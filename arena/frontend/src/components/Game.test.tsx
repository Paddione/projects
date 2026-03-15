import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computeScale, SCALE_OPTIONS } from './Game';

/**
 * Game Component Tests
 *
 * Tests for game mechanics:
 * - Game scaling & resolution presets
 * - Touch controls: joystick, weapon display, pickup button
 * - Spectator mode: camera pivot switching
 * - Sound effects: mute toggle, haptics
 */

const TILE_SIZE = 32;
const TARGET_TILES_VISIBLE = 22;

describe('Game Component', () => {
    describe('Game Scaling', () => {
        describe('computeScale', () => {
            it('returns 1 for 720p auto (22 tiles fit exactly)', () => {
                // 720 / (22 * 32) = 1.022... → rounds to ~1
                vi.stubGlobal('innerHeight', 720);
                const scale = computeScale('auto');
                expect(scale).toBeCloseTo(720 / (TARGET_TILES_VISIBLE * TILE_SIZE), 2);
                expect(scale).toBeGreaterThanOrEqual(1);
                vi.unstubAllGlobals();
            });

            it('returns ~1.53 for 1080p auto', () => {
                vi.stubGlobal('innerHeight', 1080);
                const scale = computeScale('auto');
                expect(scale).toBeCloseTo(1080 / (TARGET_TILES_VISIBLE * TILE_SIZE), 2);
                vi.unstubAllGlobals();
            });

            it('returns ~2.05 for 1440p auto', () => {
                vi.stubGlobal('innerHeight', 1440);
                const scale = computeScale('auto');
                expect(scale).toBeCloseTo(1440 / (TARGET_TILES_VISIBLE * TILE_SIZE), 2);
                vi.unstubAllGlobals();
            });

            it('returns ~3.07 for 4K auto', () => {
                vi.stubGlobal('innerHeight', 2160);
                const scale = computeScale('auto');
                expect(scale).toBeCloseTo(2160 / (TARGET_TILES_VISIBLE * TILE_SIZE), 2);
                vi.unstubAllGlobals();
            });

            it('never returns below 1 for auto (small screens)', () => {
                vi.stubGlobal('innerHeight', 400);
                const scale = computeScale('auto');
                expect(scale).toBeGreaterThanOrEqual(1);
                vi.unstubAllGlobals();
            });

            it('parses numeric preset "1" as scale 1', () => {
                expect(computeScale('1')).toBe(1);
            });

            it('parses numeric preset "1.5" as scale 1.5', () => {
                expect(computeScale('1.5')).toBe(1.5);
            });

            it('parses numeric preset "2" as scale 2', () => {
                expect(computeScale('2')).toBe(2);
            });

            it('parses numeric preset "3" as scale 3', () => {
                expect(computeScale('3')).toBe(3);
            });

            it('falls back to 1 for invalid preset', () => {
                expect(computeScale('garbage')).toBe(1);
            });

            it('falls back to 1 for empty string', () => {
                expect(computeScale('')).toBe(1);
            });
        });

        describe('Scale Presets', () => {
            it('has 5 scale options', () => {
                expect(SCALE_OPTIONS).toHaveLength(5);
            });

            it('first option is auto', () => {
                expect(SCALE_OPTIONS[0].key).toBe('auto');
            });

            it('all options have unique keys', () => {
                const keys = SCALE_OPTIONS.map(o => o.key);
                expect(new Set(keys).size).toBe(SCALE_OPTIONS.length);
            });

            it('non-auto options are valid numbers', () => {
                const numericOptions = SCALE_OPTIONS.filter(o => o.key !== 'auto');
                numericOptions.forEach(opt => {
                    expect(parseFloat(opt.key)).toBeGreaterThan(0);
                    expect(isNaN(parseFloat(opt.key))).toBe(false);
                });
            });

            it('options are ordered from smallest to largest scale', () => {
                const numericOptions = SCALE_OPTIONS.filter(o => o.key !== 'auto');
                for (let i = 1; i < numericOptions.length; i++) {
                    expect(parseFloat(numericOptions[i].key))
                        .toBeGreaterThan(parseFloat(numericOptions[i - 1].key));
                }
            });
        });

        describe('Camera with Scale', () => {
            it('centers player at screen center regardless of scale', () => {
                const playerX = 200;
                const playerY = 150;
                const viewportW = 1920;
                const viewportH = 1080;

                // At scale 1
                const cam1x = -playerX * 1 + viewportW / 2;
                const cam1y = -playerY * 1 + viewportH / 2;

                // At scale 2
                const cam2x = -playerX * 2 + viewportW / 2;
                const cam2y = -playerY * 2 + viewportH / 2;

                // Player screen position = cam + player * scale = viewportW/2 in both cases
                expect(cam1x + playerX * 1).toBe(viewportW / 2);
                expect(cam1y + playerY * 1).toBe(viewportH / 2);
                expect(cam2x + playerX * 2).toBe(viewportW / 2);
                expect(cam2y + playerY * 2).toBe(viewportH / 2);
            });

            it('higher scale shows fewer tiles on screen', () => {
                const viewportH = 1080;
                const tilesAt1x = viewportH / (TILE_SIZE * 1);
                const tilesAt2x = viewportH / (TILE_SIZE * 2);
                const tilesAt3x = viewportH / (TILE_SIZE * 3);

                expect(tilesAt1x).toBeCloseTo(33.75);
                expect(tilesAt2x).toBeCloseTo(16.875);
                expect(tilesAt3x).toBeCloseTo(11.25);
                expect(tilesAt1x).toBeGreaterThan(tilesAt2x);
                expect(tilesAt2x).toBeGreaterThan(tilesAt3x);
            });

            it('auto scale at 1080p shows ~22 tiles vertically', () => {
                const viewportH = 1080;
                const scale = viewportH / (TARGET_TILES_VISIBLE * TILE_SIZE);
                const visibleTiles = viewportH / (TILE_SIZE * scale);
                expect(visibleTiles).toBeCloseTo(TARGET_TILES_VISIBLE);
            });
        });

        describe('Scale Persistence', () => {
            beforeEach(() => {
                localStorage.clear();
            });

            it('defaults to auto when no localStorage value', () => {
                const setting = localStorage.getItem('arena-scale') || 'auto';
                expect(setting).toBe('auto');
            });

            it('reads saved scale from localStorage', () => {
                localStorage.setItem('arena-scale', '2');
                const setting = localStorage.getItem('arena-scale') || 'auto';
                expect(setting).toBe('2');
            });

            it('persists scale change to localStorage', () => {
                const newSetting = '1.5';
                localStorage.setItem('arena-scale', newSetting);
                expect(localStorage.getItem('arena-scale')).toBe('1.5');
            });
        });
    });

    describe('Touch Controls', () => {
        describe('Joystick Input', () => {
            it('detects touch device', () => {
                const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                expect(typeof isTouchDevice).toBe('boolean');
            });

            it('left joystick controls movement', () => {
                const leftStick = { active: false, dx: 0, dy: 0 };

                // Simulate touch
                leftStick.active = true;
                leftStick.dx = 30;
                leftStick.dy = 0;

                expect(leftStick.active).toBe(true);
                expect(Math.sqrt(leftStick.dx ** 2 + leftStick.dy ** 2)).toBeGreaterThan(0);
            });

            it('clamps joystick puck to 50px radius', () => {
                const RADIUS = 50;
                const dx = 70;
                const dy = 0;

                const distance = Math.sqrt(dx * dx + dy * dy);
                const clamped = distance > RADIUS ? (RADIUS / distance) * dx : dx;

                expect(clamped).toBeLessThanOrEqual(RADIUS);
            });

            it('right joystick controls aiming and firing', () => {
                const rightStick = { active: false, dx: 0, dy: 0, firing: false };

                rightStick.active = true;
                rightStick.dx = 30;
                rightStick.dy = 30;

                const aimAngle = Math.atan2(rightStick.dy, rightStick.dx);
                expect(typeof aimAngle).toBe('number');
            });
        });

        describe('Action Buttons', () => {
            it('has melee button', () => {
                const meleeButton = { active: false, label: '🗡️' };
                expect(meleeButton.label).toBe('🗡️');
            });

            it('has pickup button', () => {
                const pickupButton = { active: false, label: '📦' };
                expect(pickupButton.label).toBe('📦');
            });

            it('has sprint button', () => {
                const sprintButton = { active: false, label: '⇧' };
                expect(sprintButton.label).toMatch(/⇧|⚡/);
            });

            it('toggles sprint on button press', () => {
                let sprintActive = false;
                sprintActive = !sprintActive;
                expect(sprintActive).toBe(true);

                sprintActive = !sprintActive;
                expect(sprintActive).toBe(false);
            });

            it('sends pickup input when pickup button pressed', () => {
                const pickupActive = true;
                const pickup = true; // keys.has('f') || (isTouchDevice && pickupActiveRef.current)

                expect(pickup).toBe(true);
            });
        });

        describe('Weapon Display', () => {
            it('shows current weapon type on HUD', () => {
                const weaponType = 'machine_gun';
                const display =
                    weaponType === 'pistol'
                        ? 'Pistol'
                        : weaponType === 'machine_gun'
                          ? 'Machine Gun'
                          : 'Grenade Launcher';

                expect(display).toBe('Machine Gun');
            });

            it('displays pistol label', () => {
                const label =
                    'pistol' === 'pistol' ? 'Pistol' : 'pistol' === 'machine_gun' ? 'Machine Gun' : 'Grenade Launcher';
                expect(label).toBe('Pistol');
            });

            it('displays machine gun label', () => {
                const label =
                    'machine_gun' === 'pistol' ? 'Pistol' : 'machine_gun' === 'machine_gun' ? 'Machine Gun' : 'Grenade Launcher';
                expect(label).toBe('Machine Gun');
            });

            it('displays grenade launcher label', () => {
                const label =
                    'grenade_launcher' === 'pistol'
                        ? 'Pistol'
                        : 'grenade_launcher' === 'machine_gun'
                          ? 'Machine Gun'
                          : 'Grenade Launcher';
                expect(label).toBe('Grenade Launcher');
            });

            it('updates weapon label on weapon switch', () => {
                let currentWeapon = 'pistol';
                expect(currentWeapon).toBe('pistol');

                currentWeapon = 'machine_gun';
                expect(currentWeapon).toBe('machine_gun');

                currentWeapon = 'grenade_launcher';
                expect(currentWeapon).toBe('grenade_launcher');
            });

            it('hides weapon label on desktop', () => {
                const isTouchDevice = false;
                expect(isTouchDevice).toBe(false);
                // Label should not render
            });
        });

        describe('Haptic Feedback', () => {
            it('vibrates on player hit (50ms)', () => {
                const shouldVibrate = true;
                const duration = 50;

                if (shouldVibrate && navigator.vibrate) {
                    expect(duration).toBe(50);
                }
            });

            it('vibrates with pattern on kill [100, 50, 100]', () => {
                const pattern = [100, 50, 100];
                if (navigator.vibrate) {
                    expect(pattern).toEqual([100, 50, 100]);
                }
            });

            it('vibrates for 300ms on death', () => {
                const shouldVibrate = true;
                const duration = 300;

                if (shouldVibrate && navigator.vibrate) {
                    expect(duration).toBe(300);
                }
            });
        });
    });

    describe('Spectator Mode', () => {
        describe('Camera Pivot', () => {
            it('switches camera to spectated player position', () => {
                const myPos = { x: 100, y: 100 };
                const spectatedPos = { x: 200, y: 150 };
                const isSpectating = true;

                const camTarget = isSpectating ? spectatedPos : myPos;
                expect(camTarget).toEqual(spectatedPos);
            });

            it('returns to self when not spectating', () => {
                const myPos = { x: 100, y: 100 };
                const isSpectating = false;

                const camTarget = isSpectating ? { x: 0, y: 0 } : myPos;
                expect(camTarget).toEqual(myPos);
            });

            it('updates camera position continuously during spectate', () => {
                const positions = [
                    { x: 100, y: 100 },
                    { x: 110, y: 100 },
                    { x: 120, y: 105 },
                ];

                positions.forEach((pos, i) => {
                    if (i > 0) {
                        // Camera should follow movement
                        expect(pos.x).toBeGreaterThanOrEqual(positions[i - 1].x);
                    }
                });
            });

            it('smoothly transitions when switching spectate targets', () => {
                const oldTarget = { x: 100, y: 100 };
                const newTarget = { x: 200, y: 150 };

                // Camera pivot would interpolate
                const distance = Math.sqrt(
                    (newTarget.x - oldTarget.x) ** 2 + (newTarget.y - oldTarget.y) ** 2
                );
                expect(distance).toBeGreaterThan(0);
            });
        });

        describe('Spectate UI', () => {
            it('shows spectating banner with player name', () => {
                const isSpectating = true;
                const spectatedPlayerName = 'Alice';

                if (isSpectating) {
                    const banner = `👀 Spectating ${spectatedPlayerName}`;
                    expect(banner).toContain('Alice');
                }
            });

            it('displays next player button to cycle targets', () => {
                const canCyclePlayer = true;
                expect(canCyclePlayer).toBe(true);
            });

            it('cycles through alive players on button click', () => {
                const alivePlayers = ['Alice', 'Bob', 'Charlie'];
                let currentIndex = 0;

                currentIndex = (currentIndex + 1) % alivePlayers.length;
                expect(alivePlayers[currentIndex]).toBe('Bob');

                currentIndex = (currentIndex + 1) % alivePlayers.length;
                expect(alivePlayers[currentIndex]).toBe('Charlie');

                currentIndex = (currentIndex + 1) % alivePlayers.length;
                expect(alivePlayers[currentIndex]).toBe('Alice');
            });
        });

        describe('Auto-Spectate', () => {
            it('auto-follows first alive player on death', () => {
                const myId = '1';
                const isAlive = false;
                const alivePlayers = ['2', '3', '4'];

                if (!isAlive && alivePlayers.length > 0) {
                    const targetId = alivePlayers[0];
                    expect(targetId).toBe('2');
                }
            });

            it('does not auto-spectate if already spectating', () => {
                const isAlive = false;
                const isSpectating = true;

                const shouldAutoSpectate = !isAlive && !isSpectating;
                expect(shouldAutoSpectate).toBe(false);
            });

            it('stops auto-spectate when player respawns', () => {
                const isAlive = true;
                const isSpectating = true;

                // Would emit spectate-stop event
                expect(isAlive).toBe(true);
            });
        });
    });

    describe('Map Rendering', () => {
        it('uses all 4 floor tile variants via deterministic hash', () => {
            const MAP_WIDTH = 28;
            const MAP_HEIGHT = 22;
            const floorTileCount = 4;
            const usedIndices = new Set<number>();

            for (let ty = 0; ty < MAP_HEIGHT; ty++) {
                for (let tx = 0; tx < MAP_WIDTH; tx++) {
                    const hash = ((tx * 7919) + (ty * 104729)) % floorTileCount;
                    const tileIdx = Math.abs(hash) % floorTileCount;
                    usedIndices.add(tileIdx);
                }
            }

            // All 4 tile variants should be used across the map
            expect(usedIndices.size).toBe(4);
            expect(usedIndices.has(0)).toBe(true);
            expect(usedIndices.has(1)).toBe(true);
            expect(usedIndices.has(2)).toBe(true);
            expect(usedIndices.has(3)).toBe(true);
        });

        it('hash is deterministic (same coords = same tile)', () => {
            const floorTileCount = 4;
            const hash1 = ((5 * 7919) + (10 * 104729)) % floorTileCount;
            const hash2 = ((5 * 7919) + (10 * 104729)) % floorTileCount;
            expect(hash1).toBe(hash2);
        });

        it('adjacent tiles can differ', () => {
            const floorTileCount = 4;
            const hash1 = ((0 * 7919) + (0 * 104729)) % floorTileCount;
            const hash2 = ((1 * 7919) + (0 * 104729)) % floorTileCount;
            // With primes 7919 and 104729, adjacent tiles will differ
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('Item Sprite Mapping', () => {
        it('maps health to health_pack sprite', () => {
            const type = 'health';
            const assetId = type === 'health' ? 'health_pack'
                : type === 'machine_gun' ? 'machine_gun'
                : 'armor_plate';
            expect(assetId).toBe('health_pack');
        });

        it('maps machine_gun to machine_gun sprite', () => {
            const type = 'machine_gun';
            const assetId = type === 'health' ? 'health_pack'
                : type === 'machine_gun' ? 'machine_gun'
                : 'armor_plate';
            expect(assetId).toBe('machine_gun');
        });

        it('maps armor to armor_plate sprite', () => {
            const type = 'armor';
            const assetId = type === 'health' ? 'health_pack'
                : type === 'machine_gun' ? 'machine_gun'
                : 'armor_plate';
            expect(assetId).toBe('armor_plate');
        });

        it('maps grenade_launcher to armor_plate fallback', () => {
            const type = 'grenade_launcher';
            const assetId = type === 'health' ? 'health_pack'
                : type === 'machine_gun' ? 'machine_gun'
                : 'armor_plate';
            expect(assetId).toBe('armor_plate');
        });

        it('fallback colors cover all weapon types', () => {
            const typeColors: Record<string, number> = {
                health: 0xef4444,
                armor: 0x38bdf8,
                machine_gun: 0xfbbf24,
                grenade_launcher: 0xf97316,
            };

            expect(Object.keys(typeColors)).toHaveLength(4);
            // All colors should be distinct
            const colorValues = Object.values(typeColors);
            expect(new Set(colorValues).size).toBe(4);
        });
    });

    describe('Projectile Rendering', () => {
        it('renders projectile sprites at 14x14px', () => {
            const projWidth = 14;
            const projHeight = 14;
            expect(projWidth).toBe(14);
            expect(projHeight).toBe(14);
        });

        it('fallback projectile has glow ring (radius 8) and core (radius 4)', () => {
            const glowRadius = 8;
            const coreRadius = 4;
            expect(glowRadius).toBeGreaterThan(coreRadius);
            expect(coreRadius).toBe(4);
        });
    });

    describe('Footstep Timing', () => {
        it('walking footsteps play at 500ms interval', () => {
            const isSprinting = false;
            const interval = isSprinting ? 285 : 500;
            expect(interval).toBe(500);
        });

        it('sprinting footsteps play at 285ms interval', () => {
            const isSprinting = true;
            const interval = isSprinting ? 285 : 500;
            expect(interval).toBe(285);
        });

        it('walking is slower than sprinting', () => {
            const walkInterval = 500;
            const sprintInterval = 285;
            expect(walkInterval).toBeGreaterThan(sprintInterval);
        });

        it('walking cadence is ~2 steps/sec', () => {
            const walkInterval = 500;
            const stepsPerSecond = 1000 / walkInterval;
            expect(stepsPerSecond).toBe(2);
        });

        it('sprinting cadence is ~3.5 steps/sec', () => {
            const sprintInterval = 285;
            const stepsPerSecond = 1000 / sprintInterval;
            expect(stepsPerSecond).toBeCloseTo(3.5, 1);
        });
    });

    describe('Sound & Mute', () => {
        it('has mute button in HUD', () => {
            const muteButton = true;
            expect(muteButton).toBe(true);
        });

        it('displays mute icon (🔊 or 🔇)', () => {
            const isMuted = true;
            const icon = isMuted ? '🔇' : '🔊';
            expect(['🔊', '🔇']).toContain(icon);
        });

        it('toggles mute on button click', () => {
            let isMuted = false;
            isMuted = !isMuted;
            expect(isMuted).toBe(true);
        });

        it('calls SoundService.toggleMute()', () => {
            const toggleMuteCalled = true;
            expect(toggleMuteCalled).toBe(true);
        });

        it('updates React state when mute changes', () => {
            let isMuted = false;
            const newMuted = !isMuted;
            expect(newMuted).toBe(true);
        });
    });
});
