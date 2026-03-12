'use client';

import { useEffect, useState } from 'react';
import { useTOONMetrics } from '@/hooks/useHybridData';
import styles from './TOONSavingsWidget.module.css';

interface SavingsData {
    category: string;
    jsonTokens: number;
    toonTokens: number;
    savings: number;
    icon: string;
}



export default function TOONSavingsWidget() {
    const { data } = useTOONMetrics();
    const [animated, setAnimated] = useState(false);
    const [monthlyJson, setMonthlyJson] = useState(data ? data.totalJsonTokens * 0.001 : 30);
    const [monthlyToon, setMonthlyToon] = useState(data ? data.totalToonTokens * 0.001 : 12);

    useEffect(() => {
        const timer = setTimeout(() => setAnimated(true), 400);
        return () => clearTimeout(timer);
    }, []);

    // Simulate cost fluctuation
    useEffect(() => {
        const interval = setInterval(() => {
            setMonthlyJson(prev => +(prev + (Math.random() - 0.5) * 0.2).toFixed(2));
            setMonthlyToon(prev => +(prev + (Math.random() - 0.5) * 0.05).toFixed(2));
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    const savingsData: SavingsData[] = (data?.byCategory || []).map(cat => {
        const iconMap: Record<string, string> = {
            'Receipts': '🤖',
            'Screenshots': '📸',
            'Calendar': '📅',
            'Negotiations': '💬'
        };
        return {
            ...cat,
            icon: iconMap[cat.category] || '📊'
        };
    });

    const totalJSON = data?.totalJsonTokens || 10000;
    const totalTOON = data?.totalToonTokens || 4000;
    const overallSavings = data?.overallSavingsPercent || 60;
    const annualSavings = ((monthlyJson - monthlyToon) * 12).toFixed(0);

    return (
        <div className={`glass-card ${styles.container}`}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h4 className={styles.title}>TOON Token Savings</h4>
                    <span className={styles.headerSub}>Token-Oriented Object Notation</span>
                </div>
                <div className={styles.overallBadge}>
                    <span className={styles.overallValue}>{overallSavings}%</span>
                    <span className={styles.overallLabel}>Reduction</span>
                </div>
            </div>

            <div className={styles.comparison}>
                <div className={styles.comparisonItem}>
                    <span className={styles.compLabel}>JSON (Standard)</span>
                    <span className={styles.compValue} style={{ color: 'var(--color-danger)' }}>
                        ${monthlyJson.toFixed(2)}/mo
                    </span>
                    <span className={styles.compTokens}>{totalJSON.toLocaleString()} tokens</span>
                </div>
                <div className={styles.arrow}>
                    <span className={styles.arrowIcon}>→</span>
                    <span className={styles.arrowSave}>-{overallSavings}%</span>
                </div>
                <div className={styles.comparisonItem}>
                    <span className={styles.compLabel}>TOON (Optimized)</span>
                    <span className={styles.compValue} style={{ color: 'var(--color-success)' }}>
                        ${monthlyToon.toFixed(2)}/mo
                    </span>
                    <span className={styles.compTokens}>{totalTOON.toLocaleString()} tokens</span>
                </div>
            </div>

            <div className={styles.bars}>
                {savingsData.map((data) => (
                    <div key={data.category} className={styles.barRow}>
                        <span className={styles.barIcon}>{data.icon}</span>
                        <span className={styles.barLabel}>{data.category}</span>
                        <div className={styles.barTrack}>
                            <div
                                className={styles.barJSON}
                                style={{ width: animated ? '100%' : '0%' }}
                            />
                            <div
                                className={styles.barTOON}
                                style={{ width: animated ? `${100 - data.savings}%` : '0%' }}
                            />
                        </div>
                        <span className={styles.barSavings}>-{data.savings}%</span>
                    </div>
                ))}
            </div>

            <div className={styles.footer}>
                <div className={styles.annualSave}>
                    <span className={styles.annualLabel}>Annual Savings</span>
                    <span className={styles.annualValue}>${annualSavings}</span>
                </div>
                <span className={styles.footerNote}>
                    ⚡ TOON: <strong>74% LLM accuracy</strong> vs JSON 70%
                </span>
            </div>
        </div>
    );
}
