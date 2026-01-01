import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnAdmin = nextUrl.pathname.startsWith('/admin');

            if (isOnAdmin) {
                if (isLoggedIn && auth.user.role === 'ADMIN') return true;
                return false;
            }

            // Allow all other routes by default, protect specific ones via middleware logic if needed
            return true;
        },
        jwt({ token, user }) {
            if (user) {
                console.log('JWT Callback - User:', user);
                token.role = user.role;
                token.id = user.id;
                token.accessToken = (user as any).accessToken;
                token.refreshToken = (user as any).refreshToken;
                token.authUserId = (user as any).authUserId;
            }
            return token;
        },
        session({ session, token }) {
            if (token && session.user) {
                session.user.role = token.role as any; // eslint-disable-line @typescript-eslint/no-explicit-any
                session.user.id = token.id as string;
            }
            return session;
        },
    },
    providers: [], // Configured in auth.ts
} satisfies NextAuthConfig;
