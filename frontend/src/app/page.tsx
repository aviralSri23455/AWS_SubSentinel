'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import FinancialFreedomScore from '@/components/dashboard/FinancialFreedomScore';
import SubscriptionMap from '@/components/dashboard/SubscriptionMap';
import AgentActivityFeed from '@/components/dashboard/AgentActivityFeed';
import DarkPatternLeaderboard from '@/components/dashboard/DarkPatternLeaderboard';
import PatternSummary from '@/components/dashboard/PatternSummary';
import PipelineProgress from '@/components/dashboard/PipelineProgress';
import {
    useSystemStatus,
    useSubscriptions,
    useFinancialScore,
    useDarkPatterns,
    useScreenshotUpload,
    useGmailScan,
} from '@/hooks/useHybridData';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';
import styles from './page.module.css';

interface AgentDashboardInfo {
    name: string;
    icon: string;
    service: string;
    serviceColor: string;
    status: 'active' | 'idle' | 'processing' | 'error';
    color: string;
}

export default function DashboardPage() {
    const [isLoaded, setIsLoaded] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState('');
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
    const [hasUploadedInSession, setHasUploadedInSession] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const systemStatus = useSystemStatus();
    const subscriptions = useSubscriptions(false);
    const financialScore = useFinancialScore();
    const darkPatterns = useDarkPatterns(false);
    const { uploading, result: uploadResult, error: uploadError, progress, upload, reset: resetUpload } = useScreenshotUpload();
    const { scanning, result: scanResult, error: scanError, scan: scanGmail } = useGmailScan();
    const { subscribe: subscribeToEvents } = useRealtimeEvents();
    const [lastUpdate, setLastUpdate] = useState(new Date());

    const [dashboardAgents, setDashboardAgents] = useState<AgentDashboardInfo[]>([
        { name: 'Auditor',    icon: '📧', service: 'SES',         serviceColor: '#3b82f6', status: 'idle', color: '#3b82f6' },
        { name: 'Calendar',   icon: '📅', service: 'Bedrock',     serviceColor: '#f59e0b', status: 'idle', color: '#f59e0b' },
        { name: 'Negotiator', icon: '💬', service: 'OpenSearch',  serviceColor: '#10b981', status: 'idle', color: '#10b981' },
        { name: 'Defender',   icon: '🛡️', service: 'Rekognition', serviceColor: '#ef4444', status: 'idle', color: '#ef4444' },
        { name: 'Learner',    icon: '🧠', service: 'Comprehend',  serviceColor: '#8b5cf6', status: 'idle', color: '#8b5cf6' },
    ]);

    const agentTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const activateDashAgent = useCallback((name: string, duration = 5000) => {
        if (agentTimersRef.current[name]) clearTimeout(agentTimersRef.current[name]);
        setDashboardAgents((prev) => prev.map((a) =>
            a.name === name ? { ...a, status: 'active' as const } : a,
        ));
        agentTimersRef.current[name] = setTimeout(() => {
            setDashboardAgents((prev) => prev.map((a) =>
                a.name === name ? { ...a, status: 'idle' as const } : a,
            ));
        }, duration);
    }, []);

    const processDashAgent = useCallback((name: string) => {
        if (agentTimersRef.current[name]) clearTimeout(agentTimersRef.current[name]);
        setDashboardAgents((prev) => prev.map((a) =>
            a.name === name ? { ...a, status: 'processing' as const } : a,
        ));
    }, []);

    useEffect(() => { setIsLoaded(true); }, []);

    const prevBackendConnected = useRef<boolean | null>(null);
    useEffect(() => {
        const wasConnected = prevBackendConnected.current;
        const isConnected  = systemStatus.backendConnected;
        prevBackendConnected.current = isConnected;
        if (isConnected && wasConnected !== true) {
            activateDashAgent('Auditor',    4000);
            activateDashAgent('Defender',   5000);
            activateDashAgent('Learner',    3500);
            setTimeout(() => activateDashAgent('Calendar',   3000), 600);
            setTimeout(() => activateDashAgent('Negotiator', 3000), 1200);
        }
    }, [systemStatus.backendConnected, activateDashAgent]);

    const prevSubsLen = useRef(0);
    useEffect(() => {
        const subs = subscriptions.data || [];
        if (subs.length > 0 && subs.length !== prevSubsLen.current) {
            prevSubsLen.current = subs.length;
            activateDashAgent('Auditor', 4000);
            setTimeout(() => activateDashAgent('Negotiator', 3000), 500);
        }
    }, [subscriptions.data, activateDashAgent]);

    const subsData   = subscriptions.data || [];
    const hasRealData = subsData.length > 0;

    useEffect(() => {
        if (subscriptions.lastUpdated) setLastUpdate(subscriptions.lastUpdated);
    }, [subscriptions.lastUpdated]);

    useEffect(() => {
        const u1 = subscribeToEvents('screenshot_complete', () => {
            setHasUploadedInSession(true);
            subscriptions.refetch(); financialScore.refetch(); darkPatterns.refetch();
            setLastUpdate(new Date());
            activateDashAgent('Defender', 5000);
            setTimeout(() => activateDashAgent('Learner', 3000), 500);
        });
        const u2 = subscribeToEvents('screenshot_analyzing', () => processDashAgent('Defender'));
        const u3 = subscribeToEvents('subscription_added',   () => {
            setHasUploadedInSession(true);
            subscriptions.refetch(); financialScore.refetch();
            setLastUpdate(new Date()); activateDashAgent('Auditor', 5000);
        });
        const u4 = subscribeToEvents('dark_pattern_added',   () => {
            setHasUploadedInSession(true);
            darkPatterns.refetch(); setLastUpdate(new Date());
            activateDashAgent('Defender', 4000); activateDashAgent('Learner', 3000);
        });
        const u5 = subscribeToEvents('pipeline_progress', (data) => {
            if (data?.stage === 'rekognition') processDashAgent('Defender');
            if (data?.stage === 'bedrock')     processDashAgent('Calendar');
            if (data?.stage === 'comprehend')  processDashAgent('Learner');
            if (data?.stage === 'opensearch')  processDashAgent('Negotiator');
            if (data.status === 'success' && data.stage === 'complete') {
                setHasUploadedInSession(true);
                subscriptions.refetch(); financialScore.refetch(); darkPatterns.refetch();
                setLastUpdate(new Date());
                activateDashAgent('Defender', 4000); activateDashAgent('Learner', 3000);
            }
        });
        const u6 = subscribeToEvents('gmail_scan_started',  () => processDashAgent('Auditor'));
        const u7 = subscribeToEvents('gmail_scan_complete',  () => {
            activateDashAgent('Auditor', 5000);
            setTimeout(() => activateDashAgent('Calendar', 3000), 800);
        });
        return () => {
            u1(); u2(); u3(); u4(); u5(); u6(); u7();
            Object.values(agentTimersRef.current).forEach(clearTimeout);
        };
    }, [subscribeToEvents, subscriptions, financialScore, darkPatterns, activateDashAgent, processDashAgent]);

    useEffect(() => {
        if (uploadResult) {
            setHasUploadedInSession(true);
            setUploadSuccess(`✅ ${uploadResult.provider || 'Screenshot'} analyzed · Hostility ${uploadResult.hostilityScore.toFixed(1)}/10 · ${uploadResult.patterns.length} dark patterns found`);
            subscriptions.refetch(); financialScore.refetch(); darkPatterns.refetch();
            setShowUploadModal(false); resetUpload();
            setTimeout(() => { window.dispatchEvent(new CustomEvent('subsentinel:refresh')); setUploadSuccess(null); }, 5000);
        }
    }, [uploadResult, subscriptions, financialScore, darkPatterns, resetUpload]);

    useEffect(() => {
        if (scanResult) {
            setHasUploadedInSession(true);
            setUploadSuccess(`✅ Gmail scanned · ${scanResult.scanned} receipts · ${scanResult.newSubscriptions.length} new subscriptions`);
            subscriptions.refetch();
            setTimeout(() => setUploadSuccess(null), 5000);
        }
    }, [scanResult, subscriptions]);

    const timeAgo = useCallback((date: Date) => {
        const s = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (s < 5) return 'just now';
        if (s < 60) return `${s}s ago`;
        return `${Math.floor(s / 60)}m ago`;
    }, []);

    const handleFileSelect = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) { alert('Please upload an image file (PNG, JPG, WebP)'); return; }
        await upload(file, selectedProvider || undefined);
    }, [upload, selectedProvider]);

    const handleDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault(); setDragOver(false);
        const file = event.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    }, [handleFileSelect]);

    const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) handleFileSelect(file);
    }, [handleFileSelect]);

    const activeCount = dashboardAgents.filter((a) => a.status === 'active' || a.status === 'processing').length;

    // Derived KPI stats
    const totalSpend = subsData.reduce((sum, s: any) => sum + (s.amount || 0), 0);
    const patternCount = darkPatterns.data?.length ?? 0;
    const score = financialScore.data?.score ?? 0;

    return (
        <div className={styles.layout}>
            <Sidebar />
            <main className={styles.main}>
                <Header />
                <div className={`${styles.dashboard} ${isLoaded ? styles.loaded : ''}`}>

                    {/* Background accents */}
                    <div className={styles.dashboardEnhancements}>
                        <div className={styles.glowOrb} />
                        <div className={styles.glowOrb2} />
                        <div className={styles.gridPattern} />
                    </div>

                    {/* Banners */}
                    {uploadSuccess && (
                        <div className={styles.successBanner}>
                            <span>{uploadSuccess}</span>
                            <button onClick={() => setUploadSuccess(null)}>×</button>
                        </div>
                    )}

                    {!systemStatus.backendConnected && (
                        <div className={styles.connectionAlert}>
                            <span className={styles.alertIcon}>⚠️</span>
                            <span className={styles.alertText}>
                                <strong>Backend Not Running.</strong> Start it with{' '}
                                <code>go run cmd/server/main.go</code> to enable real AWS data.
                            </span>
                            <button className={styles.alertDismiss} onClick={() => {}}>×</button>
                        </div>
                    )}

                    {/* KPI Row */}
                    <div className={styles.kpiRow}>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiIcon}>📋</div>
                            <div className={styles.kpiValue}>{subsData.length}</div>
                            <div className={styles.kpiLabel}>Active Subscriptions</div>
                            <div className={`${styles.kpiTrend} ${styles.kpiTrendUp}`}>▲ Tracked in real-time</div>
                        </div>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiIcon}>💰</div>
                            <div className={styles.kpiValue}>${totalSpend.toFixed(0)}</div>
                            <div className={styles.kpiLabel}>Monthly Spend</div>
                            <div className={`${styles.kpiTrend} ${totalSpend > 0 ? styles.kpiTrendDown : styles.kpiTrendUp}`}>
                                {totalSpend > 0 ? '▼ Optimizable' : '— Awaiting data'}
                            </div>
                        </div>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiIcon}>🛡️</div>
                            <div className={styles.kpiValue}>{patternCount}</div>
                            <div className={styles.kpiLabel}>Dark Patterns Found</div>
                            <div className={`${styles.kpiTrend} ${patternCount > 0 ? styles.kpiTrendDown : styles.kpiTrendUp}`}>
                                {patternCount > 0 ? '▼ Flagged by Rekognition' : '✓ None detected'}
                            </div>
                        </div>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiIcon}>⚡</div>
                            <div className={styles.kpiValue}>{score}</div>
                            <div className={styles.kpiLabel}>Protection Score</div>
                            <div className={`${styles.kpiTrend} ${score >= 60 ? styles.kpiTrendUp : styles.kpiTrendDown}`}>
                                {score >= 80 ? '▲ Well Protected' : score >= 60 ? '▲ Protected' : '▼ Needs Attention'}
                            </div>
                        </div>
                    </div>

                    {/* Live Banner + Action Bar */}
                    <div className={styles.liveBanner}>
                        <div className={styles.liveLeft}>
                            <span className={systemStatus.backendConnected ? styles.liveDot : styles.liveDotOff} />
                            <span className={styles.liveText}>
                                {systemStatus.backendConnected ? 'Connected to AWS' : 'Backend Offline'}
                            </span>
                            <span className={styles.liveService}>
                                {systemStatus.backendConnected
                                    ? `${systemStatus.activeServices.length} services active`
                                    : 'Start backend for real-time data'}
                            </span>
                        </div>
                        <div className={styles.liveRight}>
                            <span className={styles.liveTimestamp}>Updated {timeAgo(lastUpdate)}</span>
                        </div>
                    </div>

                    <div className={styles.actionBar}>
                        <div className={styles.actionBarLeft}>
                            <div className={styles.actionBarTitle}>
                                {hasRealData
                                    ? `${subsData.length} subscription${subsData.length !== 1 ? 's' : ''} tracked`
                                    : 'No subscriptions found'}
                            </div>
                            <div className={styles.actionBarSub}>
                                {hasRealData
                                    ? 'Upload more screenshots or scan Gmail to expand detection'
                                    : 'Upload a screenshot or scan Gmail to start tracking'}
                            </div>
                        </div>
                        <div className={styles.actionBarRight}>
                            <button
                                id="scan-gmail-btn"
                                className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
                                onClick={scanGmail}
                                disabled={scanning || !systemStatus.backendConnected}
                                title={systemStatus.backendConnected ? 'Scan Gmail receipts' : 'Start backend first'}
                            >
                                {scanning ? <><span className={styles.spinner} />Scanning...</> : <>📧 Scan Gmail</>}
                            </button>
                            <button
                                id="upload-screenshot-btn"
                                className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                                onClick={() => setShowUploadModal(true)}
                                disabled={!systemStatus.backendConnected}
                                title={systemStatus.backendConnected ? 'Upload screenshot for dark pattern detection' : 'Start backend first'}
                            >
                                📸 Upload Screenshot
                            </button>
                        </div>
                    </div>

                    {scanError && (
                        <div className={styles.errorBanner}>
                            <span>⚠️ Gmail scan error: {scanError}</span>
                        </div>
                    )}

                    {/* Main Content Grid */}
                    <div className={styles.contentGrid}>

                        {/* AWS Agents — full width */}
                        <div className={styles.agentsCard}>
                            <div className={`glass-card ${styles.agentsContainer}`}>
                                <div className={styles.agentsHeader}>
                                    <div className={styles.agentsTitleGroup}>
                                        <div className={styles.agentsTitle}>
                                            <span className={styles.agentsTitleIcon}>🤖</span>
                                            AWS Intelligence Agents
                                            {activeCount > 0 && (
                                                <span style={{
                                                    fontSize: '0.62rem', fontWeight: 800,
                                                    color: '#10b981',
                                                    background: 'rgba(16,185,129,0.12)',
                                                    border: '1px solid rgba(16,185,129,0.25)',
                                                    padding: '0.12rem 0.6rem', borderRadius: '999px',
                                                    marginLeft: '0.5rem', letterSpacing: '0.04em',
                                                    textTransform: 'uppercase' as const,
                                                }}>
                                                    {activeCount} active
                                                </span>
                                            )}
                                        </div>
                                        <span className={styles.agentsSubtitle}>Real-time processing status · Powered by AWS</span>
                                    </div>
                                </div>

                                <div className={styles.agentsGrid}>
                                    {dashboardAgents.map((agent) => {
                                        const isActive     = agent.status === 'active';
                                        const isProcessing = agent.status === 'processing';
                                        const isWorking    = isActive || isProcessing;
                                        return (
                                            <div
                                                key={agent.name}
                                                className={`${styles.agentCard} ${isActive ? styles.agentCardActive : ''} ${isProcessing ? styles.agentCardProcessing : ''}`}
                                            >
                                                <div className={styles.agentCardDotWrap}>
                                                    <span
                                                        className={`${styles.agentCardDot} ${isActive ? styles.agentCardDotActive : ''} ${isProcessing ? styles.agentCardDotProcessing : ''}`}
                                                        style={{
                                                            backgroundColor: isActive    ? '#10b981'
                                                                : isProcessing ? '#f59e0b'
                                                                : 'rgba(100,116,139,0.35)',
                                                        }}
                                                    />
                                                    {isWorking && (
                                                        <span
                                                            className={styles.agentCardRing}
                                                            style={{ borderColor: isActive ? '#10b981' : '#f59e0b' }}
                                                        />
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '1.5rem' }}>{agent.icon}</div>
                                                <span className={styles.agentCardName}>{agent.name}</span>
                                                <span className={styles.agentCardService}>
                                                    <span
                                                        className={styles.agentServiceDot}
                                                        style={{ background: agent.serviceColor }}
                                                    />
                                                    {agent.service}
                                                </span>
                                                <span
                                                    className={`${styles.agentCardStatus} ${isActive ? styles.agentCardStatusActive : ''} ${isProcessing ? styles.agentCardStatusProcessing : ''}`}
                                                    style={{
                                                        color: isActive    ? '#10b981'
                                                            : isProcessing ? '#f59e0b'
                                                            : 'var(--text-muted)',
                                                    }}
                                                >
                                                    {isActive ? '● Active' : isProcessing ? '◉ Processing' : '○ Idle'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className={styles.scoreCard}>
                            <FinancialFreedomScore />
                        </div>
                        <div className={styles.mapCard}>
                            <SubscriptionMap />
                        </div>
                        <div className={styles.patternSummaryCard}>
                            <PatternSummary />
                        </div>
                        <div className={styles.darkPatternFullCard}>
                            <DarkPatternLeaderboard onUploadClick={() => setShowUploadModal(true)} />
                        </div>
                        <div className={styles.feedFullCard}>
                            <AgentActivityFeed />
                        </div>
                    </div>
                </div>
            </main>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className={styles.modalOverlay} onClick={() => { if (!uploading) { setShowUploadModal(false); resetUpload(); } }}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h3 className={styles.modalTitle}>📸 Dark Pattern Analysis</h3>
                                <p className={styles.modalSubtitle}>Upload a cancellation or subscription page screenshot</p>
                            </div>
                            {!uploading && (
                                <button className={styles.modalClose} onClick={() => { setShowUploadModal(false); resetUpload(); }}>×</button>
                            )}
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.pipelineInfo}>
                                <span className={styles.pipelineStep}><span>📁</span>Upload</span>
                                <span className={styles.pipelineArrow}>→</span>
                                <span className={styles.pipelineStep}><span>☁</span>S3</span>
                                <span className={styles.pipelineArrow}>→</span>
                                <span className={styles.pipelineStep}><span>👁</span>Rekognition</span>
                                <span className={styles.pipelineArrow}>→</span>
                                <span className={styles.pipelineStep}><span>🧠</span>Bedrock</span>
                                <span className={styles.pipelineArrow}>→</span>
                                <span className={styles.pipelineStep}><span>💾</span>DynamoDB</span>
                            </div>

                            <div className={styles.providerSelect}>
                                <label className={styles.providerLabel}>Provider (optional)</label>
                                <select
                                    className={styles.providerDropdown}
                                    value={selectedProvider}
                                    onChange={(e) => setSelectedProvider(e.target.value)}
                                    disabled={uploading}
                                >
                                    <option value="">Auto-detect from screenshot</option>
                                    <option value="Netflix">Netflix</option>
                                    <option value="Adobe">Adobe Creative Cloud</option>
                                    <option value="NYTimes">New York Times</option>
                                    <option value="Hulu">Hulu</option>
                                    <option value="Amazon">Amazon Prime</option>
                                    <option value="LinkedIn">LinkedIn Premium</option>
                                    <option value="Spotify">Spotify</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            {!uploading && !uploadError && (
                                <div
                                    className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ''}`}
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileInputChange} />
                                    <div className={styles.dropZoneIcon}>📸</div>
                                    <p className={styles.dropZoneText}>Drop screenshot here or <span className={styles.dropZoneLink}>browse files</span></p>
                                    <p className={styles.dropZoneHint}>PNG, JPG, WebP supported</p>
                                </div>
                            )}

                            {uploading && (
                                <div className={styles.uploadProgress}>
                                    <div className={styles.uploadProgressHeader}>
                                        <span className={styles.uploadProgressLabel}>
                                            {progress < 30  ? '📁 Converting image...'
                                             : progress < 50 ? '☁ Uploading to S3...'
                                             : progress < 70 ? '👁 Rekognition analyzing...'
                                             : progress < 90 ? '🧠 Bedrock detecting patterns...'
                                             : '💾 Saving to DynamoDB...'}
                                        </span>
                                        <span className={styles.uploadProgressPct}>{progress}%</span>
                                    </div>
                                    <div className={styles.uploadProgressBar}>
                                        <div className={styles.uploadProgressFill} style={{ width: `${progress}%` }} />
                                    </div>
                                    <p className={styles.uploadProgressNote}>S3 → Rekognition → Bedrock Vision → DynamoDB</p>
                                </div>
                            )}

                            {uploadError && (
                                <div className={styles.uploadError}>
                                    <span>⚠️ {uploadError}</span>
                                    <button onClick={resetUpload} className={styles.retryBtn}>Try Again</button>
                                </div>
                            )}

                            <div className={styles.uploadTips}>
                                <p className={styles.tipsTitle}>💡 What to screenshot:</p>
                                <ul className={styles.tipsList}>
                                    <li>Netflix / Spotify / Adobe cancellation page</li>
                                    <li>Subscription management screen</li>
                                    <li>Confusing renewal or billing pages</li>
                                    <li>Retention / &quot;Don&apos;t leave&quot; screens</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <PipelineProgress />
        </div>
    );
}
