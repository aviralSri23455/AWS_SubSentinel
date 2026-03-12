'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';
import styles from './Sidebar.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1';

interface AgentStatusInfo {
    name: string;
    icon: string;
    service: string;
    status: 'active' | 'idle' | 'processing' | 'error';
    color: string;
    lastActive: number | null;
}

const navItems = [
    { href: '/',              label: 'Dashboard',     icon: '⬡',  description: 'Overview & metrics',         countKey: null },
    { href: '/subscriptions', label: 'Subscriptions', icon: '◈',  description: 'Manage recurring charges',    countKey: 'subscriptions' },
    { href: '/dark-patterns', label: 'Dark Patterns', icon: '◉',  description: 'View all reports',            countKey: 'darkPatterns' },
    { href: '/negotiate',     label: 'Negotiate',     icon: '◇',  description: 'AI email drafts',             countKey: null },
    { href: '/calendar',      label: 'Calendar',      icon: '◆',  description: 'Life event insights',         countKey: 'calendar' },
];

const bottomItems: Array<{ href: string; label: string; icon: string }> = [];

function useElapsedTime() {
    const [, setTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(interval);
    }, []);
    return useCallback((timestamp: number | null) => {
        if (!timestamp) return null;
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 5) return 'just now';
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        return `${Math.floor(seconds / 3600)}h ago`;
    }, []);
}

