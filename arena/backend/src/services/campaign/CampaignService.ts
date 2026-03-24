import { v4 as uuidv4 } from 'uuid';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DatabaseService } from '../DatabaseService.js';
import { CampaignMapService } from './CampaignMapService.js';
import { CampaignNPCService } from './CampaignNPCService.js';
import { CampaignQuizService } from './CampaignQuizService.js';
import { CampaignGameLoop } from './CampaignGameLoop.js';
import { DayNightService } from './DayNightService.js';
import { SeasonalEventService } from './SeasonalEventService.js';
import { authFetchInternal } from '../../config/authClient.js';
import type {
    CampaignPlayerState,
    CampaignMap,
    QuestState,
    QuestDef,
    SerializedCampaignState,
    VocabCardData,
    CampaignRuntimeNPC,
    DialogueClientLine,
    QuizQuestion,
    CampaignEnemyType,
    DialogueRewardNode,
} from '../../types/campaign.js';
import { CAMPAIGN, CAMPAIGN_ENEMIES, RENT_AMOUNT, PROTAGONIST_DEFAULTS } from '../../types/campaign.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ActiveQuizState {
    answerKey: Map<string, string>;
    questId: string | null;
    dialogueId: string;
    quizNodeId: string;
    correct: number;
    total: number;
    required: number;
    questionCount: number;
}

export class CampaignService {
    private db: DatabaseService;
    private mapService: CampaignMapService;
    private npcService: CampaignNPCService;
    private quizService: CampaignQuizService;
    private gameLoop: CampaignGameLoop;
    private seasonalEventService: SeasonalEventService;
    private questDefs: Map<string, QuestDef> = new Map();

    // Active quiz states per session
    private activeQuizzes: Map<string, ActiveQuizState> = new Map();

    // Session-to-user mapping
    private sessionUserMap: Map<string, number> = new Map();

    // Callbacks for emitting events to clients (wired by SocketService)
    private onDialogue?: (sessionId: string, data: { npcId: string; lines: DialogueClientLine[] }) => void;
    private onQuestUpdate?: (sessionId: string, data: { quest: any }) => void;
    private onQuestComplete?: (sessionId: string, data: { questId: string; respectGained: number; vocabCards: VocabCardData[] }) => void;
    private onMapChange?: (sessionId: string, data: { targetMapId: string; spawnX: number; spawnY: number }) => void;
    private onCheckpointSaved?: (sessionId: string) => void;
    private onVocabCollected?: (sessionId: string, data: { card: VocabCardData }) => void;
    private onQuizStart?: (sessionId: string, data: { questionSetId: string; questions: QuizQuestion[]; rewardQuestId: string | null }) => void;
    private onQuizResult?: (sessionId: string, data: { correct: boolean; score: number; completed: boolean }) => void;
    private onEnemyKilled?: (sessionId: string, data: { enemyId: string; respectGained: number; vocabDrop?: VocabCardData }) => void;
    private onSessionStarted?: (sessionId: string, data: { sessionId: string; state: SerializedCampaignState }) => void;
    private onError?: (sessionId: string, data: { message: string }) => void;

    constructor() {
        this.db = DatabaseService.getInstance();
        this.mapService = new CampaignMapService();
        this.npcService = new CampaignNPCService();
        this.quizService = new CampaignQuizService();
        this.seasonalEventService = new SeasonalEventService();
        this.gameLoop = new CampaignGameLoop(this.mapService);
        this.loadQuests();
        this.wireGameLoopCallbacks();
    }

    private loadQuests(): void {
        try {
            const questPath = join(__dirname, '../../data/campaign/quests.json');
            const raw = readFileSync(questPath, 'utf-8');
            const data = JSON.parse(raw);

            if (data.quests) {
                for (const [id, quest] of Object.entries(data.quests)) {
                    this.questDefs.set(id, quest as QuestDef);
                }
            }

            console.log(`[CampaignService] Loaded ${this.questDefs.size} quest definitions`);
        } catch (error) {
            console.error('[CampaignService] Failed to load quest data:', error);
        }
    }

    /**
     * Wire internal game loop callbacks to orchestrator logic.
     */
    private wireGameLoopCallbacks(): void {
        this.gameLoop.setCallbacks({
            onStateUpdate: (_sessionId, _state) => {
                // Forward state updates to socket
                // (handled by SocketService through the game loop directly)
            },
            onEnemyKilled: async (sessionId, data) => {
                await this.handleEnemyKilled(sessionId, data);
            },
            onPlayerHit: (_sessionId, _data) => {
                // Forward to client via socket
            },
            onPlayerDied: (sessionId) => {
                // Handle player death — respawn at last checkpoint
                this.handlePlayerDeath(sessionId);
            },
        });
    }

