'use client';

import { useState, useEffect } from 'react';
import { useDarkPatterns } from '@/hooks/useHybridData';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';
import styles from './DarkPatternLeaderboard.module.css';

interface PatternDetail {
    type: string;
    confidence: number;
    severity: number;
    description: string;
    color: string;
    emoji: string;
}

interface ProviderReport {
    provider: string;
    providerColor: string;
    hostility: number;
    patterns: PatternDetail[];
    analyzedAt: string;
}

interface Props {
    onUploadClick?: () => void;
}

const PATTERN_CONFIG: Record<string, { emoji: string; color: string }> = {
    OBSTRUCTION: { emoji: '🔴', color: '#ef4444' },
    CONFUSION: { emoji: '🟠', color: '#f97316' },
    FORCED_LABOR: { emoji: '🔴', color: '#dc2626' },
    SHAME_TACTICS: { emoji: '🟡', color: '#eab308' },
    MISDIRECTION: { emoji: '🟣', color: '#a855f7' },
    SOCIAL_PROOF: { emoji: '🔵', color: '#3b82f6' },
    URGENCY: { emoji: '🟠', color: '#ea580c' },
    SCARCITY: { emoji: '🟡', color: '#ca8a04' },
};

function getPatternConfig(type: string) {
    const key = type.toUpperCase().replace(/[\s-]/g, '_');
    return PATTERN_CONFIG[key] || { emoji: '⚪', color: '#64748b' };
}