export default function Sidebar() {
    const pathname = usePathname();
    const { connected, subscribe } = useRealtimeEvents();
    const timeAgo = useElapsedTime();
    const [counts, setCounts] = useState<Record<string, number>>({
        subscriptions: 0,
        darkPatterns: 0,
        calendar: 0,
    });

    const [agents, setAgents] = useState<AgentStatusInfo[]>([
        { name: 'Auditor',    icon: '📧', service: 'SES',        status: 'idle', color: '#3b82f6', lastActive: null },
        { name: 'Calendar',   icon: '📅', service: 'Bedrock',    status: 'idle', color: '#f59e0b', lastActive: null },
        { name: 'Negotiator', icon: '💬', service: 'OpenSearch', status: 'idle', color: '#10b981', lastActive: null },
        { name: 'Defender',   icon: '🛡️', service: 'Rekognition',status: 'idle', color: '#ef4444', lastActive: null },
        { name: 'Learner',    icon: '🧠', service: 'Comprehend', status: 'idle', color: '#8b5cf6', lastActive: null },
    ]);

    const agentTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const activateAgent = useCallback((name: string, duration = 4000) => {
        if (agentTimers.current[name]) clearTimeout(agentTimers.current[name]);
        setAgents((prev) => prev.map((a) =>
            a.name === name ? { ...a, status: 'active' as const, lastActive: Date.now() } : a,
        ));
        agentTimers.current[name] = setTimeout(() => {
            setAgents((prev) => prev.map((a) =>
                a.name === name ? { ...a, status: 'idle' as const } : a,
            ));
        }, duration);
    }, []);

    const processingAgent = useCallback((name: string) => {
        if (agentTimers.current[name]) clearTimeout(agentTimers.current[name]);
        setAgents((prev) => prev.map((a) =>
            a.name === name ? { ...a, status: 'processing' as const, lastActive: Date.now() } : a,
        ));
    }, []);

    const fetchCounts = useCallback(async () => {
        try {
            const [subscriptionsResponse, darkPatternsResponse, calendarResponse] = await Promise.allSettled([
                fetch(`${API_URL}/subscriptions`).then((r) => r.ok ? r.json() : null),
                fetch(`${API_URL}/dark-patterns`).then((r) => r.ok ? r.json() : null),
                fetch(`${API_URL}/calendar/insights`).then((r) => r.ok ? r.json() : null),
            ]);

            setCounts({
                subscriptions: subscriptionsResponse.status === 'fulfilled' && subscriptionsResponse.value?.subscriptions
                    ? subscriptionsResponse.value.subscriptions.length : 0,
                darkPatterns: darkPatternsResponse.status === 'fulfilled' && darkPatternsResponse.value?.reports
                    ? darkPatternsResponse.value.reports.length : 0,
                calendar: calendarResponse.status === 'fulfilled' && calendarResponse.value?.insights
                    ? calendarResponse.value.insights.length : 0,
            });
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        fetchCounts();
        const interval = setInterval(fetchCounts, 300000);
        return () => clearInterval(interval);
    }, [fetchCounts]);

    const prevConnected = useRef<boolean | null>(null);
    useEffect(() => {
        const wasConnected = prevConnected.current;
        prevConnected.current = connected;
        if (connected && wasConnected !== true) {
            activateAgent('Auditor',    4000);
            activateAgent('Defender',   5000);
            activateAgent('Learner',    3500);
            setTimeout(() => activateAgent('Calendar',   3000), 600);
            setTimeout(() => activateAgent('Negotiator', 3000), 1200);
        }
    }, [connected, activateAgent]);

    useEffect(() => {
        const u1  = subscribe('screenshot_complete',    () => { activateAgent('Defender', 5000); setTimeout(() => activateAgent('Learner', 3000), 500); fetchCounts(); });
        const u2  = subscribe('screenshot_analyzing',   () => processingAgent('Defender'));
        const u3  = subscribe('subscription_added',     () => { activateAgent('Auditor', 5000); fetchCounts(); });
        const u4  = subscribe('gmail_scan_started',     () => processingAgent('Auditor'));
        const u5  = subscribe('gmail_scan_complete',    () => { activateAgent('Auditor', 5000); setTimeout(() => activateAgent('Calendar', 3000), 800); fetchCounts(); });
        const u6  = subscribe('dark_pattern_added',     () => { activateAgent('Defender', 4000); activateAgent('Learner', 3000); fetchCounts(); });
        const u7  = subscribe('pipeline_progress', (data: any) => {
            if (data?.stage === 'rekognition') processingAgent('Defender');
            if (data?.stage === 'bedrock')     processingAgent('Calendar');
            if (data?.stage === 'comprehend')  processingAgent('Learner');
            if (data?.stage === 'opensearch')  processingAgent('Negotiator');
            if (data?.stage === 'complete')    { activateAgent('Defender', 4000); activateAgent('Learner', 3000); fetchCounts(); }
        });
        const u8  = subscribe('negotiation_drafted', () => activateAgent('Negotiator', 5000));
        const u9  = subscribe('calendar_insight',    () => activateAgent('Calendar',   5000));
        const refreshHandler = () => fetchCounts();
        window.addEventListener('subsentinel:refresh', refreshHandler);
        return () => {
            u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9();
            window.removeEventListener('subsentinel:refresh', refreshHandler);
            Object.values(agentTimers.current).forEach(clearTimeout);
        };
    }, [subscribe, fetchCounts, activateAgent, processingAgent]);

    const activeAgentCount = agents.filter((a) => a.status === 'active' || a.status === 'processing').length;

    return (
        <aside className={styles.sidebar}>
            <div className={styles.sidebarInner}>

                {/* Logo */}
                <div className={styles.logo}>
                    <div className={styles.logoIconWrap}>
                        <div className={styles.logoIcon}>🛡️</div>
                        <div className={styles.logoIconRing} />
                    </div>
                    <div className={styles.logoTextGroup}>
                        <h1 className={styles.logoTitle}>SubSentinel</h1>
                        <p className={styles.logoSubtitle}>AI Guardian</p>
                    </div>
                </div>

                {/* Connection */}
                <div className={styles.connectionBadge}>
                    <span className={connected ? styles.connDotLive : styles.connDotOff} />
                    <span className={styles.connText}>
                        {connected ? '● Connected to AWS' : '○ Offline'}
                    </span>
                </div>

                {/* Main Nav */}
                <nav className={styles.nav}>
                    <p className={styles.navLabel}>Main</p>
                    {navItems.map((item) => {
                        const count = item.countKey ? counts[item.countKey] : 0;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
                            >
                                <div className={styles.navIconWrap}>{item.icon}</div>
                                <div className={styles.navContent}>
                                    <div className={styles.navTextRow}>
                                        <span className={styles.navText}>{item.label}</span>
                                        {count > 0 && (
                                            <span className={styles.navCount}>{count}</span>
                                        )}
                                    </div>
                                    <span className={styles.navDesc}>{item.description}</span>
                                </div>
                            </Link>
                        );
                    })}
                </nav>

                {/* AWS Agents */}
                <div className={styles.agentSection}>
                    <div className={styles.agentHeader}>
                        <p className={styles.navLabel}>AWS Agents</p>
                        {activeAgentCount > 0 && (
                            <span className={styles.agentCountBadge}>{activeAgentCount} active</span>
                        )}
                    </div>
                    {agents.map((agent) => {
                        const isActive     = agent.status === 'active';
                        const isProcessing = agent.status === 'processing';
                        const isWorking    = isActive || isProcessing;
                        const lastActiveText = timeAgo(agent.lastActive);

                        return (
                            <div
                                key={agent.name}
                                className={`${styles.agentRow} ${isWorking ? styles.agentRowActive : ''}`}
                            >
                                <div className={styles.agentDotWrap}>
                                    <span
                                        className={`${styles.agentDot} ${isActive ? styles.agentDotActive : ''} ${isProcessing ? styles.agentDotProcessing : ''}`}
                                        style={{
                                            backgroundColor: isActive    ? '#10b981'
                                                : isProcessing ? '#f59e0b'
                                                : agent.status === 'error' ? '#ef4444'
                                                : 'rgba(100,116,139,0.4)',
                                        }}
                                    />
                                    {isWorking && <span className={styles.agentDotRing} style={{ borderColor: isActive ? '#10b981' : '#f59e0b' }} />}
                                </div>
                                <div className={styles.agentInfo}>
                                    <span className={styles.agentName}>{agent.name}</span>
                                    {lastActiveText && (
                                        <span className={styles.agentLastActive}>{lastActiveText}</span>
                                    )}
                                </div>
                                <span className={styles.agentService}>{agent.service}</span>
                                <span
                                    className={`${styles.agentStatusLabel} ${isActive ? styles.statusActive : ''} ${isProcessing ? styles.statusProcessing : ''}`}
                                    style={{
                                        color: isActive    ? '#10b981'
                                            : isProcessing ? '#f59e0b'
                                            : agent.status === 'error' ? '#ef4444'
                                            : 'var(--text-muted)',
                                    }}
                                >
                                    {isActive ? '● Active' : isProcessing ? '◉ Processing' : agent.status === 'error' ? '✕ Error' : '○ Idle'}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Bottom */}
                <div className={styles.bottom}>
                    {bottomItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.navItem} ${styles.bottomItem} ${pathname === item.href ? styles.active : ''}`}
                        >
                            <div className={styles.navIconWrap}>{item.icon}</div>
                            <span className={styles.navText}>{item.label}</span>
                        </Link>
                    ))}
                    <div className={styles.versionBadge}>
                        <span>v1.0.0</span>
                        <span className={styles.versionEnv}>dev</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
