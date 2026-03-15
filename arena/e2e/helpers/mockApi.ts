import type { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// User fixtures
// ---------------------------------------------------------------------------

export const ALICE = {
    userId: 1,
    username: 'alice',
    email: 'alice@arena.test',
    role: 'USER',
};

export const BOB = {
    userId: 2,
    username: 'bob',
    email: 'bob@arena.test',
    role: 'USER',
};

// ---------------------------------------------------------------------------
// Lobby fixture factory
// ---------------------------------------------------------------------------

export function makeLobby(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 1,
        code: 'TEST01',
        authUserId: ALICE.userId,
        status: 'waiting',
        maxPlayers: 4,
        settings: {
            maxPlayers: 4,
            bestOf: 1,
            shrinkingZone: false,
            shrinkInterval: 30,
            itemSpawns: false,
            itemSpawnInterval: 60,
            mapId: 'campus',
            mapSize: 1,
        },
        players: [
            {
                id: String(ALICE.userId),
                username: ALICE.username,
                character: 'soldier',
                characterLevel: 1,
                isReady: false,
                isHost: true,
                isConnected: true,
                joinedAt: new Date().toISOString(),
            },
        ],
        createdAt: new Date().toISOString(),
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Auth mock — intercepts /api/auth/me
// ---------------------------------------------------------------------------

export async function mockAuth(page: Page, user = ALICE) {
    await page.route('**/api/auth/me', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ user }),
        })
    );
}

// ---------------------------------------------------------------------------
// Mock unauthenticated (401) for auth/me
// ---------------------------------------------------------------------------

export async function mockAuthUnauthorized(page: Page) {
    await page.route('**/api/auth/me', (route) =>
        route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Not authenticated' }),
        })
    );
}

// ---------------------------------------------------------------------------
// Lobby API mocks
// ---------------------------------------------------------------------------

export async function mockCreateLobby(page: Page, lobby = makeLobby()) {
    await page.route('**/api/lobbies', async (route) => {
        if (route.request().method() === 'POST') {
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify(lobby),
            });
        } else {
            await route.continue();
        }
    });
}

export async function mockGetLobby(page: Page, lobby = makeLobby()) {
    await page.route(`**/api/lobbies/${lobby.code}`, async (route) => {
        if (route.request().method() === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(lobby),
            });
        } else {
            await route.continue();
        }
    });
}

export async function mockGetActiveLobbies(page: Page, lobbies: ReturnType<typeof makeLobby>[] = []) {
    await page.route('**/api/lobbies', async (route) => {
        if (route.request().method() === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(lobbies),
            });
        } else {
            await route.continue();
        }
    });
}

export async function mockDeleteLobby(page: Page, code: string) {
    await page.route(`**/api/lobbies/${code}`, async (route) => {
        if (route.request().method() === 'DELETE') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true }),
            });
        } else {
            await route.continue();
        }
    });
}

export async function mockGetLeaderboard(page: Page, rows: object[] = []) {
    await page.route('**/api/leaderboard', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(rows),
        })
    );
}

export async function mockHealth(page: Page) {
    await page.route('**/api/health', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'OK', service: 'arena-backend', database: 'connected', timestamp: new Date().toISOString() }),
        })
    );
}

// ---------------------------------------------------------------------------
// Block socket.io connections (prevents browser from trying to connect
// to backend WebSocket when running without a live server)
// ---------------------------------------------------------------------------

export async function blockSocket(page: Page) {
    await page.route('**/socket.io/**', (route) => route.abort());
}

// ---------------------------------------------------------------------------
// Simulate socket joining: inject lobby data directly into Zustand store
// via page.evaluate after navigation. Used when testing Lobby page.
// ---------------------------------------------------------------------------

export async function injectLobbyState(
    page: Page,
    payload: {
        code: string;
        isHost: boolean;
        players: object[];
        settings?: object;
    }
) {
    await page.evaluate((data) => {
        // Access the Zustand store via the window-scoped debug hook the app exposes.
        // If the app doesn't expose a hook, dispatch a custom event instead.
        window.dispatchEvent(new CustomEvent('__e2e:setLobby', { detail: data }));
    }, payload);
}

// ---------------------------------------------------------------------------
// E2E Socket Helpers — for Game page testing
// ---------------------------------------------------------------------------

/**
 * Emit a socket event from the server side by directly triggering the
 * listeners on window.__arenaSocket (exposed in Game.tsx for DEV).
 */
export async function emitFromServer(page: Page, event: string, data: unknown) {
    await page.evaluate(({ event, data }) => {
        const socket = (window as any).__arenaSocket;
        if (socket) {
            // Trigger internal listeners
            const listeners = socket._callbacks?.[`$${event}`] || [];
            listeners.forEach((fn: Function) => fn(data));
        }
    }, { event, data });
}

/**
 * Mock GET /api/matches/:id/results endpoint
 */
export async function mockMatchResults(
    page: Page,
    matchId: string,
    results: Array<{
        playerId: string;
        username: string;
        placement: number;
        kills?: number;
        deaths?: number;
        damage?: number;
        itemsCollected?: number;
        roundsWon?: number;
        xpGained?: number;
        levelBefore?: number;
        levelAfter?: number;
    }>
) {
    await page.route(`**/api/matches/${matchId}/results`, (route) => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ results }),
        });
    });
}

/**
 * Factory for creating a minimal valid game-state snapshot for E2E injection.
 */
export function makeGameState(overrides: Partial<Record<string, unknown>> = {}) {
    const now = Date.now();
    return {
        matchId: 'match-test-001',
        round: 1,
        roundStartTime: now - 5000,
        isActive: true,
        zone: {
            isActive: false,
            centerX: 640,
            centerY: 480,
            currentRadius: 1200,
            maxRadius: 1200,
        },
        players: [
            {
                id: String(ALICE.userId),
                username: ALICE.username,
                x: 640,
                y: 480,
                rotation: 0,
                hp: 2,
                hasArmor: false,
                isAlive: true,
                kills: 0,
                deaths: 0,
                selectedCharacter: 'warrior',
                weapon: { type: 'pistol' },
                lastMoveDirection: { x: 0, y: 0 },
            },
        ],
        items: [],
        projectiles: [],
        ...overrides,
    };
}
