/**
 * Campaign Mode Type Definitions
 *
 * All types for the World Campaign: maps, NPCs, dialogue, quests,
 * session state, and item effects. Campaign runs alongside deathmatch
 * as a separate game mode with persistent progression.
 */

import type { CoverObject } from './game.js';

// ============================================================================
// Tile Map
// ============================================================================

/** Tile type IDs used in campaign map JSON files */
export const CAMPAIGN_TILE = {
    GRASS: 0,
    WALL: 1,
    PATH: 2,
    ROAD: 3,
    BUILDING: 4,
    DOOR: 5,
    WATER: 6,
    COBBLESTONE: 7,
} as const;

export type CampaignTileType = (typeof CAMPAIGN_TILE)[keyof typeof CAMPAIGN_TILE];

export interface CampaignMapDoor {
    /** Tile position of this door */
    tileX: number;
    tileY: number;
    /** ID of the map this door leads to */
    targetMapId: string;
    /** Tile position where the player spawns in the target map */
    targetTileX: number;
    targetTileY: number;
    /** Direction player faces after transition */
    targetFacing?: 'N' | 'S' | 'E' | 'W';
}

export interface CampaignEnemyZone {
    /** Unique ID for this zone */
    id: string;
    /** Bounding box in tile coordinates */
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    /** Enemy type that spawns here */
    enemyType: CampaignEnemyType;
    /** Max concurrent enemies in this zone */
    maxEnemies: number;
    /** Spawn interval in seconds */
    spawnIntervalS: number;
    /** Time restriction (null = any time) */
    timeRestriction?: 'day' | 'night' | null;
}

export interface CampaignMapMeta {
    /** Unique map ID (e.g., 'vogelsen', 'patricks-house-ground') */
    id: string;
    /** Display name */
    name: string;
    /** Width in tiles */
    width: number;
    /** Height in tiles */
    height: number;
    /** Pixels per tile (always 32) */
    tileSize: number;
    /** Whether this is an interior map */
    isInterior: boolean;
    /** Parent map ID (for interiors, the outdoor map they belong to) */
    parentMapId?: string;
}

export interface CampaignMap {
    meta: CampaignMapMeta;
    /** 2D tile grid — row-major [y][x] */
    tiles: number[][];
    /** Cover objects (buildings, fences, benches, etc.) */
    coverObjects: CoverObject[];
    /** Door transitions to other maps */
    doors: CampaignMapDoor[];
    /** Player spawn point (used when entering this map) */
    spawnPoint: { x: number; y: number };
    /** NPC placements */
    npcs: CampaignNPCPlacement[];
    /** Enemy spawn zones */
    enemyZones: CampaignEnemyZone[];
    /** Item spawn points (for vocab card drops, etc.) */
    itemSpawnPoints: { x: number; y: number }[];
}

// ============================================================================
// NPCs (Non-Combat)
// ============================================================================

export interface CampaignNPCPlacement {
    /** NPC definition ID (references npcs.json) */
    npcId: string;
    /** Tile position */
    tileX: number;
    tileY: number;
    /** Direction NPC faces by default */
    facing: 'N' | 'S' | 'E' | 'W';
}

export interface CampaignNPCDef {
    /** Unique NPC ID */
    id: string;
    /** Display name */
    name: string;
    /** Character sprite to use (or placeholder ID) */
    spriteId: string;
    /** Icon color from Google Maps (for placeholder rendering) */
    iconColor: string;
    /** Interaction range in tiles */
    interactionRange: number;
    /** Dialogue tree ID to trigger on interaction */
    dialogueId: string;
    /** Quest this NPC gives (null if no quest) */
    questId?: string;
    /** English topic this NPC teaches */
    englishTopic?: string;
}

/** Runtime NPC state (per player, per NPC) */
export interface CampaignNPCState {
    npcId: string;
    /** Has the player talked to this NPC at least once? */
    talked: boolean;
    /** Current quest marker state */
    questMarker: 'available' | 'active' | 'complete' | null;
    /** Whether this NPC currently has unread dialogue */
    hasNewDialogue: boolean;
}

// ============================================================================
// Dialogue System
// ============================================================================

export type DialogueNodeType = 'text' | 'choice' | 'quiz' | 'reward' | 'condition';

