import { v4 as uuidv4 } from 'uuid';
import type {
    GameState,
    PlayerState,
    PlayerInput,
    Projectile,
    MapItem,
    ItemType,
    GameMap,
    SpawnPoint,
    ShrinkingZone,
    RoundState,
    ArenaLobbySettings,
    ArenaLobby,
    SerializedGameState,
    MatchResult,
    CoverObject,
    NPC,
} from '../types/game.js';
import { GAME, HP, DAMAGE, NPC_CONST } from '../types/game.js';
import { createCampusCourtyard } from '../maps/campus-courtyard.js';
import type { WeaponState } from '../types/weapon.js';
import { WEAPON_STATS, MACHINE_GUN_PICKUP, GRENADE_LAUNCHER_PICKUP } from '../types/weapon.js';
import { PlayerService } from './PlayerService.js';
import { DatabaseService } from './DatabaseService.js';

export class GameService {
    private activeGames: Map<string, GameState> = new Map();
    private gameIntervals: Map<string, NodeJS.Timeout> = new Map();
    private playerService: PlayerService;
    private db: DatabaseService;
    private tickRate: number;

    // Callbacks for emitting events
    private onStateUpdate?: (matchId: string, state: SerializedGameState) => void;
    private onPlayerHit?: (matchId: string, data: { targetId: string; attackerId: string; damage: number; remainingHp: number; hasArmor: boolean }) => void;
    private onPlayerKilled?: (matchId: string, data: { victimId: string; killerId: string; weapon: 'gun' | 'melee' | 'zone' | 'zombie' }) => void;
    private onItemSpawned?: (matchId: string, data: { item: MapItem; announcement: string }) => void;
    private onItemCollected?: (matchId: string, data: { itemId: string; playerId: string }) => void;
    private onRoundEnd?: (matchId: string, data: { roundNumber: number; winnerId: string; scores: Record<string, number> }) => void;
    private onMatchEnd?: (matchId: string, data: { winnerId: string; results: MatchResult[]; dbMatchId?: number }) => void;
    private onZoneShrink?: (matchId: string, data: { zone: ShrinkingZone }) => void;
    private onCoverDestroyed?: (matchId: string, data: { coverId: string }) => void;
    private onExplosion?: (matchId: string, data: { x: number; y: number; radius: number }) => void;

    constructor(tickRate = 20) {
        this.playerService = new PlayerService();
        this.db = DatabaseService.getInstance();
        this.tickRate = tickRate;
    }

    /**
     * Register event callbacks (called by SocketService)
     */
    setCallbacks(callbacks: {
        onStateUpdate: (matchId: string, state: SerializedGameState) => void;
        onPlayerHit: (matchId: string, data: { targetId: string; attackerId: string; damage: number; remainingHp: number; hasArmor: boolean }) => void;
        onPlayerKilled: (matchId: string, data: { victimId: string; killerId: string; weapon: 'gun' | 'melee' | 'zone' | 'zombie' }) => void;
        onItemSpawned: (matchId: string, data: { item: MapItem; announcement: string }) => void;
        onItemCollected: (matchId: string, data: { itemId: string; playerId: string }) => void;
        onRoundEnd: (matchId: string, data: { roundNumber: number; winnerId: string; scores: Record<string, number> }) => void;
        onMatchEnd: (matchId: string, data: { winnerId: string; results: MatchResult[]; dbMatchId?: number }) => void;
        onZoneShrink: (matchId: string, data: { zone: ShrinkingZone }) => void;
        onCoverDestroyed: (matchId: string, data: { coverId: string }) => void;
        onExplosion: (matchId: string, data: { x: number; y: number; radius: number }) => void;
    }): void {
        this.onStateUpdate = callbacks.onStateUpdate;
        this.onPlayerHit = callbacks.onPlayerHit;
        this.onPlayerKilled = callbacks.onPlayerKilled;
        this.onItemSpawned = callbacks.onItemSpawned;
        this.onItemCollected = callbacks.onItemCollected;
        this.onRoundEnd = callbacks.onRoundEnd;
        this.onMatchEnd = callbacks.onMatchEnd;
        this.onZoneShrink = callbacks.onZoneShrink;
        this.onCoverDestroyed = callbacks.onCoverDestroyed;
        this.onExplosion = callbacks.onExplosion;
    }

    /**
     * Start a new match from a lobby
     */
    startMatch(lobby: ArenaLobby): string {
        const matchId = uuidv4();
        const map = this.generateMap();
        const players = new Map<string, PlayerState>();

        // Assign spawn points dynamically based on player count
        const spawnPoints = this.getSpawnPoints(lobby.players.length, map);

        lobby.players.forEach((lobbyPlayer, index) => {
            const spawn = spawnPoints[index];
            const playerState = this.playerService.createPlayer(
                lobbyPlayer.id,
                lobbyPlayer.username,
                lobbyPlayer.character,
                lobbyPlayer.characterLevel,
                spawn.x * GAME.TILE_SIZE + GAME.TILE_SIZE / 2,
                spawn.y * GAME.TILE_SIZE + GAME.TILE_SIZE / 2
            );
            players.set(lobbyPlayer.id, playerState);
        });

        const gameState: GameState = {
            matchId,
            lobbyCode: lobby.code,
            phase: 'round-active',
            players,
            projectiles: [],
            items: [],
            map,
            zone: lobby.settings.shrinkingZone ? this.createInitialZone(map) : undefined,
            currentRound: {
                roundNumber: 1,
                phase: 'playing',
                alivePlayers: Array.from(players.keys()),
                startedAt: Date.now(),
            },
            roundScores: Object.fromEntries(lobby.players.map((p) => [p.id, 0])),
            bestOf: lobby.settings.bestOf,
            settings: lobby.settings,
            tickCount: 0,
            lastItemSpawnTick: 0,
            npcs: [],
            lastNPCSpawnTick: 0,
        };

        this.activeGames.set(matchId, gameState);

        // Spawn initial weapons at map center (only if item spawning is enabled)
        if (gameState.settings.itemSpawns) {
            this.spawnInitialWeapons(gameState);
        }

        // Start the game loop
        const interval = setInterval(() => this.tick(matchId), 1000 / this.tickRate);
        this.gameIntervals.set(matchId, interval);

        console.log(`Match ${matchId} started with ${lobby.players.length} players`);
        return matchId;
    }

