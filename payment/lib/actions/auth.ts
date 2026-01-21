'use server'

import { headers } from 'next/headers';
import { db } from '@/lib/db';

export type AuthUser = {
    id: string;
    email: string;
    name: string | null;
    role: 'USER' | 'ADMIN';
    authUserId?: number;
};

/**
 * Get the current authenticated user from ForwardAuth headers
 * This replaces NextAuth.js session management
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
    const headersList = await headers();

    const authEmail = headersList.get('x-user-email');
    const authRole = headersList.get('x-user-role');
    const authUserId = headersList.get('x-user-id');
    const authName = headersList.get('x-user-name');

    if (!authEmail) {
        return null;
    }

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

    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        authUserId: authUserId ? parseInt(authUserId) : undefined,
    };
}

/**
 * Check if the current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
    const user = await getCurrentUser();
    return user?.role === 'ADMIN';
}

/**
 * Require authentication - throws if user is not authenticated
 */
export async function requireAuth(): Promise<AuthUser> {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('Authentication required');
    }
    return user;
}

/**
 * Require admin role - throws if user is not an admin
 */
export async function requireAdmin(): Promise<AuthUser> {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
        throw new Error('Admin access required');
    }
    return user;
}