export interface DialogueTextNode {
    type: 'text';
    id: string;
    speaker: string;
    text: string;
    next: string | null;  // next node ID, or null to end
}

export interface DialogueChoiceOption {
    id: string;
    text: string;
    next: string;  // node ID to jump to
}

export interface DialogueChoiceNode {
    type: 'choice';
    id: string;
    speaker: string;
    text: string;
    choices: DialogueChoiceOption[];
}

export interface DialogueQuizNode {
    type: 'quiz';
    id: string;
    speaker: string;
    text: string;  // shown before quiz starts
    /** L2P question set ID to pull questions from */
    questionSetId: string;
    /** Number of questions to ask */
    questionCount: number;
    /** Pass threshold (0-1) */
    passThreshold: number;
    /** Node to go to on pass */
    onPass: string;
    /** Node to go to on fail */
    onFail: string;
}

export interface DialogueRewardNode {
    type: 'reward';
    id: string;
    speaker: string;
    text: string;
    /** Respect to award */
    respect?: number;
    /** Vocab cards to grant */
    vocabCards?: Array<{ word_en: string; word_de: string; definition_en: string; example_en: string }>;
    /** Quest ID to complete */
    completesQuest?: string;
    /** Quest ID to start */
    startsQuest?: string;
    next: string | null;
}

export interface DialogueConditionNode {
    type: 'condition';
    id: string;
    /** Quest that must be complete */
    requiresQuestComplete?: string;
    /** Quest that must be active */
    requiresQuestActive?: string;
    /** Node to go to if condition is met */
    onTrue: string;
    /** Node to go to if condition is not met */
    onFalse: string;
}

export type DialogueNode =
    | DialogueTextNode
    | DialogueChoiceNode
    | DialogueQuizNode
    | DialogueRewardNode
    | DialogueConditionNode;

export interface DialogueTree {
    /** Unique dialogue tree ID */
    id: string;
    /** Entry node ID */
    startNode: string;
    /** All nodes keyed by ID */
    nodes: Record<string, DialogueNode>;
}

// ============================================================================
// Quest System
// ============================================================================

export type QuestStatus = 'available' | 'active' | 'complete' | 'failed' | 'hint_passed';

export interface QuestObjective {
    id: string;
    text: string;
    /** Type of objective */
    type: 'talk' | 'fetch' | 'quiz' | 'combat' | 'reach';
    /** Target NPC ID, item ID, or tile position */
    target: string;
    /** Required count (e.g., 3 items, 5 enemies) */
    requiredCount: number;
    /** Current count (tracked at runtime) */
    currentCount?: number;
}

export interface QuestDef {
    /** Unique quest ID */
    id: string;
    /** Display title */
    title: string;
    /** Description shown in quest log */
    description: string;
    /** NPC who gives this quest */
    giverNpcId: string;
    /** Prerequisites: quest IDs that must be complete */
    prerequisites: string[];
    /** Objectives to complete */
    objectives: QuestObjective[];
    /** Respect reward on completion */
    respectReward: number;
    /** Dollar reward on completion */
    dollarReward?: number;
    /** Vocab card rewards */
    vocabRewards?: Array<{ word_en: string; word_de: string; definition_en: string; example_en: string }>;
    /** Quest IDs unlocked on completion */
    unlocksQuests: string[];
    /** English topic this quest teaches */
    englishTopic: string;
}

/** Runtime quest state (persisted in DB) */
export interface QuestState {
    questId: string;
    status: QuestStatus;
    progress: Record<string, number>;  // objectiveId -> currentCount
    startedAt: number;
    completedAt?: number;
    respectEarned: number;
}

// ============================================================================
// Enemies (Campaign-Specific)
// ============================================================================

export type CampaignEnemyType = 'grammar_goblin' | 'vocab_vampire' | 'tense_troll';

export interface CampaignEnemyDef {
    type: CampaignEnemyType;
    name: string;
    hp: number;
    speed: number;
    damage: number;
    aggroRange: number;  // in tiles
    deaggroRange: number;
    /** Tier affects spawn zones */
    tier: 1 | 2 | 3;
    /** Vocab cards dropped on defeat */
    vocabDropPool: string[];  // word_en values
    /** Respect awarded on kill */
    respectReward: number;
}

