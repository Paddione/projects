import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Application, Container, Graphics, Text, TextStyle,
    Sprite, AnimatedSprite, Texture,
} from 'pixi.js';
import { useGameStore } from '../stores/gameStore';
import { getSocket } from '../services/apiService';
import { AssetService, type CharacterAnimation } from '../services/AssetService';
import { SoundService } from '../services/SoundService';
import LoadingScreen from './LoadingScreen';

const TILE_SIZE = 32;
const TARGET_TILES_VISIBLE = 22; // Design target: map height in tiles

// Scale presets: label shown in UI, scale factor (null = auto-compute)
export const SCALE_OPTIONS = [
    { key: 'auto', label: 'Auto' },
    { key: '1', label: '1× (720p)' },
    { key: '1.5', label: '1.5× (1080p)' },
    { key: '2', label: '2× (1440p)' },
    { key: '3', label: '3× (4K)' },
] as const;

export function computeScale(setting: string): number {
    if (setting === 'auto') {
        // Scale so ~22 tiles fit vertically, matching the default map height
        const targetHeight = TARGET_TILES_VISIBLE * TILE_SIZE;
        return Math.max(1, window.innerHeight / targetHeight);
    }
    return parseFloat(setting) || 1;
}

const CHARACTER_COLORS: Record<string, number> = {
    student: 0x00f2ff,
    student_f: 0x00f2ff,
    researcher: 0x3eff8b,
    researcher_f: 0x3eff8b,
    professor: 0xbc13fe,
    professor_f: 0xbc13fe,
    dean: 0xffd700,
    dean_f: 0xffd700,
    librarian: 0xff6b9d,
    librarian_f: 0xff6b9d,
};

