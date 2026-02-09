import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'https://auth.korczewski.de';

function buildAuthLoginUrl(redirectTo: string) {
    const loginUrl = new URL('/login', AUTH_SERVICE_URL);
    loginUrl.searchParams.set('redirect', redirectTo);
    return loginUrl;
}

export function proxy(request: NextRequest) {
    // Read auth headers from Traefik ForwardAuth
    const authUser = request.headers.get('x-auth-user') || request.headers.get('x-user-name');
    const authEmail = request.headers.get('x-auth-email') || request.headers.get('x-user-email');
    const authRole = request.headers.get('x-auth-role') || request.headers.get('x-user-role');
    const authUserId = request.headers.get('x-auth-user-id') || request.headers.get('x-user-id');

    if (!authUser || !authEmail) {
        return NextResponse.redirect(buildAuthLoginUrl(request.nextUrl.href));
    }

    // Create a new headers object with auth info
    const requestHeaders = new Headers(request.headers);

    // User is authenticated via ForwardAuth
    requestHeaders.set('x-user-email', authEmail);
    requestHeaders.set('x-user-role', authRole || 'USER');
    requestHeaders.set('x-user-id', authUserId || '');
    requestHeaders.set('x-user-name', authUser);

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
