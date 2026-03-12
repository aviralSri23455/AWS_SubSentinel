'use client';

import { useState } from 'react';
import { useSubscriptions } from '@/hooks/useHybridData';
import styles from './SubscriptionMap.module.css';

interface Sub {
    name: string;
    amount: number;
    category: string;
    status: 'active' | 'flagged' | 'paused';
    renewal: string;
    color: string;
    detectedVia: string;
}

export default function SubscriptionMap() {
    const { data: rawSubscriptions } = useSubscriptions();
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const subscriptions: Sub[] = (rawSubscriptions || []).map((subscription, index) => {
        const colors = ['#e50914', '#1db954', '#fa0f00', '#7c3aed', '#1ce783', '#567b95', '#113ccf', '#74aa9c'];
        const renewal = subscription.renewalDate
            ? new Date(subscription.renewalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : 'Unknown';

        return {
            name: subscription.provider,
            amount: subscription.amount,
            category: subscription.category || 'Subscription',
            status: subscription.status as 'active' | 'flagged' | 'paused',
            renewal,
            color: colors[index % colors.length],
            detectedVia: subscription.detectedVia || 'Unknown',
        };
    });

    const total = subscriptions.reduce((sum, subscription) => sum + subscription.amount, 0);
    const activeCount = subscriptions.filter((subscription) => subscription.status === 'active').length;
    const flaggedCount = subscriptions.filter((subscription) => subscription.status === 'flagged').length;

    return (
        <div className={`glass-card ${styles.container}`}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h4 className={styles.title}>Subscription Map</h4>
                    <span className={styles.headerMeta}>
                        {activeCount} active • {flaggedCount} flagged
                    </span>
                </div>
                <div className={styles.totalWrap}>
                    <span className={styles.totalLabel}>Monthly</span>
                    <span className={styles.total}>${total.toFixed(2)}</span>
                </div>
            </div>

            <div className={styles.list}>
                {subscriptions.length === 0 ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        padding: '2rem 1.5rem',
                        gap: '0.75rem',
                        flex: 1,
                        minHeight: '180px',
                    }}>
                        <div style={{ fontSize: '2rem', opacity: 0.4 }}>📧</div>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            No subscriptions detected yet
                        </p>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '240px' }}>
                            Scan Gmail receipts or upload a Netflix, Spotify, or Adobe screenshot from the dashboard to detect subscriptions in real time.
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <span className="aws-badge">AWS Gmail API</span>
                            <span className="aws-badge">AWS Textract</span>
                        </div>
                    </div>
                ) : (
                    subscriptions.map((subscription, index) => (
                        <div
                            key={`${subscription.name}-${index}`}
                            className={`${styles.item} ${hoveredIndex === index ? styles.itemHovered : ''}`}
                            onMouseEnter={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            <div className={styles.itemLeft}>
                                <div
                                    className={styles.dot}
                                    style={{ backgroundColor: subscription.color, boxShadow: `0 0 8px ${subscription.color}40` }}
                                />
                                <div className={styles.nameGroup}>
                                    <span className={styles.name}>{subscription.name}</span>
                                    <span className={styles.category}>{subscription.category}</span>
                                </div>
                            </div>
                            <div className={styles.itemRight}>
                                <span className={styles.amount}>${subscription.amount.toFixed(2)}</span>
                                <span className={`badge badge-${subscription.status === 'active' ? 'success' : subscription.status === 'flagged' ? 'danger' : 'warning'}`}>
                                    {subscription.status}
                                </span>
                                <span className={styles.renewal}>{subscription.renewal}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className={styles.footer}>
                <span className={styles.footerText}>Detected via AWS services</span>
                <span className="aws-badge">AWS SES + Textract</span>
            </div>
        </div>
    );
}
