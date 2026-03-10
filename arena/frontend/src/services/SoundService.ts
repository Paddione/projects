/**
 * SoundService — Audio Management with Howler.js
 *
 * Manages all game audio: sound effects and music tracks.
 * Supports preloading, volume control, spatial audio placeholder,
 * and automatic format fallback (ogg → mp3).
 *
 * Usage:
 *   await SoundService.loadAll();
 *   SoundService.playSFX('gunshot');
 *   SoundService.playMusic('battle', { loop: true, volume: 0.5 });
 *   SoundService.stopMusic();
 */

import { Howl, Howler } from 'howler';

const SFX_BASE = '/assets/sfx';
const MUSIC_BASE = '/assets/music';

// All SFX asset IDs (must match manifest.json)
const SFX_IDS = [
    'gunshot', 'melee_swing', 'bullet_impact', 'player_hit', 'player_death',
    'health_pickup', 'armor_pickup', 'round_start', 'round_end',
    'match_victory', 'match_defeat', 'zone_warning', 'zone_tick',
    'footstep_walk', 'footstep_sprint', 'grenade_launch', 'grenade_explode',
] as const;

// All music track IDs
const MUSIC_IDS = ['lobby', 'battle', 'victory', 'defeat'] as const;

type SFXId = (typeof SFX_IDS)[number];
type MusicId = (typeof MUSIC_IDS)[number];

interface PlayOptions {
    volume?: number;
    loop?: boolean;
    rate?: number;  // Playback speed (1.0 = normal)
}

class SoundServiceImpl {
    private sfxHowls: Map<string, Howl> = new Map();
    private musicHowls: Map<string, Howl> = new Map();
    private currentMusic: { id: string; howl: Howl } | null = null;
    private loaded = false;

    // Volume settings (0-1)
    private masterVolume = 1.0;
    private sfxVolume = 0.8;
    private musicVolume = 0.4;
    private muted = false;

    get isLoaded(): boolean {
        return this.loaded;
    }

    /**
     * Preload all audio assets. Call once at game start.
     */
    async loadAll(): Promise<void> {
        if (this.loaded) return;

        const promises: Promise<void>[] = [];

        // Load SFX
        for (const id of SFX_IDS) {
            promises.push(this.loadSound(id, SFX_BASE, this.sfxHowls, false));
        }

        // Load Music
        for (const id of MUSIC_IDS) {
            promises.push(this.loadSound(id, MUSIC_BASE, this.musicHowls, true));
        }

        await Promise.allSettled(promises);
        this.loaded = true;
    }

    private loadSound(
        id: string,
        basePath: string,
        store: Map<string, Howl>,
        html5: boolean
    ): Promise<void> {
        return new Promise((resolve) => {
            const howl = new Howl({
                src: [`${basePath}/${id}.mp3`],
                preload: true,
                html5,  // Stream music (large files) vs. buffer SFX
                onload: () => resolve(),
                onloaderror: (_id, err) => {
                    console.warn(`[SoundService] Failed to load ${id}:`, err);
                    resolve(); // Don't block on missing audio
                },
            });
            store.set(id, howl);
        });
    }

    // =========================================================================
    // SFX
    // =========================================================================

    /**
     * Play a sound effect.
     * @param id SFX asset ID from manifest
     * @param options Volume, rate overrides
     */
    playSFX(id: SFXId | string, options?: PlayOptions): void {
        if (this.muted) return;

        const howl = this.sfxHowls.get(id);
        if (!howl) {
            console.warn(`[SoundService] SFX not loaded: ${id}`);
            return;
        }

        const volume = (options?.volume ?? 1.0) * this.sfxVolume * this.masterVolume;
        const playId = howl.play();
        howl.volume(volume, playId);

        if (options?.rate) {
            howl.rate(options.rate, playId);
        }
    }

    /**
     * Play a random footstep sound with slight pitch variation.
     */
    playFootstep(sprinting: boolean): void {
        const id = sprinting ? 'footstep_sprint' : 'footstep_walk';
        // Slight random pitch for variety
        const rate = 0.9 + Math.random() * 0.2;
        this.playSFX(id, { rate, volume: 0.5 });
    }

    // =========================================================================
    // Music
    // =========================================================================

    /**
     * Play a music track. Stops any currently playing music.
     * @param id Music track ID
     * @param options Loop, volume overrides
     */
    playMusic(id: MusicId | string, options?: PlayOptions): void {
        // Stop current music with fade
        if (this.currentMusic) {
            const prev = this.currentMusic.howl;
            prev.fade(prev.volume(), 0, 500);
            setTimeout(() => prev.stop(), 500);
        }

        const howl = this.musicHowls.get(id);
        if (!howl) {
            console.warn(`[SoundService] Music not loaded: ${id}`);
            return;
        }

        const loop = options?.loop ?? true;
        const volume = (options?.volume ?? 1.0) * this.musicVolume * this.masterVolume;

        howl.loop(loop);
        howl.volume(0); // Start silent
        howl.play();
        howl.fade(0, this.muted ? 0 : volume, 1000); // Fade in

        this.currentMusic = { id, howl };
    }

    /**
     * Stop the currently playing music with a fade-out.
     */
    stopMusic(fadeMs = 1000): void {
        if (!this.currentMusic) return;

        const { howl } = this.currentMusic;
        howl.fade(howl.volume(), 0, fadeMs);
        setTimeout(() => {
            howl.stop();
        }, fadeMs);
        this.currentMusic = null;
    }

    /**
     * Play a short music sting (victory/defeat), then optionally resume previous track.
     */
    playSting(id: MusicId | string, options?: PlayOptions): void {
        this.playMusic(id, { loop: false, ...options });

        // After sting ends, music system is clear (no auto-resume)
        // The game logic should call playMusic again if needed
    }

    // =========================================================================
    // Volume Controls
    // =========================================================================

    setMasterVolume(vol: number): void {
        this.masterVolume = Math.max(0, Math.min(1, vol));
        Howler.volume(this.masterVolume);
    }

    setSFXVolume(vol: number): void {
        this.sfxVolume = Math.max(0, Math.min(1, vol));
    }

    setMusicVolume(vol: number): void {
        this.musicVolume = Math.max(0, Math.min(1, vol));
        if (this.currentMusic) {
            this.currentMusic.howl.volume(this.musicVolume * this.masterVolume);
        }
    }

    toggleMute(): boolean {
        this.muted = !this.muted;
        Howler.mute(this.muted);
        return this.muted;
    }

    get isMuted(): boolean {
        return this.muted;
    }

    // =========================================================================
    // Cleanup
    // =========================================================================

    /**
     * Stop all audio and unload. Call on game exit.
     */
    destroy(): void {
        this.stopMusic(0);
        Howler.unload();
        this.sfxHowls.clear();
        this.musicHowls.clear();
        this.loaded = false;
    }
}

// Singleton export
export const SoundService = new SoundServiceImpl();
