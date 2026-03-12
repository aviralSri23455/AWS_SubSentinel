'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

interface Subscription {
    id: string;
    name: string;
    amount: number;
    category: string;
    status: 'active' | 'flagged' | 'paused' | 'cancelled';
    renewal: string;
    color: string;
    detectedVia: string;
    lastCharge: string;
    risk: 'low' | 'medium' | 'high';
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1';

export default function SubscriptionsPage() {
    const searchParams = useSearchParams();
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingMessage, setProcessingMessage] = useState('');
    const [hasUploadedInSession, setHasUploadedInSession] = useState(false);

    useEffect(() => {
        // Force refresh if coming from upload page
        const shouldRefresh = searchParams.get('refresh') === 'true';
        if (shouldRefresh) {
            setHasUploadedInSession(true);
            // Small delay to ensure backend has processed the subscription
            setTimeout(() => {
                fetchSubscriptions();
            }, 500);
        } else {
            // Fetch data on initial load to show existing subscriptions
            fetchSubscriptions();
        }

        const eventSource = new EventSource(`${API_URL}/events`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'subscription_added') {
                    setHasUploadedInSession(true);
                    setIsProcessing(false);
                    setProcessingMessage('');
                    fetchSubscriptions();
                }

                if (data.type === 'pipeline_progress') {
                    const stage = data.data?.stage || '';
                    const status = data.data?.status || '';

                    if (status === 'processing' || status === 'uploading' || status === 'analyzing') {
                        setIsProcessing(true);
                        const stageMessages: Record<string, string> = {
                            upload: 'Uploading screenshot...',
                            s3: 'Uploading to S3...',
                            rekognition: 'Analyzing screenshot with Rekognition...',
                            ai_vision: 'Detecting provider and dark patterns...',
                            dynamodb: 'Saving results...',
                        };
                        setProcessingMessage(stageMessages[stage] || 'Processing...');
                    } else if (status === 'success' || status === 'complete') {
                        setHasUploadedInSession(true);
                        setIsProcessing(false);
                        setProcessingMessage('');
                        fetchSubscriptions();
                    } else if (status === 'failed' || status === 'error') {
                        setIsProcessing(false);
                        setProcessingMessage('');
                        setError(`Processing failed: ${data.data?.error || 'Unknown error'}`);
                    }
                }
            } catch (parseError) {
                console.error('Failed to parse SSE event:', parseError);
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [searchParams]);

    const fetchSubscriptions = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await fetch(`${API_URL}/subscriptions`, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch subscriptions: ${response.statusText}`);
            }

            const data = await response.json();
            const rawSubscriptions = data.subscriptions || [];

            const mappedSubscriptions = rawSubscriptions.map((subscription: any) => ({
                id: subscription.subscriptionId || subscription.subscription_id || subscription.id,
                name: subscription.provider || subscription.service_name || subscription.name || 'Unknown',
                amount: Number(subscription.amount || 0),
                category: subscription.category || 'Unknown',
                status: subscription.status || 'active',
                renewal: subscription.renewalDate || subscription.next_billing_date || subscription.renewal || 'N/A',
                color: getServiceColor(subscription.provider || subscription.service_name || subscription.name || ''),
                detectedVia: subscription.detectedVia || subscription.detected_via || 'API',
                lastCharge: subscription.lastCharge || subscription.last_charge_date || subscription.detectedAt || subscription.detected_at || 'N/A',
                risk: getRiskLevel(subscription),
            }));

            setSubscriptions(mappedSubscriptions);
            setIsLoaded(true);
        } catch (fetchError) {
            console.error('Error fetching subscriptions:', fetchError);
            setError(fetchError instanceof Error ? fetchError.message : 'Failed to load subscriptions');
            setSubscriptions([]);
        } finally {
            setIsLoading(false);
        }
    };

    const getServiceColor = (name: string): string => {
        const colors: Record<string, string> = {
            Netflix: '#e50914',
            Spotify: '#1db954',
            Adobe: '#fa0f00',
            Hulu: '#1ce783',
            Disney: '#113ccf',
            ChatGPT: '#74aa9c',
            AWS: '#ff9900',
            Notion: '#000000',
            Grammarly: '#15c39a',
            iCloud: '#3693f5',
        };

        for (const [key, color] of Object.entries(colors)) {
            if (name.toLowerCase().includes(key.toLowerCase())) {
                return color;
            }
        }
        return '#6366f1';
    };

    const getRiskLevel = (subscription: any): 'low' | 'medium' | 'high' => {
        if (subscription.risk_level) return subscription.risk_level;
        if (subscription.status === 'flagged') return 'high';
        if (Number(subscription.amount || 0) >= 25) return 'medium';
        return 'low';
    };

    const total = subscriptions.reduce((sum, subscription) => sum + subscription.amount, 0);
    const displayedSubscriptions = subscriptions;
    const filteredSubscriptions = displayedSubscriptions.filter((subscription) => {
        const matchesFilter = filter === 'all' || subscription.status === filter;
        const matchesSearch = subscription.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            subscription.category.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const statusColor: Record<string, string> = {
        active: 'var(--color-success)',
        flagged: 'var(--color-danger)',
        paused: 'var(--color-warning)',
        cancelled: 'var(--text-muted)',
    };

    const riskColor: Record<string, string> = {
        low: 'var(--color-success)',
        medium: 'var(--color-warning)',
        high: 'var(--color-danger)',
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <main style={{ flex: 1, marginLeft: 260, display: 'flex', flexDirection: 'column' }}>
                <Header />
                <div style={{ padding: 'var(--spacing-xl)', opacity: isLoaded ? 1 : 0, transition: 'opacity 0.5s' }}>
                    {isLoading && (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            <p>Loading subscriptions from backend...</p>
                        </div>
                    )}

                    {isProcessing && (
                        <div className="glass-card" style={{ padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)', borderLeft: '3px solid var(--color-primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    width: '20px',
                                    height: '20px',
                                    border: '3px solid var(--color-primary)',
                                    borderTopColor: 'transparent',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                }} />
                                <p style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>
                                    {processingMessage || 'Processing screenshot...'}
                                </p>
                            </div>
                        </div>
                    )}

                    {error && !isLoading && (
                        <div className="glass-card" style={{ padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)', borderLeft: '3px solid var(--color-danger)' }}>
                            <p style={{ color: 'var(--color-danger)', fontWeight: 600 }}>⚠️ Error: {error}</p>
                            <button onClick={fetchSubscriptions} className="btn btn-primary" style={{ marginTop: '0.5rem', fontSize: '0.78rem' }}>
                                Retry
                            </button>
                        </div>
                    )}

                    {!isLoading && (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-xl)' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>📧 Subscriptions</h2>
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                        {subscriptions.length > 0 
                                            ? `${subscriptions.length} subscriptions detected • $${total.toFixed(2)}/month`
                                            : 'No subscriptions found — upload a screenshot or scan Gmail'}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span className="aws-badge">AWS Real-Time</span>
                                    <button onClick={fetchSubscriptions} className="btn btn-primary" style={{ fontSize: '0.78rem' }}>
                                        Refresh
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap', alignItems: 'center' }}>
                                {['all', 'active', 'flagged', 'paused'].map((filterValue) => (
                                    <button
                                        key={filterValue}
                                        onClick={() => setFilter(filterValue)}
                                        style={{
                                            padding: '0.4rem 0.85rem',
                                            borderRadius: 'var(--radius-full)',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            border: '1px solid',
                                            borderColor: filter === filterValue ? 'var(--color-primary)' : 'var(--border-color)',
                                            background: filter === filterValue ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-glass)',
                                            color: filter === filterValue ? 'var(--color-primary-light)' : 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s',
                                            textTransform: 'capitalize',
                                        }}
                                    >
                                        {filterValue}
                                    </button>
                                ))}
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    style={{
                                        marginLeft: 'auto',
                                        padding: '0.4rem 0.85rem',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: '0.78rem',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-glass)',
                                        color: 'var(--text-primary)',
                                        outline: 'none',
                                        width: 200,
                                        fontFamily: 'var(--font-sans)',
                                    }}
                                />
                            </div>

                            {displayedSubscriptions.length === 0 && !error && !isLoading && (
                                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                                    <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                        No subscriptions found
                                    </p>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        {subscriptions.length > 0 
                                            ? 'No subscriptions match your filter. Try a different search.'
                                            : 'No subscriptions found — upload a screenshot or scan Gmail'}
                                    </p>
                                </div>
                            )}

                            {displayedSubscriptions.length > 0 && (
                                <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                {['Service', 'Category', 'Amount', 'Renewal', 'Status', 'Risk', 'Detected Via'].map((header) => (
                                                    <th key={header} style={{
                                                        padding: '0.75rem 1rem',
                                                        textAlign: 'left',
                                                        fontSize: '0.68rem',
                                                        fontWeight: 700,
                                                        color: 'var(--text-muted)',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.06em',
                                                    }}>
                                                        {header}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSubscriptions.map((subscription, index) => (
                                                <tr
                                                    key={subscription.id}
                                                    style={{
                                                        borderBottom: '1px solid var(--border-color)',
                                                        transition: 'background 0.15s',
                                                        animation: `fadeIn 0.3s ease-out ${index * 40}ms backwards`,
                                                    }}
                                                    onMouseEnter={(event) => (event.currentTarget.style.background = 'var(--bg-glass-hover)')}
                                                    onMouseLeave={(event) => (event.currentTarget.style.background = 'transparent')}
                                                >
                                                    <td style={{ padding: '0.75rem 1rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: subscription.color, boxShadow: `0 0 8px ${subscription.color}40`, flexShrink: 0 }} />
                                                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{subscription.name}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{subscription.category}</td>
                                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, fontSize: '0.88rem', fontFamily: 'var(--font-mono)' }}>${subscription.amount.toFixed(2)}</td>
                                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{subscription.renewal}</td>
                                                    <td style={{ padding: '0.75rem 1rem' }}>
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.3rem',
                                                            padding: '0.2rem 0.55rem',
                                                            borderRadius: 'var(--radius-full)',
                                                            fontSize: '0.65rem',
                                                            fontWeight: 600,
                                                            textTransform: 'uppercase',
                                                            color: statusColor[subscription.status],
                                                            background: `${statusColor[subscription.status]}15`,
                                                            border: `1px solid ${statusColor[subscription.status]}30`,
                                                        }}>
                                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor[subscription.status] }} />
                                                            {subscription.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem' }}>
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: riskColor[subscription.risk] }}>{subscription.risk}</span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.68rem', color: '#ff9900', fontFamily: 'var(--font-mono)' }}>{subscription.detectedVia}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {displayedSubscriptions.length > 0 && (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(4, 1fr)',
                                    gap: 'var(--spacing-lg)',
                                    marginTop: 'var(--spacing-xl)',
                                }}>
                                    {[
                                        { label: 'Total Monthly', value: `$${total.toFixed(2)}`, color: 'var(--text-primary)' },
                                        { label: 'Annual Projection', value: `$${(total * 12).toFixed(0)}`, color: 'var(--color-primary-light)' },
                                        { label: 'Active Subs', value: String(displayedSubscriptions.filter((subscription) => subscription.status === 'active').length), color: 'var(--color-success)' },
                                        { label: 'Flagged Risk', value: String(displayedSubscriptions.filter((subscription) => subscription.risk === 'high').length), color: 'var(--color-danger)' },
                                    ].map((stat) => (
                                        <div key={stat.label} className="glass-card" style={{ textAlign: 'center', padding: 'var(--spacing-md)' }}>
                                            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{stat.label}</p>
                                            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: stat.color, fontFamily: 'var(--font-mono)' }}>{stat.value}</span>
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
