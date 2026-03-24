import { v4 as uuidv4 } from 'uuid';
import type {
    CampaignSessionState,
    CampaignEnemy,
    CampaignInput,
    CampaignPlayerState,
    CampaignMap,
    SerializedCampaignState,
    CampaignEnemyType,
    CampaignEnemyZone,
    DayNightState,
    ActiveSeasonalEvent,
} from '../../types/campaign.js';
import { CAMPAIGN_ENEMIES, CAMPAIGN } from '../../types/campaign.js';
import { CampaignMapService } from './CampaignMapService.js';
import { DayNightService } from './DayNightService.js';
import { SeasonalEventService } from './SeasonalEventService.js';

const WANDER_CHANGE_MS = 3000;
const CONTACT_RANGE_PX = 24;
const DAMAGE_COOLDOWN_MS = 1000;

export class CampaignGameLoop {
    private activeSessions: Map<string, CampaignSessionState> = new Map();
    private sessionIntervals: Map<string, NodeJS.Timeout> = new Map();
    private mapService: CampaignMapService;
    private seasonalEventService: SeasonalEventService;

    // Cached day/night and seasonal state (updated every ~1s, not every tick)
    private cachedDayNight: DayNightState | null = null;
    private cachedActiveEvents: Map<string, ActiveSeasonalEvent[]> = new Map();

    // Callbacks (same pattern as GameService)
    private onStateUpdate?: (sessionId: string, state: SerializedCampaignState) => void;
    private onEnemyKilled?: (sessionId: string, data: { enemyId: string; enemyType: CampaignEnemyType; x: number; y: number }) => void;
    private onPlayerHit?: (sessionId: string, data: { damage: number; remainingHp: number; hasArmor: boolean }) => void;
    private onPlayerDied?: (sessionId: string) => void;

    constructor(mapService: CampaignMapService) {
        this.mapService = mapService;
        this.seasonalEventService = new SeasonalEventService();
    }

    /**
     * Register event callbacks (called by CampaignService).
     */
    setCallbacks(callbacks: {
        onStateUpdate: (sessionId: string, state: SerializedCampaignState) => void;
        onEnemyKilled: (sessionId: string, data: { enemyId: string; enemyType: CampaignEnemyType; x: number; y: number }) => void;
        onPlayerHit: (sessionId: string, data: { damage: number; remainingHp: number; hasArmor: boolean }) => void;
        onPlayerDied: (sessionId: string) => void;
    }): void {
        this.onStateUpdate = callbacks.onStateUpdate;
        this.onEnemyKilled = callbacks.onEnemyKilled;
        this.onPlayerHit = callbacks.onPlayerHit;
        this.onPlayerDied = callbacks.onPlayerDied;
    }

    /**
     * Create a new campaign session.
     */
    createSession(sessionId: string, player: CampaignPlayerState, map: CampaignMap): CampaignSessionState {
        const session: CampaignSessionState = {
            sessionId,
            mapId: map.meta.id,
            map,
            player,
            companions: [],
            auxiliaries: [],
            npcs: [],
            enemies: [],
            items: [],
            tickCount: 0,
        };

        this.activeSessions.set(sessionId, session);
        return session;
    }

    /**
     * Start the tick loop for a session.
     */
    startSession(sessionId: string): void {
        if (this.sessionIntervals.has(sessionId)) {
            console.warn(`[CampaignGameLoop] Session ${sessionId} already running`);
            return;
        }

        const interval = setInterval(() => this.tick(sessionId), 1000 / CAMPAIGN.TICK_RATE);
        this.sessionIntervals.set(sessionId, interval);
    }

    /**
     * The 20Hz tick.
     */
    private tick(sessionId: string): void {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;

        session.tickCount++;

        // 0. Every 20 ticks (~1 second), update day/night state and seasonal events
        if (session.tickCount % CAMPAIGN.TICK_RATE === 0) {
            this.updateTimeBasedState(session);
        }

        // 1. Update enemies (wander/chase AI)
        this.updateEnemies(session);

        // 2. Check enemy-player combat
        this.checkEnemyCombat(session);

        // 3. Spawn enemies in zones (based on spawn interval)
        this.spawnEnemiesInZones(session);

        // 4. Check item collection
        this.checkItemCollection(session);

        // 5. Broadcast state
        if (this.onStateUpdate) {
            this.onStateUpdate(sessionId, this.serializeState(session));
        }
    }

