import { DatabaseService } from '../DatabaseService.js';
import type { CreateCustomQuestData, CustomQuest } from '../../types/campaign.js';

export class CampaignEditorService {
    private db: DatabaseService;

    constructor() {
        this.db = DatabaseService.getInstance();
    }

    /**
     * Create a custom quest. Generates a unique quest ID.
     */
    async createQuest(data: CreateCustomQuestData): Promise<{ questId: string }> {
        const questId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        await this.db.query(
            `INSERT INTO campaign_custom_quests
                (quest_id, title, description, quest_type, target_npc_id, l2p_quiz_set_id,
                 objectives, rewards, prerequisites, audience, class_id, created_by_auth_user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                questId,
                data.title,
                data.description || null,
                data.questType,
                data.targetNpcId || null,
                data.l2pQuizSetId || null,
                JSON.stringify(data.objectives),
                JSON.stringify(data.rewards),
                JSON.stringify(data.prerequisites),
                data.audience,
                data.classId || null,
                data.createdByAuthUserId,
            ]
        );

        return { questId };
    }

    /**
     * Get custom quests with optional filters.
     */
    async getQuests(filters: { audience?: string; classId?: number; createdBy?: number }): Promise<CustomQuest[]> {
        let query = `SELECT * FROM campaign_custom_quests WHERE is_active = true`;
        const params: unknown[] = [];
        let paramIdx = 1;

        if (filters.audience) {
            query += ` AND audience = $${paramIdx++}`;
            params.push(filters.audience);
        }

        if (filters.classId) {
            query += ` AND class_id = $${paramIdx++}`;
            params.push(filters.classId);
        }

        if (filters.createdBy) {
            query += ` AND created_by_auth_user_id = $${paramIdx++}`;
            params.push(filters.createdBy);
        }

        query += ` ORDER BY created_at DESC`;

        const result = await this.db.query(query, params);

        return result.rows.map((r: any) => this.mapRowToCustomQuest(r));
    }

    /**
     * Update an existing custom quest.
     */
    async updateQuest(questId: string, data: Partial<CreateCustomQuestData>): Promise<void> {
        const setClauses: string[] = [];
        const params: unknown[] = [];
        let paramIdx = 1;

        if (data.title !== undefined) {
            setClauses.push(`title = $${paramIdx++}`);
            params.push(data.title);
        }
        if (data.description !== undefined) {
            setClauses.push(`description = $${paramIdx++}`);
            params.push(data.description);
        }
        if (data.questType !== undefined) {
            setClauses.push(`quest_type = $${paramIdx++}`);
            params.push(data.questType);
        }
        if (data.targetNpcId !== undefined) {
            setClauses.push(`target_npc_id = $${paramIdx++}`);
            params.push(data.targetNpcId);
        }
        if (data.l2pQuizSetId !== undefined) {
            setClauses.push(`l2p_quiz_set_id = $${paramIdx++}`);
            params.push(data.l2pQuizSetId);
        }
        if (data.objectives !== undefined) {
            setClauses.push(`objectives = $${paramIdx++}`);
            params.push(JSON.stringify(data.objectives));
        }
        if (data.rewards !== undefined) {
            setClauses.push(`rewards = $${paramIdx++}`);
            params.push(JSON.stringify(data.rewards));
        }
        if (data.prerequisites !== undefined) {
            setClauses.push(`prerequisites = $${paramIdx++}`);
            params.push(JSON.stringify(data.prerequisites));
        }
        if (data.audience !== undefined) {
            setClauses.push(`audience = $${paramIdx++}`);
            params.push(data.audience);
        }
        if (data.classId !== undefined) {
            setClauses.push(`class_id = $${paramIdx++}`);
            params.push(data.classId);
        }

        if (setClauses.length === 0) return;

        params.push(questId);
        await this.db.query(
            `UPDATE campaign_custom_quests SET ${setClauses.join(', ')} WHERE quest_id = $${paramIdx}`,
            params
        );
    }

    /**
     * Deactivate (soft-delete) a custom quest.
     */
    async deactivateQuest(questId: string): Promise<void> {
        await this.db.query(
            `UPDATE campaign_custom_quests SET is_active = false WHERE quest_id = $1`,
            [questId]
        );
    }

    /**
     * Get a single quest by ID.
     */
    async getQuestById(questId: string): Promise<CustomQuest | null> {
        const result = await this.db.query(
            `SELECT * FROM campaign_custom_quests WHERE quest_id = $1`,
            [questId]
        );
        if ((result.rowCount ?? 0) === 0) return null;
        return this.mapRowToCustomQuest(result.rows[0]);
    }

    /**
     * ClosedPaw auto-generate quest from a text prompt (stub).
     * Real AI integration comes in Phase 6.
     */
    async generateFromPrompt(prompt: string, cefrLevel: string): Promise<CreateCustomQuestData> {
        // Stub — returns a reasonable quest template based on keywords
        const p = prompt.toLowerCase();

        let questType = 'talk';
        let objectives: CreateCustomQuestData['objectives'] = [];
        let rewards: CreateCustomQuestData['rewards'] = { respect: 100 };

        if (p.includes('vocab') || p.includes('word') || p.includes('vocabulary')) {
            questType = 'fetch';
            objectives = [
                { id: 'obj_1', text: 'Collect 5 vocabulary words', type: 'fetch', target: 'vocab_card', requiredCount: 5 },
            ];
            rewards = { respect: 100, vocabCards: [] };
        } else if (p.includes('quiz') || p.includes('test') || p.includes('question')) {
            questType = 'quiz';
            objectives = [
                { id: 'obj_1', text: 'Complete the quiz with 80% accuracy', type: 'quiz', target: 'quiz_set', requiredCount: 1 },
            ];
            rewards = { respect: 150 };
        } else if (p.includes('write') || p.includes('letter') || p.includes('postcard')) {
            questType = 'talk';
            objectives = [
                { id: 'obj_1', text: 'Write a letter to your penpal', type: 'talk', target: 'penpal', requiredCount: 1 },
            ];
            rewards = { respect: 200, dollars: 50 };
        } else if (p.includes('read') || p.includes('newspaper') || p.includes('article')) {
            questType = 'fetch';
            objectives = [
                { id: 'obj_1', text: 'Read 2 newspaper articles', type: 'fetch', target: 'newspaper_article', requiredCount: 2 },
            ];
            rewards = { respect: 75 };
        } else if (p.includes('talk') || p.includes('npc') || p.includes('speak')) {
            questType = 'talk';
            objectives = [
                { id: 'obj_1', text: 'Talk to an NPC in the current country', type: 'talk', target: 'any_npc', requiredCount: 1 },
            ];
            rewards = { respect: 50 };
        } else {
            // Generic quest
            objectives = [
                { id: 'obj_1', text: 'Complete the assigned task', type: 'talk', target: 'any', requiredCount: 1 },
            ];
        }

        // Adjust rewards based on CEFR level
        const levelMultiplier = cefrLevel === 'B2' ? 2 : cefrLevel === 'B1' ? 1.5 : cefrLevel === 'A2' ? 1.2 : 1;
        if (rewards.respect) {
            rewards.respect = Math.round(rewards.respect * levelMultiplier);
        }

        // Generate a title from the prompt
        const title = prompt.length > 50 ? prompt.substring(0, 47) + '...' : prompt;

        return {
            title,
            description: `Auto-generated quest (${cefrLevel} level): ${prompt}`,
            questType,
            objectives,
            rewards,
            prerequisites: [],
            audience: 'class' as const,
            createdByAuthUserId: 0, // Will be overridden by the calling route
        };
    }

    /**
     * Map a database row to a CustomQuest object.
     */
    private mapRowToCustomQuest(r: any): CustomQuest {
        const parseJsonField = (field: any, fallback: any) => {
            if (!field) return fallback;
            return typeof field === 'string' ? JSON.parse(field) : field;
        };

        return {
            questId: r.quest_id,
            title: r.title,
            description: r.description || '',
            questType: r.quest_type,
            targetNpcId: r.target_npc_id || undefined,
            l2pQuizSetId: r.l2p_quiz_set_id || undefined,
            objectives: parseJsonField(r.objectives, []),
            rewards: parseJsonField(r.rewards, {}),
            prerequisites: parseJsonField(r.prerequisites, []),
            audience: r.audience,
            classId: r.class_id || undefined,
            createdByAuthUserId: r.created_by_auth_user_id,
            isActive: r.is_active,
            createdAt: r.created_at,
        };
    }
}
