// ─── SubSentinel Real-Time AWS API Client ──────────────────────
// REAL DATA ONLY — No mock data. All data flows through AWS:
//
//  📧 Gmail API → SES → Textract → Bedrock → DynamoDB
//  📸 Screenshot → S3 → Rekognition → Bedrock Vision → DynamoDB
//  📅 Google Calendar → Bedrock → DynamoDB
//  🔍 OpenSearch (vector k-NN for negotiation)
//
// Dashboard shows EMPTY STATE until user provides real data via:
//   1. Gmail OAuth (auto-detects subscription receipts)
//   2. Screenshot upload (dark pattern detection)

import type {
    ApiResponse,
    Subscription,
    DarkPatternReport,
    DetectedPattern,
    NegotiationDraft,
    CalendarInsight,
    FinancialScore,
    AgentActivity,
    TOONMetrics,
} from '@/types';

// ─── Configuration ────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1';

// ─── Data Source Tracking ─────────────────────────────────────
export type DataSource = 'aws' | 'cached' | 'empty';

export interface HybridResponse<T> extends ApiResponse<T> {
    source: DataSource;
    latencyMs: number;
    awsServices: string[];
    timestamp: string;
}

export interface UploadAnalysisResult {
    reportId: string;
    provider: string;
    hostilityScore: number;
    patterns: DetectedPattern[];
    bypassGuide: string[];
    toonTokensSaved: number;
    awsServices: string[];
    timestamp?: string;
    message?: string;
}

// Track which services are reachable
const serviceStatus: Record<string, { available: boolean; lastCheck: number }> = {};

function normalizeDetectedPattern(pattern: any): DetectedPattern {
    return {
        patternType: String(pattern?.patternType || pattern?.type || 'UNKNOWN'),
        description: String(pattern?.description || pattern?.evidence || 'Dark pattern detected'),
        confidence: typeof pattern?.confidence === 'number' ? pattern.confidence : 0,
        severity: typeof pattern?.severity === 'number' ? pattern.severity : 0,
        evidence: pattern?.evidence ? String(pattern.evidence) : undefined,
        provider: pattern?.provider ? String(pattern.provider) : undefined,
    };
}

function normalizeDarkPatternReport(report: any): DarkPatternReport {
    return {
        reportId: String(report?.reportId || report?.report_id || ''),
        userId: String(report?.userId || report?.user_id || ''),
        provider: String(report?.provider || report?.service_name || 'Unknown'),
        screenshotKey: report?.screenshotKey || report?.screenshot_key || undefined,
        patterns: Array.isArray(report?.patterns)
            ? report.patterns.map(normalizeDetectedPattern)
            : [],
        hostilityScore: typeof report?.hostilityScore === 'number'
            ? report.hostilityScore
            : typeof report?.hostility_score === 'number'
                ? report.hostility_score
                : 0,
        confidence: typeof report?.confidence === 'number' ? report.confidence : undefined,
        bypassGuide: Array.isArray(report?.bypassGuide)
            ? report.bypassGuide.map((step: unknown) => String(step))
            : Array.isArray(report?.bypass_steps)
                ? report.bypass_steps.map((step: unknown) => String(step))
                : [],
        analyzedAt: String(report?.analyzedAt || report?.analyzed_at || new Date().toISOString()),
    };
}

function normalizeNegotiationDraft(draft: any): NegotiationDraft {
    const successRate = typeof draft?.successPrediction === 'number'
        ? Math.round(draft.successPrediction * 100)
        : typeof draft?.success_prediction === 'number'
            ? Math.round(draft.success_prediction * 100)
            : typeof draft?.successRate === 'number'
                ? draft.successRate
                : typeof draft?.success_rate === 'number'
                    ? draft.success_rate
                    : 0;

    return {
        draftId: String(draft?.draftId || draft?.draft_id || draft?.id || ''),
        userId: draft?.userId || draft?.user_id || undefined,
        subscriptionId: draft?.subscriptionId || draft?.subscription_id || undefined,
        provider: String(draft?.provider || draft?.service_name || 'Unknown'),
        strategy: String(draft?.strategy || 'Negotiation Strategy'),
        emailDraft: String(draft?.emailDraft || draft?.email_draft || ''),
        successPrediction: successRate / 100,
        successRate,
        leverage: Array.isArray(draft?.leverage) ? draft.leverage.map((item: unknown) => String(item)) : [],
        status: draft?.status || 'ready',
        estimatedSaving: typeof draft?.estimatedSaving === 'number'
            ? draft.estimatedSaving
            : typeof draft?.estimated_saving === 'number'
                ? draft.estimated_saving
                : undefined,
        generatedAt: String(draft?.generatedAt || draft?.generated_at || new Date().toISOString()),
    };
}

