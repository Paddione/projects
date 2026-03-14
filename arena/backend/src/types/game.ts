import type { WeaponState } from './weapon.js';

// ============================================================================
// Core Game Types for Arena
// ============================================================================

// -- Player & HP --

export type HealthState = 'full' | 'injured' | 'armored' | 'armored_injured';

export interface PlayerState {
    id: string;
    username: string;
    character: string;
    characterLevel: number;
    x: number;
    y: number;
    rotation: number;           // radians, direction player is facing
    hp: number;                 // 0-2
    hasArmor: boolean;
    isAlive: boolean;
    isSpectating: boolean;
    kills: number;
    deaths: number;
    roundsWon: number;
    damageDealt: number;        // accumulated across full match
    itemsCollected: number;     // accumulated across full match
    lastMoveDirection: { dx: number; dy: number };
    weapon: WeaponState;
    lastShotTime: number;
    pose: string;
}

export interface PlayerInput {
    movement: { x: number; y: number };  // -1 to 1 for each axis
    aimAngle: number;                     // radians
    shooting: boolean;
    melee: boolean;
    sprint: boolean;
    pickup: boolean;
    reload: boolean;
    timestamp: number;
}

// -- Projectile --

export interface Projectile {
    id: string;
    ownerId: string;
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    damage: number;
    createdAt: number;
    explosionRadius?: number;
}

// -- Items --

export type ItemType = 'health' | 'armor' | 'machine_gun' | 'grenade_launcher';

export interface MapItem {
    id: string;
    type: ItemType;
    x: number;
    y: number;
    isCollected: boolean;
    spawnedAt: number;
    weaponState?: WeaponState;
}

// -- Cover --

export type CoverType = 'building' | 'bench' | 'fountain' | 'hedge' | 'pond';

export interface CoverObject {
    id: string;
    type: CoverType;
    x: number;
    y: number;
    width: number;
    height: number;
    hp: number;                  // -1 = indestructible
    blocksProjectiles: boolean;
    blocksLineOfSight: boolean;
    blocksMovement: boolean;
    slowsMovement: boolean;
}

// -- Map --

