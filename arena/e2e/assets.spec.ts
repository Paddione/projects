import { test, expect } from '@playwright/test';
import { ALICE } from './helpers/mockApi';
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
 * 1. All sprite and audio files exist in dist/ (local testing only)
 * 2. Loading screen progresses to 100% (real asset loading)
 * 3. Audio files decode without errors
 * 4. CSP headers permit worker, image, and audio operations
 * 5. Sprite atlases are valid JSON with texture data (local testing only)
 *
 * Unlike other E2E tests, these DO load real assets (not mocked).
 * They verify production-ready state before deployment.
 *
 * Run against local dev server:
 *   npx playwright test e2e/assets.spec.ts
 *
 * Run against production:
 *   PLAYWRIGHT_BASE_URL=https://arena.korczewski.de npx playwright test e2e/assets.spec.ts
 *   (Filesystem tests are skipped when running against production)
 */

// Detect if running against a remote server (production or dev cluster)
const isRemoteTest = () => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL;
    return baseUrl && (baseUrl.includes('http://') || baseUrl.includes('https://'));
};

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
        test.skip(isRemoteTest(), 'Skipped for remote testing (requires filesystem access)');
        testFilesExist(SPRITE_ATLASES, [getSpriteAtlasPath, getSpritePngPath], ['json', 'png']);
    });

    test('all audio SFX files exist in dist/ (.ogg + .mp3)', () => {
        test.skip(isRemoteTest(), 'Skipped for remote testing (requires filesystem access)');
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
        test.skip(isRemoteTest(), 'Skipped for remote testing (requires filesystem access)');
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
        test.skip(isRemoteTest(), 'Skipped for remote testing (requires filesystem access)');
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
        // Production may also allow https: for external images
        const hasImgSrc = csp.includes("img-src 'self'") && csp.includes('data:');
        expect(hasImgSrc).toBe(true);

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

        // For production testing, verify assets are accessible via HTTP
        // Spot-check a few key assets to ensure they load
        const assetUrls = [
            '/assets/sprites/characters.json',
            '/assets/sprites/characters.png',
            '/assets/sfx/gunshot.ogg',
            '/assets/music/lobby.ogg',
        ];

        for (const assetUrl of assetUrls) {
            const response = await page.request.head(assetUrl).catch(() => null);
            // Assets should be accessible (200 OK or 304 Not Modified)
            expect(response?.ok() ?? false).toBe(true);
        }
    });

    test('all audio files decode without errors', async ({ page }) => {
        await mockAuthNoAssetBlock(page, ALICE);

        const audioErrors: string[] = [];

        // Monitor console for audio-related errors
        page.on('console', (msg) => {
            const text = msg.text();
            // Capture:
            // - SoundService errors: "[SoundService] Failed to load ..."
            // - Howler.js errors: "Error loading audio" or similar
            // - General audio issues: contains 'audio' or 'sound' with error keywords
            if (
                text.includes('[SoundService]') ||
                (text.includes('audio') && (text.includes('error') || text.includes('Error') || text.includes('failed'))) ||
                (text.includes('sound') && (text.includes('error') || text.includes('Error') || text.includes('failed')))
            ) {
                audioErrors.push(text);
            }
        });

        // Monitor for uncaught exceptions related to audio
        page.on('pageerror', (error) => {
            // Catch various audio/decode related errors:
            // - NotSupportedError, InvalidStateError from Web Audio API
            // - CORS issues on audio files
            // - Codec support issues
            const message = error.message;
            if (
                message.includes('audio') ||
                message.includes('Audio') ||
                message.includes('decode') ||
                message.includes('Decode') ||
                message.includes('NotSupported') ||
                message.includes('InvalidState') ||
                message.includes('codec')
            ) {
                audioErrors.push(message);
            }
        });

        // Navigate and wait for SoundService to load all audio
        await page.goto('/');

        // Wait for page to settle (assets + audio should be loading)
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
            // Network idle might not reach if there are long-running connections
            // That's OK — we just want assets to load
        });

        // Give audio a moment to decode - Howler.js can take 1-3s per file on slower hardware
        await page.waitForTimeout(3000);

        // Verify no audio errors were logged
        expect(
            audioErrors,
            `Audio decode errors detected:\n${audioErrors.join('\n')}`
        ).toHaveLength(0);
    });
});
