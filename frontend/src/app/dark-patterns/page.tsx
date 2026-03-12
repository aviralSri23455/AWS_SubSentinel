'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useDarkPatterns } from '@/hooks/useHybridData';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';
import { getProviderColor } from '@/lib/providers';

export default function DarkPatternsPage() {
    const [isLoaded, setIsLoaded] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const { data, loading: isLoading, error, refetch } = useDarkPatterns(false); // Fetch data on initial load
    const { subscribe } = useRealtimeEvents();
    
    // Show all data immediately
    const darkPatterns = data ?? [];

    useEffect(() => {
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if (darkPatterns.length > 0 && !expanded) {
            setExpanded(darkPatterns[0].reportId);
        }
    }, [darkPatterns, expanded]);

    useEffect(() => {
        const unsubscribeScreenshot = subscribe('screenshot_complete', () => {
            refetch();
        });

        const unsubscribeDarkPattern = subscribe('dark_pattern_added', () => {
            refetch();
        });

        return () => {
            unsubscribeScreenshot();
            unsubscribeDarkPattern();
        };
    }, [refetch, subscribe]);

    const getSeverityColor = (score: number) => {
        if (score >= 7) return 'var(--color-danger)';
        if (score >= 5) return 'var(--color-warning)';
        return 'var(--color-success)';
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <main style={{ flex: 1, marginLeft: 260, display: 'flex', flexDirection: 'column' }}>
                <Header />
                <div style={{ padding: 'var(--spacing-xl)', opacity: isLoaded ? 1 : 0, transition: 'opacity 0.5s' }}>
                    {!isLoading && darkPatterns.length === 0 && (
                        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                            <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                No dark pattern reports found
                            </p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Upload screenshots of cancellation flows to detect dark patterns
                            </p>
                        </div>
                    )}

                    {isLoading && (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            <p>Loading screenshot analysis reports...</p>
                        </div>
                    )}

                    {error && !isLoading && (
                        <div className="glass-card" style={{ padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)', borderLeft: '3px solid var(--color-danger)' }}>
                            <p style={{ color: 'var(--color-danger)', fontWeight: 600 }}>⚠️ Error: {error}</p>
                            <button onClick={refetch} className="btn btn-primary" style={{ marginTop: '0.5rem', fontSize: '0.78rem' }}>
                                Retry
                            </button>
                        </div>
                    )}

                    {!isLoading && darkPatterns.length > 0 && (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-xl)' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>🛡️ Dark Pattern Defender</h2>
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                        Shared screenshot intelligence from Rekognition + Bedrock Vision
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <span className="aws-badge">AWS Rekognition</span>
                                    <span className="aws-badge">AWS Bedrock Vision</span>
                                    <button onClick={refetch} className="btn btn-primary" style={{ fontSize: '0.78rem' }}>
                                        Refresh
                                    </button>
                                </div>
                            </div>

                            {darkPatterns.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                                    {darkPatterns.map((report, index) => (
                                        <div
                                            key={report.reportId || `${report.provider}-${index}`}
                                            className="glass-card"
                                            style={{ animation: `fadeIn 0.4s ease-out ${index * 100}ms backwards`, cursor: 'pointer' }}
                                            onClick={() => setExpanded(expanded === report.reportId ? null : report.reportId)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1 }}>
                                                    <div
                                                        style={{
                                                            width: 12,
                                                            height: 12,
                                                            borderRadius: '50%',
                                                            background: getProviderColor(report.provider),
                                                            boxShadow: `0 0 12px ${getProviderColor(report.provider)}40`,
                                                        }}
                                                    />
                                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{report.provider}</h3>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: getSeverityColor(report.hostilityScore) }}>
                                                            {report.hostilityScore.toFixed(1)}
                                                        </div>
                                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hostility</div>
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--color-primary-light)' }}>
                                                            {((report.confidence || 0) * 100).toFixed(0)}%
                                                        </div>
                                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Confidence</div>
                                                    </div>
                                                    <span style={{ fontSize: '1.2rem', transition: 'transform 0.2s', transform: expanded === report.reportId ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                                                </div>
                                            </div>

                                            {expanded === report.reportId && (
                                                <div style={{ marginTop: 'var(--spacing-lg)', paddingTop: 'var(--spacing-lg)', borderTop: '1px solid var(--border-color)', animation: 'fadeIn 0.3s ease-out' }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-xl)' }}>
                                                        <div>
                                                            <h4 style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 'var(--spacing-md)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                Detected Patterns
                                                            </h4>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                {report.patterns.map((pattern, patternIndex) => (
                                                                    <div
                                                                        key={`${report.reportId}-${pattern.patternType}-${patternIndex}`}
                                                                        style={{
                                                                            padding: '0.6rem 0.75rem',
                                                                            background: 'var(--bg-glass)',
                                                                            border: '1px solid var(--border-color)',
                                                                            borderRadius: 'var(--radius-md)',
                                                                        }}
                                                                    >
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                                                                            <span style={{ fontSize: '0.68rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: getSeverityColor(pattern.severity) }}>
                                                                                {pattern.patternType}
                                                                            </span>
                                                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: getSeverityColor(pattern.severity) }}>
                                                                                {pattern.severity.toFixed(1)}
                                                                            </span>
                                                                        </div>
                                                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                                                                            {pattern.description}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h4 style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 'var(--spacing-md)', color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                Bypass Guide
                                                            </h4>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                                {report.bypassGuide.map((step, stepIndex) => (
                                                                    <div
                                                                        key={`${report.reportId}-step-${stepIndex}`}
                                                                        style={{
                                                                            display: 'flex',
                                                                            gap: '0.6rem',
                                                                            padding: '0.5rem 0.65rem',
                                                                            background: 'rgba(16, 185, 129, 0.04)',
                                                                            border: '1px solid rgba(16, 185, 129, 0.08)',
                                                                            borderRadius: 'var(--radius-md)',
                                                                        }}
                                                                    >
                                                                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-success)', fontFamily: 'var(--font-mono)', minWidth: 18 }}>
                                                                            {stepIndex + 1}.
                                                                        </span>
                                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{step}</span>
                                                                    </div>
                                                                ))}
                                                                {report.bypassGuide.length === 0 && (
                                                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                                                                        No bypass steps were generated for this report.
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
