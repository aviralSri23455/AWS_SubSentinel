'use client';

import { AuthProvider as OidcAuthProvider } from 'react-oidc-context';
import { ReactNode } from 'react';

const cognitoAuthConfig = {
    authority: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_YW6uFl73g',
    client_id: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '3usd1j2vhenrm9emskfdual9en',
    redirect_uri: typeof window !== 'undefined' ? window.location.origin : 'https://d84l1y8p4kdic.cloudfront.net',
    response_type: 'code',
    scope: 'phone openid email',
};

export function AuthProvider({ children }: { children: ReactNode }) {
    return (
        <OidcAuthProvider {...cognitoAuthConfig}>
            {children}
        </OidcAuthProvider>
    );
}
