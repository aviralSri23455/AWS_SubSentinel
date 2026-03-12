'use client';

import { useAuth as useOidcAuth } from 'react-oidc-context';

export function useAuth() {
    const auth = useOidcAuth();

    return {
        isAuthenticated: auth.isAuthenticated,
        isLoading: auth.isLoading,
        user: auth.user,
        error: auth.error,
        signIn: () => auth.signinRedirect(),
        signOut: () => auth.removeUser(),
        idToken: auth.user?.id_token,
        accessToken: auth.user?.access_token,
        refreshToken: auth.user?.refresh_token,
    };
}