export const CAMPAIGN_ENEMIES: Record<CampaignEnemyType, CampaignEnemyDef> = {
    grammar_goblin: {
        type: 'grammar_goblin',
        name: 'Grammar Goblin',
        hp: 2,
        speed: 0.3,
        damage: 1,
        aggroRange: 5,
        deaggroRange: 8,
        tier: 1,
        vocabDropPool: ['noun', 'verb', 'adjective', 'sentence', 'paragraph'],
        respectReward: 10,
    },
    vocab_vampire: {
        type: 'vocab_vampire',
        name: 'Vocab Vampire',
        hp: 3,
        speed: 0.4,
        damage: 1,
        aggroRange: 4,
        deaggroRange: 6,
        tier: 1,
        vocabDropPool: ['word', 'dictionary', 'spelling', 'meaning', 'vocabulary'],
        respectReward: 15,
    },
    tense_troll: {
        type: 'tense_troll',
        name: 'Tense Troll',
        hp: 5,
        speed: 0.2,
        damage: 2,
        aggroRange: 6,
        deaggroRange: 10,
        tier: 2,
        vocabDropPool: ['past', 'present', 'future', 'continuous', 'perfect'],
        respectReward: 25,
    },
};

// ============================================================================
// Campaign Session (Runtime State)
// ============================================================================

export interface CampaignPlayerState {
    id: string;
    authUserId: number;
    username: string;
    character: string;
    role: 'protagonist' | 'auxiliary';
    protagonistSlot: 1 | 2 | null;
    x: number;
    y: number;
    rotation: number;
    hp: number;
    hasArmor: boolean;
    isAlive: boolean;
    pose: string;
    englishLevel: string;
}

export interface CampaignEnemy {
    id: string;
    type: CampaignEnemyType;
    x: number;
    y: number;
    hp: number;
    speed: number;
    rotation: number;
    state: 'wander' | 'chase';
    targetPlayerId: string | null;
    wanderAngle: number;
    wanderChangeTime: number;
    lastDamageTime: number;
    zoneId: string;
}

export interface CampaignRuntimeNPC {
    npcId: string;
    x: number;
    y: number;
    facing: number;  // radians
    spriteId: string;
    name: string;
    iconColor: string;
    questMarker: 'available' | 'active' | 'complete' | null;
    hasNewDialogue: boolean;
}

export interface CampaignSessionState {
    sessionId: string;
    mapId: string;
    map: CampaignMap;
    player: CampaignPlayerState;
    companions: CampaignPlayerState[];
    auxiliaries: CampaignPlayerState[];
    npcs: CampaignRuntimeNPC[];
    enemies: CampaignEnemy[];
    items: Array<{ id: string; type: string; x: number; y: number; collected: boolean }>;
    tickCount: number;
}

/** Serialized state sent over Socket.io */
export interface SerializedCampaignState {
    sessionId: string;
    mapId: string;
    map: {
        meta: CampaignMapMeta;
        tiles: number[][];
        coverObjects: CoverObject[];
        doors: CampaignMapDoor[];
    };
    player: CampaignPlayerState;
    companions: CampaignPlayerState[];
    auxiliaries: CampaignPlayerState[];
    npcs: CampaignRuntimeNPC[];
    enemies: CampaignEnemy[];
    items: Array<{ id: string; type: string; x: number; y: number; collected: boolean }>;
    tickCount: number;
    dayNight: DayNightState;
    activeEvents: ActiveSeasonalEvent[];
}

// ============================================================================
// Campaign Socket Events
// ============================================================================

export interface CampaignServerToClientEvents {
    'campaign-state': (state: SerializedCampaignState) => void;
    'campaign-npc-dialogue': (data: { npcId: string; lines: DialogueClientLine[] }) => void;
    'campaign-quest-update': (data: { quest: QuestClientState }) => void;
    'campaign-quest-complete': (data: { questId: string; respectGained: number; vocabCards: any[] }) => void;
    'campaign-map-change': (data: { targetMapId: string; spawnX: number; spawnY: number }) => void;
    'campaign-checkpoint-saved': () => void;
    'campaign-vocab-collected': (data: { card: VocabCardData }) => void;
    'campaign-quiz-start': (data: { questionSetId: string; questions: QuizQuestion[]; rewardQuestId: string | null }) => void;
    'campaign-quiz-result': (data: { correct: boolean; score: number; completed: boolean }) => void;
    'campaign-enemy-killed': (data: { enemyId: string; respectGained: number; vocabDrop?: VocabCardData }) => void;
    'campaign-session-started': (data: { sessionId: string; state: SerializedCampaignState }) => void;
    'campaign-error': (data: { message: string }) => void;
}