    /**
     * Update time-based state: day/night cycle and seasonal events.
     * Called every ~1 second (every 20 ticks) to avoid unnecessary computation.
     */
    private updateTimeBasedState(session: CampaignSessionState): void {
        // Derive country from map ID (maps are named like 'vogelsen', 'singapore_chinatown', etc.)
        // Default to 'germany' for the starting maps
        const countryId = this.getCountryFromMapId(session.mapId);

        // Boss zones always report daytime
        if (DayNightService.isBossZone(session.mapId)) {
            this.cachedDayNight = {
                timeOfDay: 'day',
                sunAngle: 180,
                lightLevel: 1.0,
                tintColor: '#FFFFFF',
                hour: 12,
                minute: 0,
            };
        } else {
            this.cachedDayNight = DayNightService.getState(countryId);
        }

        // Update seasonal events for this country
        this.cachedActiveEvents.set(countryId, this.seasonalEventService.getActiveEvents(countryId));
    }

    /**
     * Extract country ID from map ID.
     * Map IDs follow patterns like 'vogelsen' (germany), 'singapore_chinatown', 'boss_ireland', etc.
     * Falls back to 'germany' for the starting Vogelsen maps.
     */
    private getCountryFromMapId(mapId: string): string {
        // Starting maps (Vogelsen, Patrick's house) are in Germany
        if (mapId.startsWith('vogelsen') || mapId.startsWith('patricks-house')) {
            return 'germany';
        }

        // Boss zones: 'boss_ireland' -> 'ireland'
        if (mapId.startsWith('boss_')) {
            return mapId.replace('boss_', '').split('_')[0] ?? 'germany';
        }

        // Country-prefixed maps: 'singapore_chinatown' -> 'singapore'
        const firstSegment = mapId.split('_')[0];
        const knownCountries = [
            'germany', 'singapore', 'philippines', 'new_zealand', 'ireland',
            'south_africa', 'nigeria', 'jamaica', 'canada', 'scotland',
            'wales', 'england', 'australia', 'usa',
        ];
        if (firstSegment && knownCountries.includes(firstSegment)) {
            return firstSegment;
        }

        // Handle compound country names (new_zealand, south_africa)
        for (const country of knownCountries) {
            if (mapId.startsWith(country)) {
                return country;
            }
        }

        return 'germany';
    }

    /**
     * Process player input.
     */
    processInput(sessionId: string, playerId: string, input: CampaignInput): void {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;

        const player = session.player;
        if (player.id !== playerId || !player.isAlive) return;

        // Movement
        const speed = input.sprint
            ? CAMPAIGN.PLAYER_SPEED * CAMPAIGN.SPRINT_MULTIPLIER
            : CAMPAIGN.PLAYER_SPEED;

        let dx = input.movement.x * speed;
        let dy = input.movement.y * speed;

        // Clamp movement magnitude
        const magnitude = Math.sqrt(dx * dx + dy * dy);
        const maxDelta = CAMPAIGN.PLAYER_SPEED * CAMPAIGN.SPRINT_MULTIPLIER * 1.1;
        if (magnitude > maxDelta) {
            const scale = maxDelta / magnitude;
            dx *= scale;
            dy *= scale;
        }

        const newX = player.x + dx;
        const newY = player.y + dy;

        // Check walkability before applying movement
        if (this.mapService.isPositionWalkable(session.map, newX, newY)) {
            player.x = newX;
            player.y = newY;
        } else {
            // Try sliding along axes independently
            if (this.mapService.isPositionWalkable(session.map, newX, player.y)) {
                player.x = newX;
            } else if (this.mapService.isPositionWalkable(session.map, player.x, newY)) {
                player.y = newY;
            }
        }

        // Clamp to map bounds
        const clamped = this.mapService.clampToMapBounds(session.map, player.x, player.y);
        player.x = clamped.x;
        player.y = clamped.y;

        // Aim
        player.rotation = input.aimAngle;

        // Update pose
        if (input.shooting) {
            player.pose = 'gun';
        } else if (input.melee) {
            player.pose = 'hold';
        } else if (input.sprint && (input.movement.x !== 0 || input.movement.y !== 0)) {
            player.pose = 'stand'; // sprinting uses stand pose
        } else {
            player.pose = 'stand';
        }

        // Melee attack against enemies
        if (input.melee) {
            this.processMelee(session);
        }

        // Shooting against enemies
        if (input.shooting) {
            this.processShoot(session);
        }
    }