    /**
     * Process player input
     */
    processInput(matchId: string, playerId: string, input: PlayerInput): void {
        const game = this.activeGames.get(matchId);
        if (!game || game.phase !== 'round-active') return;

        const player = game.players.get(playerId);
        if (!player || !player.isAlive) return;

        // ====== ANTI-CHEAT: Timestamp validation ======
        const now = Date.now();
        if (input.timestamp > now + 500) {
            console.warn(`[Anti-Cheat] Future timestamp from player ${playerId}: ${input.timestamp} > ${now}`);
            return; // Reject input with future timestamp
        }

        // Movement
        const speed = input.sprint ? GAME.PLAYER_SPEED * GAME.SPRINT_MULTIPLIER : GAME.PLAYER_SPEED;
        let dx = input.movement.x * speed;
        let dy = input.movement.y * speed;

        // ====== ANTI-CHEAT: Movement clamping ======
        const maxDelta = (GAME.PLAYER_SPEED * GAME.SPRINT_MULTIPLIER / this.tickRate) * 2;
        const movementMagnitude = Math.sqrt(dx * dx + dy * dy);
        if (movementMagnitude > maxDelta) {
            console.warn(`[Anti-Cheat] Excessive movement speed from player ${playerId}: ${movementMagnitude.toFixed(2)} > ${maxDelta.toFixed(2)}`);
            const scale = maxDelta / movementMagnitude;
            dx *= scale;
            dy *= scale;
        }

        const newX = player.x + dx;
        const newY = player.y + dy;

        // Check bounds and collisions before applying movement
        if (this.isValidPosition(newX, newY, game.map)) {
            player.x = newX;
            player.y = newY;
            player.lastMoveDirection = { dx: input.movement.x, dy: input.movement.y };
        }

        // Aim
        player.rotation = input.aimAngle;

        // Shooting (weapon-aware) — anti-cheat: use latency-tolerant cooldown check (0.8x)
        if (input.shooting && !input.sprint) {
            // Check shooting requirements: not reloading, has ammo, cooldown passed
            if (!player.weapon.isReloading && player.weapon.clipAmmo > 0) {
                const stats = WEAPON_STATS[player.weapon.type];
                const timeSinceShot = now - player.lastShotTime;
                const effectiveCooldown = stats.cooldownMs * 0.8; // More latency-tolerant
                if (timeSinceShot >= effectiveCooldown) {
                    if (this.playerService.consumeAmmo(player)) {
                        player.lastShotTime = now;
                        const spread = (Math.random() - 0.5) * 2 * stats.spreadRad;
                        this.createProjectile(game, player, input.aimAngle + spread);
                    }
                }
            }
        }

        // Manual reload
        if (input.reload) {
            this.playerService.startReload(player);
        }

        // Update pose based on current action
        this.playerService.updatePose(player, input.shooting, input.melee);

        // Melee
        if (input.melee && !input.sprint) {
            this.processMelee(game, player);
        }

        // Item pickup
        if (input.pickup) {
            this.processPickup(game, player);
        }
    }

    /**
     * Get game state for a match
     */
    getGameState(matchId: string): GameState | undefined {
        return this.activeGames.get(matchId);
    }

    /**
     * End a match and clean up
     */
    endMatch(matchId: string): void {
        const interval = this.gameIntervals.get(matchId);
        if (interval) {
            clearInterval(interval);
            this.gameIntervals.delete(matchId);
        }
        this.activeGames.delete(matchId);
    }

    // ============================================================================
    // GAME LOOP
    // ============================================================================

    private tick(matchId: string): void {
        const game = this.activeGames.get(matchId);
        if (!game || game.phase !== 'round-active') return;

        game.tickCount++;

        // Update projectiles
        this.updateProjectiles(game);

        // Shrinking zone
        if (game.zone?.isActive) {
            this.updateZone(game);
        }

        // Item spawns
        if (game.settings.itemSpawns) {
            const spawnIntervalTicks = game.settings.itemSpawnInterval * this.tickRate;
            if (game.tickCount - game.lastItemSpawnTick >= spawnIntervalTicks) {
                this.spawnItems(game);
                game.lastItemSpawnTick = game.tickCount;
            }
        }

        // NPC spawning
        const npcSpawnTicks = NPC_CONST.SPAWN_INTERVAL_S * this.tickRate;
        if (game.tickCount - game.lastNPCSpawnTick >= npcSpawnTicks) {
            this.spawnNPC(game);
            game.lastNPCSpawnTick = game.tickCount;
        }

        // NPC AI
        this.updateNPCs(game);

        // Reload timers
        for (const [, player] of game.players) {
            this.playerService.updateReload(player);
        }

        // Check round end
        this.checkRoundEnd(game);

        // Broadcast state
        if (this.onStateUpdate) {
            this.onStateUpdate(matchId, this.serializeState(game));
        }
    }

    // ============================================================================
    // PROJECTILES
    // ============================================================================