export interface CampaignClientToServerEvents {
    'campaign-start': (data: { characterId: string }) => void;
    'campaign-continue': () => void;
    'campaign-input': (data: { sessionId: string; input: CampaignInput }) => void;
    'campaign-interact': (data: { sessionId: string; npcId: string }) => void;
    'campaign-dialogue-choice': (data: { sessionId: string; npcId: string; choiceId: string }) => void;
    'campaign-quiz-answer': (data: { sessionId: string; questionId: string; answer: string; timeMs: number }) => void;
    'campaign-map-loaded': (data: { sessionId: string; mapId: string }) => void;
    'campaign-use-item': (data: { sessionId: string; itemId: CampaignItemId }) => void;
}

export interface CampaignInput {
    movement: { x: number; y: number };
    aimAngle: number;
    shooting: boolean;
    melee: boolean;
    sprint: boolean;
    interact: boolean;
    timestamp: number;
}

// ============================================================================
// Client-Facing Types (stripped of server internals)
// ============================================================================

export interface DialogueClientLine {
    speaker: string;
    text: string;
    choices?: Array<{ id: string; text: string }>;
    triggersQuiz?: boolean;
}

export interface QuestClientState {
    questId: string;
    title: string;
    description: string;
    status: QuestStatus;
    objectives: Array<{
        id: string;
        text: string;
        requiredCount: number;
        currentCount: number;
        completed: boolean;
    }>;
}

export interface QuizQuestion {
    id: string;
    text: string;
    answers: Array<{ id: string; text: string }>;
    difficulty: number;
    hint?: string;
    answerType: string;
}

export interface VocabCardData {
    wordEn: string;
    wordDe: string;
    definitionEn: string;
    exampleEn: string;
    foundInCountry: string;
    foundAtNpc?: string;
}

// ============================================================================
// Campaign Items (Consumables)
// ============================================================================

export type CampaignItemId = 'hint_token' | 'xp_potion' | 'map_reveal';

export interface CampaignItemDef {
    id: CampaignItemId;
    name: string;
    description: string;
    respectCost: number;
}

export const CAMPAIGN_ITEMS: Record<CampaignItemId, CampaignItemDef> = {
    hint_token: {
        id: 'hint_token',
        name: 'Hint Token',
        description: 'Skip 1 L2P question without XP penalty',
        respectCost: 100,
    },
    xp_potion: {
        id: 'xp_potion',
        name: 'XP Potion',
        description: '+50% XP on next completed quest',
        respectCost: 75,
    },
    map_reveal: {
        id: 'map_reveal',
        name: 'Map Reveal',
        description: 'Reveal all waypoints on current continent',
        respectCost: 300,
    },
};

// ============================================================================
// Currency System
// ============================================================================

export interface DollarTransaction {
    id: number;
    playerId: number;
    amount: number;
    source: 'quest_reward' | 'boss_defeat' | 'rent_paid' | 'rent_received' | 'job' | 'item_sale' | 'housing';
    metadata?: Record<string, any>;
    createdAt: string;
}

export interface RentPayment {
    payerId: number;
    receiverId: number;
    amount: number;
    paidAt: string;
}

export interface HousingProperty {
    id: string;
    name: string;
    country: string;
    stage: 'rented' | 'owned' | 'upgraded';
    purchasedAt: string;
}

export interface HousingStage {
    stage: string;
    condition: string;
    description: string;
    cost: number;
}

export const HOUSING_PROGRESSION: HousingStage[] = [
    { stage: 'start', condition: 'Default', description: 'Mama owns house, Patrick rents top floor', cost: 0 },
    { stage: 'buy_flat', condition: 'Both players have $2,000+', description: 'Patrick buys the flat (co-ownership)', cost: 2000 },
    { stage: 'country_flat', condition: '$5,000 combined after first country boss', description: 'Buy a small flat in that country', cost: 5000 },
    { stage: 'holiday_home', condition: '$15,000 combined after continent complete', description: 'Buy a holiday home abroad', cost: 15000 },
    { stage: 'grand_estate', condition: '$100,000 combined after full world', description: 'The Grand Estate', cost: 100000 },
];

