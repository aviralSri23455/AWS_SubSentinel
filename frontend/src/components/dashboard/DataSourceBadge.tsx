'use client';

import type { DataSource } from '@/lib/api';

interface Props {
    source: DataSource;
    latencyMs: number;
}

const sourceConfig: Record<DataSource, { label: string; color: string; bg: string; border: string }> = {
    aws: {
        label: 'Live AWS',
        color: 'var(--color-success)',
        bg: 'rgba(16, 185, 129, 0.08)',
        border: 'rgba(16, 185, 129, 0.15)',
    },
    cached: {
        label: 'Cached',
        color: 'var(--color-primary-light)',
        bg: 'rgba(99, 102, 241, 0.08)',
        border: 'rgba(99, 102, 241, 0.15)',
    },
    empty: {
        label: 'No Data',
        color: 'var(--text-muted)',
        bg: 'rgba(156, 163, 175, 0.08)',
        border: 'rgba(156, 163, 175, 0.15)',
    },
};

export default function DataSourceBadge({ source, latencyMs }: Props) {
    const config = sourceConfig[source];

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.62rem',
                fontWeight: 700,
                color: config.color,
                background: config.bg,
                border: `1px solid ${config.border}`,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.02em',
            }}
        >
            {config.label}
            {latencyMs > 0 && (
                <span style={{ opacity: 0.7, fontSize: '0.58rem' }}>
                    {latencyMs}ms
                </span>
            )}
        </span>
    );
}
