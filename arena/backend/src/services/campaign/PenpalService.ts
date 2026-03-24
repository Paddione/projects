import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DatabaseService } from '../DatabaseService.js';
import type {
    PenpalDef,
    PenpalLetter,
    PenpalGrade,
} from '../../types/campaign.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface LetterTemplate {
    subject: string;
    body: string;
    vocab: string[];
}

export class PenpalService {
    private db: DatabaseService;
    private penpals: Map<string, PenpalDef> = new Map();
    private letterTemplates: Record<string, LetterTemplate[]> = {};

    constructor() {
        this.db = DatabaseService.getInstance();
        this.loadPenpals();
    }

    private loadPenpals(): void {
        const path = join(__dirname, '../../data/campaign/penpals.json');
        const data = JSON.parse(readFileSync(path, 'utf-8'));

        for (const [countryId, penpal] of Object.entries(data.penpals)) {
            this.penpals.set(countryId, penpal as PenpalDef);
        }

        this.letterTemplates = data.letterTemplates || {};
        console.log(`[PenpalService] Loaded ${this.penpals.size} penpals, templates for ${Object.keys(this.letterTemplates).length} countries`);
    }

    /**
     * Generate an incoming letter from a penpal NPC.
     * Uses templates for now; ClosedPaw dynamic generation comes in Phase 6.
     */
    async generateIncomingLetter(playerId: number, countryId: string): Promise<PenpalLetter> {
        const penpal = this.penpals.get(countryId);
        if (!penpal) throw new Error(`No penpal for country: ${countryId}`);

        // Generate template-based letter
        const letter = this.generateTemplateLetter(penpal, countryId);

        // Store in DB
        const result = await this.db.query(
            `INSERT INTO campaign_penpal_letters (player_id, country_id, penpal_npc_id, direction, subject, body, vocab_highlighted)
             VALUES ($1, $2, $3, 'incoming', $4, $5, $6) RETURNING id, created_at`,
            [playerId, countryId, penpal.npcId, letter.subject, letter.body, JSON.stringify(letter.vocabHighlighted)]
        );

        return {
            id: result.rows[0].id,
            countryId,
            penpalNpcId: penpal.npcId,
            direction: 'incoming',
            subject: letter.subject,
            body: letter.body,
            vocabHighlighted: letter.vocabHighlighted,
            createdAt: result.rows[0].created_at,
        };
    }

    /**
     * Submit player's reply to a penpal.
     * Auto-grades using the same 4-axis system as WritingQuestService.
     */
    async submitReply(playerId: number, countryId: string, text: string): Promise<{ grade: PenpalGrade; respectEarned: number }> {
        const penpal = this.penpals.get(countryId);
        if (!penpal) throw new Error(`No penpal for country: ${countryId}`);

        // Auto-grade (same 4-axis system as WritingQuestService)
        const grade = this.gradeReply(text);

        // Calculate respect reward based on grade
        let respectEarned: number;
        if (grade.total >= 90) respectEarned = 200;
        else if (grade.total >= 70) respectEarned = 150;
        else if (grade.total >= 50) respectEarned = 75;
        else respectEarned = 25;

        // Store reply
        await this.db.query(
            `INSERT INTO campaign_penpal_letters (player_id, country_id, penpal_npc_id, direction, body, grade_json, respect_earned)
             VALUES ($1, $2, $3, 'reply', $4, $5, $6)`,
            [playerId, countryId, penpal.npcId, text, JSON.stringify(grade), respectEarned]
        );

        return { grade, respectEarned };
    }

    /**
     * Get all letters for a player in a specific country, ordered chronologically.
     */
    async getLetters(playerId: number, countryId: string): Promise<PenpalLetter[]> {
        const result = await this.db.query(
            `SELECT id, country_id, penpal_npc_id, direction, subject, body,
                    vocab_highlighted, grade_json, respect_earned, read_at, created_at
             FROM campaign_penpal_letters
             WHERE player_id = $1 AND country_id = $2
             ORDER BY created_at ASC`,
            [playerId, countryId]
        );

        return result.rows.map((r: any) => ({
            id: r.id,
            countryId: r.country_id,
            penpalNpcId: r.penpal_npc_id,
            direction: r.direction,
            subject: r.subject,
            body: r.body,
            vocabHighlighted: r.vocab_highlighted || [],
            grade: r.grade_json ? (typeof r.grade_json === 'string' ? JSON.parse(r.grade_json) : r.grade_json) : undefined,
            respectEarned: r.respect_earned,
            readAt: r.read_at,
            createdAt: r.created_at,
        }));
    }