    /**
     * Set callbacks (forwarded from SocketService).
     */
    setCallbacks(callbacks: {
        onDialogue?: (sessionId: string, data: { npcId: string; lines: DialogueClientLine[] }) => void;
        onQuestUpdate?: (sessionId: string, data: { quest: any }) => void;
        onQuestComplete?: (sessionId: string, data: { questId: string; respectGained: number; vocabCards: VocabCardData[] }) => void;
        onMapChange?: (sessionId: string, data: { targetMapId: string; spawnX: number; spawnY: number }) => void;
        onCheckpointSaved?: (sessionId: string) => void;
        onVocabCollected?: (sessionId: string, data: { card: VocabCardData }) => void;
        onQuizStart?: (sessionId: string, data: { questionSetId: string; questions: QuizQuestion[]; rewardQuestId: string | null }) => void;
        onQuizResult?: (sessionId: string, data: { correct: boolean; score: number; completed: boolean }) => void;
        onEnemyKilled?: (sessionId: string, data: { enemyId: string; respectGained: number; vocabDrop?: VocabCardData }) => void;
        onSessionStarted?: (sessionId: string, data: { sessionId: string; state: SerializedCampaignState }) => void;
        onError?: (sessionId: string, data: { message: string }) => void;
    }): void {
        this.onDialogue = callbacks.onDialogue;
        this.onQuestUpdate = callbacks.onQuestUpdate;
        this.onQuestComplete = callbacks.onQuestComplete;
        this.onMapChange = callbacks.onMapChange;
        this.onCheckpointSaved = callbacks.onCheckpointSaved;
        this.onVocabCollected = callbacks.onVocabCollected;
        this.onQuizStart = callbacks.onQuizStart;
        this.onQuizResult = callbacks.onQuizResult;
        this.onEnemyKilled = callbacks.onEnemyKilled;
        this.onSessionStarted = callbacks.onSessionStarted;
        this.onError = callbacks.onError;
    }

    // ============================================================================
    // SESSION LIFECYCLE
    // ============================================================================

