'use client';

import { useAuth } from 'react-oidc-context';

export function AuthButton() {
    const auth = useAuth();

    const signOutRedirect = () => {
        const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '3usd1j2vhenrm9emskfdual9en';
        const logoutUri = typeof window !== 'undefined' ? window.location.origin : 'https://d84l1y8p4kdic.cloudfront.net';
        const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN || 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_YW6uFl73g';
        window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
    };

    if (auth.isLoading) {
        return <div>Loading...</div>;
    }

    if (auth.error) {
        return <div>Authentication error: {auth.error.message}</div>;
    }

    if (auth.isAuthenticated) {
        return (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span>Hello, {auth.user?.profile.email}</span>
                <button onClick={() => auth.removeUser()}>Sign out</button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => auth.signinRedirect()}>Sign in</button>
        </div>
    );
}
