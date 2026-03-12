'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function SettingsPage() {
    const [isLoaded, setIsLoaded] = useState(false);
    const [toonEnabled] = useState(true);

    useEffect(() => setIsLoaded(true), []);

    type Setting = {
        label: string;
        value: string | boolean;
        type: 'text' | 'toggle';
    };

    const settingSections: { title: string; icon: string; settings: Setting[] }[] = [
        {
            title: 'AWS Configuration',
            icon: 'Cloud',
            settings: [
                { label: 'AWS Region', value: 'us-east-1', type: 'text' },
                { label: 'Bedrock Model', value: 'Amazon Nova Pro', type: 'text' },
                { label: 'Cognito User Pool', value: 'us-east-1_YW6uFl73g', type: 'text' },
                { label: 'S3 Screenshots Bucket', value: 'subsentinel-screenshots', type: 'text' },
            ],
        },
        {
            title: 'Data Source',
            icon: 'Sync',
            settings: [
                { label: 'Current Mode', value: 'real', type: 'text' },
                { label: 'Fallback Data', value: 'disabled', type: 'text' },
            ],
        },
        {
            title: 'Agents',
            icon: 'Agents',
            settings: [
                { label: 'Auditor (SES + Textract)', value: true, type: 'toggle' },
                { label: 'Calendar Reasoner (Bedrock)', value: true, type: 'toggle' },
                { label: 'Negotiator (OpenSearch k-NN)', value: true, type: 'toggle' },
                { label: 'Dark Pattern Defender (Rekognition)', value: true, type: 'toggle' },
                { label: 'Learner (Comprehend)', value: true, type: 'toggle' },
            ],
        },
        {
            title: 'TOON Encoding',
            icon: 'TOON',
            settings: [
                { label: 'TOON Encoding', value: toonEnabled, type: 'toggle' },
                { label: 'Cost Savings Target', value: '60%', type: 'text' },
            ],
        },
    ];

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <main style={{ flex: 1, marginLeft: 260, display: 'flex', flexDirection: 'column' }}>
                <Header />
                <div style={{ padding: 'var(--spacing-xl)', opacity: isLoaded ? 1 : 0, transition: 'opacity 0.5s', maxWidth: 900 }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>Settings</h2>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-xl)' }}>
                        Configure SubSentinel agents, AWS services, and TOON encoding
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                        {settingSections.map((section, idx) => (
                            <div
                                key={section.title}
                                className="glass-card"
                                style={{ animation: `fadeIn 0.4s ease-out ${idx * 80}ms backwards` }}
                            >
                                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span>{section.icon}</span> {section.title}
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    {section.settings.map(s => (
                                        <div
                                            key={s.label}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '0.5rem 0.75rem',
                                                background: 'var(--bg-glass)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 'var(--radius-md)',
                                            }}
                                        >
                                            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{s.label}</span>
                                            {s.type === 'toggle' ? (
                                                <div
                                                    style={{
                                                        width: 36,
                                                        height: 20,
                                                        borderRadius: 'var(--radius-full)',
                                                        background: s.value ? 'var(--color-success)' : 'var(--text-muted)',
                                                        position: 'relative',
                                                        transition: 'background 0.2s',
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            top: 2,
                                                            left: s.value ? 18 : 2,
                                                            width: 16,
                                                            height: 16,
                                                            borderRadius: '50%',
                                                            background: 'white',
                                                            transition: 'left 0.2s',
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--color-primary-light)' }}>
                                                    {String(s.value)}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
