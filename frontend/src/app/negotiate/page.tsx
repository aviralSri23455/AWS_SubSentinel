'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useDarkPatterns, useNegotiationDrafts } from '@/hooks/useHybridData';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';
import { getProviderColor } from '@/lib/providers';

export default function NegotiatePage() {
    const [isLoaded, setIsLoaded] = useState(false);
    const [selectedDraft, setSelectedDraft] = useState<string | null>(null);
    const {
        data: draftData,
        loading: isLoading,
        error,
        refetch: refetchDrafts,
    } = useNegotiationDrafts(false); // Fetch data on initial load
    const { data: darkPatternData, refetch: refetchDarkPatterns } = useDarkPatterns(false); // Fetch data on initial load
    const { subscribe } = useRealtimeEvents();
    const drafts = draftData ?? [];
    const darkPatterns = darkPatternData ?? [];

    useEffect(() => {
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if (drafts.length === 0) {
            setSelectedDraft(null);
            return;
        }

        const hasSelectedDraft = drafts.some((draft) => draft.draftId === selectedDraft);
        if (!hasSelectedDraft) {
            setSelectedDraft(drafts[0].draftId);
        }
    }, [drafts, selectedDraft]);

    useEffect(() => {
        const unsubscribeScreenshot = subscribe('screenshot_complete', () => {
            refetchDarkPatterns();
        });
        const unsubscribeSubscription = subscribe('subscription_added', () => {
            refetchDrafts();
        });

        return () => {
            unsubscribeScreenshot();
            unsubscribeSubscription();
        };
    }, [refetchDarkPatterns, refetchDrafts, subscribe]);

    const selected = selectedDraft ? drafts.find((draft) => draft.draftId === selectedDraft) : null;
    const latestScreenshotReports = darkPatterns.slice(0, 3);

    const statusStyles: Record<string, { bg: string; color: string }> = {
        ready: { bg: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary-light)' },
        sent: { bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)' },
        won: { bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)' },
        pending: { bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)' },
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <main style={{ flex: 1, marginLeft: 260, display: 'flex', flexDirection: 'column' }}>
                <Header />
                <div style={{ padding: 'var(--spacing-xl)', opacity: isLoaded ? 1 : 0, transition: 'opacity 0.5s' }}>
                    {!isLoading && drafts.length === 0 && (
                        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                            <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                No negotiation drafts found
                            </p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Upload a screenshot of a cancellation page to detect dark patterns and generate negotiation context
                            </p>
                        </div>
                    )}

                    {isLoading && (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            <p>Loading negotiation drafts and screenshot leverage...</p>
                        </div>
                    )}

                    {error && !isLoading && (
                        <div className="glass-card" style={{ padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)', borderLeft: '3px solid var(--color-danger)' }}>
                            <p style={{ color: 'var(--color-danger)', fontWeight: 600 }}>⚠️ Error: {error}</p>
                            <button onClick={refetchDrafts} className="btn btn-primary" style={{ marginTop: '0.5rem', fontSize: '0.78rem' }}>
                                Retry
                            </button>
                        </div>
                    )}

                    {!isLoading && drafts.length > 0 && (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-xl)' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>💬 Negotiation Engine</h2>
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                        AI-generated drafts plus screenshot-derived leverage from dark pattern analysis
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <span className="aws-badge">AWS Rekognition</span>
                                    <span className="aws-badge">AWS OpenSearch k-NN</span>
                                    <span className="aws-badge">AWS Bedrock</span>
                                    <button onClick={refetchDrafts} className="btn btn-primary" style={{ fontSize: '0.78rem' }}>
                                        Refresh
                                    </button>
                                </div>
                            </div>

                            {latestScreenshotReports.length > 0 && (
                                <div className="glass-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: 'var(--spacing-md)' }}>
                                        <div>
                                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.25rem' }}>Recent Screenshot Intelligence</h3>
                                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                Uploaded screenshot analysis is now visible here as negotiation context, even before a draft exists.
                                            </p>
                                        </div>
                                        <button onClick={refetchDarkPatterns} className="btn btn-secondary" style={{ fontSize: '0.78rem' }}>
                                            Refresh Reports
                                        </button>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                                        {latestScreenshotReports.map((report) => (
                                            <div
                                                key={report.reportId}
                                                style={{
                                                    padding: '0.85rem',
                                                    background: 'var(--bg-glass)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: 'var(--radius-md)',
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: getProviderColor(report.provider) }} />
                                                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{report.provider}</span>
                                                </div>
                                                <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                                    Hostility {report.hostilityScore.toFixed(1)}/10 • {report.patterns.length} pattern{report.patterns.length !== 1 ? 's' : ''}
                                                </p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                                    {report.patterns.slice(0, 3).map((pattern, index) => (
                                                        <span
                                                            key={`${report.reportId}-${pattern.patternType}-${index}`}
                                                            style={{
                                                                padding: '0.2rem 0.5rem',
                                                                borderRadius: 'var(--radius-full)',
                                                                fontSize: '0.68rem',
                                                                background: 'rgba(245, 158, 11, 0.1)',
                                                                border: '1px solid rgba(245, 158, 11, 0.18)',
                                                                color: 'var(--color-warning)',
                                                            }}
                                                        >
                                                            {pattern.patternType}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {drafts.length === 0 && !error && (
                                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                                    <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                        No negotiation drafts available
                                    </p>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Add subscriptions to generate full drafts. Screenshot analysis now appears above as leverage context.
                                    </p>
                                </div>
                            )}

                            {drafts.length > 0 && (
                                <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 'var(--spacing-lg)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {drafts.map((draft) => (
                                            <div
                                                key={draft.draftId}
                                                className="glass-card"
                                                onClick={() => setSelectedDraft(draft.draftId)}
                                                style={{
                                                    cursor: 'pointer',
                                                    borderColor: selectedDraft === draft.draftId ? 'var(--color-primary)' : undefined,
                                                    boxShadow: selectedDraft === draft.draftId ? 'var(--shadow-glow)' : undefined,
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: getProviderColor(draft.provider) }} />
                                                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{draft.provider}</span>
                                                </div>
                                                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{draft.strategy}</p>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span
                                                        style={{
                                                            fontSize: '0.62rem',
                                                            fontWeight: 600,
                                                            padding: '0.15rem 0.5rem',
                                                            borderRadius: 'var(--radius-full)',
                                                            textTransform: 'uppercase',
                                                            ...(statusStyles[draft.status || 'ready'] || statusStyles.ready),
                                                        }}
                                                    >
                                                        {draft.status || 'ready'}
                                                    </span>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>
                                                        {draft.successRate ?? Math.round(draft.successPrediction * 100)}%
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {selected && (
                                        <div className="glass-card">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-lg)' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: getProviderColor(selected.provider) }} />
                                                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{selected.provider}</h3>
                                                    </div>
                                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{selected.strategy}</p>
                                                </div>
                                                <div style={{ display: 'flex', gap: '1.5rem' }}>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '1.75rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>
                                                            {selected.successRate ?? Math.round(selected.successPrediction * 100)}%
                                                        </div>
                                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Success Rate</div>
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '1.75rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--color-primary-light)' }}>
                                                            {selected.estimatedSaving !== undefined ? `$${selected.estimatedSaving}` : 'TBD'}
                                                        </div>
                                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Est. Saving/mo</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                                <h4 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--spacing-sm)' }}>
                                                    Generated Email Draft
                                                </h4>
                                                <div
                                                    style={{
                                                        background: 'var(--bg-glass)',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: 'var(--radius-md)',
                                                        padding: 'var(--spacing-md)',
                                                        whiteSpace: 'pre-wrap',
                                                        fontSize: '0.78rem',
                                                        color: 'var(--text-secondary)',
                                                        lineHeight: 1.6,
                                                        fontFamily: 'var(--font-sans)',
                                                        maxHeight: 280,
                                                        overflowY: 'auto',
                                                    }}
                                                >
                                                    {selected.emailDraft}
                                                </div>
                                            </div>

                                            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                                <h4 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--spacing-sm)' }}>
                                                    Leverage Points
                                                </h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                                    {selected.leverage.map((item, index) => (
                                                        <div
                                                            key={`${selected.draftId}-leverage-${index}`}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem',
                                                                padding: '0.4rem 0.6rem',
                                                                background: 'rgba(16, 185, 129, 0.04)',
                                                                border: '1px solid rgba(16, 185, 129, 0.08)',
                                                                borderRadius: 'var(--radius-sm)',
                                                                fontSize: '0.75rem',
                                                                color: 'var(--text-secondary)',
                                                            }}
                                                        >
                                                            <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>✓</span>
                                                            {item}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button 
                                                    className="btn btn-primary"
                                                    onClick={async () => {
                                                        if (!selected) return;
                                                        try {
                                                            const response = await fetch('http://localhost:4000/v1/negotiate/send-email', {
                                                                method: 'POST',
                                                                headers: {
                                                                    'Content-Type': 'application/json',
                                                                },
                                                                body: JSON.stringify({
                                                                    draftId: selected.draftId,
                                                                    provider: selected.provider,
                                                                    emailDraft: selected.emailDraft,
                                                                    to: `support@${selected.provider.toLowerCase().replace(/\s+/g, '')}.com`,
                                                                    subject: `Subscription Inquiry - ${selected.provider}`,
                                                                }),
                                                            });
                                                            
                                                            if (response.ok) {
                                                                alert('✅ Email sent successfully!');
                                                                // Refresh drafts to update status
                                                                refetchDrafts();
                                                            } else {
                                                                alert('❌ Failed to send email');
                                                            }
                                                        } catch (error) {
                                                            alert('❌ Error sending email: ' + error);
                                                        }
                                                    }}
                                                >
                                                    Send Email
                                                </button>
                                                <button 
                                                    className="btn btn-secondary"
                                                    onClick={() => {
                                                        if (selected?.emailDraft) {
                                                            navigator.clipboard.writeText(selected.emailDraft);
                                                            alert('✅ Email draft copied to clipboard!');
                                                        }
                                                    }}
                                                >
                                                    Copy Draft
                                                </button>
                                                <button 
                                                    className="btn btn-secondary"
                                                    onClick={async () => {
                                                        if (!selected) return;
                                                        try {
                                                            const response = await fetch('http://localhost:4000/v1/negotiate/regenerate', {
                                                                method: 'POST',
                                                                headers: {
                                                                    'Content-Type': 'application/json',
                                                                },
                                                                body: JSON.stringify({
                                                                    draftId: selected.draftId,
                                                                    provider: selected.provider,
                                                                }),
                                                            });
                                                            
                                                            if (response.ok) {
                                                                alert('✅ Draft regenerated!');
                                                                refetchDrafts();
                                                            } else {
                                                                alert('❌ Failed to regenerate draft');
                                                            }
                                                        } catch (error) {
                                                            alert('❌ Error regenerating draft: ' + error);
                                                        }
                                                    }}
                                                >
                                                    Regenerate
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
