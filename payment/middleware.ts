import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // Read auth headers from Traefik ForwardAuth
    const authUser = request.headers.get('x-auth-user');
    const authEmail = request.headers.get('x-auth-email');
    const authRole = request.headers.get('x-auth-role');
    const authUserId = request.headers.get('x-auth-user-id');

    // Create a new headers object with auth info
    const requestHeaders = new Headers(request.headers);

    if (authUser && authEmail) {
        // User is authenticated via ForwardAuth
        requestHeaders.set('x-user-email', authEmail);
        requestHeaders.set('x-user-role', authRole || 'USER');
        requestHeaders.set('x-user-id', authUserId || '');
        requestHeaders.set('x-user-name', authUser);
    }

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
