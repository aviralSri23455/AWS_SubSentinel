'use client';

import { useEffect, useState } from 'react';
import { useRealtimeEvents, type PipelineProgress as PipelineProgressType } from '@/hooks/useRealtimeEvents';

interface PipelineStage {
    id: string;
    name: string;
    emoji: string;
    status: 'pending' | 'active' | 'complete' | 'error';
}

export default function PipelineProgress() {
    const { pipelineProgress, connected } = useRealtimeEvents();
    const [stages, setStages] = useState<PipelineStage[]>([
        { id: 'upload', name: 'Upload', emoji: '📁', status: 'pending' },
        { id: 's3', name: 'S3', emoji: '☁', status: 'pending' },
        { id: 'rekognition', name: 'Rekognition', emoji: '👁', status: 'pending' },
        { id: 'ai_vision', name: 'AI Vision', emoji: '🧠', status: 'pending' },
        { id: 'dynamodb', name: 'DynamoDB', emoji: '💾', status: 'pending' },
    ]);
    const [currentProvider, setCurrentProvider] = useState<string>('');
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        if (!pipelineProgress) return;

        const { stage, status, provider } = pipelineProgress;

        if (provider) {
            setCurrentProvider(provider);
        }

        if (stage === 'upload' && status === 'started') {
            setIsActive(true);
            setStages(prev => prev.map(s => ({ ...s, status: 'pending' })));
        }

        setStages(prev => prev.map(s => {
            if (s.id === stage) {
                if (status === 'started' || status === 'uploading' || status === 'analyzing') {
                    return { ...s, status: 'active' };
                } else if (status === 'complete') {
                    return { ...s, status: 'complete' };
                } else if (status === 'error') {
                    return { ...s, status: 'error' };
                }
            }
            const stageIndex = prev.findIndex(st => st.id === stage);
            const currentIndex = prev.findIndex(st => st.id === s.id);
            if (currentIndex < stageIndex && s.status !== 'complete') {
                return { ...s, status: 'complete' };
            }
            return s;
        }));

        if (stage === 'dynamodb' && status === 'complete') {
            setTimeout(() => {
                setIsActive(false);
                setStages(prev => prev.map(s => ({ ...s, status: 'pending' })));
            }, 3000);
        }
    }, [pipelineProgress]);

    if (!isActive) return null;

    const statusColors: Record<string, { bg: string; text: string; border: string }> = {
        pending: { bg: 'rgba(100, 116, 139, 0.15)', text: 'var(--text-muted)', border: 'rgba(100, 116, 139, 0.2)' },
        active: { bg: 'rgba(99, 102, 241, 0.2)', text: 'var(--color-primary-light)', border: 'rgba(99, 102, 241, 0.4)' },
        complete: { bg: 'rgba(16, 185, 129, 0.2)', text: 'var(--color-success)', border: 'rgba(16, 185, 129, 0.4)' },
        error: { bg: 'rgba(239, 68, 68, 0.2)', text: 'var(--color-danger)', border: 'rgba(239, 68, 68, 0.4)' },
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            zIndex: 50,
            background: 'var(--bg-secondary, rgba(15, 15, 30, 0.95))',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: 'var(--radius-xl, 16px)',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
            maxWidth: '600px',
            animation: 'fadeIn 0.3s ease-out',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
            }}>
                <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        Processing Pipeline
                    </h3>
                    {currentProvider && (
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.15rem 0 0' }}>
                            {currentProvider}
                        </p>
                    )}
                </div>
                {!connected && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-warning)' }}>⚠ Reconnecting...</span>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {stages.map((stage, index) => (
                    <div key={stage.id} style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                            <div style={{
                                width: 42,
                                height: 42,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.1rem',
                                background: statusColors[stage.status].bg,
                                border: `1px solid ${statusColors[stage.status].border}`,
                                color: statusColors[stage.status].text,
                                transition: 'all 0.3s ease',
                                animation: stage.status === 'active' ? 'livePulse 2s infinite' : undefined,
                            }}>
                                {stage.status === 'complete' ? '✓' : stage.status === 'error' ? '✕' : stage.emoji}
                            </div>
                            <span style={{
                                fontSize: '0.6rem',
                                fontWeight: 600,
                                color: statusColors[stage.status].text,
                                whiteSpace: 'nowrap',
                            }}>
                                {stage.name}
                            </span>
                        </div>

                        {index < stages.length - 1 && (
                            <div style={{
                                width: 24,
                                height: 2,
                                margin: '0 0.15rem',
                                marginBottom: '1.1rem',
                                background: stages[index + 1].status !== 'pending'
                                    ? statusColors[stages[index + 1].status].border
                                    : 'rgba(100, 116, 139, 0.15)',
                                transition: 'all 0.3s ease',
                                borderRadius: 2,
                            }} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