    /**
     * Change the map (door transition).
     */
    changeMap(sessionId: string, newMap: CampaignMap, spawnX: number, spawnY: number): void {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;

        session.mapId = newMap.meta.id;
        session.map = newMap;
        session.player.x = spawnX;
        session.player.y = spawnY;
        session.enemies = [];
        session.items = [];
    }

    /**
     * Get session state.
     */
    getSession(sessionId: string): CampaignSessionState | undefined {
        return this.activeSessions.get(sessionId);
    }

    /**
     * Stop a session.
     */
    stopSession(sessionId: string): void {
        const interval = this.sessionIntervals.get(sessionId);
        if (interval) {
            clearInterval(interval);
            this.sessionIntervals.delete(sessionId);
        }
        this.activeSessions.delete(sessionId);
    }

    /**
     * Update NPC runtime states (called by CampaignService when quest state changes).
     */
    updateNPCStates(sessionId: string, npcs: CampaignSessionState['npcs']): void {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;
        session.npcs = npcs;
    }

    // ============================================================================
    // ENEMY AI
    // ============================================================================

    /**
     * Update enemy wander/chase AI (same pattern as GameService zombie logic).
     */
    private updateEnemies(session: CampaignSessionState): void {
        const now = Date.now();
        const tileSize = session.map.meta.tileSize;
        const toRemove: string[] = [];

        for (const enemy of session.enemies) {
            const def = CAMPAIGN_ENEMIES[enemy.type];
            const player = session.player;

            if (!player.isAlive) {
                // No target — wander
                this.wanderEnemy(enemy, now);
                this.clampEnemyToMap(enemy, session.map);
                continue;
            }

            const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
            const aggroRangePx = def.aggroRange * tileSize;
            const deaggroRangePx = def.deaggroRange * tileSize;

            // Aggro/de-aggro logic
            if (enemy.state === 'wander' && distToPlayer < aggroRangePx) {
                enemy.state = 'chase';
                enemy.targetPlayerId = player.id;
            } else if (enemy.state === 'chase') {
                if (distToPlayer > deaggroRangePx || !player.isAlive) {
                    enemy.state = 'wander';
                    enemy.targetPlayerId = null;
                    enemy.wanderAngle = Math.random() * Math.PI * 2;
                    enemy.wanderChangeTime = now + WANDER_CHANGE_MS;
                }
            }

            // Movement
            if (enemy.state === 'chase' && enemy.targetPlayerId) {
                const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
                const newX = enemy.x + Math.cos(angle) * enemy.speed;
                const newY = enemy.y + Math.sin(angle) * enemy.speed;

                // Only move if target position is walkable
                if (this.mapService.isPositionWalkable(session.map, newX, newY)) {
                    enemy.x = newX;
                    enemy.y = newY;
                }
                enemy.rotation = angle;
            } else {
                this.wanderEnemy(enemy, now);
            }

            this.clampEnemyToMap(enemy, session.map);

            // Check enemy death
            if (enemy.hp <= 0) {
                toRemove.push(enemy.id);
                this.onEnemyKilled?.(session.sessionId, {
                    enemyId: enemy.id,
                    enemyType: enemy.type,
                    x: enemy.x,
                    y: enemy.y,
                });
            }
        }

        if (toRemove.length > 0) {
            session.enemies = session.enemies.filter((e) => !toRemove.includes(e.id));
        }
    }

