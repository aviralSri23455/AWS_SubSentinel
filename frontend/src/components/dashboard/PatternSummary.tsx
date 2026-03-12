'use client';

import { useDarkPatterns } from '@/hooks/useHybridData';
import styles from './PatternSummary.module.css';

interface PatternStats {
    type: string;
    count: number;
    totalConfidence: number;
    averageConfidence: number;
    emoji: string;
    color: string;
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

export default function PatternSummary() {
    const { data: rawPatterns } = useDarkPatterns();
    
    // Calculate pattern statistics
    const patternStats = new Map<string, PatternStats>();
    
    if (rawPatterns && rawPatterns.length > 0) {
        rawPatterns.forEach(report => {
            report.patterns.forEach((pattern: any) => {
                const patternType = (pattern.patternType || pattern.type || 'UNKNOWN').toUpperCase().replace(/[\s-]/g, '_');
                const config = getPatternConfig(patternType);
                const confidence = pattern.confidence || 0.85;
                
                if (!patternStats.has(patternType)) {
                    patternStats.set(patternType, {
                        type: patternType,
                        count: 0,
                        totalConfidence: 0,
                        averageConfidence: 0,
                        emoji: config.emoji,
                        color: config.color,
                    });
                }
                
                const stats = patternStats.get(patternType)!;
                stats.count += 1;
                stats.totalConfidence += confidence;
                stats.averageConfidence = stats.totalConfidence / stats.count;
            });
        });
    }
    
    const patterns = Array.from(patternStats.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 6); // Show top 6 patterns
    
    const totalPatterns = patterns.reduce((sum, p) => sum + p.count, 0);
    
    if (totalPatterns === 0) {
        return (
            <div className={`glass-card ${styles.container}`}>
                <div className={styles.header}>
                    <h4 className={styles.title}>
                        <span className={styles.titleIcon}>📊</span>
                        Pattern Summary
                    </h4>
                    <span className={styles.subtitle}>No patterns detected yet</span>
                </div>
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📸</div>
                    <p className={styles.emptyText}>
                        Upload a screenshot to detect dark patterns
                    </p>
                </div>
            </div>
        );
    }
    
    return (
        <div className={`glass-card ${styles.container}`}>
            <div className={styles.header}>
                <h4 className={styles.title}>
                    <span className={styles.titleIcon}>📊</span>
                    Pattern Summary
                </h4>
                <span className={styles.subtitle}>
                    {totalPatterns} patterns across {rawPatterns?.length || 0} reports
                </span>
            </div>
            
            <div className={styles.patternsGrid}>
                {patterns.map((pattern) => {
                    const percentage = totalPatterns > 0 ? Math.round((pattern.count / totalPatterns) * 100) : 0;
                    const confidencePercentage = Math.round(pattern.averageConfidence * 100);
                    
                    return (
                        <div key={pattern.type} className={styles.patternCard}>
                            <div className={styles.patternHeader}>
                                <span className={styles.patternEmoji}>{pattern.emoji}</span>
                                <span className={styles.patternType} style={{ color: pattern.color }}>
                                    {pattern.type}
                                </span>
                            </div>
                            
                            <div className={styles.patternStats}>
                                <div className={styles.statRow}>
                                    <span className={styles.statLabel}>Frequency</span>
                                    <span className={styles.statValue} style={{ color: pattern.color }}>
                                        {pattern.count} ({percentage}%)
                                    </span>
                                </div>
                                
                                <div className={styles.statRow}>
                                    <span className={styles.statLabel}>Confidence</span>
                                    <span className={styles.statValue}>
                                        {confidencePercentage}%
                                    </span>
                                </div>
                            </div>
                            
                            <div className={styles.progressBar}>
                                <div 
                                    className={styles.progressFill}
                                    style={{
                                        width: `${percentage}%`,
                                        background: `linear-gradient(90deg, ${pattern.color}80, ${pattern.color})`,
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className={styles.footer}>
                <span className="aws-badge">AWS Rekognition + Bedrock Vision</span>
            </div>
        </div>
    );
}