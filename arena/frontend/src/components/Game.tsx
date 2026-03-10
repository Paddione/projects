import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Application, Container, Graphics, Text, TextStyle,
    Sprite, AnimatedSprite,
} from 'pixi.js';
import { useGameStore } from '../stores/gameStore';
import { getSocket } from '../services/apiService';
import { AssetService } from '../services/AssetService';
import { SoundService } from '../services/SoundService';
import LoadingScreen from './LoadingScreen';

const TILE_SIZE = 32;
const MAP_WIDTH = 28;
const MAP_HEIGHT = 22;

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
    const pickupActiveRef = useRef(false);
    // Derived joystick puck offsets for React render (clamped to 40px radius)
    const [leftPuck, setLeftPuck] = useState({ x: 0, y: 0 });
    const [rightPuck, setRightPuck] = useState({ x: 0, y: 0 });
    const [sprintOn, setSprintOn] = useState(false);
    const [meleeOn, setMeleeOn] = useState(false);
    const [pickupOn, setPickupOn] = useState(false);

    // Track animated sprites for reuse (avoid recreating every frame)
    const playerSpritesRef = useRef<Map<string, AnimatedSprite | Sprite>>(new Map());
    const itemSpritesRef = useRef<Map<string, AnimatedSprite | Sprite>>(new Map());
    const footstepTimerRef = useRef(Date.now());
    const explosionsRef = useRef<Array<{ x: number; y: number; radius: number; createdAt: number }>>(
        []
    );
    const mapRenderedRef = useRef(false);
    const zoneDirtyRef = useRef(true);
    const hudRafIdRef = useRef<number | null>(null);

    const [assetsLoaded, setAssetsLoaded] = useState(false);
    const [isMuted, setIsMuted] = useState(SoundService.isMuted);
    const lastZoneTickRef = useRef(0);

    const {
        playerId, hp, hasArmor, kills, deaths, weaponType,
        killfeed, announcement, currentRound,
        isSpectating, spectatedPlayerId,
        setPlayerState, addKillfeed, setAnnouncement, setRound, setRoundScores,
        setSpectating, setSpectatedPlayer,
        endMatch,
    } = useGameStore();

    const socket = getSocket();

    // Expose socket for E2E testing (tree-shaken in production)
    if (import.meta.env.DEV) {
        (window as any).__arenaSocket = socket;
    }

    const useSprites = AssetService.isLoaded;

    // ============================================================================
    // INPUT HANDLING
    // ============================================================================

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        keysRef.current.add(e.key.toLowerCase());
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
            const pickup = keys.has('f') || (isTouchDevice && pickupActiveRef.current);

            socket.emit('player-input', {
                matchId,
                input: {
                    movement: { x: mx, y: my },
                    aimAngle,
                    shooting,
                    melee,
                    sprint,
                    pickup,
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

            // Camera follows player or spectated player
            const camTarget = isSpectating && spectatedPlayerId
                ? state.players?.find((p: any) => p.id === spectatedPlayerId) || me
                : me;

            // Dynamic zoom based on screen height (keeps gameplay fair & visible across resolutions)
            const zoom = Math.max(1.5, window.innerHeight / 500);
            const cameraX = -camTarget.x * zoom + window.innerWidth / 2;
            const cameraY = -camTarget.y * zoom + window.innerHeight / 2;

            worldContainer.scale.set(zoom);
            worldContainer.position.set(cameraX, cameraY);

            // ---- MAP LAYER (render once, cache) ----
            if (!mapRenderedRef.current) {
                mapLayer.removeChildren();
                renderMap(mapLayer, state);
                mapRenderedRef.current = true;
            }

            // ---- ITEM LAYER (reuse sprites) ----
            renderItems(itemLayer, state);

            // ---- PROJECTILE LAYER ----
            projectileLayer.removeChildren();
            renderProjectiles(projectileLayer, state);

            // ---- ZONE LAYER (redraw only when zone changed) ----
            if (zoneDirtyRef.current) {
                zoneLayer.removeChildren();
                renderZone(zoneLayer, state);
                zoneDirtyRef.current = false;
            }

            // ---- PLAYER LAYER + LABELS (reuse sprites) ----
            renderPlayers(playerLayer, labelLayer, state, me);

            // ---- FOOTSTEP AUDIO ----
            handleFootstepAudio(me);

            // ---- ZONE TICK AUDIO ----
            // Play zone tick sound when player is outside safe zone (throttled to 1/sec)
            if (state.zone?.isActive && me.isAlive) {
                const dx = me.x - state.zone.centerX;
                const dy = me.y - state.zone.centerY;
                const distToCenter = Math.sqrt(dx * dx + dy * dy);
                if (distToCenter > state.zone.currentRadius) {
                    const now = Date.now();
                    if (now - lastZoneTickRef.current >= 1000) {
                        SoundService.playSFX('zone_tick', { volume: 0.4 });
                        lastZoneTickRef.current = now;
                    }
                }
            }
        });

        // ====================================================================
        // RENDER FUNCTIONS
        // ====================================================================

        function renderMap(container: Container, _state: any) {
            if (useSprites) {
                // Try to use tile sprites
                const floorTiles = AssetService.getFloorTiles();
                if (floorTiles.length > 0) {
                    // Place individual sprites per tile with random variety
                    // Use a simple hash of (x, y) for deterministic randomness
                    for (let ty = 0; ty < MAP_HEIGHT; ty++) {
                        for (let tx = 0; tx < MAP_WIDTH; tx++) {
                            const hash = ((tx * 7919) + (ty * 104729)) % floorTiles.length;
                            const tileIdx = Math.abs(hash) % floorTiles.length;
                            const sprite = new Sprite(floorTiles[tileIdx]);
                            sprite.position.set(tx * TILE_SIZE, ty * TILE_SIZE);
                            sprite.width = TILE_SIZE;
                            sprite.height = TILE_SIZE;
                            container.addChild(sprite);
                        }
                    }
                    return;
                }
            }

            // Fallback: procedural map with varied tile colors
            const g = new Graphics();
            const floorColors = [0x1a1c3a, 0x1c1e3e, 0x181a36, 0x1e2042];
            for (let ty = 0; ty < MAP_HEIGHT; ty++) {
                for (let tx = 0; tx < MAP_WIDTH; tx++) {
                    const hash = ((tx * 7919) + (ty * 104729)) % floorColors.length;
                    const colorIdx = Math.abs(hash) % floorColors.length;
                    g.beginFill(floorColors[colorIdx]);
                    g.drawRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    g.endFill();
                }
            }

            g.lineStyle(1, 0x222450, 0.3);
            for (let x = 0; x <= MAP_WIDTH; x++) {
                g.moveTo(x * TILE_SIZE, 0);
                g.lineTo(x * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
            }
            for (let y = 0; y <= MAP_HEIGHT; y++) {
                g.moveTo(0, y * TILE_SIZE);
                g.lineTo(MAP_WIDTH * TILE_SIZE, y * TILE_SIZE);
            }
            container.addChild(g);
        }

        function renderItems(container: Container, state: any) {
            // Mark all items as hidden first
            itemSpritesRef.current.forEach((sprite) => {
                sprite.visible = false;
            });

            // Update or create sprites for active items
            for (const item of state.items || []) {
                const cachedSprite = itemSpritesRef.current.get(item.id);

                if (useSprites) {
                    const assetId = item.type === 'health' ? 'health_pack'
                        : item.type === 'machine_gun' ? 'machine_gun'
                        : 'armor_plate';
                    const frames = AssetService.getItemAnimation('items', assetId);
                    if (frames.length > 0) {
                        let sprite = cachedSprite;

                        // Create sprite if not cached
                        if (!sprite) {
                            sprite = frames.length > 1
                                ? new AnimatedSprite(frames)
                                : new Sprite(frames[0]);
                            sprite.anchor.set(0.5);
                            sprite.width = 20;
                            sprite.height = 20;
                            if (sprite instanceof AnimatedSprite) {
                                sprite.animationSpeed = 0.1;
                                sprite.play();
                            }
                            container.addChild(sprite);
                            itemSpritesRef.current.set(item.id, sprite);
                        }

                        // Update position and visibility
                        sprite.position.set(item.x, item.y);
                        sprite.visible = true;
                        continue;
                    }
                }

                // Fallback: procedural items
                const ig = new Graphics();
                const pulse = 0.3 + Math.sin(Date.now() / 300) * 0.3;
                if (item.type === 'health') {
                    ig.beginFill(0xef4444);
                    ig.drawCircle(item.x, item.y, 8);
                    ig.endFill();
                    ig.lineStyle(2, 0xef4444, pulse);
                    ig.drawCircle(item.x, item.y, 12);
                } else if (item.type === 'armor') {
                    ig.beginFill(0x38bdf8);
                    ig.drawCircle(item.x, item.y, 8);
                    ig.endFill();
                    ig.lineStyle(2, 0x38bdf8, pulse);
                    ig.drawCircle(item.x, item.y, 12);
                } else if (item.type === 'machine_gun') {
                    ig.beginFill(0xfbbf24);
                    ig.drawCircle(item.x, item.y, 8);
                    ig.endFill();
                    ig.lineStyle(2, 0xfbbf24, pulse);
                    ig.drawCircle(item.x, item.y, 12);
                } else if (item.type === 'grenade_launcher') {
                    ig.beginFill(0xf97316);
                    ig.drawCircle(item.x, item.y, 8);
                    ig.endFill();
                    ig.lineStyle(2, 0xf97316, pulse);
                    ig.drawCircle(item.x, item.y, 12);
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

                // Fallback: procedural projectiles with glow
                const pg = new Graphics();
                pg.beginFill(0xfbbf24, 0.2);
                pg.drawCircle(proj.x, proj.y, 8);
                pg.endFill();
                pg.beginFill(0xfbbf24);
                pg.drawCircle(proj.x, proj.y, 4);
                pg.endFill();
                pg.lineStyle(1, 0xfef08a, 0.7);
                pg.drawCircle(proj.x, proj.y, 5);
                container.addChild(pg);
            }
        }

        function renderZone(container: Container, state: any) {
            if (!state.zone?.isActive) return;

            const zg = new Graphics();
            zg.beginFill(0xef4444, 0.1);
            zg.drawRect(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
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
            // Mark all sprites as hidden, then show only alive players
            playerSpritesRef.current.forEach((sprite) => {
                sprite.visible = false;
            });

            // Rebuild label layer (labels change frequently with HP/position)
            labelContainer.removeChildren();

            for (const player of state.players || []) {
                if (!player.isAlive) continue;

                const isMe = player.id === playerId;
                const cachedSprite = playerSpritesRef.current.get(player.id);

                if (useSprites) {
                    // Character ID (default to 'warrior' if not set)
                    const charId = player.selectedCharacter || player.selected_character || 'warrior';
                    // Pose-based: use 'stand' pose (single sprite rotated in-engine)
                    const poseTexture = AssetService.getCharacterPose(charId, 'stand');

                    if (poseTexture) {
                        let sprite = cachedSprite;

                        // Create sprite if not cached
                        if (!sprite) {
                            sprite = new Sprite(poseTexture);
                            sprite.anchor.set(0.5);
                            sprite.width = 28;
                            sprite.height = 28;
                            playerContainer.addChild(sprite);
                            playerSpritesRef.current.set(player.id, sprite);
                        }

                        // Update position and rotation
                        sprite.position.set(player.x, player.y);
                        sprite.rotation = player.rotation;
                        sprite.visible = true;

                        // Armor ring overlay (recreate if needed)
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

                // Fallback: procedural player
                const pg = new Graphics();
                const color = isMe ? 0x6366f1 : 0xef4444;
                pg.beginFill(color);
                pg.drawCircle(player.x, player.y, 12);
                pg.endFill();

                const dirX = player.x + Math.cos(player.rotation) * 18;
                const dirY = player.y + Math.sin(player.rotation) * 18;
                pg.lineStyle(3, color, 0.8);
                pg.moveTo(player.x, player.y);
                pg.lineTo(dirX, dirY);

                if (player.hasArmor) {
                    pg.lineStyle(2, 0x38bdf8, 0.8);
                    pg.drawCircle(player.x, player.y, 15);
                }
                playerContainer.addChild(pg);

                renderPlayerLabel(labelContainer, player, isMe);
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
                (me.lastMoveDirection.x !== 0 || me.lastMoveDirection.y !== 0);
            const isSprinting = keysRef.current.has('shift');

            if (isMoving && me.isAlive) {
                const now = Date.now();
                // Walking: ~2 steps/sec (500ms). Sprinting: ~3.5 steps/sec (285ms)
                const interval = isSprinting ? 285 : 500;
                if (now - footstepTimerRef.current >= interval) {
                    SoundService.playFootstep(isSprinting);
                    footstepTimerRef.current = now;
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
            mapRenderedRef.current = false;
            zoneDirtyRef.current = true;
        };
    }, [matchId, playerId, assetsLoaded]);

    // ============================================================================
    // SOCKET EVENT HANDLERS
    // ============================================================================

    useEffect(() => {
        socket.on('game-state', (state: any) => {
            prevStateRef.current = gameStateRef.current;
            gameStateRef.current = state;

            // Throttle HUD re-renders to rAF (max 60/sec) instead of socket frequency (20/sec)
            // This coalesces multiple socket messages into single React render
            if (hudRafIdRef.current) cancelAnimationFrame(hudRafIdRef.current);
            hudRafIdRef.current = requestAnimationFrame(() => {
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

                    // Auto-spectate first alive player when you die
                    if (me.isAlive === false && !isSpectating) {
                        const alivePlayers = state.players?.filter((p: any) => p.isAlive && p.id !== playerId);
                        if (alivePlayers?.length > 0) {
                            const firstAlive = alivePlayers[0];
                            socket.emit('spectate-player', {
                                matchId: state.matchId,
                                targetPlayerId: firstAlive.id,
                            });
                        }
                    }
                }
                hudRafIdRef.current = null;
            });
        });

        socket.on('player-killed', (data: any) => {
            const state = gameStateRef.current;
            const killer = state?.players?.find((p: any) => p.id === data.killerId);
            const victim = state?.players?.find((p: any) => p.id === data.victimId);
            addKillfeed({
                killer: killer?.username || data.killerId,
                victim: victim?.username || data.victimId,
                weapon: data.weapon,
            });

            // Play death sound
            SoundService.playSFX('player_death');

            // Play weapon-specific sound
            if (data.weapon === 'melee') {
                SoundService.playSFX('melee_swing');
            }

            // Haptic feedback on kill (pattern)
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }
        });

        socket.on('player-hit', (_data: any) => {
            SoundService.playSFX('player_hit');
            SoundService.playSFX('bullet_impact', { volume: 0.5 });
            // Haptic feedback on hit (short pulse)
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
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
            setTimeout(() => setAnnouncement(null), 2000);
        });

        socket.on('zone-shrink', () => {
            zoneDirtyRef.current = true;
            SoundService.playSFX('zone_warning');
        });

        socket.on('explosion', (data: any) => {
            explosionsRef.current.push({ ...data, createdAt: Date.now() });
            SoundService.playSFX('grenade_explode', { volume: 0.7 });
        });

        socket.on('spectate-start', (data: any) => {
            setSpectating(true);
            setSpectatedPlayer(data.targetPlayerId);
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

            // Haptic feedback on match end (longer pulse for defeat)
            if (navigator.vibrate && !isWinner) {
                navigator.vibrate(300);
            }

            setTimeout(() => {
                endMatch();
                if (data.dbMatchId) {
                    navigate(`/results/${data.dbMatchId}`);
                } else {
                    navigate('/');
                }
            }, 8000);
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
            socket.off('explosion');
            socket.off('spectate-start');
            socket.off('match-end');
        };
    }, [playerId]);

    // ============================================================================
    // Detect shooting for SFX
    // ============================================================================

    useEffect(() => {
        const shootCheck = setInterval(() => {
            const mouse = mouseRef.current;
            if (mouse.down) {
                if (weaponType === 'grenade_launcher') {
                    SoundService.playSFX('grenade_launch', { volume: 0.8 });
                } else {
                    SoundService.playSFX('gunshot', { volume: 0.6 });
                }
            }
            if (mouse.rightDown || keysRef.current.has('e')) {
                SoundService.playSFX('melee_swing', { volume: 0.7 });
            }
        }, 250); // Throttle to 4/sec to avoid sound spam

        return () => clearInterval(shootCheck);
    }, [weaponType]);

    // ============================================================================
    // RENDER
    // ============================================================================

    if (!assetsLoaded) {
        return <LoadingScreen onLoaded={() => setAssetsLoaded(true)} />;
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

                {/* Round Info */}
                <div className="hud-round">
                    Round {currentRound} • K: {kills} D: {deaths}
                </div>

                {/* Weapon Label (touch devices only) */}
                {isTouchDevice && (
                    <div style={{
                        position: 'absolute',
                        bottom: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '6px 12px',
                        background: 'rgba(10, 11, 26, 0.85)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-full)',
                        color: 'var(--color-text-secondary)',
                        fontWeight: 600,
                        fontSize: '12px',
                    }}>
                        🔫 {weaponType === 'pistol' ? 'Pistol' : weaponType === 'machine_gun' ? 'Machine Gun' : weaponType === 'grenade_launcher' ? 'Grenade Launcher' : 'Unknown'}
                    </div>
                )}

                {/* Announcement */}
                {announcement && (
                    <div className="hud-announcement">{announcement}</div>
                )}

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
                        👀 Spectating {spectatedPlayerId && gameStateRef.current?.players?.find((p: any) => p.id === spectatedPlayerId)?.username}
                    </div>
                )}

                {/* Mute Button */}
                <button
                    onClick={() => {
                        const newMuted = SoundService.toggleMute();
                        setIsMuted(newMuted);
                    }}
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        padding: '6px 12px',
                        background: 'rgba(10, 11, 26, 0.85)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 600,
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(10, 11, 26, 0.95)';
                        e.currentTarget.style.color = 'var(--color-text)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(10, 11, 26, 0.85)';
                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }}
                >
                    {isMuted ? '🔇' : '🔊'}
                </button>
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

                    {/* Action buttons — melee + pickup + sprint (between the two sticks) */}
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
                            className={`touch-btn ${pickupOn ? 'active' : ''}`}
                            onTouchStart={(e) => {
                                e.preventDefault();
                                pickupActiveRef.current = true;
                                setPickupOn(true);
                            }}
                            onTouchEnd={(e) => {
                                e.preventDefault();
                                pickupActiveRef.current = false;
                                setPickupOn(false);
                            }}
                        >
                            📦
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