export default function DarkPatternLeaderboard({ onUploadClick }: Props) {
    const { data: rawPatterns, refetch } = useDarkPatterns();
    const { latestAnalysis, subscribe } = useRealtimeEvents();
    const [scanActive, setScanActive] = useState(false);
    const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

    const reports: ProviderReport[] = (rawPatterns || []).map((report, index) => {
        const colors = ['#e50914', '#1db954', '#fa0f00', '#7c3aed', '#1ce783', '#567b95'];
        const provider = report.provider && report.provider.toLowerCase() !== 'unknown'
            ? report.provider
            : `Screenshot #${index + 1}`;

        const patterns: PatternDetail[] = report.patterns.map((pattern: any) => {
            const config = getPatternConfig(pattern.patternType || pattern.type || '');
            return {
                type: (pattern.patternType || pattern.type || 'UNKNOWN').toUpperCase().replace(/[\s-]/g, '_'),
                confidence: pattern.confidence ? Math.round(pattern.confidence * 100) : 85,
                severity: pattern.severity || 7,
                description: pattern.description || 'Dark pattern detected',
                color: config.color,
                emoji: config.emoji,
            };
        });

        return {
            provider,
            providerColor: colors[index % colors.length],
            hostility: Math.round(report.hostilityScore * 10) / 10,
            patterns,
            analyzedAt: new Date(report.analyzedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
    });

    useEffect(() => {
        const unsubscribe = subscribe('screenshot_complete', () => {
            setScanActive(true);
            refetch();
            setTimeout(() => setScanActive(false), 2000);
        });
        return unsubscribe;
    }, [subscribe, refetch]);

    useEffect(() => {
        if (latestAnalysis) {
            setScanActive(true);
            setTimeout(() => setScanActive(false), 2000);
        }
    }, [latestAnalysis]);

    useEffect(() => {
        if (reports.length > 0 && !expandedProvider) {
            setExpandedProvider(reports[0].provider);
        }
    }, [reports, expandedProvider]);

    const getSeverityColor = (severity: number) => {
        if (severity >= 7) return '#ef4444';
        if (severity >= 5) return '#f59e0b';
        return '#10b981';
    };

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 90) return '#ef4444';
        if (confidence >= 80) return '#f97316';
        if (confidence >= 70) return '#eab308';
        return '#10b981';
    };

    return (
        <div className={`glass-card ${styles.container}`}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h4 className={styles.title}>
                        <span className={styles.titleIcon}>🛡️</span>
                        Dark Pattern Detection
                    </h4>
                    <span className={styles.subtitle}>
                        {reports.length > 0 ? `${reports.length} report${reports.length > 1 ? 's' : ''} analyzed` : 'Upload a screenshot to detect'}
                    </span>
                </div>
                <div className={styles.headerRight}>
                    <span className={`${styles.scanBadge} ${scanActive ? styles.scanning : ''}`}>
                        <span className={styles.scanDot} />
                        {scanActive ? 'Analyzing...' : 'Rekognition Active'}
                    </span>
                </div>
            </div>

            <div className={styles.list}>
                {reports.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>📸</div>
                        <p className={styles.emptyTitle}>No screenshots analyzed yet</p>
                        <p className={styles.emptyText}>
                            Upload a cancellation or subscription page screenshot to detect dark patterns
                        </p>
                        {onUploadClick && (
                            <button className={styles.emptyUploadBtn} onClick={onUploadClick}>
                                📸 Upload Screenshot
                            </button>
                        )}
                    </div>
                ) : (
                    reports.map((report, reportIndex) => (
                        <div key={`${report.provider}-${reportIndex}`} className={styles.reportCard}>
                            <div
                                className={styles.reportHeader}
                                onClick={() => setExpandedProvider(expandedProvider === report.provider ? null : report.provider)}
                            >
                                <div className={styles.reportHeaderLeft}>
                                    <div className={styles.providerDot} style={{ backgroundColor: report.providerColor }} />
                                    <div>
                                        <span className={styles.providerName}>{report.provider}</span>
                                        <span className={styles.analyzedTime}>{report.analyzedAt}</span>
                                    </div>
                                </div>
                                <div className={styles.reportHeaderRight}>
                                    <div className={styles.hostilityBadge} style={{
                                        color: getSeverityColor(report.hostility),
                                        borderColor: `${getSeverityColor(report.hostility)}30`,
                                        background: `${getSeverityColor(report.hostility)}10`,
                                    }}>
                                        <span className={styles.hostilityValue}>{report.hostility.toFixed(1)}</span>
                                        <span className={styles.hostilityLabel}>Hostility</span>
                                    </div>
                                    <span className={styles.patternCount}>
                                        {report.patterns.length} pattern{report.patterns.length !== 1 ? 's' : ''}
                                    </span>
                                    <span className={styles.expandArrow} style={{
                                        transform: expandedProvider === report.provider ? 'rotate(180deg)' : 'rotate(0deg)',
                                    }}>▾</span>
                                </div>
                            </div>

                            {expandedProvider === report.provider && (
                                <div className={styles.patternsList}>
                                    {report.patterns.map((pattern, patternIndex) => (
                                        <div key={`${pattern.type}-${patternIndex}`} className={styles.patternItem}>
                                            <div className={styles.patternHeader}>
                                                <div className={styles.patternLeft}>
                                                    <span className={styles.patternEmoji}>{pattern.emoji}</span>
                                                    <span className={styles.patternType} style={{ color: pattern.color }}>
                                                        {pattern.type}
                                                    </span>
                                                </div>
                                                <div className={styles.patternRight}>
                                                    <span className={styles.confidenceValue} style={{
                                                        color: getConfidenceColor(pattern.confidence),
                                                    }}>
                                                        {pattern.confidence}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={styles.confidenceBar}>
                                                <div
                                                    className={styles.confidenceFill}
                                                    style={{
                                                        width: `${pattern.confidence}%`,
                                                        background: `linear-gradient(90deg, ${pattern.color}80, ${pattern.color})`,
                                                    }}
                                                />
                                            </div>
                                            <p className={styles.patternDesc}>{pattern.description}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className={styles.footer}>
                <div className={styles.legend}>
                    <span className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: '#ef4444' }} />
                        High (7-10)
                    </span>
                    <span className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: '#f59e0b' }} />
                        Medium (4-7)
                    </span>
                    <span className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: '#10b981' }} />
                        Low (0-4)
                    </span>
                </div>
                <span className="aws-badge">AWS Rekognition + Bedrock Vision</span>
            </div>
        </div>
    );
}
