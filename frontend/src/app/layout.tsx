import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth/AuthProvider';

export const metadata: Metadata = {
    title: 'SubSentinel — AI Subscription Guardian',
    description: 'Five-agent AI system that fights dark patterns, negotiates subscriptions, and optimizes your financial life. Powered by AWS Bedrock with TOON-encoded prompts.',
    keywords: ['subscription management', 'dark patterns', 'AI agents', 'AWS Bedrock', 'TOON'],
    authors: [{ name: 'SubSentinel Team' }],
    openGraph: {
        title: 'SubSentinel — AI Subscription Guardian',
        description: 'The first multi-agent AI that fights for your subscriptions',
        type: 'website',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>
                <AuthProvider>
                    <div id="app-root" style={{ position: 'relative', zIndex: 1 }}>
                        {children}
                    </div>
                </AuthProvider>
            </body>
        </html>
    );
}