export default function Game() {
    const { matchId } = useParams<{ matchId: string }>();
    const navigate = useNavigate();
    const canvasRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const gameStateRef = useRef<any>(null);
    const prevStateRef = useRef<any>(null);
    const keysRef = useRef<Set<string>>(new Set());
    const mouseRef = useRef({ x: 0, y: 0, down: false, rightDown: false });

    // ---- Touch control state ----
    // Left joystick: movement   Right joystick: aim + fire
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const leftStickRef = useRef({ active: false, startX: 0, startY: 0, dx: 0, dy: 0, touchId: -1 });
    const rightStickRef = useRef({ active: false, startX: 0, startY: 0, dx: 0, dy: 0, touchId: -1, firing: false });
    const sprintActiveRef = useRef(false);
    const meleeActiveRef = useRef(false);
    // Derived joystick puck offsets for React render (clamped to 40px radius)
    const [leftPuck, setLeftPuck] = useState({ x: 0, y: 0 });
    const [rightPuck, setRightPuck] = useState({ x: 0, y: 0 });
    const [sprintOn, setSprintOn] = useState(false);
    const [meleeOn, setMeleeOn] = useState(false);

    // Track animated sprites for reuse (avoid recreating every frame)
    const playerSpritesRef = useRef<Map<string, AnimatedSprite | Sprite>>(new Map());
    const itemSpritesRef = useRef<Map<string, AnimatedSprite | Sprite>>(new Map());
    const footstepTimerRef = useRef(0);

    const [assetsLoaded, setAssetsLoaded] = useState(false);

    const [isMuted, setIsMuted] = useState(false);

    // ---- Game scale (zoom) ----
    const [scaleSetting, setScaleSetting] = useState<string>(
        () => localStorage.getItem('arena-scale') || 'auto'
    );
    const scaleSettingRef = useRef(scaleSetting);

    const handleScaleChange = useCallback((setting: string) => {
        scaleSettingRef.current = setting;
        setScaleSetting(setting);
        localStorage.setItem('arena-scale', setting);
    }, []);

    const {
        playerId, hp, hasArmor, kills, deaths, weaponType,
        killfeed, announcement, currentRound,
        isSpectating, spectatedPlayerId,
        setPlayerState, addKillfeed, setAnnouncement, setRound, setRoundScores,
        setSpectating, setSpectatedPlayer,
        endMatch,
    } = useGameStore();

    const socket = getSocket();

    // Expose socket for E2E test helpers (emitFromServer)
    (window as any).__arenaSocket = socket;

    const useSprites = AssetService.isLoaded;

    // ============================================================================
    // INPUT HANDLING
    // ============================================================================

    const weaponCycleRef = useRef(0); // 0=none, 1=next, -1=prev

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        keysRef.current.add(e.key.toLowerCase());
        // Q key cycles to next weapon
        if (e.key.toLowerCase() === 'q') {
            weaponCycleRef.current = 1;
        }
    }, []);

    const handleKeyUp = useCallback((e: KeyboardEvent) => {
        keysRef.current.delete(e.key.toLowerCase());
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            mouseRef.current.x = e.clientX - rect.left;
            mouseRef.current.y = e.clientY - rect.top;
        }
    }, []);

    const handleMouseDown = useCallback((e: MouseEvent) => {
        if (e.button === 0) mouseRef.current.down = true;
        if (e.button === 2) mouseRef.current.rightDown = true;
    }, []);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (e.button === 0) mouseRef.current.down = false;
        if (e.button === 2) mouseRef.current.rightDown = false;
    }, []);

    const handleContextMenu = useCallback((e: Event) => e.preventDefault(), []);

    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        weaponCycleRef.current = e.deltaY > 0 ? 1 : -1;
    }, []);

    // ============================================================================
    // TOUCH INPUT HANDLERS (dual joystick)
    // ============================================================================

    // Clamp dx/dy to the joystick radius (60px = half of 120px ring)
    const RADIUS = 50;

    const handleTouchStart = useCallback((e: TouchEvent) => {
        e.preventDefault();
        const halfW = window.innerWidth / 2;
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            // Skip touches on action buttons — they have their own React handlers
            const target = t.target as HTMLElement;
            if (target.closest('.touch-action-buttons')) continue;

            if (t.clientX < halfW && !leftStickRef.current.active) {
                leftStickRef.current = { active: true, startX: t.clientX, startY: t.clientY, dx: 0, dy: 0, touchId: t.identifier };
            } else if (t.clientX >= halfW && !rightStickRef.current.active) {
                rightStickRef.current = { active: true, startX: t.clientX, startY: t.clientY, dx: 0, dy: 0, touchId: t.identifier, firing: false };
                mouseRef.current.down = true;
            }
        }
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            const ls = leftStickRef.current;
            const rs = rightStickRef.current;

            if (ls.active && t.identifier === ls.touchId) {
                const rawDx = t.clientX - ls.startX;
                const rawDy = t.clientY - ls.startY;
                const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
                const clamp = Math.min(dist, RADIUS);
                ls.dx = dist > 0 ? (rawDx / dist) * clamp : 0;
                ls.dy = dist > 0 ? (rawDy / dist) * clamp : 0;
                setLeftPuck({ x: ls.dx, y: ls.dy });
            }

            if (rs.active && t.identifier === rs.touchId) {
                const rawDx = t.clientX - rs.startX;
                const rawDy = t.clientY - rs.startY;
                const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
                const clamp = Math.min(dist, RADIUS);
                rs.dx = dist > 0 ? (rawDx / dist) * clamp : 0;
                rs.dy = dist > 0 ? (rawDy / dist) * clamp : 0;
                setRightPuck({ x: rs.dx, y: rs.dy });
            }
        }
    }, []);

    const handleTouchEnd = useCallback((e: TouchEvent) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (leftStickRef.current.active && t.identifier === leftStickRef.current.touchId) {
                leftStickRef.current = { active: false, startX: 0, startY: 0, dx: 0, dy: 0, touchId: -1 };
                setLeftPuck({ x: 0, y: 0 });
            }
            if (rightStickRef.current.active && t.identifier === rightStickRef.current.touchId) {
                rightStickRef.current = { active: false, startX: 0, startY: 0, dx: 0, dy: 0, touchId: -1, firing: false };
                mouseRef.current.down = false;
                setRightPuck({ x: 0, y: 0 });
            }
        }
    }, []);

    // ============================================================================
    // PIXI SETUP
    // ============================================================================

    useEffect(() => {
        if (!canvasRef.current || appRef.current || !assetsLoaded) return;

        const app = new Application({
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: 0x0a0b1a,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });

        canvasRef.current.appendChild(app.view as HTMLCanvasElement);
        appRef.current = app;

        // Resize canvas on orientation change / browser resize
        const resizeObserver = new ResizeObserver(() => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            app.renderer.resize(w, h);
        });
        resizeObserver.observe(document.documentElement);

        // Layer containers for z-ordering
        const worldContainer = new Container();
        const mapLayer = new Container();
        const itemLayer = new Container();
        const projectileLayer = new Container();
        const zoneLayer = new Container();
        const playerLayer = new Container();
        const labelLayer = new Container();

        worldContainer.addChild(mapLayer, itemLayer, projectileLayer, zoneLayer, playerLayer, labelLayer);
        app.stage.addChild(worldContainer);

        // Start music
        SoundService.playMusic('battle', { loop: true, volume: 0.5 });

        // Input loop — send to server
        const inputLoop = setInterval(() => {
            if (!matchId || !playerId) return;

            const keys = keysRef.current;
            const mouse = mouseRef.current;

            let mx = 0, my = 0;

            if (isTouchDevice && leftStickRef.current.active) {
                // Left joystick drives movement
                const { dx, dy } = leftStickRef.current;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 4) { mx = dx / RADIUS; my = dy / RADIUS; }
            } else {
                // Keyboard fallback
                if (keys.has('w') || keys.has('arrowup')) my = -1;
                if (keys.has('s') || keys.has('arrowdown')) my = 1;
                if (keys.has('a') || keys.has('arrowleft')) mx = -1;
                if (keys.has('d') || keys.has('arrowright')) mx = 1;
                if (mx !== 0 && my !== 0) {
                    const len = Math.sqrt(mx * mx + my * my);
                    mx /= len; my /= len;
                }
            }

            let aimAngle = 0;
            if (isTouchDevice && rightStickRef.current.active) {
                // Right joystick drives aiming
                const { dx, dy } = rightStickRef.current;
                if (Math.sqrt(dx * dx + dy * dy) > 4) {
                    aimAngle = Math.atan2(dy, dx);
                }
            } else {
                // Mouse aim fallback
                const state = gameStateRef.current;
                if (state) {
                    const me = state.players?.find((p: any) => p.id === playerId);
                    if (me) {
                        aimAngle = Math.atan2(mouse.y - window.innerHeight / 2, mouse.x - window.innerWidth / 2);
                    }
                }
            }

            const shooting = isTouchDevice ? (rightStickRef.current.active) : mouse.down;
            const melee = isTouchDevice ? meleeActiveRef.current : (mouse.rightDown || keys.has('e'));
            const sprint = isTouchDevice ? sprintActiveRef.current : keys.has('shift');

            const cycleWeapon = weaponCycleRef.current;
            weaponCycleRef.current = 0; // consume the cycle input

            socket.emit('player-input', {
                matchId,
                input: {
                    movement: { x: mx, y: my },
                    aimAngle,
                    shooting,
                    melee,
                    sprint,
                    pickup: false, // auto-pickup on walk-over (server-side)
                    cycleWeapon,
                    timestamp: Date.now(),
                },
            });
        }, 50);

        // ====================================================================
        // RENDER LOOP
        // ====================================================================

        app.ticker.add(() => {
            const state = gameStateRef.current;
            if (!state) return;

            const me = state.players?.find((p: any) => p.id === playerId);
            if (!me) return;

            // Apply game scale (zoom)
            const scale = computeScale(scaleSettingRef.current);
            worldContainer.scale.set(scale);

            // Camera follows player (adjusted for scale)
            const cameraX = -me.x * scale + window.innerWidth / 2;
            const cameraY = -me.y * scale + window.innerHeight / 2;
            worldContainer.position.set(cameraX, cameraY);

            // ---- MAP LAYER ----
            mapLayer.removeChildren();
            renderMap(mapLayer, state);

            // ---- COVER LAYER ----
            renderCover(mapLayer, state);

            // ---- ITEM LAYER ----
            itemLayer.removeChildren();
            renderItems(itemLayer, state);

            // ---- PROJECTILE LAYER ----
            projectileLayer.removeChildren();
            renderProjectiles(projectileLayer, state);

            // ---- ZONE LAYER ----
            zoneLayer.removeChildren();
            renderZone(zoneLayer, state);

            // ---- PLAYER LAYER + LABELS ----
            playerLayer.removeChildren();
            labelLayer.removeChildren();
            renderPlayers(playerLayer, labelLayer, state, me);
            renderEnemyNPCs(playerLayer, labelLayer, state);

            // ---- FOOTSTEP AUDIO ----
            handleFootstepAudio(me);
        });

        // ====================================================================
        // RENDER FUNCTIONS
        // ====================================================================

        function renderMap(container: Container, state: any) {
            const mapW = state.map?.width ?? 28;
            const mapH = state.map?.height ?? 22;
            if (useSprites) {
                const floorTiles = AssetService.getFloorTiles();
                if (floorTiles.length > 0) {
                    for (let ty = 0; ty < mapH; ty++) {
                        for (let tx = 0; tx < mapW; tx++) {
                            const tileType = state.map?.tiles?.[ty]?.[tx] ?? 0;
                            let texture: Texture | null = null;
                            if (tileType === 1) {
                                texture = AssetService.getSprite('tiles', 'wall_01');
                            } else if (tileType === 2) {
                                texture = AssetService.getSprite('tiles', 'path_01');
                            } else {
                                const hash = (tx * 7919 + ty * 104729) % floorTiles.length;
                                texture = floorTiles[Math.abs(hash) % floorTiles.length] || null;
                            }
                            if (texture) {
                                const sprite = new Sprite(texture);
                                sprite.position.set(tx * TILE_SIZE, ty * TILE_SIZE);
                                sprite.width = TILE_SIZE;
                                sprite.height = TILE_SIZE;
                                container.addChild(sprite);
                            }
                        }
                    }
                    return;
                }
            }

            // Fallback: procedural map with tile-type-aware colors
            const g = new Graphics();
            for (let ty = 0; ty < mapH; ty++) {
                for (let tx = 0; tx < mapW; tx++) {
                    const tileType = state.map?.tiles?.[ty]?.[tx] ?? 0;
                    let color: number;
                    if (tileType === 1) {
                        color = 0x2a2a4a; // wall - dark blue-gray
                    } else if (tileType === 2) {
                        color = (tx + ty) % 2 === 0 ? 0x2a2520 : 0x282320; // path - warm stone
                    } else {
                        const hash = (tx * 7919 + ty * 104729) % 4;
                        color = [0x1a2e1a, 0x1c301c, 0x182a18, 0x1e321e][Math.abs(hash) % 4]; // grass - green
                    }
                    g.beginFill(color);
                    g.drawRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    g.endFill();
                }
            }

            g.lineStyle(1, 0x222450, 0.3);
            for (let x = 0; x <= mapW; x++) {
                g.moveTo(x * TILE_SIZE, 0);
                g.lineTo(x * TILE_SIZE, mapH * TILE_SIZE);
            }
            for (let y = 0; y <= mapH; y++) {
                g.moveTo(0, y * TILE_SIZE);
                g.lineTo(mapW * TILE_SIZE, y * TILE_SIZE);
            }
            container.addChild(g);
        }

        function renderCover(container: Container, state: any) {
            if (!state.map?.coverObjects) return;

            for (const cover of state.map.coverObjects) {
                if (cover.hp === 0) continue; // destroyed

                if (useSprites) {
                    const coverSprite = AssetService.getSprite('cover', cover.type);
                    if (coverSprite) {
                        const sprite = new Sprite(coverSprite);
                        sprite.position.set(cover.x, cover.y);
                        sprite.width = cover.width;
                        sprite.height = cover.height;
                        container.addChild(sprite);
                        continue;
                    }
                }

                // Procedural fallback with distinctive shapes
                const g = new Graphics();
                const colors: Record<string, number> = {
                    building: 0x3a3a5a,
                    bench: 0x5a4020,
                    fountain: 0x1a3a5a,
                    hedge: 0x1a4a2a,
                    pond: 0x0a2a4a,
                };
                const borderColors: Record<string, number> = {
                    building: 0x5a5a7a,
                    bench: 0x7a6040,
                    fountain: 0x3a6a8a,
                    hedge: 0x2a6a3a,
                    pond: 0x1a4a6a,
                };
                const fillColor = colors[cover.type] || 0x444444;
                const borderColor = borderColors[cover.type] || 0x666666;
                const cx = cover.x + cover.width / 2;
                const cy = cover.y + cover.height / 2;

                if (cover.type === 'fountain') {
                    // Circle with inner ring
                    g.beginFill(fillColor, 0.9);
                    g.drawCircle(cx, cy, cover.width / 2);
                    g.endFill();
                    g.lineStyle(2, borderColor, 0.8);
                    g.drawCircle(cx, cy, cover.width / 2);
                    g.lineStyle(1, 0x4a8aaa, 0.5);
                    g.drawCircle(cx, cy, cover.width / 4);
                } else if (cover.type === 'pond') {
                    // Rounded rectangle with wavy feel
                    g.beginFill(fillColor, 0.7);
                    g.drawRoundedRect(cover.x + 1, cover.y + 1, cover.width - 2, cover.height - 2, 8);
                    g.endFill();
                    g.lineStyle(1, borderColor, 0.5);
                    g.drawRoundedRect(cover.x + 1, cover.y + 1, cover.width - 2, cover.height - 2, 8);
                } else if (cover.type === 'hedge') {
                    // Soft rounded shape
                    g.beginFill(fillColor, 0.85);
                    g.drawRoundedRect(cover.x + 2, cover.y + 2, cover.width - 4, cover.height - 4, 6);
                    g.endFill();
                    g.lineStyle(1.5, borderColor, 0.7);
                    g.drawRoundedRect(cover.x + 2, cover.y + 2, cover.width - 4, cover.height - 4, 6);
                } else if (cover.type === 'bench') {
                    // Rectangle with thicker border (destructible feel)
                    g.beginFill(fillColor, 0.9);
                    g.drawRect(cover.x + 1, cover.y + 1, cover.width - 2, cover.height - 2);
                    g.endFill();
                    g.lineStyle(2, borderColor, 0.8);
                    g.drawRect(cover.x + 1, cover.y + 1, cover.width - 2, cover.height - 2);
                    // Damage indicator for low HP benches
                    if (cover.hp > 0 && cover.hp < 3) {
                        g.lineStyle(1, 0xff4444, 0.4);
                        g.moveTo(cover.x + 4, cover.y + 4);
                        g.lineTo(cover.x + cover.width - 4, cover.y + cover.height - 4);
                    }
                } else {
                    // building: solid heavy block
                    g.beginFill(fillColor, 0.95);
                    g.drawRect(cover.x, cover.y, cover.width, cover.height);
                    g.endFill();
                    g.lineStyle(2, borderColor, 0.9);
                    g.drawRect(cover.x, cover.y, cover.width, cover.height);
                }
                container.addChild(g);
            }
        }

        function renderItems(container: Container, state: any) {
            const now = Date.now();
            for (const item of state.items || []) {
                // Animated bob: items float up and down (3px amplitude, 1.5s cycle)
                const bobOffset = Math.sin(now / 750 + item.x * 0.1) * 3;
                // Pulsing glow intensity
                const pulse = 0.3 + Math.sin(now / 300 + item.y * 0.05) * 0.3;
                // Scale pulse for "breathing" effect
                const scalePulse = 1.0 + Math.sin(now / 500 + item.x * 0.07) * 0.08;

                const itemColor: Record<string, number> = {
                    health: 0xef4444,
                    armor: 0x38bdf8,
                    machine_gun: 0xfbbf24,
                    grenade_launcher: 0xf97316,
                };
                const glowColor = itemColor[item.type] ?? 0xffffff;

                // Draw glow ring underneath
                const glow = new Graphics();
                glow.lineStyle(2, glowColor, pulse);
                glow.drawCircle(item.x, item.y + bobOffset, 14 * scalePulse);
                container.addChild(glow);

                if (useSprites) {
                    const assetId = item.type === 'health' ? 'health_pack'
                        : item.type === 'machine_gun' ? 'machine_gun'
                        : item.type === 'grenade_launcher' ? 'grenade_launcher'
                        : 'armor_plate';
                    const frames = AssetService.getItemAnimation('items', assetId);
                    if (frames.length > 0) {
                        const sprite = frames.length > 1
                            ? new AnimatedSprite(frames)
                            : new Sprite(frames[0]);
                        sprite.anchor.set(0.5);
                        sprite.position.set(item.x, item.y + bobOffset);
                        sprite.width = 20 * scalePulse;
                        sprite.height = 20 * scalePulse;
                        if (sprite instanceof AnimatedSprite) {
                            sprite.animationSpeed = 0.1;
                            sprite.play();
                        }
                        container.addChild(sprite);
                        continue;
                    }
                }

                // Fallback: procedural items with distinctive shapes
                const ig = new Graphics();
                const x = item.x;
                const y = item.y + bobOffset;

                if (item.type === 'health') {
                    ig.beginFill(0x1a0808, 0.6);
                    ig.drawCircle(x, y, 11 * scalePulse);
                    ig.endFill();
                    ig.beginFill(0xef4444);
                    ig.drawRect(x - 3, y - 9, 6, 18);
                    ig.drawRect(x - 9, y - 3, 18, 6);
                    ig.endFill();
                } else if (item.type === 'armor') {
                    ig.beginFill(0x081a2a, 0.6);
                    ig.drawCircle(x, y, 11 * scalePulse);
                    ig.endFill();
                    ig.beginFill(0x38bdf8);
                    ig.moveTo(x, y - 10);
                    ig.lineTo(x + 8, y);
                    ig.lineTo(x, y + 10);
                    ig.lineTo(x - 8, y);
                    ig.closePath();
                    ig.endFill();
                    ig.lineStyle(1.5, 0x0a0b1a, 0.8);
                    ig.moveTo(x - 4, y - 2);
                    ig.lineTo(x, y + 3);
                    ig.lineTo(x + 4, y - 2);
                } else if (item.type === 'machine_gun') {
                    ig.beginFill(0x1a1808, 0.6);
                    ig.drawCircle(x, y, 11 * scalePulse);
                    ig.endFill();
                    ig.beginFill(0xfbbf24);
                    ig.drawRect(x - 8, y - 3, 12, 6);
                    ig.drawRect(x + 4, y - 1.5, 6, 3);
                    ig.drawRect(x - 4, y + 3, 3, 5);
                    ig.endFill();
                } else if (item.type === 'grenade_launcher') {
                    ig.beginFill(0x1a0c04, 0.6);
                    ig.drawCircle(x, y, 11 * scalePulse);
                    ig.endFill();
                    ig.beginFill(0xf97316);
                    ig.drawRoundedRect(x - 5, y - 4, 10, 10, 3);
                    ig.endFill();
                    ig.lineStyle(2, 0xf97316, 0.9);
                    ig.moveTo(x, y - 4);
                    ig.lineTo(x + 2, y - 8);
                    ig.beginFill(0xfbbf24);
                    ig.drawCircle(x + 2, y - 9, 2);
                    ig.endFill();
                }
                container.addChild(ig);
            }
        }

        function renderProjectiles(container: Container, state: any) {
            for (const proj of state.projectiles || []) {
                if (useSprites) {
                    const tex = AssetService.getSprite('weapons', 'projectile', 0);
                    if (tex) {
                        const sprite = new Sprite(tex);
                        sprite.anchor.set(0.5);
                        sprite.position.set(proj.x, proj.y);
                        sprite.width = 14;
                        sprite.height = 14;
                        // Rotate projectile to match velocity direction
                        sprite.rotation = Math.atan2(proj.velocityY ?? 0, proj.velocityX ?? 0);
                        container.addChild(sprite);
                        continue;
                    }
                }

                // Fallback: procedural projectile with neon glow
                const pg = new Graphics();
                const isGrenade = proj.explosionRadius && proj.explosionRadius > 0;
                const coreColor = isGrenade ? 0xf97316 : 0xfbbf24;
                const glowColor = isGrenade ? 0xff6b35 : 0xfef08a;

                // Outer glow
                pg.beginFill(glowColor, 0.15);
                pg.drawCircle(proj.x, proj.y, 12);
                pg.endFill();
                // Mid glow
                pg.beginFill(coreColor, 0.3);
                pg.drawCircle(proj.x, proj.y, 7);
                pg.endFill();
                // Core
                pg.beginFill(0xffffff);
                pg.drawCircle(proj.x, proj.y, 3);
                pg.endFill();
                // Bright outline ring
                pg.lineStyle(1.5, glowColor, 0.9);
                pg.drawCircle(proj.x, proj.y, 5);
                container.addChild(pg);
            }
        }

        function renderZone(container: Container, state: any) {
            if (!state.zone?.isActive) return;

            const mapW = state.map?.width ?? 28;
            const mapH = state.map?.height ?? 22;
            const zg = new Graphics();
            zg.beginFill(0xef4444, 0.1);
            zg.drawRect(0, 0, mapW * TILE_SIZE, mapH * TILE_SIZE);
            zg.endFill();
            zg.beginFill(0x000000, 0);
            zg.drawCircle(state.zone.centerX, state.zone.centerY, state.zone.currentRadius);
            zg.endFill();
            zg.lineStyle(3, 0x38bdf8, 0.6);
            zg.drawCircle(state.zone.centerX, state.zone.centerY, state.zone.currentRadius);
            container.addChild(zg);
        }

        function renderPlayers(
            playerContainer: Container,
            labelContainer: Container,
            state: any,
            _me: any,
        ) {
            for (const player of state.players || []) {
                if (!player.isAlive) continue;

                const isMe = player.id === playerId;
                const direction = AssetService.angleToDirection(player.rotation);

                if (useSprites) {
                    // Determine animation state
                    const isMoving = player.lastMoveDirection &&
                        (player.lastMoveDirection.dx !== 0 || player.lastMoveDirection.dy !== 0);
                    const animState: CharacterAnimation = isMoving ? 'walk' : 'idle';

                    // Character ID (default to 'student' if not set)
                    const charId = player.character || 'student';
                    const frames = AssetService.getAnimation(charId, animState, direction);

                    if (frames.length > 0) {
                        const sprite = frames.length > 1
                            ? new AnimatedSprite(frames)
                            : new Sprite(frames[0]);
                        sprite.anchor.set(0.5);
                        sprite.position.set(player.x, player.y);
                        sprite.width = 28;
                        sprite.height = 28;
                        if (sprite instanceof AnimatedSprite) {
                            sprite.animationSpeed = isMoving ? 0.15 : 0.05;
                            sprite.play();
                        }
                        playerContainer.addChild(sprite);

                        // Armor ring overlay
                        if (player.hasArmor) {
                            const armorG = new Graphics();
                            armorG.lineStyle(2, 0x38bdf8, 0.8);
                            armorG.drawCircle(player.x, player.y, 16);
                            playerContainer.addChild(armorG);
                        }

                        // Name + HP labels (always procedural)
                        renderPlayerLabel(labelContainer, player, isMe);
                        continue;
                    }
                }

                // Fallback: detailed procedural player
                const pg = new Graphics();
                const charColor = CHARACTER_COLORS[player.character] || (isMe ? 0x6366f1 : 0xef4444);

                // Outer glow (character accent)
                pg.beginFill(charColor, 0.12);
                pg.drawCircle(player.x, player.y, 18);
                pg.endFill();

                // Dark body
                pg.beginFill(0x1a1a2e);
                pg.drawCircle(player.x, player.y, 12);
                pg.endFill();

                // Accent ring
                pg.lineStyle(2, charColor, 0.9);
                pg.drawCircle(player.x, player.y, 12);

                // Direction indicator (weapon barrel)
                const dirLen = 20;
                const dirX = player.x + Math.cos(player.rotation) * dirLen;
                const dirY = player.y + Math.sin(player.rotation) * dirLen;
                pg.lineStyle(3, charColor, 0.8);
                pg.moveTo(player.x + Math.cos(player.rotation) * 10, player.y + Math.sin(player.rotation) * 10);
                pg.lineTo(dirX, dirY);

                // Barrel tip crossbar
                const perpAngle = player.rotation + Math.PI / 2;
                const tipX = player.x + Math.cos(player.rotation) * (dirLen - 3);
                const tipY = player.y + Math.sin(player.rotation) * (dirLen - 3);
                pg.lineStyle(2, charColor, 0.6);
                pg.moveTo(tipX + Math.cos(perpAngle) * 3, tipY + Math.sin(perpAngle) * 3);
                pg.lineTo(tipX - Math.cos(perpAngle) * 3, tipY - Math.sin(perpAngle) * 3);

                // Inner accent dot (character identity)
                pg.beginFill(charColor, 0.7);
                pg.drawCircle(player.x, player.y, 4);
                pg.endFill();

                // "Me" pulse indicator
                if (isMe) {
                    const pulse = 0.3 + Math.sin(Date.now() / 400) * 0.3;
                    pg.lineStyle(1.5, 0xffffff, pulse);
                    pg.drawCircle(player.x, player.y, 15);
                }

                // Armor ring
                if (player.hasArmor) {
                    pg.lineStyle(2, 0x38bdf8, 0.8);
                    pg.drawCircle(player.x, player.y, 16);
                }
                playerContainer.addChild(pg);

                renderPlayerLabel(labelContainer, player, isMe);
            }
        }

        function renderEnemyNPCs(npcContainer: Container, labelContainer: Container, state: any) {
            for (const npc of state.npcs || []) {
                if (npc.type !== 'enemy' || npc.hp <= 0) continue;

                if (useSprites) {
                    const frames = AssetService.getAnimation('zombie', 'idle', AssetService.angleToDirection(npc.rotation));
                    if (frames.length > 0) {
                        const sprite = frames.length > 1
                            ? new AnimatedSprite(frames)
                            : new Sprite(frames[0]);
                        sprite.anchor.set(0.5);
                        sprite.position.set(npc.x, npc.y);
                        sprite.width = 28;
                        sprite.height = 28;
                        sprite.tint = 0xFF4444;
                        if (sprite instanceof AnimatedSprite) {
                            sprite.animationSpeed = 0.05;
                            sprite.play();
                        }
                        npcContainer.addChild(sprite);

                        renderNPCLabel(labelContainer, npc);
                        continue;
                    }
                }

                // Fallback: red circle with direction indicator
                const ng = new Graphics();
                ng.beginFill(0xCC3333, 0.9);
                ng.drawCircle(npc.x, npc.y, 14);
                ng.endFill();
                ng.lineStyle(3, 0xFFFFFF, 0.9);
                ng.moveTo(npc.x, npc.y);
                ng.lineTo(
                    npc.x + Math.cos(npc.rotation) * 18,
                    npc.y + Math.sin(npc.rotation) * 18
                );
                if (npc.state === 'engage') {
                    ng.lineStyle(2, 0xFF6666, 0.8);
                    ng.drawCircle(npc.x, npc.y, 17);
                }
                npcContainer.addChild(ng);

                renderNPCLabel(labelContainer, npc);
            }
        }

        function renderNPCLabel(container: Container, npc: any) {
            const label = new Text(npc.label || 'Bot', {
                fontFamily: 'monospace',
                fontSize: 10,
                fill: 0xFF4444,
                align: 'center',
            });
            label.anchor.set(0.5);
            label.position.set(npc.x, npc.y - 24);
            container.addChild(label);

            // HP pips
            const maxHp = 3;
            const pipStartX = npc.x - (maxHp * 6) / 2;
            for (let i = 0; i < maxHp; i++) {
                const pip = new Graphics();
                const color = i < npc.hp ? 0xFF4444 : 0x444444;
                pip.beginFill(color);
                pip.drawRect(pipStartX + i * 6, npc.y - 32, 4, 4);
                pip.endFill();
                container.addChild(pip);
            }
        }

        function renderPlayerLabel(container: Container, player: any, isMe: boolean) {
            const nameStyle = new TextStyle({
                fontSize: 10,
                fill: isMe ? 0x818cf8 : 0xffffff,
                fontFamily: 'Outfit',
                fontWeight: '600',
            });
            const nameText = new Text(player.username, nameStyle);
            nameText.anchor.set(0.5);
            nameText.position.set(player.x, player.y - 22);
            container.addChild(nameText);

            const hpY = player.y - 30;
            const hpG = new Graphics();
            for (let i = 0; i < 2; i++) {
                const x = player.x - 8 + i * 10;
                hpG.beginFill(i < player.hp ? 0xef4444 : 0x3f1111);
                hpG.drawCircle(x, hpY, 3);
                hpG.endFill();
            }
            container.addChild(hpG);
        }

        function handleFootstepAudio(me: any) {
            const isMoving = me.lastMoveDirection &&
                (me.lastMoveDirection.dx !== 0 || me.lastMoveDirection.dy !== 0);
            const isSprinting = keysRef.current.has('shift');

            if (isMoving && me.isAlive) {
                footstepTimerRef.current++;
                // Walking: ~2 steps/sec (30 ticks @ 60fps = 500ms). Sprinting: ~3.5 steps/sec (17 ticks = 285ms)
                const interval = isSprinting ? 17 : 30;
                if (footstepTimerRef.current >= interval) {
                    SoundService.playFootstep(isSprinting);
                    footstepTimerRef.current = 0;
                }
            } else {
                footstepTimerRef.current = 0;
            }
        }

        // Event listeners
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('wheel', handleWheel, { passive: false });
        if (isTouchDevice) {
            window.addEventListener('touchstart', handleTouchStart, { passive: false });
            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleTouchEnd, { passive: false });
            window.addEventListener('touchcancel', handleTouchEnd, { passive: false });
        }

        return () => {
            clearInterval(inputLoop);
            resizeObserver.disconnect();
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('wheel', handleWheel);
            if (isTouchDevice) {
                window.removeEventListener('touchstart', handleTouchStart);
                window.removeEventListener('touchmove', handleTouchMove);
                window.removeEventListener('touchend', handleTouchEnd);
                window.removeEventListener('touchcancel', handleTouchEnd);
            }
            SoundService.stopMusic();
            app.destroy(true);
            appRef.current = null;
            playerSpritesRef.current.clear();
            itemSpritesRef.current.clear();
        };
    }, [matchId, playerId, assetsLoaded]);

    // ============================================================================
    // SOCKET EVENT HANDLERS
    // ============================================================================

    useEffect(() => {
        socket.on('game-state', (state: any) => {
            prevStateRef.current = gameStateRef.current;
            gameStateRef.current = state;

            const me = state.players?.find((p: any) => p.id === playerId);
            if (me) {
                setPlayerState({
                    hp: me.hp,
                    hasArmor: me.hasArmor,
                    isAlive: me.isAlive,
                    kills: me.kills,
                    deaths: me.deaths,
                    weaponType: me.weapon?.type || 'pistol',
                });
            }
        });

        socket.on('player-killed', (data: any) => {
            const state = gameStateRef.current;
            const killer = state?.players?.find((p: any) => p.id === data.killerId);
            const victim = state?.players?.find((p: any) => p.id === data.victimId);
            addKillfeed({
                killer: data.killerName || killer?.username || data.killerId,
                victim: data.victimName || victim?.username || data.victimId,
                weapon: data.weapon,
            });

            SoundService.playSFX('player_death');

            if (data.weapon === 'melee') {
                SoundService.playSFX('melee_hit');
            }
        });

        socket.on('player-hit', (_data: any) => {
            SoundService.playSFX('player_hit');
        });

        socket.on('item-spawned', (data: any) => {
            setAnnouncement(data.announcement);
            setTimeout(() => setAnnouncement(null), 3000);
        });

        // Listen for item pickup events
        socket.on('item-collected', (data: any) => {
            if (data.type === 'health') {
                SoundService.playSFX('health_pickup');
            } else if (data.type === 'armor') {
                SoundService.playSFX('armor_pickup');
            }
        });

        socket.on('round-end', (data: any) => {
            setRoundScores(data.scores);
            const state = gameStateRef.current;
            const winner = state?.players?.find((p: any) => p.id === data.winnerId);
            setAnnouncement(`🏆 ${winner?.username || 'Unknown'} wins Round ${data.roundNumber}!`);
            SoundService.playSFX('round_end');
            setTimeout(() => setAnnouncement(null), 4000);
        });

        socket.on('round-start', (data: any) => {
            setRound(data.roundNumber);
            setAnnouncement(`Round ${data.roundNumber} — FIGHT!`);
            SoundService.playSFX('round_start');
            SoundService.playMusic('battle', { loop: true, volume: 0.5 });
            setTimeout(() => setAnnouncement(null), 2000);
        });

        socket.on('zone-shrink', () => {
            SoundService.playSFX('zone_warning');
        });

        socket.on('match-end', (data: any) => {
            const winner = data.results?.find((r: any) => r.placement === 1);
            const isWinner = winner?.playerId === playerId;
            setAnnouncement(`🎉 ${winner?.username || 'Unknown'} wins the match!`);

            // Play victory/defeat sting
            SoundService.stopMusic(500);
            setTimeout(() => {
                SoundService.playSting(isWinner ? 'victory' : 'defeat');
            }, 600);

            setTimeout(() => {
                endMatch();
                navigate(data.dbMatchId ? `/results/${data.dbMatchId}` : '/');
            }, 8000);
        });

        socket.on('spectate-start', (data: any) => {
            setSpectating(true);
            setSpectatedPlayer(data.targetPlayerId);
        });

        return () => {
            socket.off('game-state');
            socket.off('player-killed');
            socket.off('player-hit');
            socket.off('item-spawned');
            socket.off('item-collected');
            socket.off('round-end');
            socket.off('round-start');
            socket.off('zone-shrink');
            socket.off('match-end');
            socket.off('spectate-start');
        };
    }, [playerId]);

    // ============================================================================
    // Detect shooting for SFX
    // ============================================================================

    useEffect(() => {
        const shootCheck = setInterval(() => {
            const mouse = mouseRef.current;
            if (mouse.down) {
                SoundService.playSFX('gunshot', { volume: 0.6 });
            }
            if (mouse.rightDown || keysRef.current.has('e')) {
                SoundService.playSFX('melee_swing', { volume: 0.7 });
            }
        }, 250); // Throttle to 4/sec to avoid sound spam

        return () => clearInterval(shootCheck);
    }, []);

    // ============================================================================
    // RENDER
    // ============================================================================

    const handleAssetsLoaded = useCallback(() => setAssetsLoaded(true), []);

    if (!assetsLoaded) {
        return <LoadingScreen onLoaded={handleAssetsLoaded} />;
    }

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', cursor: isTouchDevice ? 'default' : 'crosshair' }}>
            {/* PixiJS Canvas */}
            <div ref={canvasRef} style={{ width: '100%', height: '100%' }} />

            {/* HUD Overlay */}
            <div className="hud">
                {/* Health Display */}
                <div className="hud-health">
                    {hasArmor && <div className="hp-icon armor">🛡️</div>}
                    {[...Array(2)].map((_, i) => (
                        <div key={i} className={`hp-icon ${i < hp ? 'full' : 'empty'}`}>
                            {i < hp ? '❤️' : '💔'}
                        </div>
                    ))}
                </div>

                {/* Kill Feed */}
                <div className="hud-killfeed">
                    {killfeed.map((entry, i) => (
                        <div key={entry.timestamp + i} className="killfeed-entry">
                            <span className="killer">{entry.killer}</span>
                            {' '}
                            {entry.weapon === 'melee' ? '🗡️' : entry.weapon === 'zone' ? '☠️' : '🔫'}
                            {' '}
                            <span className="victim">{entry.victim}</span>
                        </div>
                    ))}
                </div>

                {/* Weapon Indicator */}
                <div className="hud-weapon">
                    {(() => {
                        const me = gameStateRef.current?.players?.find((p: any) => p.id === playerId);
                        const weapons: any[] = me?.weapons || [{ type: weaponType }];
                        const activeIdx = me?.activeWeaponIndex ?? 0;
                        const weaponIcons: Record<string, string> = {
                            pistol: '🔫',
                            machine_gun: '🔫',
                            grenade_launcher: '💣',
                        };
                        const weaponNames: Record<string, string> = {
                            pistol: 'Pistol',
                            machine_gun: 'MG',
                            grenade_launcher: 'GL',
                        };
                        return weapons.map((w: any, i: number) => (
                            <div key={i} className={`weapon-slot ${i === activeIdx ? 'active' : ''}`}>
                                <span className="weapon-icon">{weaponIcons[w.type] || '?'}</span>
                                <span className="weapon-name">{weaponNames[w.type] || w.type}</span>
                                {w.type !== 'pistol' && (
                                    <span className="weapon-ammo">{w.clipAmmo}/{w.totalAmmo}</span>
                                )}
                            </div>
                        ));
                    })()}
                    <div className="weapon-hint">Q / Scroll</div>
                </div>

                {/* Round Info */}
                <div className="hud-round">
                    Round {currentRound} • K: {kills} D: {deaths}
                </div>

                {/* Announcement */}
                {announcement && (
                    <div className="hud-announcement">{announcement}</div>
                )}

                {/* Top-left controls: Mute + Scale */}
                <div className="hud-top-left">
                    <button
                        onClick={() => {
                            const nowMuted = SoundService.toggleMute();
                            setIsMuted(nowMuted);
                        }}
                        className="hud-icon-btn"
                    >
                        {isMuted ? '🔇' : '🔊'}
                    </button>
                    <div className="scale-selector">
                        {SCALE_OPTIONS.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => handleScaleChange(opt.key)}
                                className={`scale-btn ${scaleSetting === opt.key ? 'active' : ''}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Spectating Banner */}
                {isSpectating && (
                    <div style={{
                        position: 'absolute',
                        bottom: '80px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '8px 24px',
                        background: 'rgba(10, 11, 26, 0.85)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-full)',
                        color: 'var(--color-text-secondary)',
                        fontWeight: 600,
                    }}>
                        👀 Spectating {gameStateRef.current?.players?.find(
                            (p: any) => p.id === spectatedPlayerId
                        )?.username || ''}
                    </div>
                )}
            </div>

            {/* Virtual Joystick Controls — touch devices only */}
            {isTouchDevice && (
                <div className="touch-controls">
                    {/* Left joystick — movement */}
                    <div className="joystick-zone left">
                        <div className="joystick-ring" />
                        <div
                            className="joystick-puck"
                            style={{
                                transform: `translate(calc(-50% + ${leftPuck.x}px), calc(-50% + ${leftPuck.y}px))`,
                            }}
                        />
                    </div>

                    {/* Action buttons — melee, sprint, weapon cycle (centered between sticks) */}
                    <div className="touch-action-buttons">
                        <button
                            className={`touch-btn ${meleeOn ? 'active' : ''}`}
                            onTouchStart={(e) => {
                                e.preventDefault();
                                meleeActiveRef.current = true;
                                setMeleeOn(true);
                            }}
                            onTouchEnd={(e) => {
                                e.preventDefault();
                                meleeActiveRef.current = false;
                                setMeleeOn(false);
                            }}
                        >
                            🗡️
                        </button>
                        <button
                            className="touch-btn"
                            onTouchStart={(e) => {
                                e.preventDefault();
                                weaponCycleRef.current = 1;
                            }}
                            onTouchEnd={(e) => { e.preventDefault(); }}
                        >
                            🔄
                        </button>
                        <button
                            className={`touch-btn ${sprintOn ? 'active' : ''}`}
                            onTouchStart={(e) => {
                                e.preventDefault();
                                sprintActiveRef.current = !sprintActiveRef.current;
                                setSprintOn(sprintActiveRef.current);
                            }}
                            onTouchEnd={(e) => { e.preventDefault(); }}
                        >
                            {sprintOn ? '⚡' : '⇧'}
                        </button>
                    </div>

                    {/* Right joystick — aim + fire */}
                    <div className="joystick-zone right">
                        <div className="joystick-ring" />
                        <div
                            className="joystick-puck"
                            style={{
                                transform: `translate(calc(-50% + ${rightPuck.x}px), calc(-50% + ${rightPuck.y}px))`,
                                background: rightStickRef.current.active
                                    ? 'rgba(239, 68, 68, 0.45)'
                                    : 'rgba(255, 255, 255, 0.22)',
                                borderColor: rightStickRef.current.active
                                    ? 'rgba(239, 68, 68, 0.9)'
                                    : 'rgba(255, 255, 255, 0.5)',
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
