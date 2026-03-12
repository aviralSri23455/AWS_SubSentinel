'use client';

import { useEffect, useState } from 'react';
import styles from './FinancialFreedomScore.module.css';

// Subscription Protection Score — NOT a financial tracking component

import { useFinancialScore } from '@/hooks/useHybridData';

export default function FinancialFreedomScore() {
    const { data } = useFinancialScore();
    const score = data?.score ?? 0;
    const hasData = !!data;
    const [animatedScore, setAnimatedScore] = useState(0);

    useEffect(() => {
        const duration = 1200;
        const startTime = Date.now();
        const timer = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutCubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(eased * score);
            setAnimatedScore(current);
            if (progress >= 1) clearInterval(timer);
        }, 16);
        return () => clearInterval(timer);
    }, [score]);

    const circumference = 2 * Math.PI * 85;
    const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

    const getScoreColor = (s: number) => {
        if (s >= 80) return '#10b981';
        if (s >= 60) return '#818cf8';
        if (s >= 40) return '#f59e0b';
        return '#ef4444';
    };

    const getGradeLabel = (s: number) => {
        if (s >= 90) return 'Fully Protected';
        if (s >= 80) return 'Well Protected';
        if (s >= 60) return 'Protected';
        if (s >= 40) return 'Vulnerable';
        return 'Needs Work';
    };

    const color = getScoreColor(animatedScore);

    return (
        <div className={`glass-card ${styles.container}`}>
            <div className={styles.header}>
                <h4 className={styles.title}>Subscription Protection Score</h4>
                <span className="aws-badge">☁ Bedrock</span>
            </div>

            <div className={styles.scoreRing}>
                <svg width="190" height="190" viewBox="0 0 200 200">
                    <defs>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>
                    {/* Background ring */}
                    <circle
                        cx="100" cy="100" r="85"
                        fill="none"
                        stroke="rgba(255,255,255,0.04)"
                        strokeWidth="8"
                    />
                    {/* Progress ring */}
                    <circle
                        cx="100" cy="100" r="85"
                        fill="none"
                        stroke={color}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        transform="rotate(-90 100 100)"
                        className={styles.progressRing}
                        filter="url(#glow)"
                    />
                </svg>
                <div className={styles.scoreValue}>
                    <span className={styles.scoreNumber} style={{ color }}>
                        {animatedScore}
                    </span>
                    <span className={styles.scoreLabel}>/ 100</span>
                    <span className={styles.scoreGrade} style={{ color }}>
                        {getGradeLabel(animatedScore)}
                    </span>
                </div>
            </div>

            <div className={styles.breakdown}>
                <div className={styles.breakdownItem}>
                    <span className={styles.breakdownValue}>{hasData ? `${Math.round(data!.savingsRatio * 100)}%` : '0%'}</span>
                    <span className={styles.breakdownLabel}>Protected</span>
                </div>
                <div className={styles.breakdownDivider} />
                <div className={styles.breakdownItem}>
                    <span className={styles.breakdownValue}>{hasData ? data!.negotiationWins : '0'}</span>
                    <span className={styles.breakdownLabel}>Wins</span>
                </div>
                <div className={styles.breakdownDivider} />
                <div className={styles.breakdownItem}>
                    <span className={styles.breakdownValue}>{hasData ? data!.patternsBlocked : '0'}</span>
                    <span className={styles.breakdownLabel}>Blocked</span>
                </div>
            </div>


            <p className={styles.formula}>
                <code>(Savings / TotalSpend) × 100 + Wins × 5</code>
            </p>
        </div>
    );
}
