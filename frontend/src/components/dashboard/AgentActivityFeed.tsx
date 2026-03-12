'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAgentActivity } from '@/hooks/useHybridData';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';
import styles from './AgentActivityFeed.module.css';

interface Activity {
    id: string;
    agent: string;
    icon: string;
    agentColor: string;
    action: string;
    detail: string;
    timestamp: string;
    status: 'success' | 'processing' | 'warning';
    awsService: string;
}

export default function AgentActivityFeed() {
    const { data: rawActivities, lastUpdated, loading, source, refetch } = useAgentActivity();
    const { agentActivities: realtimeActivities, connected } = useRealtimeEvents();

    // Properly deduplicate activities using useMemo
    const activities: Activity[] = useMemo(() => {
        const merged = [...realtimeActivities, ...(rawActivities || [])];
        
        // Deduplicate using a Map with composite key
        const uniqueMap = new Map<string, any>();
        for (const a of merged as any[]) {
            // Create a unique key from agent, action, and timestamp (rounded to nearest second)
            const ts = new Date(a.timestamp).getTime();
            const roundedTs = Math.floor(ts / 1000) * 1000; // Round to nearest second
            const key = `${a.agent}-${a.action}-${roundedTs}`;
            
            // Only keep the first occurrence
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, a);
            }
        }
        
        const uniqueActivities = Array.from(uniqueMap.values());
        
        // Sort by timestamp descending (newest first)
        uniqueActivities.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        // Limit to 20 most recent activities
        const limited = uniqueActivities.slice(0, 20);

        const typeMap: Record<string, { icon: string; color: string; service: string }> = {
            auditor: { icon: '📧', color: '#3b82f6', service: 'SES + Textract' },
            defender: { icon: '🛡️', color: '#ef4444', service: 'Rekognition' },
            calendar: { icon: '📅', color: '#f59e0b', service: 'Bedrock' },
            negotiator: { icon: '💬', color: '#10b981', service: 'OpenSearch' },
            learner: { icon: '🧠', color: '#8b5cf6', service: 'Comprehend' },
        };

        return limited.map((a: any, index: number) => {
            const mapping = typeMap[a.agent.toLowerCase()] || typeMap.learner;

            let detailStr = a.detail;
            if (!detailStr && a.details) {
                const d = a.details;
                if (d.provider && d.provider !== 'unknown') {
                    detailStr = `Provider: ${d.provider}`;
                    if (d.hostilityScore !== undefined) {
                        detailStr += ` · Hostility: ${Number(d.hostilityScore).toFixed(1)}`;
                    }
                    if (d.patternsCount !== undefined) {
                        detailStr += ` · ${d.patternsCount} patterns`;
                    }
                } else if (d.hostilityScore !== undefined) {
                    detailStr = `Hostility: ${Number(d.hostilityScore).toFixed(1)}`;
                    if (d.patternsCount !== undefined) {
                        detailStr += ` · ${d.patternsCount} patterns found`;
                    }
                } else {
                    detailStr = '';
                }
            }

            return {
                id: a.id || `activity-${index}-${a.timestamp}`,
                agent: a.agent.charAt(0).toUpperCase() + a.agent.slice(1),
                icon: mapping.icon,
                agentColor: mapping.color,
                action: a.action,
                detail: detailStr || '',
                timestamp: new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: a.status as 'success' | 'processing' | 'warning',
                awsService: mapping.service,
            };
        });
    }, [rawActivities, realtimeActivities]);

    const [newActivity, setNewActivity] = useState(false);
    const isLive = source === 'aws' || connected;

    useEffect(() => {
        if (lastUpdated || realtimeActivities.length > 0) {
            setNewActivity(true);
            const timer = setTimeout(() => setNewActivity(false), 2500);
            return () => clearTimeout(timer);
        }
    }, [lastUpdated, realtimeActivities.length]);

    useEffect(() => {
        if (realtimeActivities.length > 0) {
            refetch();
        }
    }, [realtimeActivities.length, refetch]);

    return (
        <div className={`glass-card ${styles.container}`}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h4 className={styles.title}>
                        Agent Activity Feed
                        {newActivity && <span className={styles.newDot} />}
                    </h4>
                    <span className={styles.streamInfo}>
                        {activities.length > 0
                            ? `${activities.length} events`
                            : 'Awaiting real AWS events'}
                    </span>
                </div>
                <div className={styles.wsStatus}>
                    <span className={`${styles.wsDot} ${isLive ? styles.wsConnected : styles.wsDisconnected}`} />
                    <span className={styles.wsLabel}>
                        {loading ? 'Loading…' : isLive ? '🔴 Live' : 'Offline'}
                    </span>
                </div>
            </div>

            <div className={styles.feed}>
                {activities.length === 0 ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        padding: '2.5rem 1.5rem',
                        gap: '0.75rem',
                        flex: 1,
                        minHeight: '220px',
                    }}>
                        <div style={{ fontSize: '2.2rem', opacity: 0.4 }}>🤖</div>
                        <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {loading ? 'Connecting to AWS agents…' : 'No agent activity yet'}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '260px' }}>
                            {loading
                                ? 'Polling for real-time events'
                                : 'Upload a screenshot or scan Gmail to trigger agents'}
                        </p>
                    </div>
                ) : (
                    activities.map((activity, index) => (
                        <div
                            key={activity.id}
                            className={styles.item}
                            style={{ animationDelay: `${index * 60}ms` }}
                        >
                            <div className={styles.iconCol}>
                                <div className={styles.iconWrap} style={{ borderColor: `${activity.agentColor}30` }}>
                                    <span className={styles.icon}>{activity.icon}</span>
                                </div>
                                {index < activities.length - 1 && <div className={styles.line} />}
                            </div>
                            <div className={styles.content}>
                                <div className={styles.contentHeader}>
                                    <span className={styles.agent} style={{ color: activity.agentColor }}>
                                        {activity.agent}
                                    </span>
                                    <span className={styles.timestamp}>{activity.timestamp}</span>
                                </div>
                                <p className={styles.action}>{activity.action}</p>
                                {activity.detail && (
                                    <p className={styles.detail}>{activity.detail}</p>
                                )}
                                <div className={styles.meta}>
                                    <span className={`badge badge-${activity.status === 'success' ? 'success' : activity.status === 'warning' ? 'danger' : 'processing'}`}>
                                        {activity.status}
                                    </span>
                                    <span className={styles.awsTag}>{activity.awsService}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