    /**
     * Wander movement for an enemy.
     */
    private wanderEnemy(enemy: CampaignEnemy, now: number): void {
        if (now >= enemy.wanderChangeTime) {
            enemy.wanderAngle = Math.random() * Math.PI * 2;
            enemy.wanderChangeTime = now + WANDER_CHANGE_MS;
        }
        enemy.x += Math.cos(enemy.wanderAngle) * enemy.speed * 0.5;
        enemy.y += Math.sin(enemy.wanderAngle) * enemy.speed * 0.5;
        enemy.rotation = enemy.wanderAngle;
    }

    /**
     * Clamp enemy position to map bounds.
     */
    private clampEnemyToMap(enemy: CampaignEnemy, map: CampaignMap): void {
        const clamped = this.mapService.clampToMapBounds(map, enemy.x, enemy.y);
        enemy.x = clamped.x;
        enemy.y = clamped.y;
    }

    // ============================================================================
    // COMBAT
    // ============================================================================

    /**
     * Check enemy contact damage to player.
     */
    private checkEnemyCombat(session: CampaignSessionState): void {
        const now = Date.now();
        const player = session.player;
        if (!player.isAlive) return;

        for (const enemy of session.enemies) {
            const def = CAMPAIGN_ENEMIES[enemy.type];
            const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);

            if (dist < CONTACT_RANGE_PX && now - enemy.lastDamageTime >= DAMAGE_COOLDOWN_MS) {
                enemy.lastDamageTime = now;

                // Apply damage
                if (player.hasArmor) {
                    player.hasArmor = false;
                } else {
                    player.hp = Math.max(0, player.hp - def.damage);
                }

                this.onPlayerHit?.(session.sessionId, {
                    damage: def.damage,
                    remainingHp: player.hp,
                    hasArmor: player.hasArmor,
                });

                if (player.hp <= 0) {
                    player.isAlive = false;
                    this.onPlayerDied?.(session.sessionId);
                }
            }
        }
    }

    /**
     * Process melee attack — instant kill on nearby enemies.
     */
    private processMelee(session: CampaignSessionState): void {
        const player = session.player;
        const meleeRange = CAMPAIGN.TILE_SIZE * 1.5;

        for (const enemy of session.enemies) {
            const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
            // Check if enemy is in melee range and roughly in the direction player is facing
            if (dist < meleeRange) {
                const angleToEnemy = Math.atan2(enemy.y - player.y, enemy.x - player.x);
                const angleDiff = Math.abs(this.normalizeAngle(angleToEnemy - player.rotation));
                if (angleDiff < Math.PI / 2) {
                    enemy.hp = 0; // Melee kills instantly
                }
            }
        }
    }

    /**
     * Process ranged attack — damage enemies in the aim direction.
     */
    private processShoot(session: CampaignSessionState): void {
        const player = session.player;
        const shootRange = CAMPAIGN.TILE_SIZE * 8;

        // Find the nearest enemy in the firing arc
        let nearestEnemy: CampaignEnemy | null = null;
        let nearestDist = Infinity;

        for (const enemy of session.enemies) {
            const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
            if (dist > shootRange) continue;

            const angleToEnemy = Math.atan2(enemy.y - player.y, enemy.x - player.x);
            const angleDiff = Math.abs(this.normalizeAngle(angleToEnemy - player.rotation));
            if (angleDiff < Math.PI / 6 && dist < nearestDist) {
                nearestDist = dist;
                nearestEnemy = enemy;
            }
        }

        if (nearestEnemy) {
            nearestEnemy.hp -= 1;
        }
    }

    // ============================================================================
    // ENEMY SPAWNING
    // ============================================================================

    /**
     * Spawn enemies in zones based on spawn interval.
     * Night-time increases max enemies per zone via spawn multiplier.
     * Zones with timeRestriction are only active during matching time of day.
     */
    private spawnEnemiesInZones(session: CampaignSessionState): void {
        const ticksPerSpawnCheck = CAMPAIGN.ENEMY_SPAWN_INTERVAL_S * CAMPAIGN.TICK_RATE;
        if (session.tickCount % ticksPerSpawnCheck !== 0) return;

        const dayNight = this.cachedDayNight;
        const timeOfDay = dayNight?.timeOfDay ?? 'day';
        const spawnMultiplier = DayNightService.getEnemySpawnMultiplier(timeOfDay);

        for (const zone of session.map.enemyZones) {
            // Check time restriction on the zone
            if (zone.timeRestriction) {
                const isDay = timeOfDay === 'day' || timeOfDay === 'dawn' || timeOfDay === 'dusk';
                if (zone.timeRestriction === 'day' && !isDay) continue;
                if (zone.timeRestriction === 'night' && timeOfDay !== 'night') continue;
            }

            // Count current enemies in this zone
            const currentCount = session.enemies.filter((e) => e.zoneId === zone.id).length;
            const effectiveMax = Math.floor(zone.maxEnemies * spawnMultiplier);
            if (currentCount >= effectiveMax) continue;

            // Spawn one enemy
            this.spawnEnemyInZone(session, zone);
        }
    }

    /**
     * Spawn a single enemy in a zone.
     */
    private spawnEnemyInZone(session: CampaignSessionState, zone: CampaignEnemyZone): void {
        const def = CAMPAIGN_ENEMIES[zone.enemyType];
        if (!def) return;

        const tileSize = session.map.meta.tileSize;

        // Random position within zone bounds
        const tx = zone.minX + Math.random() * (zone.maxX - zone.minX);
        const ty = zone.minY + Math.random() * (zone.maxY - zone.minY);
        const px = tx * tileSize + tileSize / 2;
        const py = ty * tileSize + tileSize / 2;

        // Only spawn if position is walkable
        if (!this.mapService.isPositionWalkable(session.map, px, py)) return;

        const enemy: CampaignEnemy = {
            id: uuidv4(),
            type: zone.enemyType,
            x: px,
            y: py,
            hp: def.hp,
            speed: def.speed,
            rotation: Math.random() * Math.PI * 2,
            state: 'wander',
            targetPlayerId: null,
            wanderAngle: Math.random() * Math.PI * 2,
            wanderChangeTime: Date.now() + WANDER_CHANGE_MS,
            lastDamageTime: 0,
            zoneId: zone.id,
        };

        session.enemies.push(enemy);
    }

    // ============================================================================
    // ITEMS
    // ============================================================================

    /**
     * Check if player walks over an uncollected item.
     */
    private checkItemCollection(session: CampaignSessionState): void {
        const player = session.player;
        if (!player.isAlive) return;

        for (const item of session.items) {
            if (item.collected) continue;
            const dist = Math.hypot(player.x - item.x, player.y - item.y);
            if (dist < CAMPAIGN.TILE_SIZE) {
                item.collected = true;
            }
        }
    }

    // ============================================================================
    // SERIALIZATION
    // ============================================================================

    /**
     * Serialize state for network transmission.
     */
    private serializeState(session: CampaignSessionState): SerializedCampaignState {
        const countryId = this.getCountryFromMapId(session.mapId);

        // Use cached day/night state or compute fresh
        const dayNight = this.cachedDayNight ?? DayNightService.getState(countryId);
        const activeEvents = this.cachedActiveEvents.get(countryId)
            ?? this.seasonalEventService.getActiveEvents(countryId);

        return {
            sessionId: session.sessionId,
            mapId: session.mapId,
            map: {
                meta: session.map.meta,
                tiles: session.map.tiles,
                coverObjects: session.map.coverObjects,
                doors: session.map.doors,
            },
            player: session.player,
            companions: session.companions,
            auxiliaries: session.auxiliaries,
            npcs: session.npcs,
            enemies: session.enemies,
            items: session.items,
            tickCount: session.tickCount,
            dayNight,
            activeEvents,
        };
    }

    // ============================================================================
    // UTILITIES
    // ============================================================================

    /**
     * Normalize an angle to [-PI, PI].
     */
    private normalizeAngle(angle: number): number {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }
}