    private createProjectile(game: GameState, player: PlayerState, angle?: number): void {
        const fireAngle = angle ?? player.rotation;
        const isGrenade = player.weapon.type === 'grenade_launcher';
        const speed = isGrenade ? GAME.PROJECTILE_SPEED * 0.6 : GAME.PROJECTILE_SPEED;

        const projectile: Projectile = {
            id: uuidv4(),
            ownerId: player.id,
            x: player.x,
            y: player.y,
            velocityX: Math.cos(fireAngle) * speed,
            velocityY: Math.sin(fireAngle) * speed,
            damage: isGrenade ? DAMAGE.GRENADE : DAMAGE.GUN,
            createdAt: Date.now(),
            explosionRadius: isGrenade ? 64 : undefined,
        };
        game.projectiles.push(projectile);
    }

    private triggerExplosion(game: GameState, projectile: Projectile): void {
        const radius = projectile.explosionRadius || 64;

        // Damage all players in radius
        for (const [targetId, target] of game.players) {
            if (!target.isAlive) continue;
            const dist = Math.hypot(target.x - projectile.x, target.y - projectile.y);
            if (dist <= radius) {
                const result = this.playerService.applyDamage(target, projectile.damage, projectile.ownerId);
                const attacker = game.players.get(projectile.ownerId);
                if (attacker) attacker.damageDealt += projectile.damage;

                this.onPlayerHit?.(game.matchId, {
                    targetId,
                    attackerId: projectile.ownerId,
                    damage: projectile.damage,
                    remainingHp: result.remainingHp,
                    hasArmor: result.hasArmor,
                });

                if (result.died) {
                    if (attacker) attacker.kills++;
                    this.playerService.makeSpectator(target);
                    game.currentRound.alivePlayers = game.currentRound.alivePlayers.filter((id) => id !== targetId);

                    this.onPlayerKilled?.(game.matchId, {
                        victimId: targetId,
                        killerId: projectile.ownerId,
                        weapon: 'gun',
                    });
                }
            }
        }

        // Damage all NPCs in radius
        for (const npc of game.npcs) {
            const dist = Math.hypot(npc.x - projectile.x, npc.y - projectile.y);
            if (dist <= radius) {
                npc.hp -= projectile.damage;
            }
        }

        // Emit explosion event
        this.onExplosion?.(game.matchId, { x: projectile.x, y: projectile.y, radius });
    }

    private updateProjectiles(game: GameState): void {
        const toRemove: string[] = [];

        for (const projectile of game.projectiles) {
            projectile.x += projectile.velocityX;
            projectile.y += projectile.velocityY;

            // Out of bounds check
            const mapWidth = game.map.width * GAME.TILE_SIZE;
            const mapHeight = game.map.height * GAME.TILE_SIZE;
            if (projectile.x < 0 || projectile.x > mapWidth || projectile.y < 0 || projectile.y > mapHeight) {
                if (projectile.explosionRadius) {
                    this.triggerExplosion(game, projectile);
                }
                toRemove.push(projectile.id);
                continue;
            }

            // Cover collision
            let hitCover = false;
            for (const cover of game.map.coverObjects) {
                if (!cover.blocksProjectiles) continue;
                if (this.pointInRect(projectile.x, projectile.y, cover)) {
                    if (projectile.explosionRadius) {
                        this.triggerExplosion(game, projectile);
                    }
                    toRemove.push(projectile.id);
                    if (cover.hp > 0) {
                        cover.hp--;
                        if (cover.hp <= 0) {
                            // Destroy cover
                            game.map.coverObjects = game.map.coverObjects.filter((c) => c.id !== cover.id);
                            this.onCoverDestroyed?.(game.matchId, { coverId: cover.id });
                        }
                    }
                    hitCover = true;
                    break;
                }
            }
            if (hitCover) continue;

            // For grenades, check radius for any hit
            if (projectile.explosionRadius) {
                let hasHit = false;

                // Check player hits
                for (const [targetId, target] of game.players) {
                    if (targetId === projectile.ownerId || !target.isAlive) continue;
                    const dist = Math.hypot(target.x - projectile.x, target.y - projectile.y);
                    if (dist < projectile.explosionRadius) {
                        this.triggerExplosion(game, projectile);
                        toRemove.push(projectile.id);
                        hasHit = true;
                        break;
                    }
                }

                // Check NPC hits
                if (!hasHit) {
                    for (const npc of game.npcs) {
                        const dist = Math.hypot(npc.x - projectile.x, npc.y - projectile.y);
                        if (dist < projectile.explosionRadius) {
                            this.triggerExplosion(game, projectile);
                            toRemove.push(projectile.id);
                            hasHit = true;
                            break;
                        }
                    }
                }

                if (hasHit) continue;
            }

            // Player hit detection (non-grenade or grenade direct hit)
            for (const [targetId, target] of game.players) {
                if (targetId === projectile.ownerId || !target.isAlive) continue;

                const dist = Math.hypot(target.x - projectile.x, target.y - projectile.y);
                if (dist < GAME.TILE_SIZE / 2) {
                    const prevHp = target.hp;
                    const hadArmor = target.hasArmor;
                    const result = this.playerService.applyDamage(target, projectile.damage, projectile.ownerId);
                    toRemove.push(projectile.id);

                    // Calculate actual damage dealt (armor absorbs 0 actual damage)
                    const actualDmg = (hadArmor && !result.hasArmor ? 1 : 0) + (prevHp - result.remainingHp);
                    const attacker = game.players.get(projectile.ownerId);
                    if (attacker) attacker.damageDealt += actualDmg;

                    this.onPlayerHit?.(game.matchId, {
                        targetId,
                        attackerId: projectile.ownerId,
                        damage: projectile.damage,
                        remainingHp: result.remainingHp,
                        hasArmor: result.hasArmor,
                    });

                    if (result.died) {
                        if (attacker) attacker.kills++;
                        this.playerService.makeSpectator(target);
                        game.currentRound.alivePlayers = game.currentRound.alivePlayers.filter((id) => id !== targetId);

                        this.onPlayerKilled?.(game.matchId, {
                            victimId: targetId,
                            killerId: projectile.ownerId,
                            weapon: 'gun',
                        });

                        // Drop weapon on death
                        const weaponDrop = this.playerService.getDeathDrop(target);
                        if (weaponDrop) {
                            const dropItem: MapItem = {
                                id: uuidv4(),
                                type: 'machine_gun',
                                x: target.x,
                                y: target.y,
                                isCollected: false,
                                spawnedAt: Date.now(),
                                weaponState: weaponDrop,
                            };
                            game.items.push(dropItem);
                            this.onItemSpawned?.(game.matchId, {
                                item: dropItem,
                                announcement: '🔫 Machine gun dropped!',
                            });
                        }
                    }
                    break;
                }
            }

            // NPC hit detection
            for (const npc of game.npcs) {
                const dist = Math.hypot(npc.x - projectile.x, npc.y - projectile.y);
                if (dist < GAME.TILE_SIZE / 2) {
                    npc.hp -= projectile.damage;
                    toRemove.push(projectile.id);
                    break;
                }
            }
        }

        game.projectiles = game.projectiles.filter((p) => !toRemove.includes(p.id));
    }

