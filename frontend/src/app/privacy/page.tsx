'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function PrivacyPage() {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => setIsLoaded(true), []);

    const specs = [
        {
            title: 'Data Collection & Processing',
            icon: '📊',
            items: [
                'Email receipts scanned via Amazon SES — content never stored in plaintext',
                'Calendar events accessed with read-only OAuth2 scope',
                'Screenshots processed via Rekognition — auto-deleted after analysis',
                'All PII encrypted at rest with AWS KMS (AES-256)',
            ],
        },
        {
            title: 'EARS-Compliant Privacy Specs',
            icon: '📋',
            items: [
                'EARS-1: System SHALL encrypt all user data at rest and in transit',
                'EARS-2: System SHALL NOT store raw email content beyond analysis window',
                'EARS-3: System SHALL provide data export within 24 hours of request',
                'EARS-4: System SHALL delete all user data within 30 days of account closure',
                'EARS-5: System SHALL log all data access events to CloudTrail',
            ],
        },
        {
            title: 'AWS Kiro Autopilot — Generated Tests',
            icon: '🧪',
            items: [
                '95%+ test coverage on all privacy-sensitive code paths',
                'Automated PII detection in logs (Comprehend)',
                'S3 bucket policy validation tests',
                'KMS key rotation verification',
                'CloudTrail audit log completeness checks',
            ],
        },
        {
            title: 'Data Retention',
            icon: '🗑️',
            items: [
                'Email content: Deleted after 24-hour analysis window',
                'Calendar data: Cached for 7 days, then purged',
                'Screenshots: Processed and deleted within 1 hour',
                'Negotiation drafts: Retained until user deletes',
                'Learning data: Anonymized aggregates only, no PII',
            ],
        },
    ];

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <main style={{ flex: 1, marginLeft: 260, display: 'flex', flexDirection: 'column' }}>
                <Header />
                <div style={{ padding: 'var(--spacing-xl)', opacity: isLoaded ? 1 : 0, transition: 'opacity 0.5s', maxWidth: 900 }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>🔒 Privacy & Security</h2>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-xl)' }}>
                        EARS-compliant privacy specifications • AWS KMS encryption • 95%+ test coverage via Kiro Autopilot
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                        {specs.map((section, idx) => (
                            <div
                                key={section.title}
                                className="glass-card"
                                style={{ animation: `fadeIn 0.4s ease-out ${idx * 80}ms backwards` }}
                            >
                                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span>{section.icon}</span> {section.title}
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {section.items.map((item, i) => (
                                        <div key={i} style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '0.6rem',
                                            padding: '0.45rem 0.65rem',
                                            background: 'var(--bg-glass)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '0.78rem',
                                            color: 'var(--text-secondary)',
                                            lineHeight: 1.5,
                                        }}>
                                            <span style={{ color: 'var(--color-success)', fontWeight: 700, flexShrink: 0, marginTop: '0.05rem' }}>✓</span>
                                            {item}
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
