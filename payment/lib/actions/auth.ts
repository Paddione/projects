'use server'

import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { cache } from 'react';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'https://auth.korczewski.de';

export type AuthUser = {
    id: string;
    email: string;
    name: string | null;
    role: 'USER' | 'ADMIN';
    authUserId?: number;
};

function buildAuthLoginUrl(redirectTo: string): string {
    const loginUrl = new URL('/login', AUTH_SERVICE_URL);
    loginUrl.searchParams.set('redirect', redirectTo);
    return loginUrl.toString();
}

export async function getRequestUrlFromHeaders(headersList: Headers): Promise<string> {
    const host = headersList.get('x-forwarded-host') || headersList.get('host');
    const protoHeader = headersList.get('x-forwarded-proto') || headersList.get('x-forwarded-protocol');
    const forwardedUri =
        headersList.get('x-forwarded-uri') ||
        headersList.get('x-original-uri') ||
        headersList.get('next-url') ||
        '/';

    if (!host) {
        return 'https://payment.korczewski.de';
    }

    const isLocal = host.includes('localhost') || host.startsWith('127.0.0.1');
    const protocol = protoHeader || (isLocal ? 'http' : 'https');
    const path = forwardedUri.startsWith('/') ? forwardedUri : `/${forwardedUri}`;

    return `${protocol}://${host}${path}`;
}

export async function getAuthLoginUrlFromHeaders(headersList: Headers): Promise<string> {
    const redirectTo = await getRequestUrlFromHeaders(headersList);
    return buildAuthLoginUrl(redirectTo);
}

/**
 * Get the current authenticated user from ForwardAuth headers
 * Wrap in React cache to prevent multiple syncs during the same request
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
    const headersList = await headers();

    const authEmail = headersList.get('x-user-email');
    const authRole = headersList.get('x-user-role');
    const authUserId = headersList.get('x-user-id');
    const authName = headersList.get('x-user-name');

    if (!authEmail) {
        return null;
    }

    try {
        // Sync user to local database
        const user = await db.user.upsert({
            where: { email: authEmail },
            update: {
                name: authName || null,
                role: authRole === 'ADMIN' ? 'ADMIN' : 'USER',
            },
            create: {
                email: authEmail,
                name: authName || null,
                role: authRole === 'ADMIN' ? 'ADMIN' : 'USER',
            },
        });

        // Ensure wallet exists
        // Use a separate try-catch because this might fail if another call just created it
        try {
            await db.wallet.upsert({
                where: { userId: user.id },
                update: {},
                create: {
                    userId: user.id,
                    balance: 0,
                },
            });
        } catch (walletError) {
            // Log but continue - another process might have created it
            console.log('Wallet sync note (likely race condition handled):', walletError instanceof Error ? walletError.message : walletError);
        }

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            authUserId: authUserId ? parseInt(authUserId) : undefined,
        };
    } catch (error) {
        console.error('User sync error:', error);
        return null;
    }
});

/**
 * Check if the current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
    const user = await getCurrentUser();
    return user?.role === 'ADMIN';
}

/**
 * Require authentication - redirects if user is not authenticated
 */
export async function requireAuth(): Promise<AuthUser> {
    const user = await getCurrentUser();
    if (!user) {
        const headersList = await headers();
        const loginUrl = await getAuthLoginUrlFromHeaders(headersList);
        redirect(loginUrl);
    }
    return user;
}

/**
 * Require admin role - redirects/throws if user is not an admin
 */
export async function requireAdmin(): Promise<AuthUser> {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
        throw new Error('Admin access required');
    }
    return user;
}