export interface SpawnPoint {
    x: number;
    y: number;
    corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export interface GameMap {
    width: number;               // in tiles
    height: number;              // in tiles
    tileSize: number;            // pixels (32)
    tiles: number[][];           // tile type grid
    coverObjects: CoverObject[];
    spawnPoints: SpawnPoint[];
    itemSpawnPoints: { x: number; y: number }[];
}

// -- Zone --

export interface ShrinkingZone {
    centerX: number;
    centerY: number;
    currentRadius: number;
    targetRadius: number;
    shrinkRate: number;          // pixels per tick
    damagePerTick: number;
    isActive: boolean;
}

// -- Round & Match --

export type RoundPhase = 'countdown' | 'playing' | 'ended';
export type MatchPhase = 'waiting' | 'starting' | 'round-active' | 'round-transition' | 'match-ended';

export interface RoundState {
    roundNumber: number;
    phase: RoundPhase;
    alivePlayers: string[];      // player IDs
    startedAt: number;
    endedAt?: number;
    winnerId?: string;
}

export interface GameState {
    matchId: string;
    lobbyCode: string;
    phase: MatchPhase;
    players: Map<string, PlayerState>;
    projectiles: Projectile[];
    items: MapItem[];
    map: GameMap;
    zone?: ShrinkingZone;
    currentRound: RoundState;
    roundScores: Record<string, number>; // playerId -> rounds won
    bestOf: 1 | 3 | 5;
    settings: ArenaLobbySettings;
    tickCount: number;
    lastItemSpawnTick: number;
    npcs: NPC[];
    lastNPCSpawnTick: number;
}

// -- NPC --

export type NPCType = 'zombie' | 'enemy';
export type NPCState = 'wander' | 'chase' | 'patrol' | 'engage';

export interface NPC {
    id: string;
    type: NPCType;
    x: number;
    y: number;
    hp: number;
    speed: number;
    rotation: number;
    targetPlayerId: string | null;
    state: NPCState;
    wanderAngle: number;
    wanderChangeTime: number;
    lastDamageTime: number;
    // Enemy NPC fields:
    weapon?: WeaponState;
    lastShotTime?: number;
    engageRange?: number;
    patrolTarget?: { x: number; y: number };
    losLostTime?: number;
    label?: string;
}

// -- Lobby --

export interface ArenaLobbySettings {
    maxPlayers: 2 | 3 | 4;
    bestOf: 1 | 3 | 5;
    shrinkingZone: boolean;
    shrinkInterval: number;      // seconds between shrinks
    itemSpawns: boolean;
    itemSpawnInterval: number;   // seconds between spawns
    npcEnemies: 0 | 1 | 2 | 3;
}

export interface ArenaPlayer {
    id: string;
    username: string;
    character: string;
    characterLevel: number;
    isReady: boolean;
    isHost: boolean;
    isConnected: boolean;
    joinedAt: Date;
}

export interface ArenaLobby {
    id: number;
    code: string;
    hostId: number | null;
    authUserId: number | null;
    status: 'waiting' | 'starting' | 'playing' | 'ended';
    maxPlayers: number;
    settings: ArenaLobbySettings;
    players: ArenaPlayer[];
    createdAt: Date;
}

// -- Socket Events --

export interface ServerToClientEvents {
    'connected': (data: { message: string }) => void;
    'lobby-updated': (lobby: ArenaLobby) => void;
    'lobby-deleted': (data: { lobbyCode: string }) => void;
    'join-success': (data: { lobby: ArenaLobby; playerId: string }) => void;
    'join-error': (data: { message: string }) => void;
    'leave-success': () => void;
    'leave-error': (data: { message: string }) => void;
    'ready-error': (data: { message: string }) => void;
    'game-starting': (data: { countdown: number }) => void;
    'round-start': (data: { roundNumber: number; spawnPositions: Record<string, SpawnPoint> }) => void;
    'game-state': (state: SerializedGameState) => void;
    'player-hit': (data: { targetId: string; attackerId: string; damage: number; remainingHp: number; hasArmor: boolean }) => void;
    'player-killed': (data: { victimId: string; killerId: string; weapon: 'gun' | 'melee' | 'zone' | 'zombie' | 'npc'; killerName?: string; victimName?: string }) => void;
    'item-spawned': (data: { item: MapItem; announcement: string }) => void;
    'item-collected': (data: { itemId: string; playerId: string }) => void;
    'round-end': (data: { roundNumber: number; winnerId: string; scores: Record<string, number> }) => void;
    'match-end': (data: { winnerId: string; results: MatchResult[]; dbMatchId?: number }) => void;
    'zone-shrink': (data: { zone: ShrinkingZone }) => void;
    'cover-destroyed': (data: { coverId: string }) => void;
    'start-game-error': (data: { message: string }) => void;
    'spectate-start': (data: { targetPlayerId: string }) => void;
    'explosion': (data: { x: number; y: number; radius: number }) => void;
}

export interface ClientToServerEvents {
    'join-lobby': (data: { lobbyCode: string; player: Omit<ArenaPlayer, 'isHost' | 'joinedAt'> }) => void;
    'leave-lobby': (data: { lobbyCode: string; playerId: string }) => void;
    'player-ready': (data: { lobbyCode: string; playerId: string; isReady: boolean }) => void;
    'start-game': (data: { lobbyCode: string; hostId: number }) => void;
    'player-input': (data: { matchId: string; input: PlayerInput }) => void;
    'pickup-item': (data: { matchId: string; itemId: string }) => void;
    'spectate-player': (data: { matchId: string; targetPlayerId: string }) => void;
    'update-settings': (data: { lobbyCode: string; hostId: number; settings: Partial<ArenaLobbySettings> }) => void;
    'ping': () => void;
}

// -- Serialized state (for network transfer) --

export interface SerializedGameState {
    matchId: string;
    phase: MatchPhase;
    players: SerializedPlayerState[];
    projectiles: Projectile[];
    items: MapItem[];
    npcs: NPC[];
    map: GameMap;
    zone?: ShrinkingZone;
    currentRound: RoundState;
    roundScores: Record<string, number>;
    tickCount: number;
}

export interface SerializedPlayerState extends Omit<PlayerState, never> {
    // Same as PlayerState but serialized in array form for efficiency
}

// -- Match Results --

export interface MatchResult {
    playerId: string;
    username: string;
    character: string;
    kills: number;
    deaths: number;
    damageDealt: number;
    itemsCollected: number;
    roundsWon: number;
    placement: number;
    experienceGained: number;
    levelBefore?: number;
    levelAfter?: number;
}

// -- Damage Constants --

export const DAMAGE = {
    GUN: 1,
    MELEE: 99,          // instant kill regardless of armor
    ZONE: 1,
    GRENADE: 3,
} as const;

export const HP = {
    MAX: 2,
    ARMOR_BONUS: 1,
    MAX_WITH_ARMOR: 3,
} as const;

export const GAME = {
    TILE_SIZE: 32,
    MAP_WIDTH_TILES: 28,
    MAP_HEIGHT_TILES: 22,
    PLAYER_SPEED: 8,
    SPRINT_MULTIPLIER: 1.6,
    PROJECTILE_SPEED: 16,
    MELEE_RANGE: 48,       // pixels
    MELEE_COOLDOWN: 800,   // ms
    SHOOT_COOLDOWN: 300,    // ms
    ITEM_PICKUP_RANGE: 32,  // pixels
} as const;

export const NPC_CONST = {
    MAX_ALIVE: 6,
    SPAWN_INTERVAL_S: 45,
    SPEED_FACTOR: 0.4,
    AGGRO_RANGE_TILES: 5,
    DEAGGRO_RANGE_TILES: 8,
    DAMAGE: 1,
    HP: 2,
    CONTACT_RANGE: 16,
    DAMAGE_COOLDOWN_MS: 1000,
    WANDER_CHANGE_MS: 2500,
} as const;

export const ENEMY_CONST = {
    SPEED_FACTOR: 0.5,
    AGGRO_RANGE: 192,
    DEAGGRO_RANGE: 256,
    FIRE_RATE_MS: 600,
    SPREAD_RAD: 0.26,
    HP: 3,
    LOS_LOSS_MS: 2000,
} as const;