    /**
     * Start or continue a campaign session.
     */
    async startSession(
        authUserId: number,
        username: string,
        characterId?: string
    ): Promise<SerializedCampaignState> {
        try {
            // Check for existing campaign_players row
            const existingPlayer = await this.db.query(
                'SELECT * FROM campaign_players WHERE auth_user_id = $1',
                [authUserId]
            );

            let playerData: any;
            let mapId: string;
            let spawnX: number;
            let spawnY: number;

            if (existingPlayer.rows.length > 0) {
                // Load saved state
                playerData = existingPlayer.rows[0];
                mapId = playerData.current_map_id || 'vogelsen';
                spawnX = playerData.position_x || 0;
                spawnY = playerData.position_y || 0;
            } else {
                // Create new campaign_players row
                const map = this.mapService.getDefaultMap();
                mapId = map.meta.id;
                spawnX = map.spawnPoint.x * map.meta.tileSize + map.meta.tileSize / 2;
                spawnY = map.spawnPoint.y * map.meta.tileSize + map.meta.tileSize / 2;

                // Determine protagonist slot and starting dollars
                const protagonistSlot = await this.getNextProtagonistSlot();
                const defaults = (protagonistSlot === 1 || protagonistSlot === 2) ? PROTAGONIST_DEFAULTS[protagonistSlot] : null;
                const startingDollars = defaults?.startingDollars ?? 200;
                const playerName = defaults?.playerName ?? username;

                await this.db.query(
                    `INSERT INTO campaign_players (auth_user_id, username, character_id, current_map_id, position_x, position_y, english_level, protagonist_slot, dollar_balance, player_name)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [authUserId, username, characterId || 'warrior', mapId, spawnX, spawnY, 'A1', protagonistSlot, startingDollars, playerName]
                );

                playerData = {
                    auth_user_id: authUserId,
                    username,
                    character_id: characterId || 'warrior',
                    current_map_id: mapId,
                    position_x: spawnX,
                    position_y: spawnY,
                    english_level: 'A1',
                    hp: 2,
                    has_armor: false,
                    protagonist_slot: protagonistSlot,
                    dollar_balance: startingDollars,
                    player_name: playerName,
                };
            }

            // Load the map
            const map = this.mapService.getMap(mapId);
            if (!map) {
                throw new Error(`Map not found: ${mapId}`);
            }

            // Create session
            const sessionId = uuidv4();

            // Create session DB row
            await this.db.query(
                `INSERT INTO campaign_sessions (id, auth_user_id, map_id, started_at)
                 VALUES ($1, $2, $3, NOW())`,
                [sessionId, authUserId, mapId]
            );

            // Build player state
            const playerState: CampaignPlayerState = {
                id: sessionId,
                authUserId,
                username: playerData.username || username,
                character: playerData.character_id || characterId || 'warrior',
                role: 'protagonist',
                protagonistSlot: 1,
                x: playerData.position_x ?? spawnX,
                y: playerData.position_y ?? spawnY,
                rotation: 0,
                hp: playerData.hp ?? 2,
                hasArmor: playerData.has_armor ?? false,
                isAlive: true,
                pose: 'stand',
                englishLevel: playerData.english_level || 'A1',
            };

            // Load quest states
            const questStates = await this.loadQuestStates(authUserId);

            // Build NPC runtime states
            const npcStates = this.buildNPCStates(map, questStates);

            // Create session in game loop
            const session = this.gameLoop.createSession(sessionId, playerState, map);
            session.npcs = npcStates;

            // Track session-user mapping
            this.sessionUserMap.set(sessionId, authUserId);

            // Start game loop
            this.gameLoop.startSession(sessionId);

            // Get serialized state
            const state = this.getSerializedState(sessionId);
            if (!state) throw new Error('Failed to create session state');

            return state;
        } catch (error) {
            console.error('[CampaignService] Failed to start session:', error);
            throw error;
        }
    }

    // ============================================================================
    // NPC INTERACTION
    // ============================================================================

    /**
     * Handle NPC interaction.
     */
    async handleInteraction(sessionId: string, npcId: string, authUserId: number): Promise<void> {
        try {
            const session = this.gameLoop.getSession(sessionId);
            if (!session) {
                this.onError?.(sessionId, { message: 'Session not found' });
                return;
            }

            const npc = this.npcService.getNPC(npcId);
            if (!npc) {
                this.onError?.(sessionId, { message: 'NPC not found' });
                return;
            }

            // Check interaction range
            const npcPlacement = session.map.npcs.find((p) => p.npcId === npcId);
            if (npcPlacement) {
                const npcPx = npcPlacement.tileX * session.map.meta.tileSize + session.map.meta.tileSize / 2;
                const npcPy = npcPlacement.tileY * session.map.meta.tileSize + session.map.meta.tileSize / 2;
                const dist = Math.hypot(session.player.x - npcPx, session.player.y - npcPy);
                const rangePx = CAMPAIGN.NPC_INTERACTION_RANGE * session.map.meta.tileSize;
                if (dist > rangePx) {
                    this.onError?.(sessionId, { message: 'Too far from NPC' });
                    return;
                }
            }

            // Load player's quest states from DB
            const questStates = await this.loadQuestStates(authUserId);

            // Get dialogue lines from NPC service
            const lines = this.npcService.getDialogueLines(npcId, questStates);

            // Check for reward nodes in the dialogue path and process them
            await this.processDialogueRewards(sessionId, npc.dialogueId, questStates, authUserId);

            // Emit dialogue to client
            this.onDialogue?.(sessionId, { npcId, lines });
        } catch (error) {
            console.error(`[CampaignService] Interaction error for NPC ${npcId}:`, error);
            this.onError?.(sessionId, { message: 'Failed to interact with NPC' });
        }
    }

    /**
     * Handle dialogue choice.
     */
    async handleDialogueChoice(
        sessionId: string,
        npcId: string,
        choiceId: string,
        authUserId: number
    ): Promise<void> {
        try {
            const npc = this.npcService.getNPC(npcId);
            if (!npc) {
                this.onError?.(sessionId, { message: 'NPC not found' });
                return;
            }

            const questStates = await this.loadQuestStates(authUserId);
            const lines = this.npcService.continueDialogue(npc.dialogueId, choiceId, questStates);

            // Process any reward nodes in this dialogue branch
            await this.processDialogueRewards(sessionId, npc.dialogueId, questStates, authUserId);

            this.onDialogue?.(sessionId, { npcId, lines });
        } catch (error) {
            console.error(`[CampaignService] Dialogue choice error:`, error);
            this.onError?.(sessionId, { message: 'Failed to process dialogue choice' });
        }
    }

    // ============================================================================
    // QUIZ SYSTEM
    // ============================================================================

    /**
     * Handle quiz start (triggered by dialogue quiz node).
     */
    async startQuiz(
        sessionId: string,
        dialogueId: string,
        quizNodeId: string,
        questId: string | null
    ): Promise<void> {
        try {
            const node = this.npcService.getNode(dialogueId, quizNodeId);
            if (!node || node.type !== 'quiz') {
                this.onError?.(sessionId, { message: 'Quiz node not found' });
                return;
            }

            const { clientQuestions, answerKey } = await this.quizService.getQuestions(
                node.questionSetId,
                node.questionCount
            );

            if (clientQuestions.length === 0) {
                this.onError?.(sessionId, { message: 'No questions available' });
                return;
            }

            // Store active quiz state
            this.activeQuizzes.set(sessionId, {
                answerKey,
                questId,
                dialogueId,
                quizNodeId,
                correct: 0,
                total: 0,
                required: Math.ceil(node.questionCount * node.passThreshold),
                questionCount: node.questionCount,
            });

            this.onQuizStart?.(sessionId, {
                questionSetId: node.questionSetId,
                questions: clientQuestions,
                rewardQuestId: questId,
            });
        } catch (error) {
            console.error('[CampaignService] Failed to start quiz:', error);
            this.onError?.(sessionId, { message: 'Failed to start quiz' });
        }
    }

    /**
     * Handle quiz answer.
     */
    async handleQuizAnswer(
        sessionId: string,
        authUserId: number,
        questionId: string,
        answer: string,
        _timeMs: number
    ): Promise<void> {
        try {
            const quiz = this.activeQuizzes.get(sessionId);
            if (!quiz) {
                this.onError?.(sessionId, { message: 'No active quiz' });
                return;
            }

            const result = this.quizService.scoreAnswer(quiz.answerKey, questionId, answer);
            quiz.total++;
            if (result.correct) {
                quiz.correct++;
            }

            const completed = quiz.total >= quiz.questionCount;

            this.onQuizResult?.(sessionId, {
                correct: result.correct,
                score: quiz.correct,
                completed,
            });

            if (completed) {
                const passed = quiz.correct >= quiz.required;

                // Get post-quiz dialogue lines
                const questStates = await this.loadQuestStates(authUserId);
                const postLines = this.npcService.getPostQuizLines(
                    quiz.dialogueId,
                    quiz.quizNodeId,
                    passed,
                    questStates
                );

                // Find the NPC who owns this dialogue to send dialogue event
                const allNPCs = this.npcService.getAllNPCs();
                const npc = allNPCs.find((n) => n.dialogueId === quiz.dialogueId);
                if (npc && postLines.length > 0) {
                    this.onDialogue?.(sessionId, { npcId: npc.id, lines: postLines });
                }

                // Process rewards from post-quiz dialogue
                await this.processDialogueRewards(sessionId, quiz.dialogueId, questStates, authUserId);

                // Clean up quiz state
                this.activeQuizzes.delete(sessionId);
            }
        } catch (error) {
            console.error('[CampaignService] Quiz answer error:', error);
            this.onError?.(sessionId, { message: 'Failed to process quiz answer' });
        }
    }

    // ============================================================================
    // QUEST SYSTEM
    // ============================================================================

    /**
     * Complete a quest.
     */
    async completeQuest(
        authUserId: number,
        questId: string,
        sessionId: string
    ): Promise<void> {
        try {
            const questDef = this.questDefs.get(questId);
            if (!questDef) {
                console.error(`[CampaignService] Quest definition not found: ${questId}`);
                return;
            }

            // Update campaign_quests row
            await this.db.query(
                `UPDATE campaign_quests
                 SET status = 'complete', completed_at = NOW(), respect_earned = $3
                 WHERE auth_user_id = $1 AND quest_id = $2`,
                [authUserId, questId, questDef.respectReward]
            );

            // Award Respect via auth service
            await this.awardRespect(authUserId, questDef.respectReward, questId);

            // Award Dollars if quest has dollar reward
            if (questDef.dollarReward && questDef.dollarReward > 0) {
                await this.awardDollars(authUserId, questDef.dollarReward, 'quest_reward', { questId });
            }

            // Grant vocab cards
            const vocabCards: VocabCardData[] = [];
            if (questDef.vocabRewards) {
                for (const vocab of questDef.vocabRewards) {
                    const card: VocabCardData = {
                        wordEn: vocab.word_en,
                        wordDe: vocab.word_de,
                        definitionEn: vocab.definition_en,
                        exampleEn: vocab.example_en,
                        foundInCountry: 'Vogelsen',
                        foundAtNpc: questDef.giverNpcId,
                    };
                    vocabCards.push(card);

                    // Store in DB
                    await this.db.query(
                        `INSERT INTO campaign_vocab_cards (auth_user_id, word_en, word_de, definition_en, example_en, found_in_country, found_at_npc)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)
                         ON CONFLICT (auth_user_id, word_en) DO NOTHING`,
                        [authUserId, card.wordEn, card.wordDe, card.definitionEn, card.exampleEn, card.foundInCountry, card.foundAtNpc]
                    );
                }
            }

            // Check if this unlocks new quests
            for (const unlockId of questDef.unlocksQuests) {
                const unlockDef = this.questDefs.get(unlockId);
                if (unlockDef) {
                    // Check all prerequisites
                    const questStates = await this.loadQuestStates(authUserId);
                    const allPrereqsMet = unlockDef.prerequisites.every((prereq) => {
                        if (prereq === '_any_2_quests') {
                            const completedCount = Object.values(questStates).filter(
                                (s) => s.status === 'complete'
                            ).length;
                            return completedCount >= 2;
                        }
                        return questStates[prereq]?.status === 'complete';
                    });

                    if (allPrereqsMet) {
                        // Make quest available
                        await this.db.query(
                            `INSERT INTO campaign_quests (auth_user_id, quest_id, status, started_at)
                             VALUES ($1, $2, 'available', NOW())
                             ON CONFLICT (auth_user_id, quest_id) DO NOTHING`,
                            [authUserId, unlockId]
                        );
                    }
                }
            }

            // Emit quest-complete to client
            this.onQuestComplete?.(sessionId, {
                questId,
                respectGained: questDef.respectReward,
                vocabCards,
            });

            // Refresh NPC states after quest completion
            await this.refreshNPCStates(sessionId, authUserId);
        } catch (error) {
            console.error(`[CampaignService] Failed to complete quest ${questId}:`, error);
        }
    }

    /**
     * Start a quest (set status to active).
     */
    async startQuest(authUserId: number, questId: string, sessionId: string): Promise<void> {
        try {
            await this.db.query(
                `INSERT INTO campaign_quests (auth_user_id, quest_id, status, started_at)
                 VALUES ($1, $2, 'active', NOW())
                 ON CONFLICT (auth_user_id, quest_id)
                 DO UPDATE SET status = 'active'`,
                [authUserId, questId]
            );

            const questDef = this.questDefs.get(questId);
            if (questDef) {
                this.onQuestUpdate?.(sessionId, {
                    quest: {
                        questId,
                        title: questDef.title,
                        description: questDef.description,
                        status: 'active',
                        objectives: questDef.objectives.map((obj) => ({
                            id: obj.id,
                            text: obj.text,
                            requiredCount: obj.requiredCount,
                            currentCount: 0,
                            completed: false,
                        })),
                    },
                });
            }

            await this.refreshNPCStates(sessionId, authUserId);
        } catch (error) {
            console.error(`[CampaignService] Failed to start quest ${questId}:`, error);
        }
    }

    // ============================================================================
    // REWARDS
    // ============================================================================

    /**
     * Award Respect via auth service (with retry on failure).
     */
    private async awardRespect(authUserId: number, amount: number, questId: string): Promise<void> {
        try {
            await authFetchInternal('/api/internal/respect/credit', {
                method: 'POST',
                body: JSON.stringify({
                    userId: authUserId,
                    amount,
                    metadata: { source: 'campaign_quest', questId },
                }),
            });
        } catch (error) {
            console.error(`[CampaignService] Failed to award Respect, queuing for retry:`, error);
            // Queue to campaign_pending_rewards
            await this.db.query(
                `INSERT INTO campaign_pending_rewards (auth_user_id, reward_type, amount, metadata)
                 VALUES ($1, $2, $3, $4)`,
                [authUserId, 'respect', amount, JSON.stringify({ questId })]
            );
        }
    }

    /**
     * Process dialogue reward nodes — starts/completes quests, awards respect.
     */
    private async processDialogueRewards(
        sessionId: string,
        dialogueId: string,
        questStates: Record<string, QuestState>,
        authUserId: number
    ): Promise<void> {
        const tree = this.npcService.getDialogueTree(dialogueId);
        if (!tree) return;

        // Walk the dialogue to find reward nodes that were reached
        const rewardNodes = this.npcService.findRewardNodes(dialogueId, tree.startNode, questStates);

        for (const node of rewardNodes) {
            if (node.type !== 'reward') continue;
            const rewardNode = node as DialogueRewardNode;

            if (rewardNode.startsQuest) {
                await this.startQuest(authUserId, rewardNode.startsQuest, sessionId);
            }

            if (rewardNode.completesQuest) {
                await this.completeQuest(authUserId, rewardNode.completesQuest, sessionId);
            }

            if (rewardNode.respect) {
                await this.awardRespect(authUserId, rewardNode.respect, `dialogue_${dialogueId}`);
            }

            if (rewardNode.vocabCards) {
                for (const vocab of rewardNode.vocabCards) {
                    const card: VocabCardData = {
                        wordEn: vocab.word_en,
                        wordDe: vocab.word_de,
                        definitionEn: vocab.definition_en,
                        exampleEn: vocab.example_en,
                        foundInCountry: 'Vogelsen',
                    };
                    this.onVocabCollected?.(sessionId, { card });
                }
            }
        }
    }

    // ============================================================================
    // MAP TRANSITIONS
    // ============================================================================

    /**
     * Handle map transition (player walks into a door).
     */
    async handleMapTransition(sessionId: string, targetMapId: string): Promise<void> {
        try {
            const session = this.gameLoop.getSession(sessionId);
            if (!session) return;

            const targetMap = this.mapService.getMap(targetMapId);
            if (!targetMap) {
                this.onError?.(sessionId, { message: `Map not found: ${targetMapId}` });
                return;
            }

            // Find the door that leads to this map for spawn position
            const door = session.map.doors.find((d) => d.targetMapId === targetMapId);
            const spawnX = door
                ? door.targetTileX * targetMap.meta.tileSize + targetMap.meta.tileSize / 2
                : targetMap.spawnPoint.x * targetMap.meta.tileSize + targetMap.meta.tileSize / 2;
            const spawnY = door
                ? door.targetTileY * targetMap.meta.tileSize + targetMap.meta.tileSize / 2
                : targetMap.spawnPoint.y * targetMap.meta.tileSize + targetMap.meta.tileSize / 2;

            // Update game loop
            this.gameLoop.changeMap(sessionId, targetMap, spawnX, spawnY);

            // Refresh NPC states for new map
            const authUserId = this.sessionUserMap.get(sessionId);
            if (authUserId) {
                const questStates = await this.loadQuestStates(authUserId);
                const npcStates = this.buildNPCStates(targetMap, questStates);
                this.gameLoop.updateNPCStates(sessionId, npcStates);

                // Update DB
                await this.db.query(
                    `UPDATE campaign_players SET current_map_id = $2, position_x = $3, position_y = $4
                     WHERE auth_user_id = $1`,
                    [authUserId, targetMapId, spawnX, spawnY]
                );
            }

            // Emit map change to client
            this.onMapChange?.(sessionId, { targetMapId, spawnX, spawnY });
        } catch (error) {
            console.error(`[CampaignService] Map transition error:`, error);
            this.onError?.(sessionId, { message: 'Failed to change map' });
        }
    }

    // ============================================================================
    // CHECKPOINTS
    // ============================================================================

    /**
     * Save checkpoint.
     */
    async saveCheckpoint(sessionId: string, authUserId: number): Promise<void> {
        try {
            const session = this.gameLoop.getSession(sessionId);
            if (!session) return;

            await this.db.query(
                `UPDATE campaign_players
                 SET position_x = $2, position_y = $3, current_map_id = $4, hp = $5, has_armor = $6, updated_at = NOW()
                 WHERE auth_user_id = $1`,
                [
                    authUserId,
                    session.player.x,
                    session.player.y,
                    session.mapId,
                    session.player.hp,
                    session.player.hasArmor,
                ]
            );

            this.onCheckpointSaved?.(sessionId);
        } catch (error) {
            console.error('[CampaignService] Failed to save checkpoint:', error);
        }
    }

    // ============================================================================
    // ENEMY EVENTS
    // ============================================================================

    /**
     * Handle enemy killed event from game loop.
     */
    private async handleEnemyKilled(
        sessionId: string,
        data: { enemyId: string; enemyType: CampaignEnemyType; x: number; y: number }
    ): Promise<void> {
        const def = CAMPAIGN_ENEMIES[data.enemyType];
        if (!def) return;

        const authUserId = this.sessionUserMap.get(sessionId);
        if (authUserId) {
            // Award respect for kill
            await this.awardRespect(authUserId, def.respectReward, `enemy_${data.enemyType}`);
        }

        // Chance to drop a vocab card
        let vocabDrop: VocabCardData | undefined;
        if (def.vocabDropPool.length > 0 && Math.random() < 0.3) {
            const word = def.vocabDropPool[Math.floor(Math.random() * def.vocabDropPool.length)];
            vocabDrop = {
                wordEn: word,
                wordDe: '', // Filled by frontend or lookup
                definitionEn: '',
                exampleEn: '',
                foundInCountry: 'Vogelsen',
            };
            this.onVocabCollected?.(sessionId, { card: vocabDrop });
        }

        this.onEnemyKilled?.(sessionId, {
            enemyId: data.enemyId,
            respectGained: def.respectReward,
            vocabDrop,
        });
    }

    /**
     * Handle player death — save state and notify client.
     */
    private async handlePlayerDeath(sessionId: string): Promise<void> {
        const authUserId = this.sessionUserMap.get(sessionId);
        if (authUserId) {
            await this.saveCheckpoint(sessionId, authUserId);
        }
    }

    // ============================================================================
    // STATE HELPERS
    // ============================================================================

    /**
     * Load quest states for a player from DB.
     */
    private async loadQuestStates(authUserId: number): Promise<Record<string, QuestState>> {
        try {
            const result = await this.db.query(
                'SELECT * FROM campaign_quests WHERE auth_user_id = $1',
                [authUserId]
            );

            const states: Record<string, QuestState> = {};
            for (const row of result.rows) {
                states[row.quest_id] = {
                    questId: row.quest_id,
                    status: row.status,
                    progress: row.progress || {},
                    startedAt: new Date(row.started_at).getTime(),
                    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
                    respectEarned: row.respect_earned || 0,
                };
            }
            return states;
        } catch (error) {
            console.error('[CampaignService] Failed to load quest states:', error);
            return {};
        }
    }

    /**
     * Build NPC runtime states from quest progress.
     */
    private buildNPCStates(
        map: CampaignMap,
        questStates: Record<string, QuestState>
    ): CampaignRuntimeNPC[] {
        const runtimeNPCs: CampaignRuntimeNPC[] = [];

        for (const placement of map.npcs) {
            const npcDef = this.npcService.getNPC(placement.npcId);
            if (!npcDef) continue;

            // Determine quest marker
            let questMarker: 'available' | 'active' | 'complete' | null = null;
            let hasNewDialogue = false;

            if (npcDef.questId) {
                const questState = questStates[npcDef.questId];
                const questDef = this.questDefs.get(npcDef.questId);

                if (!questState) {
                    // Check if prerequisites are met
                    if (questDef) {
                        const prereqsMet = questDef.prerequisites.every((prereq) => {
                            if (prereq === '_any_2_quests') {
                                return Object.values(questStates).filter((s) => s.status === 'complete').length >= 2;
                            }
                            return questStates[prereq]?.status === 'complete';
                        });
                        if (prereqsMet) {
                            questMarker = 'available';
                            hasNewDialogue = true;
                        }
                    }
                } else if (questState.status === 'active') {
                    questMarker = 'active';
                } else if (questState.status === 'complete') {
                    questMarker = 'complete';
                }
            }

            const tileSize = map.meta.tileSize;
            const facingRadians = this.facingToRadians(placement.facing);

            runtimeNPCs.push({
                npcId: placement.npcId,
                x: placement.tileX * tileSize + tileSize / 2,
                y: placement.tileY * tileSize + tileSize / 2,
                facing: facingRadians,
                spriteId: npcDef.spriteId,
                name: npcDef.name,
                iconColor: npcDef.iconColor,
                questMarker,
                hasNewDialogue,
            });
        }

        return runtimeNPCs;
    }

    /**
     * Refresh NPC states for a session (after quest state changes).
     */
    private async refreshNPCStates(sessionId: string, authUserId: number): Promise<void> {
        const session = this.gameLoop.getSession(sessionId);
        if (!session) return;

        const questStates = await this.loadQuestStates(authUserId);
        const npcStates = this.buildNPCStates(session.map, questStates);
        this.gameLoop.updateNPCStates(sessionId, npcStates);
    }

    /**
     * Get serialized state for a session.
     */
    private getSerializedState(sessionId: string): SerializedCampaignState | undefined {
        const session = this.gameLoop.getSession(sessionId);
        if (!session) return undefined;

        // Derive country from map ID for day/night + seasonal calculations
        const countryId = this.getCountryFromMapId(session.mapId);
        const dayNight = DayNightService.isBossZone(session.mapId)
            ? { timeOfDay: 'day' as const, sunAngle: 180, lightLevel: 1.0, tintColor: '#FFFFFF', hour: 12, minute: 0 }
            : DayNightService.getState(countryId);
        const activeEvents = this.seasonalEventService.getActiveEvents(countryId);

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

    /**
     * Extract country ID from map ID.
     */
    private getCountryFromMapId(mapId: string): string {
        if (mapId.startsWith('vogelsen') || mapId.startsWith('patricks-house')) {
            return 'germany';
        }
        if (mapId.startsWith('boss_')) {
            return mapId.replace('boss_', '').split('_')[0] ?? 'germany';
        }
        const firstSegment = mapId.split('_')[0];
        const knownCountries = [
            'germany', 'singapore', 'philippines', 'new_zealand', 'ireland',
            'south_africa', 'nigeria', 'jamaica', 'canada', 'scotland',
            'wales', 'england', 'australia', 'usa',
        ];
        if (firstSegment && knownCountries.includes(firstSegment)) {
            return firstSegment;
        }
        for (const country of knownCountries) {
            if (mapId.startsWith(country)) {
                return country;
            }
        }
        return 'germany';
    }

    /**
     * Stop a session and clean up.
     */
    async stopSession(sessionId: string): Promise<void> {
        const authUserId = this.sessionUserMap.get(sessionId);
        if (authUserId) {
            await this.saveCheckpoint(sessionId, authUserId);
        }

        this.gameLoop.stopSession(sessionId);
        this.activeQuizzes.delete(sessionId);
        this.sessionUserMap.delete(sessionId);
    }

    // ============================================================================
    // DOLLAR CURRENCY
    // ============================================================================

    /**
     * Award (or deduct) dollars and log the transaction.
     * Returns the new balance.
     */
    async awardDollars(authUserId: number, amount: number, source: string, metadata?: Record<string, any>): Promise<number> {
        const result = await this.db.query(
            `UPDATE campaign_players SET dollar_balance = dollar_balance + $1
             WHERE auth_user_id = $2 RETURNING dollar_balance`,
            [amount, authUserId]
        );
        await this.db.query(
            `INSERT INTO campaign_dollar_transactions (player_id, amount, source, metadata)
             SELECT id, $1, $2, $3 FROM campaign_players WHERE auth_user_id = $4`,
            [amount, source, metadata ? JSON.stringify(metadata) : null, authUserId]
        );
        return result.rows[0]?.dollar_balance ?? 0;
    }

    /**
     * Process rent payment from payer to receiver.
     * Returns false if payer has insufficient funds or either player is missing.
     */
    async processRent(payerAuthUserId: number, receiverAuthUserId: number): Promise<boolean> {
        // Check payer has enough
        const payer = await this.db.query(
            'SELECT id, dollar_balance FROM campaign_players WHERE auth_user_id = $1',
            [payerAuthUserId]
        );
        if (!payer.rows[0] || payer.rows[0].dollar_balance < RENT_AMOUNT) return false;

        const receiver = await this.db.query(
            'SELECT id FROM campaign_players WHERE auth_user_id = $1',
            [receiverAuthUserId]
        );
        if (!receiver.rows[0]) return false;

        // Transfer
        await this.db.query('UPDATE campaign_players SET dollar_balance = dollar_balance - $1 WHERE auth_user_id = $2', [RENT_AMOUNT, payerAuthUserId]);
        await this.db.query('UPDATE campaign_players SET dollar_balance = dollar_balance + $1 WHERE auth_user_id = $2', [RENT_AMOUNT, receiverAuthUserId]);

        // Record in rent ledger
        await this.db.query(
            'INSERT INTO campaign_rent_ledger (payer_id, receiver_id, amount) VALUES ($1, $2, $3)',
            [payer.rows[0].id, receiver.rows[0].id, RENT_AMOUNT]
        );

        // Log dollar transactions for both parties
        await this.awardDollars(payerAuthUserId, -RENT_AMOUNT, 'rent_paid', { to: receiverAuthUserId });
        await this.awardDollars(receiverAuthUserId, RENT_AMOUNT, 'rent_received', { from: payerAuthUserId });

        return true;
    }

    /**
     * Get a player's current dollar balance.
     */
    async getDollarBalance(authUserId: number): Promise<number> {
        const result = await this.db.query(
            'SELECT dollar_balance FROM campaign_players WHERE auth_user_id = $1',
            [authUserId]
        );
        return result.rows[0]?.dollar_balance ?? 0;
    }

    /**
     * Determine the next available protagonist slot (1 or 2).
     * Returns null if both slots are taken.
     */
    private async getNextProtagonistSlot(): Promise<1 | 2 | null> {
        const result = await this.db.query(
            'SELECT protagonist_slot FROM campaign_players WHERE protagonist_slot IS NOT NULL ORDER BY protagonist_slot'
        );
        const taken = new Set(result.rows.map((r: any) => r.protagonist_slot));
        if (!taken.has(1)) return 1;
        if (!taken.has(2)) return 2;
        return null;
    }

    // ============================================================================
    // ACCESSORS
    // ============================================================================

    /** Get the game loop (for SocketService wiring). */
    getGameLoop(): CampaignGameLoop {
        return this.gameLoop;
    }

    /** Get the map service. */
    getMapService(): CampaignMapService {
        return this.mapService;
    }

    /** Get the NPC service. */
    getNPCService(): CampaignNPCService {
        return this.npcService;
    }

    /** Get a quest definition. */
    getQuestDef(questId: string): QuestDef | undefined {
        return this.questDefs.get(questId);
    }

    // ============================================================================
    // UTILITIES
    // ============================================================================

    /**
     * Convert facing direction string to radians.
     */
    private facingToRadians(facing: 'N' | 'S' | 'E' | 'W'): number {
        switch (facing) {
            case 'N': return -Math.PI / 2;
            case 'S': return Math.PI / 2;
            case 'E': return 0;
            case 'W': return Math.PI;
            default: return Math.PI / 2; // Default: face south
        }
    }
}
