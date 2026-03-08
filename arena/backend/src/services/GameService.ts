import { v4 as uuidv4 } from 'uuid';
import type {
    GameState,
    PlayerState,
    PlayerInput,
    Projectile,
    MapItem,
    GameMap,
    SpawnPoint,
    ShrinkingZone,
    RoundState,
    ArenaLobbySettings,
    ArenaLobby,
    SerializedGameState,
    MatchResult,
    CoverObject,
} from '../types/game.js';
import { GAME, HP, DAMAGE } from '../types/game.js';
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
    private onPlayerKilled?: (matchId: string, data: { victimId: string; killerId: string; weapon: 'gun' | 'melee' | 'zone' }) => void;
    private onItemSpawned?: (matchId: string, data: { item: MapItem; announcement: string }) => void;
    private onItemCollected?: (matchId: string, data: { itemId: string; playerId: string }) => void;
    private onRoundEnd?: (matchId: string, data: { roundNumber: number; winnerId: string; scores: Record<string, number> }) => void;
    private onMatchEnd?: (matchId: string, data: { winnerId: string; results: MatchResult[] }) => void;
    private onZoneShrink?: (matchId: string, data: { zone: ShrinkingZone }) => void;
    private onCoverDestroyed?: (matchId: string, data: { coverId: string }) => void;

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
        onPlayerKilled: (matchId: string, data: { victimId: string; killerId: string; weapon: 'gun' | 'melee' | 'zone' }) => void;
        onItemSpawned: (matchId: string, data: { item: MapItem; announcement: string }) => void;
        onItemCollected: (matchId: string, data: { itemId: string; playerId: string }) => void;
        onRoundEnd: (matchId: string, data: { roundNumber: number; winnerId: string; scores: Record<string, number> }) => void;
        onMatchEnd: (matchId: string, data: { winnerId: string; results: MatchResult[] }) => void;
        onZoneShrink: (matchId: string, data: { zone: ShrinkingZone }) => void;
        onCoverDestroyed: (matchId: string, data: { coverId: string }) => void;
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
        };

        this.activeGames.set(matchId, gameState);

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

        // Movement
        const speed = input.sprint ? GAME.PLAYER_SPEED * GAME.SPRINT_MULTIPLIER : GAME.PLAYER_SPEED;
        const dx = input.movement.x * speed;
        const dy = input.movement.y * speed;

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

        // Shooting
        if (input.shooting && !input.sprint) {
            this.createProjectile(game, player);
        }

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

    private createProjectile(game: GameState, player: PlayerState): void {
        const projectile: Projectile = {
            id: uuidv4(),
            ownerId: player.id,
            x: player.x,
            y: player.y,
            velocityX: Math.cos(player.rotation) * GAME.PROJECTILE_SPEED,
            velocityY: Math.sin(player.rotation) * GAME.PROJECTILE_SPEED,
            damage: DAMAGE.GUN,
            createdAt: Date.now(),
        };
        game.projectiles.push(projectile);
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
                toRemove.push(projectile.id);
                continue;
            }

            // Cover collision
            for (const cover of game.map.coverObjects) {
                if (!cover.blocksProjectiles) continue;
                if (this.pointInRect(projectile.x, projectile.y, cover)) {
                    toRemove.push(projectile.id);
                    if (cover.hp > 0) {
                        cover.hp--;
                        if (cover.hp <= 0) {
                            // Destroy cover
                            game.map.coverObjects = game.map.coverObjects.filter((c) => c.id !== cover.id);
                            this.onCoverDestroyed?.(game.matchId, { coverId: cover.id });
                        }
                    }
                    break;
                }
            }

            // Player hit detection
            for (const [targetId, target] of game.players) {
                if (targetId === projectile.ownerId || !target.isAlive) continue;

                const dist = Math.hypot(target.x - projectile.x, target.y - projectile.y);
                if (dist < GAME.TILE_SIZE / 2) {
                    const result = this.playerService.applyDamage(target, projectile.damage, projectile.ownerId);
                    toRemove.push(projectile.id);

                    this.onPlayerHit?.(game.matchId, {
                        targetId,
                        attackerId: projectile.ownerId,
                        damage: projectile.damage,
                        remainingHp: result.remainingHp,
                        hasArmor: result.hasArmor,
                    });

                    if (result.died) {
                        const attacker = game.players.get(projectile.ownerId);
                        if (attacker) attacker.kills++;
                        this.playerService.makeSpectator(target);
                        game.currentRound.alivePlayers = game.currentRound.alivePlayers.filter((id) => id !== targetId);

                        this.onPlayerKilled?.(game.matchId, {
                            victimId: targetId,
                            killerId: projectile.ownerId,
                            weapon: 'gun',
                        });
                    }
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

                    if (died) {
                        attacker.kills++;
                        this.playerService.makeSpectator(target);
                        game.currentRound.alivePlayers = game.currentRound.alivePlayers.filter((id) => id !== targetId);

                        this.onPlayerKilled?.(game.matchId, {
                            victimId: targetId,
                            killerId: attacker.id,
                            weapon: 'melee',
                        });
                    }
                    break; // Only hit one player per melee
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
    }

    private processPickup(game: GameState, player: PlayerState): void {
        for (const item of game.items) {
            if (item.isCollected) continue;

            const dist = Math.hypot(item.x - player.x, item.y - player.y);
            if (dist <= GAME.ITEM_PICKUP_RANGE) {
                const collected = this.playerService.collectItem(player, item);
                if (collected) {
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
                this.endMatchWithResults(game, matchWinner?.[0] || winnerId);
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
        game.tickCount = 0;
        game.lastItemSpawnTick = 0;
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
            results.push({
                playerId: player.id,
                username: player.username,
                character: player.character,
                kills: player.kills,
                deaths: player.deaths,
                damageDealt: player.kills * DAMAGE.GUN, // Simplified
                itemsCollected: 0, // TODO: track properly
                roundsWon: player.roundsWon,
                placement: index + 1,
                experienceGained: xpGained,
            });
        });

        this.onMatchEnd?.(game.matchId, { winnerId, results });

        // Save to database
        try {
            await this.saveMatchResults(game, winnerId, results);
        } catch (error) {
            console.error('Failed to save match results:', error);
        }

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

    private async saveMatchResults(game: GameState, winnerId: string, results: MatchResult[]): Promise<void> {
        const duration = Math.floor((Date.now() - game.currentRound.startedAt) / 1000);

        // Insert match
        const matchResult = await this.db.query(
            `INSERT INTO matches (lobby_code, winner_id, player_count, total_rounds, duration_seconds, settings)
       VALUES ($1, (SELECT id FROM players WHERE auth_user_id = $2), $3, $4, $5, $6)
       RETURNING id`,
            [null, parseInt(winnerId), game.players.size, game.currentRound.roundNumber, duration, JSON.stringify(game.settings)]
        );

        const dbMatchId = matchResult.rows[0]?.id;
        if (!dbMatchId) return;

        // Insert match results
        for (const result of results) {
            await this.db.query(
                `INSERT INTO match_results (match_id, player_id, username, character_name, kills, deaths, damage_dealt, items_collected, rounds_won, placement, experience_gained)
         VALUES ($1, (SELECT id FROM players WHERE auth_user_id = $2), $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [dbMatchId, parseInt(result.playerId), result.username, result.character, result.kills, result.deaths, result.damageDealt, result.itemsCollected, result.roundsWon, result.placement, result.experienceGained]
            );

            // Update player stats
            await this.db.query(
                `UPDATE players SET
           total_kills = total_kills + $1,
           total_deaths = total_deaths + $2,
           games_played = games_played + 1,
           total_wins = total_wins + $3,
           experience = experience + $4,
           updated_at = CURRENT_TIMESTAMP
         WHERE auth_user_id = $5`,
                [result.kills, result.deaths, result.placement === 1 ? 1 : 0, result.experienceGained, parseInt(result.playerId)]
            );
        }
    }

    // ============================================================================
    // MAP GENERATION
    // ============================================================================

    private generateMap(): GameMap {
        const width = GAME.MAP_WIDTH_TILES;
        const height = GAME.MAP_HEIGHT_TILES;

        // Initialize tiles (0 = ground)
        const tiles: number[][] = Array(height).fill(null).map(() => Array(width).fill(0));

        // Add walls around the perimeter
        for (let x = 0; x < width; x++) {
            tiles[0][x] = 1; // top wall
            tiles[height - 1][x] = 1; // bottom wall
        }
        for (let y = 0; y < height; y++) {
            tiles[y][0] = 1; // left wall
            tiles[y][width - 1] = 1; // right wall
        }

        // Generate cover objects
        const coverObjects: CoverObject[] = [];
        const coverCount = 25 + Math.floor(Math.random() * 15);

        for (let i = 0; i < coverCount; i++) {
            const x = 3 + Math.floor(Math.random() * (width - 6));
            const y = 3 + Math.floor(Math.random() * (height - 6));

            // Don't place near corners (spawn points)
            if (this.isNearCorner(x, y, width, height, 5)) continue;

            const coverType = this.randomCoverType();
            coverObjects.push({
                id: uuidv4(),
                type: coverType,
                x: x * GAME.TILE_SIZE,
                y: y * GAME.TILE_SIZE,
                width: GAME.TILE_SIZE,
                height: GAME.TILE_SIZE,
                hp: coverType === 'crate' ? 3 : -1,
                blocksProjectiles: coverType !== 'bush' && coverType !== 'water',
                blocksLineOfSight: coverType !== 'bush' && coverType !== 'water',
                blocksMovement: coverType !== 'bush' && coverType !== 'water',
                slowsMovement: coverType === 'water',
            });
        }

        // Spawn points (one per corner)
        const spawnPoints: SpawnPoint[] = [
            { x: 2, y: 2, corner: 'top-left' },
            { x: width - 3, y: 2, corner: 'top-right' },
            { x: 2, y: height - 3, corner: 'bottom-left' },
            { x: width - 3, y: height - 3, corner: 'bottom-right' },
        ];

        // Item spawn points (scattered around center area)
        const itemSpawnPoints: { x: number; y: number }[] = [];
        for (let i = 0; i < 20; i++) {
            const ix = 5 + Math.floor(Math.random() * (width - 10));
            const iy = 5 + Math.floor(Math.random() * (height - 10));
            itemSpawnPoints.push({ x: ix, y: iy });
        }

        return {
            width,
            height,
            tileSize: GAME.TILE_SIZE,
            tiles,
            coverObjects,
            spawnPoints,
            itemSpawnPoints,
        };
    }

    private randomCoverType(): CoverObject['type'] {
        const types: CoverObject['type'][] = ['wall', 'crate', 'crate', 'pillar', 'bush', 'bush'];
        return types[Math.floor(Math.random() * types.length)];
    }

    private isNearCorner(x: number, y: number, mapW: number, mapH: number, margin: number): boolean {
        return (
            (x < margin && y < margin) ||
            (x > mapW - margin && y < margin) ||
            (x < margin && y > mapH - margin) ||
            (x > mapW - margin && y > mapH - margin)
        );
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
            zone: game.zone,
            currentRound: game.currentRound,
            roundScores: game.roundScores,
            tickCount: game.tickCount,
        };
    }
}