    // ============================================================================
    // MELEE
    // ============================================================================

    private processMelee(game: GameState, attacker: PlayerState): void {
        for (const [targetId, target] of game.players) {
            if (targetId === attacker.id || !target.isAlive) continue;

            const dist = Math.hypot(target.x - attacker.x, target.y - attacker.y);
            if (dist <= GAME.MELEE_RANGE) {
                // Check if target is in front of attacker (within ~90 degree cone)
                const angleToTarget = Math.atan2(target.y - attacker.y, target.x - attacker.x);
                const angleDiff = Math.abs(attacker.rotation - angleToTarget);
                if (angleDiff < Math.PI / 2 || angleDiff > Math.PI * 1.5) {
                    const died = this.playerService.applyMelee(target, attacker.id);
                    attacker.damageDealt += DAMAGE.MELEE; // Melee is instant kill

                    if (died) {
                        attacker.kills++;
                        this.playerService.makeSpectator(target);
                        game.currentRound.alivePlayers = game.currentRound.alivePlayers.filter((id) => id !== targetId);

                        this.onPlayerKilled?.(game.matchId, {
                            victimId: targetId,
                            killerId: attacker.id,
                            weapon: 'melee',
                        });

                        // Drop weapon on death
                        const weaponDrop = this.playerService.getDeathDrop(target);
                        if (weaponDrop) {
                            const dropItem: MapItem = {
                                id: uuidv4(),
                                type: 'machine_gun',
                                x: target.x,
                                y: target.y,
                                isCollected: false,
                                spawnedAt: Date.now(),
                                weaponState: weaponDrop,
                            };
                            game.items.push(dropItem);
                            this.onItemSpawned?.(game.matchId, {
                                item: dropItem,
                                announcement: '🔫 Machine gun dropped!',
                            });
                        }
                    }
                    break; // Only hit one player per melee
                }
            }
        }

        // NPC melee
        for (const npc of game.npcs) {
            const dist = Math.hypot(npc.x - attacker.x, npc.y - attacker.y);
            if (dist <= GAME.MELEE_RANGE) {
                const angleToNPC = Math.atan2(npc.y - attacker.y, npc.x - attacker.x);
                const angleDiff = Math.abs(attacker.rotation - angleToNPC);
                if (angleDiff < Math.PI / 2 || angleDiff > Math.PI * 1.5) {
                    npc.hp -= DAMAGE.MELEE;
                    break;
                }
            }
        }
    }

    // ============================================================================
    // ITEM SPAWNS & PICKUP
    // ============================================================================

    private spawnItems(game: GameState): void {
        const accessiblePoints = game.map.itemSpawnPoints.filter((p) =>
            this.isValidPosition(p.x * GAME.TILE_SIZE, p.y * GAME.TILE_SIZE, game.map)
        );

        if (accessiblePoints.length < 2) return;

        // Spawn one health and one armor
        const shuffled = [...accessiblePoints].sort(() => Math.random() - 0.5);

        const healthItem: MapItem = {
            id: uuidv4(),
            type: 'health',
            x: shuffled[0].x * GAME.TILE_SIZE + GAME.TILE_SIZE / 2,
            y: shuffled[0].y * GAME.TILE_SIZE + GAME.TILE_SIZE / 2,
            isCollected: false,
            spawnedAt: Date.now(),
        };

        const armorItem: MapItem = {
            id: uuidv4(),
            type: 'armor',
            x: shuffled[1].x * GAME.TILE_SIZE + GAME.TILE_SIZE / 2,
            y: shuffled[1].y * GAME.TILE_SIZE + GAME.TILE_SIZE / 2,
            isCollected: false,
            spawnedAt: Date.now(),
        };

        game.items.push(healthItem, armorItem);

        this.onItemSpawned?.(game.matchId, {
            item: healthItem,
            announcement: '💊 Health pack dropped!',
        });
        this.onItemSpawned?.(game.matchId, {
            item: armorItem,
            announcement: '🛡️ Armor spawned!',
        });

        // ~20% chance to spawn grenade launcher at 3rd spawn point
        if (shuffled.length >= 3 && Math.random() < 0.2) {
            const grenadeItem: MapItem = {
                id: uuidv4(),
                type: 'grenade_launcher',
                x: shuffled[2].x * GAME.TILE_SIZE + GAME.TILE_SIZE / 2,
                y: shuffled[2].y * GAME.TILE_SIZE + GAME.TILE_SIZE / 2,
                isCollected: false,
                spawnedAt: Date.now(),
                weaponState: { ...GRENADE_LAUNCHER_PICKUP },
            };
            game.items.push(grenadeItem);
            this.onItemSpawned?.(game.matchId, {
                item: grenadeItem,
                announcement: '💥 Grenade launcher spawned!',
            });
        }
    }

