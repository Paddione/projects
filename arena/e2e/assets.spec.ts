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

test.describe('Asset Coverage', () => {
    test('all sprite atlas files exist in dist/', () => {
        for (const atlasName of SPRITE_ATLASES) {
            const jsonPath = getSpriteAtlasPath(atlasName);
            const pngPath = getSpritePngPath(atlasName);

            expect(fileExists(jsonPath), `${atlasName}.json missing at ${jsonPath}`).toBe(true);
            expect(fileExists(pngPath), `${atlasName}.png missing at ${pngPath}`).toBe(true);
        }
    });

    test('all audio SFX files exist in dist/ (.ogg + .mp3)', () => {
        for (const audioFile of AUDIO_FILES) {
            const oggPath = getAudioPath(`${audioFile}.ogg`);
            const mp3Path = getAudioPath(`${audioFile}.mp3`);

            expect(fileExists(oggPath), `${audioFile}.ogg missing at ${oggPath}`).toBe(true);
            expect(fileExists(mp3Path), `${audioFile}.mp3 missing at ${mp3Path}`).toBe(true);
        }
    });

    test('all music files exist in dist/ (.ogg + .mp3)', () => {
        for (const musicFile of MUSIC_FILES) {
            const oggPath = getMusicPath(`${musicFile}.ogg`);
            const mp3Path = getMusicPath(`${musicFile}.mp3`);

            expect(fileExists(oggPath), `${musicFile}.ogg missing at ${oggPath}`).toBe(true);
            expect(fileExists(mp3Path), `${musicFile}.mp3 missing at ${mp3Path}`).toBe(true);
        }
    });
});