    /**
     * Get total unread letter count across all countries for a player.
     */
    async getUnreadCount(playerId: number): Promise<number> {
        const result = await this.db.query(
            `SELECT COUNT(*) as count FROM campaign_penpal_letters
             WHERE player_id = $1 AND direction = 'incoming' AND read_at IS NULL`,
            [playerId]
        );
        return parseInt(result.rows[0].count, 10);
    }

    /**
     * Mark a letter as read.
     */
    async markRead(playerId: number, letterId: number): Promise<void> {
        await this.db.query(
            `UPDATE campaign_penpal_letters SET read_at = NOW()
             WHERE id = $1 AND player_id = $2 AND read_at IS NULL`,
            [letterId, playerId]
        );
    }

    /** Get the penpal definition for a country */
    getPenpal(countryId: string): PenpalDef | undefined {
        return this.penpals.get(countryId);
    }

    /** Get all available penpal country IDs */
    getAvailableCountries(): string[] {
        return Array.from(this.penpals.keys());
    }

    /**
     * Template-based letter generation. Selects from country-specific templates
     * or falls back to default templates. Random selection for variety.
     */
    private generateTemplateLetter(penpal: PenpalDef, countryId: string): { subject: string; body: string; vocabHighlighted: string[] } {
        const templates = this.letterTemplates[countryId] || this.letterTemplates['default'] || [];
        if (templates.length === 0) {
            return {
                subject: `Hello from ${penpal.name}!`,
                body: penpal.greeting + `How are you? I would love to hear from you! Tell me about your day.` + '\n\n' + penpal.signoff,
                vocabHighlighted: [],
            };
        }

        const template = templates[Math.floor(Math.random() * templates.length)];

        return {
            subject: template.subject,
            body: penpal.greeting + template.body + '\n\n' + penpal.signoff,
            vocabHighlighted: template.vocab,
        };
    }

    /**
     * Grade a player's reply using the same 4-axis heuristic system
     * as WritingQuestService.autoGrade(). Teacher layer / ClosedPaw
     * can upgrade these grades later.
     */
    private gradeReply(text: string): PenpalGrade {
        const words = text.trim().split(/\s+/);
        const wordCount = words.length;
        const sentences = text.split(/[.!?]+/).filter(Boolean);

        // Vocabulary: unique word ratio
        const uniqueWords = new Set(words.map(w => w.toLowerCase()));
        const vocabScore = Math.min(25, Math.round((uniqueWords.size / Math.max(wordCount, 1)) * 30));

        // Grammar: basic checks (capitalization, punctuation)
        let grammarScore = 15; // baseline
        if (text[0] === text[0].toUpperCase()) grammarScore += 3;
        if (/[.!?]$/.test(text.trim())) grammarScore += 4;
        if (sentences.length >= 2) grammarScore += 3;
        grammarScore = Math.min(25, grammarScore);

        // Coherence: reasonable length for a letter reply
        let coherenceScore = 15;
        if (wordCount >= 10) coherenceScore += 3;
        if (wordCount >= 20) coherenceScore += 3;
        if (wordCount <= 300) coherenceScore += 4;
        coherenceScore = Math.min(25, coherenceScore);

        // Effort: length and variety
        let effortScore = 10;
        if (wordCount >= 15) effortScore += 5;
        if (uniqueWords.size >= 8) effortScore += 5;
        if (sentences.length >= 3) effortScore += 5;
        effortScore = Math.min(25, effortScore);

        const total = vocabScore + grammarScore + coherenceScore + effortScore;

        let feedback: string;
        if (total >= 90) feedback = 'Wonderful letter! Your penpal will love reading this.';
        else if (total >= 70) feedback = 'Good reply! Try to ask a question back to keep the conversation going.';
        else if (total >= 50) feedback = 'Not bad! Try to write a bit more and use varied vocabulary.';
        else feedback = 'Keep trying! Remember to start with a greeting and end with a sign-off.';

        return {
            vocabulary: vocabScore,
            grammar: grammarScore,
            coherence: coherenceScore,
            effort: effortScore,
            total,
            feedback,
            corrections: [], // AI corrections added later by teacher layer / ClosedPaw
        };
    }
}