    private spawnInitialWeapons(game: GameState): void {
        // Spawn one machine gun and one grenade launcher at center-most item spawn points
        const accessiblePoints = game.map.itemSpawnPoints.filter((p) =>
            this.isValidPosition(p.x * GAME.TILE_SIZE, p.y * GAME.TILE_SIZE, game.map)
        );

        if (accessiblePoints.length < 2) return;

        const mapCenterX = game.map.width * GAME.TILE_SIZE / 2;
        const mapCenterY = game.map.height * GAME.TILE_SIZE / 2;

        // Sort by distance to center and take the 2 closest
        const sorted = accessiblePoints.sort((a, b) => {
            const distA = Math.hypot(a.x * GAME.TILE_SIZE - mapCenterX, a.y * GAME.TILE_SIZE - mapCenterY);
            const distB = Math.hypot(b.x * GAME.TILE_SIZE - mapCenterX, b.y * GAME.TILE_SIZE - mapCenterY);
            return distA - distB;
        });

        // Machine gun at 1st center point
        const machineGunItem: MapItem = {
            id: uuidv4(),
            type: 'machine_gun',
            x: sorted[0].x * GAME.TILE_SIZE + GAME.TILE_SIZE / 2,
            y: sorted[0].y * GAME.TILE_SIZE + GAME.TILE_SIZE / 2,
            isCollected: false,
            spawnedAt: Date.now(),
            weaponState: { ...MACHINE_GUN_PICKUP },
        };

        // Grenade launcher at 2nd center point
        const grenadeItem: MapItem = {
            id: uuidv4(),
            type: 'grenade_launcher',
            x: sorted[1].x * GAME.TILE_SIZE + GAME.TILE_SIZE / 2,
            y: sorted[1].y * GAME.TILE_SIZE + GAME.TILE_SIZE / 2,
            isCollected: false,
            spawnedAt: Date.now(),
            weaponState: { ...GRENADE_LAUNCHER_PICKUP },
        };

        game.items.push(machineGunItem, grenadeItem);

        this.onItemSpawned?.(game.matchId, {
            item: machineGunItem,
            announcement: '🔫 Machine gun spawned!',
        });
        this.onItemSpawned?.(game.matchId, {
            item: grenadeItem,
            announcement: '💥 Grenade launcher spawned!',
        });
    }

    private processPickup(game: GameState, player: PlayerState): void {
        for (const item of game.items) {
            if (item.isCollected) continue;

            const dist = Math.hypot(item.x - player.x, item.y - player.y);
            if (dist <= GAME.ITEM_PICKUP_RANGE) {
                // Weapon pickup
                if ((item.type === 'machine_gun' || item.type === 'grenade_launcher') && item.weaponState) {
                    const oldWeapon = this.playerService.pickupWeapon(player, item.weaponState);
                    item.isCollected = true;
                    player.itemsCollected++;
                    this.onItemCollected?.(game.matchId, { itemId: item.id, playerId: player.id });
                    // If player dropped an old weapon, spawn it
                    if (oldWeapon) {
                        const swapItem: MapItem = {
                            id: uuidv4(),
                            type: oldWeapon.type as ItemType,
                            x: player.x,
                            y: player.y,
                            isCollected: false,
                            spawnedAt: Date.now(),
                            weaponState: oldWeapon,
                        };
                        game.items.push(swapItem);
                    }
                    break;
                }

                const collected = this.playerService.collectItem(player, item);
                if (collected) {
                    player.itemsCollected++;
                    this.onItemCollected?.(game.matchId, {
                        itemId: item.id,
                        playerId: player.id,
                    });
                    break; // Only pick up one item per input
                }
            }
        }
    }

    // ============================================================================
    // NPC ZOMBIES
    // ============================================================================

    private spawnNPC(game: GameState): void {
        if (game.npcs.length >= NPC_CONST.MAX_ALIVE) return;

        const mapWidth = game.map.width * GAME.TILE_SIZE;
        const mapHeight = game.map.height * GAME.TILE_SIZE;

        // Spawn at random map edge
        let x: number, y: number;
        const edge = Math.floor(Math.random() * 4);
        switch (edge) {
            case 0: // top
                x = Math.random() * mapWidth;
                y = GAME.TILE_SIZE * 2;
                break;
            case 1: // bottom
                x = Math.random() * mapWidth;
                y = mapHeight - GAME.TILE_SIZE * 2;
                break;
            case 2: // left
                x = GAME.TILE_SIZE * 2;
                y = Math.random() * mapHeight;
                break;
            default: // right
                x = mapWidth - GAME.TILE_SIZE * 2;
                y = Math.random() * mapHeight;
                break;
        }

        const npc: NPC = {
            id: uuidv4(),
            type: 'zombie',
            x,
            y,
            hp: NPC_CONST.HP,
            speed: GAME.PLAYER_SPEED * NPC_CONST.SPEED_FACTOR,
            rotation: 0,
            targetPlayerId: null,
            state: 'wander',
            wanderAngle: Math.random() * Math.PI * 2,
            wanderChangeTime: Date.now() + NPC_CONST.WANDER_CHANGE_MS,
            lastDamageTime: 0,
        };

        game.npcs.push(npc);
    }

