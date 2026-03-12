'use client';

import { usePathname } from 'next/navigation';
import styles from './Header.module.css';
import { useSubscriptions, useDarkPatterns } from '@/hooks/useHybridData';

const pageMeta: Record<string, { title: string; subtitle: string; icon: string }> = {
    '/':              { title: 'Dashboard',          subtitle: 'Real-time subscription intelligence',                icon: '⬡' },
    '/subscriptions': { title: 'Subscriptions',      subtitle: 'Manage your recurring charges',                     icon: '◈' },
    '/cancel':        { title: 'Dark Pattern Defender', subtitle: 'Upload a screenshot to analyze cancellation flows', icon: '◉' },
    '/dark-patterns': { title: 'Dark Pattern Defender', subtitle: 'Detect UI manipulation · Rekognition + Bedrock',   icon: '◉' },
    '/negotiate':     { title: 'Negotiate',          subtitle: 'AI-powered email drafts via Bedrock',               icon: '◇' },
    '/calendar':      { title: 'Calendar Reasoner',  subtitle: 'Life events → subscription optimizations',          icon: '◆' },
    '/settings':      { title: 'Settings',           subtitle: 'Configure your SubSentinel experience',             icon: '⬟' },
};

export default function Header() {
    const pathname  = usePathname();
    const pageInfo  = pageMeta[pathname] || pageMeta['/'];
    const subs      = useSubscriptions(false);
    const patterns  = useDarkPatterns(false);

    const subCount     = subs.data?.length         ?? 0;
    const patternCount = patterns.data?.length      ?? 0;

    return (
        <header className={styles.header}>
            <div className={styles.left}>
                <div className={styles.pageIconWrap}>{pageInfo.icon}</div>
                <div className={styles.titleGroup}>
                    <h2 className={styles.title}>{pageInfo.title}</h2>
                    <span className={styles.subtitle}>{pageInfo.subtitle}</span>
                </div>
            </div>

            <div className={styles.right}>
                {/* Quick stats */}
                <div className={styles.headerStats}>
                    <div className={styles.headerStat}>
                        <span className={styles.headerStatVal}>{subCount}</span>
                        <span className={styles.headerStatLabel}>Subs</span>
                    </div>
                    <div className={styles.headerStat}>
                        <span className={styles.headerStatVal}>{patternCount}</span>
                        <span className={styles.headerStatLabel}>Threats</span>
                    </div>
                </div>

                {/* Live badge */}
                <div className={styles.statusIndicator}>
                    <span className={styles.statusDot} />
                    <span className={styles.statusText}>Live</span>
                </div>

                {/* Avatar */}
                <div className={styles.avatar} title="Profile">SS</div>
            </div>
        </header>
    );
}
