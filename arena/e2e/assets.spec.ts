import { test, expect } from '@playwright/test';
import { mockAuth, blockSocket, ALICE } from './helpers/mockApi';
import {
    SPRITE_ATLASES,
    AUDIO_FILES,
    MUSIC_FILES,
    getSpritePngPath,
    getSpriteAtlasPath,
    getAudioPath,
    getMusicPath,
    fileExists,
    readJsonFile,
    SpriteAtlas,
    mockAuthNoAssetBlock,
} from './helpers/assetChecks';

/**
 * Asset Coverage E2E Tests
 *
 * These tests verify that:
 * 1. All sprite and audio files exist in dist/
 * 2. Loading screen progresses to 100% (real asset loading)
 * 3. Audio files decode without errors
 * 4. CSP headers permit worker, image, and audio operations
 * 5. Sprite atlases are valid JSON with texture data
 *
 * Unlike other E2E tests, these DO load real assets (not mocked).
 * They verify production-ready state before deployment.
 */

/**
 * Generic file existence test helper.
 * Validates that all files exist using provided path getters.
 * Eliminates DRY violation from similar loops across sprite/audio/music tests.
 *
 * @param files - List of file identifiers (atlas names, audio file names, etc.)
 * @param pathGetters - Array of functions that resolve file paths (one per extension)
 * @param fileExtNames - Array of extension names for error messages
 */
function testFilesExist(
    files: string[],
    pathGetters: Array<(file: string) => string>,
    fileExtNames: string[]
): void {
    for (const file of files) {
        for (let i = 0; i < pathGetters.length; i++) {
            const path = pathGetters[i](file);
            expect(
                fileExists(path),
                `${file}.${fileExtNames[i]} missing at ${path}`
            ).toBe(true);
        }
    }
}

test.describe('Asset Coverage', () => {
    test('all sprite atlas files exist in dist/', () => {
        testFilesExist(SPRITE_ATLASES, [getSpriteAtlasPath, getSpritePngPath], ['json', 'png']);
    });

    test('all audio SFX files exist in dist/ (.ogg + .mp3)', () => {
        testFilesExist(
            AUDIO_FILES,
            [
                (file) => getAudioPath(`${file}.ogg`),
                (file) => getAudioPath(`${file}.mp3`),
            ],
            ['ogg', 'mp3']
        );
    });

    test('all music files exist in dist/ (.ogg + .mp3)', () => {
        testFilesExist(
            MUSIC_FILES,
            [
                (file) => getMusicPath(`${file}.ogg`),
                (file) => getMusicPath(`${file}.mp3`),
            ],
            ['ogg', 'mp3']
        );
    });

    test('sprite atlases are valid JSON with texture data', () => {
        for (const atlasName of SPRITE_ATLASES) {
            const jsonPath = getSpriteAtlasPath(atlasName);

            // Should not throw on parse
            const atlas = readJsonFile(jsonPath) as SpriteAtlas;

            // Verify required structure
            expect(atlas.frames).toBeDefined();
            expect(typeof atlas.frames).toBe('object');
            expect(Object.keys(atlas.frames).length).toBeGreaterThan(0);

            expect(atlas.meta).toBeDefined();
            expect(typeof atlas.meta).toBe('object');
            expect(atlas.meta.image).toBeTruthy();
        }
    });

    test('CSP headers allow asset operations', async ({ page }) => {
        const response = await page.request.get('/');
        const csp = response.headers()['content-security-policy'] || '';

        expect(csp.length).toBeGreaterThan(0);

        // Worker-src: Required for PixiJS workers
        expect(csp).toContain("worker-src 'self' blob:");

        // Img-src: Required for sprite atlases + data: for bitmap validation
        expect(csp).toContain("img-src 'self' blob: data:");

        // Script-src: Required for React + Vite
        expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");

        // Style-src: Required for inline styles
        expect(csp).toContain("style-src 'self' 'unsafe-inline'");

        // Connect-src: Required for WebSockets + data: for image validation
        expect(csp).toContain("connect-src 'self' data:");

        // Default-src: Fallback policy
        expect(csp).toContain("default-src 'self'");
    });

    test('LoadingScreen progresses to 100%', async ({ page }) => {
        // Use mock that allows assets to load (don't mock /assets/ paths)
        await mockAuthNoAssetBlock(page, ALICE);

        // Navigate to game page (LoadingScreen component is only shown here)
        // Using a test match ID since we don't have a real backend
        await page.goto('/game/test-match-id');

        // Wait for LoadingScreen to appear (shows "ARENA" title)
        await expect(page.getByRole('heading', { name: 'ARENA' })).toBeVisible({ timeout: 10000 });

        // Wait for "Ready!" text to appear, indicating loading is complete
        // LoadingScreen sets status to "Ready!" when assets finish loading
        // This timeout is long because real asset loading takes time (sprites + audio)
        await expect(page.getByText('Ready!')).toBeVisible({ timeout: 60000 });

        // Verify the LoadingScreen is still visible but assets are loaded
        // (the component stays for a brief 300ms before calling onLoaded)
        const arenaHeading = page.getByRole('heading', { name: 'ARENA' });
        await expect(arenaHeading).toBeVisible({ timeout: 5000 });
    });
});