    private updateNPCs(game: GameState): void {
        const now = Date.now();
        const toRemove: string[] = [];

        for (const npc of game.npcs) {
            // Find nearest alive player
            let nearestPlayer: PlayerState | null = null;
            let nearestDist = Infinity;
            for (const [, player] of game.players) {
                if (!player.isAlive) continue;
                const dist = Math.hypot(player.x - npc.x, player.y - npc.y);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestPlayer = player;
                }
            }

            // Aggro/de-aggro logic
            if (npc.state === 'wander' && nearestPlayer && nearestDist < NPC_CONST.AGGRO_RANGE_TILES * GAME.TILE_SIZE) {
                npc.state = 'chase';
                npc.targetPlayerId = nearestPlayer.id;
            } else if (npc.state === 'chase') {
                const target = npc.targetPlayerId ? game.players.get(npc.targetPlayerId) : null;
                if (!target || !target.isAlive || Math.hypot(target.x - npc.x, target.y - npc.y) > NPC_CONST.DEAGGRO_RANGE_TILES * GAME.TILE_SIZE) {
                    npc.state = 'wander';
                    npc.targetPlayerId = null;
                    npc.wanderAngle = Math.random() * Math.PI * 2;
                    npc.wanderChangeTime = now + NPC_CONST.WANDER_CHANGE_MS;
                }
            }

            // Movement
            if (npc.state === 'chase' && npc.targetPlayerId) {
                const target = game.players.get(npc.targetPlayerId);
                if (target) {
                    const angle = Math.atan2(target.y - npc.y, target.x - npc.x);
                    npc.x += Math.cos(angle) * npc.speed;
                    npc.y += Math.sin(angle) * npc.speed;
                    npc.rotation = angle;
                }
            } else {
                // Wander movement
                if (now >= npc.wanderChangeTime) {
                    npc.wanderAngle = Math.random() * Math.PI * 2;
                    npc.wanderChangeTime = now + NPC_CONST.WANDER_CHANGE_MS;
                }
                npc.x += Math.cos(npc.wanderAngle) * npc.speed * 0.5;
                npc.y += Math.sin(npc.wanderAngle) * npc.speed * 0.5;
                npc.rotation = npc.wanderAngle;
            }

            // Clamp to map bounds
            const mapWidth = game.map.width * GAME.TILE_SIZE;
            const mapHeight = game.map.height * GAME.TILE_SIZE;
            npc.x = Math.max(GAME.TILE_SIZE, Math.min(mapWidth - GAME.TILE_SIZE, npc.x));
            npc.y = Math.max(GAME.TILE_SIZE, Math.min(mapHeight - GAME.TILE_SIZE, npc.y));

            // Contact damage to players
            for (const [playerId, player] of game.players) {
                if (!player.isAlive) continue;
                const dist = Math.hypot(player.x - npc.x, player.y - npc.y);
                if (dist < NPC_CONST.CONTACT_RANGE && now - npc.lastDamageTime >= NPC_CONST.DAMAGE_COOLDOWN_MS) {
                    npc.lastDamageTime = now;
                    const result = this.playerService.applyDamage(player, NPC_CONST.DAMAGE, npc.id);

                    this.onPlayerHit?.(game.matchId, {
                        targetId: playerId,
                        attackerId: npc.id,
                        damage: NPC_CONST.DAMAGE,
                        remainingHp: result.remainingHp,
                        hasArmor: result.hasArmor,
                    });

                    if (result.died) {
                        this.playerService.makeSpectator(player);
                        game.currentRound.alivePlayers = game.currentRound.alivePlayers.filter((id) => id !== playerId);

                        this.onPlayerKilled?.(game.matchId, {
                            victimId: playerId,
                            killerId: npc.id,
                            weapon: 'zombie',
                        });
                    }
                }
            }

            // Zone damage to NPCs
            if (game.zone?.isActive) {
                const distToCenter = Math.hypot(npc.x - game.zone.centerX, npc.y - game.zone.centerY);
                if (distToCenter > game.zone.currentRadius) {
                    npc.hp -= DAMAGE.ZONE;
                }
            }

            // Check NPC death
            if (npc.hp <= 0) {
                toRemove.push(npc.id);
                this.spawnNPCDrop(game, npc);
            }
        }