export const RENT_AMOUNT = 50;
export const RENT_INTERVAL_PLAY_HOURS = 2;  // 2 real hours = 1 in-game month

export interface PartTimeJob {
    id: string;
    title: string;
    description: string;
    country: string;
    giverNpcId: string;
    dollarReward: number;
    respectReward: number;
    englishTopic: string;
    repeatable: boolean;
    cooldownMinutes: number;
}

// ============================================================================
// Phrase Collectibles
// ============================================================================

export interface CountryPhrase {
    phrase: string;
    syllables: string[];
}

export interface CollectedSyllable {
    countryId: string;
    syllable: string;
    syllableIndex: number;
    collectedAt: string;
}

// ============================================================================
// Player Starting Config
// ============================================================================

export interface ProtagonistConfig {
    slot: 1 | 2;
    playerName: string;
    startingDollars: number;
    isHomeowner: boolean;
}

export const PROTAGONIST_DEFAULTS: Record<1 | 2, ProtagonistConfig> = {
    1: { slot: 1, playerName: 'Mama', startingDollars: 500, isHomeowner: true },
    2: { slot: 2, playerName: 'Patrick', startingDollars: 200, isHomeowner: false },
};

// ============================================================================
// Day/Night Cycle
// ============================================================================

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

export interface DayNightState {
    timeOfDay: TimeOfDay;
    sunAngle: number;       // 0-360, 0=midnight, 180=noon
    lightLevel: number;     // 0.0 (pitch black) to 1.0 (full daylight)
    tintColor: string;      // hex color for atmosphere overlay
    hour: number;           // 0-23
    minute: number;         // 0-59
}

// ============================================================================
// Seasonal Events
// ============================================================================

export interface SeasonalEventDef {
    id: string;
    name: string;
    startMonth: number;
    startDay: number;
    endMonth: number;
    endDay: number;
    countries: Record<string, 'full' | 'partial'>;
    effects: {
        tileSkinOverride?: string;
        specialQuests?: string[];
        vocabTopic?: string;
        enemySkinOverride?: string;
        specialNPCs?: string[];
        ambientMusic?: string;
    };
}

export interface ActiveSeasonalEvent {
    event: SeasonalEventDef;
    scale: 'full' | 'partial';
}

// ============================================================================
// Idiom Crafting
// ============================================================================

export interface IdiomRecipeDef {
    id: string;
    idiom: string;
    meaning: string;
    fragments: string[];
    result: {
        name: string;
        description: string;
        type: 'consumable' | 'persistent';
        effect: string;
        effectValue: number;
        durationMinutes: number | null;
    };
}

export interface IdiomFragmentDrop {
    fragment: string;
    source: 'enemy_kill' | 'library_search' | 'boss_drop';
}

// ============================================================================
// English Learning Systems
// ============================================================================

export interface VoiceRecognitionResult {
    transcription: string;
    expected: string;
    score: number;
    feedback: string;
    matchType: 'exact' | 'close' | 'wrong';
}

export type DictationDifficulty = 'slow' | 'normal' | 'fast';

export interface DictationChallengeDef {
    id: string;
    text: string;
    difficulty: DictationDifficulty;
    npcId: string;
    country: string;
}

export interface DictationResultData {
    challengeId: string;
    playerText: string;
    correctText: string;
    score: number;
    feedback: string;
}

export type WritingQuestType = 'postcard' | 'job_application' | 'complaint_letter' | 'social_media';

export interface WritingQuestDef {
    id: string;
    type: WritingQuestType;
    title: string;
    prompt: string;
    country: string;
    minWords: number;
    maxWords: number;
    cefrLevel: string;
    respectReward: number;
    dollarReward: number;
}

export interface WritingGradeData {
    vocabulary: number;
    grammar: number;
    coherence: number;
    effort: number;
    total: number;
    feedback: string;
}

// ============================================================================
// Leaderboards
// ============================================================================

