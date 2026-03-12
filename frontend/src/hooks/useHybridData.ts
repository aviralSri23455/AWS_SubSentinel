// ─── useHybridData Hook ────────────────────────────────────────
// Provides real-time data fetching from AWS services.
// Dashboard shows empty state until real data arrives via:
//   • Gmail OAuth (subscription receipts auto-detected)
//   • Screenshot upload (dark pattern detection)

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, type DataSource, type HybridResponse, type UploadAnalysisResult } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────
export interface HybridDataState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    source: DataSource;
    latencyMs: number;
    toonEncoded: boolean;
    tokensSaved: number;
    awsServices: string[];
    lastUpdated: Date | null;
    refetch: () => Promise<void>;
}

export interface SystemStatus {
    backendConnected: boolean;
    dataMode: string;
    activeServices: string[];
    totalTokensSaved: number;
    requestCount: number;
    avgLatencyMs: number;
}

export interface UploadState {
    uploading: boolean;
    result: UploadAnalysisResult | null;
    error: string | null;
    progress: number;
}

// ─── Main Hook: Fetch data with auto-refresh ─────────────────
export function useHybridData<T>(
    fetchFn: () => Promise<HybridResponse<T>>,
    refreshIntervalMs = 0,
    skipInitialFetch = false,
): HybridDataState<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(!skipInitialFetch);
    const [error, setError] = useState<string | null>(null);
    const [source, setSource] = useState<DataSource>('empty');
    const [latencyMs, setLatencyMs] = useState(0);
    const [toonEncoded, setToonEncoded] = useState(false);
    const [tokensSaved, setTokensSaved] = useState(0);
    const [awsServices, setAwsServices] = useState<string[]>([]);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const mountedRef = useRef(true);
    const isFetchingRef = useRef(false);

    const fetchData = useCallback(async () => {
        // Skip if already fetching (prevents concurrent duplicate calls)
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        
        try {
            setLoading(true);
            const response = await fetchFn();

            if (!mountedRef.current) return;

            if (response.success) {
                setData(response.data ?? null);
                setSource(response.source);
                setLatencyMs(response.latencyMs);
                setToonEncoded(response.toonEncoded || false);
                setTokensSaved(response.tokensSaved || 0);
                setAwsServices(response.awsServices);
                setLastUpdated(new Date());
                setError(null);
            } else {
                setError(response.error || 'Unknown error');
            }
        } catch (err) {
            // Silently ignore AbortError — these happen during unmount/navigation
            if (err instanceof Error && err.name === 'AbortError') {
                return;
            }
            if (mountedRef.current) {
                setError(err instanceof Error ? err.message : 'Fetch failed');
            }
        } finally {
            isFetchingRef.current = false;
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        
        // Only fetch on mount if skipInitialFetch is false
        if (!skipInitialFetch) {
            fetchData();
        }

        let interval: ReturnType<typeof setInterval> | null = null;
        if (refreshIntervalMs > 0 && !skipInitialFetch) {
            interval = setInterval(fetchData, refreshIntervalMs);
        }

        return () => {
            mountedRef.current = false;
            if (interval) clearInterval(interval);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshIntervalMs]);

    return {
        data,
        loading,
        error,
        source,
        latencyMs,
        toonEncoded,
        tokensSaved,
        awsServices,
        lastUpdated,
        refetch: fetchData,
    };
}

// ─── System Status Hook ──────────────────────────────────────
export function useSystemStatus(): SystemStatus {
    const [status, setStatus] = useState<SystemStatus>({
        backendConnected: false,
        dataMode: 'real',
        activeServices: [],
        totalTokensSaved: 0,
        requestCount: 0,
        avgLatencyMs: 0,
    });

    useEffect(() => {
        let mounted = true;

        const checkHealth = async () => {
            const connected = await api.checkBackendHealth();
            const serviceStatus = api.getServiceStatus();

            if (!mounted) return;

            const active = Object.entries(serviceStatus)
                .filter(([, s]) => s.available)
                .map(([name]) => name);

            setStatus(prev => ({
                ...prev,
                backendConnected: connected,
                activeServices: active,
                requestCount: prev.requestCount + 1,
            }));
        };

        checkHealth();
        // Poll every 8s for quicker reconnection detection
        const interval = setInterval(checkHealth, 8000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    return status;
}

// ─── Screenshot Upload Hook ────────────────────────────────────
// Handles screenshot upload → Rekognition → Bedrock pipeline
export function useScreenshotUpload() {
    const [state, setState] = useState<UploadState>({
        uploading: false,
        result: null,
        error: null,
        progress: 0,
    });

    const upload = useCallback(async (file: File, provider?: string): Promise<UploadAnalysisResult | null> => {
        setState({ uploading: true, result: null, error: null, progress: 10 });

        try {
            // Convert file to base64
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
                    resolve(result.split(',')[1]); // strip data: prefix
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            setState(prev => ({ ...prev, progress: 40 }));

            const response = await api.uploadScreenshot(base64, file.name, provider);

            setState(prev => ({ ...prev, progress: 90 }));

            if (response.success && response.data) {
                setState({ uploading: false, result: response.data, error: null, progress: 100 });
                return response.data;
            } else {
                // Check for rate limit error
                const errorMsg = response.error || 'Analysis failed — check backend connection';
                const isRateLimit = errorMsg.toLowerCase().includes('rate limit') || 
                                   errorMsg.toLowerCase().includes('throttling') ||
                                   errorMsg.toLowerCase().includes('quota');
                
                setState({
                    uploading: false,
                    result: null,
                    error: isRateLimit 
                        ? '⚠️ AWS Bedrock rate limit exceeded. Please wait 10-30 seconds before uploading another screenshot.'
                        : errorMsg,
                    progress: 0,
                });
                return null;
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Upload failed';
            setState({ uploading: false, result: null, error: msg, progress: 0 });
            return null;
        }
    }, []);

    const reset = useCallback(() => {
        setState({ uploading: false, result: null, error: null, progress: 0 });
    }, []);

    return { ...state, upload, reset };
}

// ─── Gmail Scan Hook ───────────────────────────────────────────
export function useGmailScan() {
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState<{ scanned: number; newSubscriptions: string[] } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const scan = useCallback(async () => {
        setScanning(true);
        setError(null);
        try {
            const response = await api.scanGmailReceipts();
            if (response.success && response.data) {
                setResult(response.data);
            } else {
                setError(response.error || 'Gmail scan failed');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Scan failed');
        } finally {
            setScanning(false);
        }
    }, []);

    return { scanning, result, error, scan };
}

// ─── Convenience Hooks ─────────────────────────────────────────

export function useSubscriptions(skipInitialFetch = false) {
    return useHybridData(
        useCallback(() => api.getSubscriptions(), []),
        10000,
        skipInitialFetch,
    );
}

export function useDarkPatterns(skipInitialFetch = false) {
    return useHybridData(
        useCallback(() => api.getDarkPatterns(), []),
        15000,
        skipInitialFetch,
    );
}

export function useNegotiationDrafts(skipInitialFetch = false) {
    return useHybridData(
        useCallback(() => api.getDrafts(), []),
        60000,
        skipInitialFetch,
    );
}

export function useCalendarInsights() {
    return useHybridData(
        useCallback(() => api.getCalendarInsights(), []),
        300000,
    );
}

export function useFinancialScore() {
    return useHybridData(
        useCallback(() => api.getFinancialScore(), []),
        5000,
    );
}

export function useAgentActivity() {
    return useHybridData(
        useCallback(() => api.getAgentActivity(), []),
        10000,
    );
}

export function useTOONMetrics() {
    return useHybridData(
        useCallback(() => api.getTOONMetrics(), []),
        60000,
    );
}
