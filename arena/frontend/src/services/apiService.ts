import { io, Socket } from 'socket.io-client';

const env = (window as any).__IMPORT_META_ENV__ || {};
const API_URL = import.meta.env.VITE_API_URL || env.VITE_API_URL || '';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || env.VITE_SOCKET_URL || window.location.origin;
const AUTH_SERVICE_URL = import.meta.env.VITE_AUTH_SERVICE_URL || env.VITE_AUTH_SERVICE_URL || '';

// ============================================================================
// REST API
// ============================================================================

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${url}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        ...options,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || res.statusText);
    }
    return res.json();
}

export const api = {
    // Auth
    getMe: () => fetchJSON<{ user: { userId: number; username: string; email: string; role: string } }>('/api/auth/me'),
    getAuthServiceUrl: () => AUTH_SERVICE_URL,

    // Health
    health: () => fetchJSON<{ status: string }>('/api/health'),

    // Lobbies
    createLobby: (data: { settings?: Record<string, unknown> }) =>
        fetchJSON('/api/lobbies', { method: 'POST', body: JSON.stringify(data) }),

    getLobby: (code: string) => fetchJSON(`/api/lobbies/${code}`),
    getActiveLobbies: () => fetchJSON('/api/lobbies'),
    deleteLobby: (code: string) => fetchJSON(`/api/lobbies/${code}`, { method: 'DELETE' }),

    // Players
    getPlayer: (authUserId: number) => fetchJSON(`/api/players/${authUserId}`),
    createPlayer: (data: { authUserId: number; username: string; selectedCharacter?: string }) =>
        fetchJSON('/api/players', { method: 'POST', body: JSON.stringify(data) }),

    // Leaderboard
    getLeaderboard: () => fetchJSON('/api/leaderboard'),

    // Matches
    getMatches: (limit = 20) => fetchJSON(`/api/matches?limit=${limit}`),
    getMatchResults: (matchId: number) => fetchJSON(`/api/matches/${matchId}/results`),

    // Campaign
    campaign: {
        getProgress: () => fetchJSON('/api/campaign/progress'),
        getVocab: () => fetchJSON('/api/campaign/vocab'),
    },
};

// ============================================================================
// SOCKET
// ============================================================================

let socket: Socket | null = null;

export function getSocket(): Socket {
    if (!socket) {
        socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            autoConnect: true,
        });
    }
    return socket;
}

export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