// ─── SubSentinel Real API ───────────────────────────────────
class SubSentinelAPI {
    private token: string | null = null;
    private backendAvailable: boolean | null = null;
    private lastHealthCheck = 0;
    private healthCheckInterval = 8000;

    setToken(token: string) {
        this.token = token;
    }

    // ─── Health Check ─────────────────────────────────────────
    async checkBackendHealth(): Promise<boolean> {
        const now = Date.now();
        if (now - this.lastHealthCheck < this.healthCheckInterval && this.backendAvailable !== null) {
            return this.backendAvailable;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(`${API_BASE.replace('/v1', '')}/health`, {
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            this.backendAvailable = response.ok;
            this.lastHealthCheck = now;
            serviceStatus['go-backend'] = { available: response.ok, lastCheck: now };
            return response.ok;
        } catch {
            this.backendAvailable = false;
            this.lastHealthCheck = now;
            serviceStatus['go-backend'] = { available: false, lastCheck: now };
            return false;
        }
    }

    getBackendStatus(): boolean | null {
        return this.backendAvailable;
    }

    // ─── Core Request (Real AWS Only — Empty on Failure) ──────
    private async realRequest<T>(
        endpoint: string,
        awsServices: string[],
        options?: RequestInit,
    ): Promise<HybridResponse<T>> {
        const startTime = Date.now();

        try {
            const isHealthy = await this.checkBackendHealth();

            if (isHealthy) {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'X-Request-TOON': 'true',
                };
                if (this.token) {
                    headers['Authorization'] = `Bearer ${this.token}`;
                }

                // Longer timeout for heavy Bedrock Vision / multimodal endpoints
                const isHeavyEndpoint = endpoint.includes('/analyze') || endpoint.includes('/scan');
                const timeoutMs = isHeavyEndpoint ? 120000 : 15000;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

                const response = await fetch(`${API_BASE}${endpoint}`, {
                    ...options,
                    headers: { ...headers, ...options?.headers },
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                awsServices.forEach(svc => {
                    serviceStatus[svc] = { available: true, lastCheck: Date.now() };
                });

                return {
                    success: true,
                    data: data as T,
                    source: 'aws',
                    latencyMs: Date.now() - startTime,
                    toonEncoded: response.headers.get('X-Toon-Encoded') === 'true',
                    tokensSaved: parseInt(response.headers.get('X-Tokens-Saved') || '0'),
                    awsServices,
                    timestamp: new Date().toISOString(),
                };
            }
        } catch (err) {
            console.warn(`[SubSentinel] AWS call failed for ${endpoint}:`, err);
            awsServices.forEach(svc => {
                serviceStatus[svc] = { available: false, lastCheck: Date.now() };
            });
        }

        // Return empty — no mock fallback
        return {
            success: true,
            data: undefined,
            source: 'empty',
            latencyMs: Date.now() - startTime,
            toonEncoded: false,
            tokensSaved: 0,
            awsServices,
            timestamp: new Date().toISOString(),
        };
    }

    // ═══════════════════════════════════════════════════════════
    // PUBLIC API ENDPOINTS — All backed by real AWS services
    // ═══════════════════════════════════════════════════════════

    // ─── Subscriptions (Gmail → SES → Textract → Bedrock → DynamoDB) ─
    async getSubscriptions(): Promise<HybridResponse<Subscription[]>> {
        const result = await this.realRequest<{ subscriptions: Subscription[] }>(
            '/subscriptions',
            ['DynamoDB', 'SES', 'Textract', 'Bedrock'],
        );
        return {
            ...result,
            data: result.data?.subscriptions ?? ([] as Subscription[]),
        } as HybridResponse<Subscription[]>;
    }

    async createSubscription(sub: Partial<Subscription>): Promise<HybridResponse<Subscription>> {
        return this.realRequest<Subscription>(
            '/subscriptions',
            ['DynamoDB'],
            { method: 'POST', body: JSON.stringify(sub) },
        );
    }

    // ─── Gmail Scan (triggers real Gmail → Textract → Bedrock pipeline) ─
    async scanGmailReceipts(): Promise<HybridResponse<{ scanned: number; newSubscriptions: string[]; message: string }>> {
        return this.realRequest(
            '/subscriptions/scan',
            ['Gmail API', 'SES', 'Textract', 'Bedrock', 'DynamoDB'],
            { method: 'POST' },
        );
    }

    // ─── Screenshot Upload (S3 → Rekognition → Bedrock Vision) ──
    async uploadScreenshot(
        imageBase64: string,
        fileName: string,
        provider?: string,
    ): Promise<HybridResponse<UploadAnalysisResult>> {
        const result = await this.realRequest<any>(
            '/dark-patterns/analyze',
            ['S3', 'Rekognition', 'Bedrock', 'DynamoDB'],
            {
                method: 'POST',
                body: JSON.stringify({
                    image: imageBase64,
                    fileName,
                    provider: provider || 'unknown',
                }),
            },
        );

        return {
            ...result,
            data: result.data ? {
                reportId: String(result.data.reportId || ''),
                provider: String(result.data.provider || 'Unknown'),
                hostilityScore: typeof result.data.hostilityScore === 'number' ? result.data.hostilityScore : 0,
                patterns: Array.isArray(result.data.patterns)
                    ? result.data.patterns.map(normalizeDetectedPattern)
                    : [],
                bypassGuide: Array.isArray(result.data.bypassGuide)
                    ? result.data.bypassGuide.map((step: unknown) => String(step))
                    : [],
                toonTokensSaved: typeof result.data.toonTokensSaved === 'number' ? result.data.toonTokensSaved : 0,
                awsServices: Array.isArray(result.data.awsServices)
                    ? result.data.awsServices.map((svc: unknown) => String(svc))
                    : [],
                timestamp: result.data.timestamp ? String(result.data.timestamp) : undefined,
                message: result.data.message ? String(result.data.message) : undefined,
            } : undefined,
        } as HybridResponse<UploadAnalysisResult>;
    }

    // ─── Dark Patterns (Rekognition + Bedrock Vision) ─────────
    async getDarkPatterns(): Promise<HybridResponse<DarkPatternReport[]>> {
        const result = await this.realRequest<{ reports: DarkPatternReport[] }>(
            '/dark-patterns',
            ['Rekognition', 'Bedrock', 'DynamoDB'],
        );
        return {
            ...result,
            data: Array.isArray(result.data?.reports)
                ? result.data.reports.map(normalizeDarkPatternReport)
                : ([] as DarkPatternReport[]),
        } as HybridResponse<DarkPatternReport[]>;
    }

    // ─── Negotiations (OpenSearch k-NN + Bedrock) ──────────────
    async getDrafts(): Promise<HybridResponse<NegotiationDraft[]>> {
        const result = await this.realRequest<{ drafts: NegotiationDraft[] }>(
            '/negotiate/drafts',
            ['OpenSearch', 'Bedrock', 'DynamoDB'],
        );
        return {
            ...result,
            data: Array.isArray(result.data?.drafts)
                ? result.data.drafts.map(normalizeNegotiationDraft)
                : ([] as NegotiationDraft[]),
        } as HybridResponse<NegotiationDraft[]>;
    }

    async generateDraft(subscriptionId: string): Promise<HybridResponse<NegotiationDraft>> {
        return this.realRequest<NegotiationDraft>(
            '/negotiate',
            ['OpenSearch', 'Bedrock', 'DynamoDB'],
            { method: 'POST', body: JSON.stringify({ subscriptionId }) },
        );
    }

    // ─── Calendar (Google Calendar → Bedrock) ─────────────────
    async getCalendarInsights(): Promise<HybridResponse<CalendarInsight[]>> {
        const result = await this.realRequest<{ insights: CalendarInsight[] }>(
            '/calendar/insights',
            ['Google Calendar API', 'Bedrock', 'DynamoDB'],
        );
        return {
            ...result,
            data: result.data?.insights ?? ([] as CalendarInsight[]),
        } as HybridResponse<CalendarInsight[]>;
    }

    // ─── Financial Score (Comprehend + OpenSearch) ─────────────
    async getFinancialScore(): Promise<HybridResponse<FinancialScore>> {
        return this.realRequest<FinancialScore>(
            '/learning/stats',
            ['Comprehend', 'OpenSearch', 'DynamoDB'],
        );
    }

    // ─── Agent Activity (CloudWatch + Lambda) ─────────────────
    async getAgentActivity(): Promise<HybridResponse<AgentActivity[]>> {
        const result = await this.realRequest<{ activities: AgentActivity[] }>(
            '/agents/activity',
            ['Lambda', 'CloudWatch', 'Step Functions'],
        );
        return {
            ...result,
            data: result.data?.activities ?? ([] as AgentActivity[]),
        } as HybridResponse<AgentActivity[]>;
    }

    // ─── TOON Metrics (CloudWatch + Bedrock) ──────────────────
    async getTOONMetrics(): Promise<HybridResponse<TOONMetrics>> {
        return this.realRequest<TOONMetrics>(
            '/metrics/toon',
            ['CloudWatch', 'Bedrock'],
        );
    }

    // ─── Service Status ───────────────────────────────────────
    getServiceStatus(): Record<string, { available: boolean; lastCheck: number }> {
        return { ...serviceStatus };
    }
}

export const api = new SubSentinelAPI();
export default api;