        game.npcs = game.npcs.filter((npc) => !toRemove.includes(npc.id));
    }

    private spawnNPCDrop(game: GameState, npc: NPC): void {
        const roll = Math.random();
        let type: ItemType;
        let weaponState: WeaponState | undefined;

        if (roll < 0.4) {
            type = 'health';
        } else if (roll < 0.8) {
            type = 'armor';
        } else if (roll < 0.9) {
            type = 'machine_gun';
            weaponState = { ...MACHINE_GUN_PICKUP };
        } else {
            type = 'grenade_launcher';
            weaponState = { ...GRENADE_LAUNCHER_PICKUP };
        }

        const item: MapItem = {
            id: uuidv4(),
            type,
            x: npc.x,
            y: npc.y,
            isCollected: false,
            spawnedAt: Date.now(),
            weaponState,
        };

        game.items.push(item);
        this.onItemSpawned?.(game.matchId, {
            item,
            announcement: type === 'health' ? '💊 Health pack dropped!' : type === 'armor' ? '🛡️ Armor dropped!' : type === 'machine_gun' ? '🔫 Machine gun dropped!' : '💥 Grenade launcher dropped!',
        });
    }

    // ============================================================================
    // SHRINKING ZONE
    // ============================================================================

    private createInitialZone(map: GameMap): ShrinkingZone {
        return {
            centerX: (map.width * GAME.TILE_SIZE) / 2,
            centerY: (map.height * GAME.TILE_SIZE) / 2,
            currentRadius: Math.max(map.width, map.height) * GAME.TILE_SIZE,
            targetRadius: GAME.TILE_SIZE * 5,
            shrinkRate: 0.5,
            damagePerTick: DAMAGE.ZONE,
            isActive: false,
        };
    }

    private updateZone(game: GameState): void {
        if (!game.zone) return;

        // Activate zone after some time
        const zoneTriggerTicks = (game.settings.shrinkInterval || 30) * this.tickRate;
        if (game.tickCount >= zoneTriggerTicks && !game.zone.isActive) {
            game.zone.isActive = true;
            this.onZoneShrink?.(game.matchId, { zone: game.zone });
        }

        if (!game.zone.isActive) return;

        // Shrink
        if (game.zone.currentRadius > game.zone.targetRadius) {
            game.zone.currentRadius = Math.max(
                game.zone.targetRadius,
                game.zone.currentRadius - game.zone.shrinkRate
            );
        }

        // Damage players outside zone
        for (const [playerId, player] of game.players) {
            if (!player.isAlive) continue;

            const dist = Math.hypot(player.x - game.zone.centerX, player.y - game.zone.centerY);
            if (dist > game.zone.currentRadius) {
                const result = this.playerService.applyDamage(player, DAMAGE.ZONE, 'zone');

                if (result.died) {
                    this.playerService.makeSpectator(player);
                    game.currentRound.alivePlayers = game.currentRound.alivePlayers.filter((id) => id !== playerId);

                    this.onPlayerKilled?.(game.matchId, {
                        victimId: playerId,
                        killerId: 'zone',
                        weapon: 'zone',
                    });
                }
            }
        }
    }

    // ============================================================================
    // ROUND MANAGEMENT
    // ============================================================================

    private checkRoundEnd(game: GameState): void {
        if (game.currentRound.alivePlayers.length <= 1) {
            const winnerId = game.currentRound.alivePlayers[0] || '';
            game.currentRound.phase = 'ended';
            game.currentRound.endedAt = Date.now();
            game.currentRound.winnerId = winnerId;

            if (winnerId) {
                game.roundScores[winnerId] = (game.roundScores[winnerId] || 0) + 1;
                const winner = game.players.get(winnerId);
                if (winner) winner.roundsWon++;
            }

            this.onRoundEnd?.(game.matchId, {
                roundNumber: game.currentRound.roundNumber,
                winnerId,
                scores: { ...game.roundScores },
            });

            // Check if match is over
            const winsNeeded = Math.ceil(game.bestOf / 2);
            const matchWinner = Object.entries(game.roundScores).find(
                ([, wins]) => wins >= winsNeeded
            );

            if (matchWinner || game.currentRound.roundNumber >= game.bestOf) {
                // Fire and forget - match end happens asynchronously
                this.endMatchWithResults(game, matchWinner?.[0] || winnerId).catch(err => {
                    console.error('Error ending match:', err);
                });
            } else {
                // Start next round after a delay
                game.phase = 'round-transition';
                setTimeout(() => this.startNextRound(game), 5000);
            }
        }
    }

    private startNextRound(game: GameState): void {
        const spawnPoints = this.getSpawnPoints(game.players.size, game.map);
        let index = 0;

        for (const [, player] of game.players) {
            const spawn = spawnPoints[index % spawnPoints.length];
            this.playerService.resetForRound(
                player,
                spawn.x * GAME.TILE_SIZE + GAME.TILE_SIZE / 2,
                spawn.y * GAME.TILE_SIZE + GAME.TILE_SIZE / 2
            );
            index++;
        }

        // Reset game state for new round
        game.projectiles = [];
        game.items = [];
        game.npcs = [];
        game.tickCount = 0;
        game.lastItemSpawnTick = 0;
        game.lastNPCSpawnTick = 0;
        if (game.zone) {
            game.zone = this.createInitialZone(game.map);
        }

        game.currentRound = {
            roundNumber: game.currentRound.roundNumber + 1,
            phase: 'playing',
            alivePlayers: Array.from(game.players.keys()),
            startedAt: Date.now(),
        };

        game.phase = 'round-active';
    }

    private async endMatchWithResults(game: GameState, winnerId: string): Promise<void> {
        game.phase = 'match-ended';

        // Stop game loop
        const interval = this.gameIntervals.get(game.matchId);
        if (interval) {
            clearInterval(interval);
            this.gameIntervals.delete(game.matchId);
        }

        // Build results
        const results: MatchResult[] = [];
        const playerArray = Array.from(game.players.values());

        // Sort by rounds won, then kills
        playerArray.sort((a, b) => {
            const aWins = game.roundScores[a.id] || 0;
            const bWins = game.roundScores[b.id] || 0;
            if (bWins !== aWins) return bWins - aWins;
            return b.kills - a.kills;
        });

        playerArray.forEach((player, index) => {
            const xpGained = this.calculateXP(player, index + 1, game.players.size);
            const levelBefore = player.characterLevel;
            // Level formula: level = floor(1 + sqrt(totalXp / 50))
            const totalXp = player.characterLevel > 1
                ? Math.floor((player.characterLevel - 1) ** 2 * 50)  // reverse formula to get cumulative XP
                : 0;
            const newTotalXp = totalXp + xpGained;
            const levelAfter = Math.floor(1 + Math.sqrt(newTotalXp / 50));

            results.push({
                playerId: player.id,
                username: player.username,
                character: player.character,
                kills: player.kills,
                deaths: player.deaths,
                damageDealt: player.damageDealt,
                itemsCollected: player.itemsCollected,
                roundsWon: player.roundsWon,
                placement: index + 1,
                experienceGained: xpGained,
                levelBefore,
                levelAfter,
            });
        });

        // Save to database
        let dbMatchId: number | undefined;
        try {
            dbMatchId = await this.saveMatchResults(game, winnerId, results);
        } catch (error) {
            console.error('Failed to save match results:', error);
        }

        this.onMatchEnd?.(game.matchId, { winnerId, results, dbMatchId });

        // Clean up game state after a delay
        setTimeout(() => {
            this.activeGames.delete(game.matchId);
        }, 30000);
    }

    // ============================================================================
    // XP & PERSISTENCE
    // ============================================================================

    private calculateXP(player: PlayerState, placement: number, totalPlayers: number): number {
        let xp = 50; // Base XP for participating
        xp += player.kills * 25; // XP per kill
        xp += player.roundsWon * 30; // XP per round won
        if (placement === 1) xp += 100; // Winner bonus
        else if (placement === 2) xp += 50; // Runner-up bonus
        return xp;
    }

    private async saveMatchResults(game: GameState, winnerId: string, results: MatchResult[]): Promise<number | undefined> {
        const duration = Math.floor((Date.now() - game.currentRound.startedAt) / 1000);

        // Upsert all players first — guarantees player rows exist before FK references
        for (const result of results) {
            await this.db.query(
                `INSERT INTO players (auth_user_id, username, selected_character)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (auth_user_id) DO UPDATE SET
                   username = EXCLUDED.username,
                   selected_character = EXCLUDED.selected_character,
                   updated_at = CURRENT_TIMESTAMP`,
                [parseInt(result.playerId), result.username, result.character]
            );
        }

        // Insert match with real lobby_code and resolved winner_id
        const matchResult = await this.db.query(
            `INSERT INTO matches (lobby_code, winner_id, player_count, total_rounds, duration_seconds, settings)
             VALUES ($1, (SELECT id FROM players WHERE auth_user_id = $2), $3, $4, $5, $6)
             RETURNING id`,
            [game.lobbyCode, parseInt(winnerId), game.players.size, game.currentRound.roundNumber, duration, JSON.stringify(game.settings)]
        );

        const dbMatchId = matchResult.rows[0]?.id;
        if (!dbMatchId) return undefined;

        // Insert match results with resolved player_id
        for (const result of results) {
            await this.db.query(
                `INSERT INTO match_results (match_id, player_id, username, character_name, kills, deaths, damage_dealt, items_collected, rounds_won, placement, experience_gained, level_before, level_after, level_up_occurred)
                 VALUES ($1, (SELECT id FROM players WHERE auth_user_id = $2), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                [
                    dbMatchId,
                    parseInt(result.playerId),
                    result.username,
                    result.character,
                    result.kills,
                    result.deaths,
                    result.damageDealt,
                    result.itemsCollected,
                    result.roundsWon,
                    result.placement,
                    result.experienceGained,
                    result.levelBefore,
                    result.levelAfter,
                    (result.levelAfter ?? 1) > (result.levelBefore ?? 1) ? true : false,
                ]
            );

            // Update player stats and character level
            await this.db.query(
                `UPDATE players SET
                   total_kills = total_kills + $1,
                   total_deaths = total_deaths + $2,
                   games_played = games_played + 1,
                   total_wins = total_wins + $3,
                   experience = experience + $4,
                   character_level = $6,
                   updated_at = CURRENT_TIMESTAMP
                 WHERE auth_user_id = $5`,
                [result.kills, result.deaths, result.placement === 1 ? 1 : 0, result.experienceGained, parseInt(result.playerId), result.levelAfter]
            );
        }

        return dbMatchId;
    }

    // ============================================================================
    // MAP GENERATION
    // ============================================================================

    private generateMap(): GameMap {
        return createCampusCourtyard();
    }

    // ============================================================================
    // UTILITY
    // ============================================================================

    private getSpawnPoints(playerCount: number, map: GameMap): SpawnPoint[] {
        const allSpawns = map.spawnPoints;
        if (playerCount >= allSpawns.length) return allSpawns;

        // For 2 players, use opposite corners
        if (playerCount === 2) {
            return [allSpawns[0], allSpawns[3]]; // top-left and bottom-right
        }

        // For 3 players, skip one corner
        if (playerCount === 3) {
            return [allSpawns[0], allSpawns[1], allSpawns[3]];
        }

        return allSpawns;
    }

    private isValidPosition(x: number, y: number, map: GameMap): boolean {
        // Bounds check
        if (x < GAME.TILE_SIZE || x > (map.width - 1) * GAME.TILE_SIZE) return false;
        if (y < GAME.TILE_SIZE || y > (map.height - 1) * GAME.TILE_SIZE) return false;

        // Wall tile check
        const tileX = Math.floor(x / GAME.TILE_SIZE);
        const tileY = Math.floor(y / GAME.TILE_SIZE);
        if (tileX >= 0 && tileX < map.width && tileY >= 0 && tileY < map.height) {
            if (map.tiles[tileY][tileX] === 1) return false;
        }

        // Cover collision check
        for (const cover of map.coverObjects) {
            if (cover.blocksMovement && this.pointInRect(x, y, cover)) {
                return false;
            }
        }

        return true;
    }

    private pointInRect(px: number, py: number, rect: { x: number; y: number; width: number; height: number }): boolean {
        return px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height;
    }

    private serializeState(game: GameState): SerializedGameState {
        return {
            matchId: game.matchId,
            phase: game.phase,
            players: Array.from(game.players.values()),
            projectiles: game.projectiles,
            items: game.items.filter((i) => !i.isCollected),
            npcs: game.npcs,
            zone: game.zone,
            currentRound: game.currentRound,
            roundScores: game.roundScores,
            tickCount: game.tickCount,
        };
    }
}