export type LeaderboardType = 'vocab_king' | 'scholar' | 'explorer' | 'richest' | 'fighter' | 'penpal_pro' | 'emote_lord';
export type LeaderboardScope = 'global' | 'class' | 'friends';
export type LeaderboardPeriod = 'weekly' | 'alltime';

export interface LeaderboardEntry {
    rank: number;
    authUserId: number;
    username: string;
    characterId: string;
    score: number;
    isCurrentPlayer: boolean;
}

// ============================================================================
// Penpal System
// ============================================================================

export interface PenpalDef {
    npcId: string;
    name: string;
    personality: string;
    greeting: string;
    signoff: string;
}

export interface PenpalLetter {
    id?: number;
    countryId: string;
    penpalNpcId: string;
    direction: 'incoming' | 'reply';
    subject?: string;
    body: string;
    vocabHighlighted?: string[];
    grade?: PenpalGrade;
    respectEarned?: number;
    readAt?: string;
    createdAt: string;
}

export interface PenpalGrade {
    vocabulary: number;     // 0-25
    grammar: number;        // 0-25
    coherence: number;      // 0-25
    effort: number;         // 0-25
    total: number;          // 0-100
    feedback: string;
    corrections: Array<{ original: string; corrected: string; explanation: string }>;
}

// ============================================================================
// Teacher Layer
// ============================================================================

export interface ClassInfo {
    id: number;
    name: string;
    studentCount: number;
    createdAt: string;
}

export interface StudentDetail {
    authUserId: number;
    username: string;
    cefrLevel: string;
    questsCompleted: number;
    vocabCollected: number;
    quizAccuracy: number;
    lastActive: string;
    weakestTopic: string;
}

export interface TeacherAlert {
    type: 'stuck_on_quiz' | 'no_progress' | 'accuracy_drop';
    studentAuthUserId: number;
    studentUsername: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    createdAt: string;
}

export interface SessionReport {
    classId: number;
    generatedAt: string;
    studentHighlights: Array<{
        username: string;
        questsDone: number;
        vocabEarned: number;
        accuracy: number;
        highlight: string;
    }>;
}

// ============================================================================
// Campaign Editor
// ============================================================================

export interface CreateCustomQuestData {
    title: string;
    description: string;
    questType: string;
    targetNpcId?: string;
    l2pQuizSetId?: number;
    objectives: Array<{ id: string; text: string; type: string; target: string; requiredCount: number }>;
    rewards: { respect?: number; dollars?: number; vocabCards?: any[] };
    prerequisites: string[];
    audience: 'public' | 'class' | 'private';
    classId?: number;
    createdByAuthUserId: number;
}

export interface CustomQuest extends CreateCustomQuestData {
    questId: string;
    isActive: boolean;
    createdAt: string;
}

// ============================================================================
// Campaign Constants
// ============================================================================

// ============================================================================
// Google Docs Integration
// ============================================================================

export interface GoogleDocExport {
    docId: string;
    docUrl: string;
    title: string;
    folder: string;
    exportedAt: string;
}

// ============================================================================
// Jitsi Recording
// ============================================================================

export interface RecordingSession {
    id?: number;
    sessionId: string;
    jitsiRoom: string;
    recordingStartedAt: string;
    recordingEndedAt?: string;
    durationSeconds?: number;
    videovaultClipId?: string;
    participants: string[];
    countryId: string;
    status: 'recording' | 'processing' | 'complete' | 'failed';
}

// ============================================================================
// Campaign Constants
// ============================================================================

export const CAMPAIGN = {
    TILE_SIZE: 32,
    TICK_RATE: 20,
    PLAYER_SPEED: 6,         // slightly slower than deathmatch for exploration feel
    SPRINT_MULTIPLIER: 1.4,
    NPC_INTERACTION_RANGE: 2.5,  // tiles
    DOOR_INTERACTION_RANGE: 1.5, // tiles
    ENEMY_SPAWN_INTERVAL_S: 30,
    CHECKPOINT_COOLDOWN_S: 10,
    QUIZ_PASS_THRESHOLD: 0.8,   // 80% correct to pass
    QUIZ_MAX_RETRIES: 2,
    HINT_MODE_XP_PENALTY: 0.5,  // 50% XP in hint mode
    AUXILIARY_RESPECT_MULTIPLIER: 0.3,  // 30% Respect for auxiliaries
} as const;
