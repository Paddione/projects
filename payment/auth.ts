import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { authConfig } from './auth.config';
import { db } from '@/lib/db';

const authServiceUrlRaw = process.env.AUTH_SERVICE_URL || 'http://localhost:5500';
const authServiceUrl = authServiceUrlRaw.replace(/\/+$/, '');
const authServiceApiUrl = authServiceUrl.endsWith('/api')
    ? authServiceUrl
    : `${authServiceUrl}/api`;

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    session: { strategy: 'jwt' },
    debug: true,
    trustHost: true,
    cookies: {
        pkceCodeVerifier: {
            name: 'next-auth.pkce.code_verifier',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
        },
    },
    logger: {
        error(code, ...message) {
            console.error('NextAuth Error:', code, message)
        },
        warn(code, ...message) {
            console.warn('NextAuth Warning:', code, message)
        },
        debug(code, ...message) {
            console.log('NextAuth Debug:', code, message)
        }
    },
    callbacks: {
        ...authConfig.callbacks,
        async signIn({ user, account, profile }) {
            console.log('Debug SignIn Callback:', {
                userEmail: user.email,
                accountProvider: account?.provider,
                profileId: profile?.sub
            });
            return true;
        },
    },
    events: {
        async signOut(message) {
            const token = (message as any)?.token?.accessToken as string | undefined;
            if (!token) return;
            try {
                await fetch(`${authServiceApiUrl}/auth/logout`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                });
            } catch (error) {
                console.warn('Failed to revoke central auth token during sign-out');
            }
        },
    },
    secret: process.env.AUTH_SECRET,
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (!parsedCredentials.success) {
                    return null;
                }

                const { email, password } = parsedCredentials.data;

                const response = await fetch(`${authServiceApiUrl}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usernameOrEmail: email, password }),
                });

                if (!response.ok) {
                    console.warn('Auth service rejected credentials:', response.status);
                    return null;
                }

                const data = await response.json().catch(() => null);
                const authUser = data?.user;

                if (!authUser) {
                    return null;
                }

                const role = authUser.role === 'ADMIN' ? 'ADMIN' : 'USER';
                const emailVerified = authUser.email_verified || authUser.emailVerified ? new Date() : null;

                const localUser = await db.user.upsert({
                    where: { email: authUser.email },
                    update: {
                        name: authUser.name ?? null,
                        role,
                        emailVerified,
                        image: authUser.avatar_url ?? null,
                    },
                    create: {
                        email: authUser.email,
                        name: authUser.name ?? null,
                        role,
                        emailVerified,
                        image: authUser.avatar_url ?? null,
                    },
                });

                return {
                    id: localUser.id,
                    email: localUser.email,
                    name: localUser.name,
                    role: localUser.role,
                    accessToken: data?.tokens?.accessToken,
                    refreshToken: data?.tokens?.refreshToken,
                    authUserId: authUser.id ?? authUser.userId,
                };
            },
        }),
    ],
});
