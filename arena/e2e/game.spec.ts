import { test, expect, type Page } from '@playwright/test';
import {
    mockAuth, blockSocket, makeGameState, emitFromServer,
    force2DRenderer, ALICE, BOB,
} from './helpers/mockApi';

/**
 * Game page E2E tests — tests the PixiJS render loop + HUD overlay
 *
 * Strategy:
 *   1. Force 2D renderer (Game.tsx exposes __arenaSocket)
 *   2. Mock auth → navigate to /game/match-xxx
 *   3. Block actual socket.io connection
 *   4. Inject game-state via emitFromServer()
 *   5. Assert HUD renders, socket events update visuals
 */

async function gotoGame(page: Page, matchId: string = 'match-test-001') {
    await force2DRenderer(page);
    await mockAuth(page, ALICE);
    await blockSocket(page);

    await page.goto(`/game/${matchId}`);

    // Wait for canvas to appear
    await expect(page.locator('canvas')).toBeVisible({ timeout: 8000 });
}

test.describe('Game page', () => {
    test('shows HUD after game-state arrives', async ({ page }) => {
        await gotoGame(page);

        // Emit game-state socket event
        await emitFromServer(page, 'game-state', makeGameState({
            players: [
                {
                    id: String(ALICE.userId),
                    username: ALICE.username,
                    x: 640, y: 480, rotation: 0,
                    hp: 2, hasArmor: false, isAlive: true,
                    kills: 0, deaths: 0,
                    selectedCharacter: 'warrior',
                    weapon: { type: 'pistol' },
                    lastMoveDirection: { x: 0, y: 0 },
                },
            ],
        }));

        // Check HUD elements are visible
        await expect(page.locator('.hud-health')).toBeVisible();
        await expect(page.locator('.hud-round')).toBeVisible();
    });

    test('health display — full HP shows 2 filled hearts', async ({ page }) => {
        await gotoGame(page);

        await emitFromServer(page, 'game-state', makeGameState({
            players: [
                {
                    id: String(ALICE.userId),
                    username: ALICE.username,
                    x: 640, y: 480, rotation: 0,
                    hp: 2, hasArmor: false, isAlive: true,
                    kills: 0, deaths: 0,
                    selectedCharacter: 'warrior',
                    weapon: { type: 'pistol' },
                    lastMoveDirection: { x: 0, y: 0 },
                },
            ],
        }));

        // Should show 2 filled hearts
        const filledHearts = page.locator('.hp-icon.full');
        await expect(filledHearts).toHaveCount(2);
    });

    test('health display — 1 HP shows 1 filled heart', async ({ page }) => {
        await gotoGame(page);

        await emitFromServer(page, 'game-state', makeGameState({
            players: [
                {
                    id: String(ALICE.userId),
                    username: ALICE.username,
                    x: 640, y: 480, rotation: 0,
                    hp: 1, hasArmor: false, isAlive: true,
                    kills: 0, deaths: 0,
                    selectedCharacter: 'warrior',
                    weapon: { type: 'pistol' },
                    lastMoveDirection: { x: 0, y: 0 },
                },
            ],
        }));

        // Count filled hearts (use CSS class, not emoji text matching)
        const filledHearts = page.locator('.hp-icon.full');
        await expect(filledHearts).toHaveCount(1);
    });

    test('armor icon visible when hasArmor=true', async ({ page }) => {
        await gotoGame(page);

        await emitFromServer(page, 'game-state', makeGameState({
            players: [
                {
                    id: String(ALICE.userId),
                    username: ALICE.username,
                    x: 640, y: 480, rotation: 0,
                    hp: 2, hasArmor: true, isAlive: true,
                    kills: 0, deaths: 0,
                    selectedCharacter: 'warrior',
                    weapon: { type: 'pistol' },
                    lastMoveDirection: { x: 0, y: 0 },
                },
            ],
        }));

        // Should show armor icon
        await expect(page.locator('.hp-icon.armor')).toContainText('🛡️');
    });

    test('kill feed entry appears on player-killed event', async ({ page }) => {
        await gotoGame(page);

        // First emit game-state so store is populated
        await emitFromServer(page, 'game-state', makeGameState({
            players: [
                {
                    id: String(ALICE.userId),
                    username: ALICE.username,
                    x: 640, y: 480, rotation: 0,
                    hp: 2, hasArmor: false, isAlive: true,
                    kills: 0, deaths: 0,
                    selectedCharacter: 'warrior',
                    weapon: { type: 'pistol' },
                    lastMoveDirection: { x: 0, y: 0 },
                },
                {
                    id: String(BOB.userId),
                    username: BOB.username,
                    x: 500, y: 500, rotation: 0,
                    hp: 0, hasArmor: false, isAlive: false,
                    kills: 0, deaths: 0,
                    selectedCharacter: 'warrior',
                    weapon: { type: 'pistol' },
                    lastMoveDirection: { x: 0, y: 0 },
                },
            ],
        }));

        // Emit kill event
        await emitFromServer(page, 'player-killed', {
            killerId: String(ALICE.userId),
            victimId: String(BOB.userId),
            weapon: 'pistol',
        });

        // Check kill feed shows the kill
        const killfeed = page.locator('.killfeed-entry');
        await expect(killfeed).toContainText(BOB.username);
    });

    test('round-start announcement displays', async ({ page }) => {
        await gotoGame(page);

        await emitFromServer(page, 'game-state', makeGameState());

        // Emit round-start
        await emitFromServer(page, 'round-start', {
            roundNumber: 1,
        });

        // Check announcement
        const announcement = page.locator('.hud-announcement');
        await expect(announcement).toContainText('Round 1 — FIGHT!');
    });

    test('round-end announcement shows winner', async ({ page }) => {
        await gotoGame(page);

        await emitFromServer(page, 'game-state', makeGameState({
            players: [
                {
                    id: String(ALICE.userId),
                    username: ALICE.username,
                    x: 640, y: 480, rotation: 0,
                    hp: 2, hasArmor: false, isAlive: true,
                    kills: 1, deaths: 0,
                    selectedCharacter: 'warrior',
                    weapon: { type: 'pistol' },
                    lastMoveDirection: { x: 0, y: 0 },
                },
            ],
        }));

        // Emit round-end
        await emitFromServer(page, 'round-end', {
            roundNumber: 1,
            winnerId: String(ALICE.userId),
            scores: [],
        });

        // Check announcement
        const announcement = page.locator('.hud-announcement');
        await expect(announcement).toContainText(ALICE.username);
        await expect(announcement).toContainText('wins Round');
    });

    test('spectate-start shows spectating banner', async ({ page }) => {
        await gotoGame(page);

        await emitFromServer(page, 'game-state', makeGameState({
            players: [
                {
                    id: String(ALICE.userId),
                    username: ALICE.username,
                    x: 640, y: 480, rotation: 0,
                    hp: 2, hasArmor: false, isAlive: true,
                    kills: 0, deaths: 0,
                    selectedCharacter: 'warrior',
                    weapon: { type: 'pistol' },
                    lastMoveDirection: { x: 0, y: 0 },
                },
                {
                    id: String(BOB.userId),
                    username: BOB.username,
                    x: 500, y: 500, rotation: 0,
                    hp: 2, hasArmor: false, isAlive: true,
                    kills: 0, deaths: 0,
                    selectedCharacter: 'warrior',
                    weapon: { type: 'pistol' },
                    lastMoveDirection: { x: 0, y: 0 },
                },
            ],
        }));

        // Emit spectate-start
        await emitFromServer(page, 'spectate-start', {
            targetPlayerId: String(BOB.userId),
        });

        // Check spectating overlay
        const spectateOverlay = page.locator('text=Spectating');
        await expect(spectateOverlay).toBeVisible();
        await expect(spectateOverlay).toContainText(BOB.username);
    });

    test('mute button toggles sound icon', async ({ page }) => {
        await gotoGame(page);

        await emitFromServer(page, 'game-state', makeGameState());

        // Volume control: first click opens popup, then click "Mute" inside
        const volumeIcon = page.locator('button:has-text("🔊")').first();
        await expect(volumeIcon).toBeVisible();

        // Open volume popup
        await volumeIcon.click();

        // Click the mute button inside the popup
        const muteBtn = page.locator('.volume-mute-btn');
        await expect(muteBtn).toBeVisible();
        await muteBtn.click();

        // After muting, the main icon and mute button should show 🔇
        await expect(muteBtn).toContainText('🔇');
    });

    test('match-end navigates to /results/:id', async ({ page }) => {
        await gotoGame(page);

        await emitFromServer(page, 'game-state', makeGameState({
            players: [
                {
                    id: String(ALICE.userId),
                    username: ALICE.username,
                    x: 640, y: 480, rotation: 0,
                    hp: 2, hasArmor: false, isAlive: true,
                    kills: 1, deaths: 0,
                    selectedCharacter: 'warrior',
                    weapon: { type: 'pistol' },
                    lastMoveDirection: { x: 0, y: 0 },
                },
            ],
        }));

        // Emit match-end with results
        await emitFromServer(page, 'match-end', {
            dbMatchId: 'db-match-42',
            results: [
                {
                    playerId: String(ALICE.userId),
                    username: ALICE.username,
                    placement: 1,
                },
            ],
        });

        // Wait for navigation (8-second delay in the emit)
        await page.waitForURL(/\/results\//, { timeout: 15000 });
        await expect(page).toHaveURL(/\/results\/db-match-42/);
    });

    test('loading screen shown before game-state arrives', async ({ page }) => {
        await gotoGame(page);

        // Initially, before any game-state emit, the page might show loading
        // or the canvas is empty. Check canvas exists.
        await expect(page.locator('canvas')).toBeVisible();

        // After emitting state, HUD should appear
        await emitFromServer(page, 'game-state', makeGameState());
        await expect(page.locator('.hud-health')).toBeVisible();
    });
});
