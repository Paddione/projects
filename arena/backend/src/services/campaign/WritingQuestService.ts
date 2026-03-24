import { DatabaseService } from '../DatabaseService.js';

export type WritingQuestType = 'postcard' | 'job_application' | 'complaint_letter' | 'social_media';

export interface WritingQuest {
    id: string;
    type: WritingQuestType;
    title: string;
    prompt: string;        // What to write about
    country: string;
    minWords: number;
    maxWords: number;
    cefrLevel: string;     // Minimum CEFR level
    respectReward: number;
    dollarReward: number;
}

export interface WritingSubmission {
    id?: number;
    playerId: number;
    questId: string;
    text: string;
    wordCount: number;
    submittedAt: string;
    grade?: WritingGrade;
}

export interface WritingGrade {
    vocabulary: number;     // 0-25
    grammar: number;        // 0-25
    coherence: number;      // 0-25
    effort: number;         // 0-25
    total: number;          // 0-100
    feedback: string;
    corrections: WritingCorrection[];
}

export interface WritingCorrection {
    original: string;
    corrected: string;
    explanation: string;
}

export class WritingQuestService {
    private db: DatabaseService;
    private quests: Map<string, WritingQuest> = new Map();

    constructor() {
        this.db = DatabaseService.getInstance();
        this.loadQuests();
    }

    private loadQuests(): void {
        // Hardcoded quests — will be expanded per country
        const quests: WritingQuest[] = [
            {
                id: 'writing_postcard_germany',
                type: 'postcard',
                title: 'Postcard from Vögelsen',
                prompt: 'Write a 2-sentence postcard to a friend telling them about Vögelsen. Mention the weather and one thing you saw.',
                country: 'germany',
                minWords: 10,
                maxWords: 50,
                cefrLevel: 'A1',
                respectReward: 50,
                dollarReward: 20,
            },
            {
                id: 'writing_job_application',
                type: 'job_application',
                title: 'The Official Form',
                prompt: 'Write a short formal letter applying for a travel permit. Address it to "Dear Sir/Madam" and explain why you want to travel.',
                country: 'germany',
                minWords: 30,
                maxWords: 100,
                cefrLevel: 'A2',
                respectReward: 100,
                dollarReward: 40,
            },
            {
                id: 'writing_complaint_england',
                type: 'complaint_letter',
                title: 'A Proper British Complaint',
                prompt: 'Write a politely worded complaint about the terrible weather in England. Be very British about it — understate everything.',
                country: 'england',
                minWords: 30,
                maxWords: 120,
                cefrLevel: 'B1',
                respectReward: 150,
                dollarReward: 50,
            },
            {
                id: 'writing_tweet_usa',
                type: 'social_media',
                title: 'Tweet About Your Adventure',
                prompt: 'Write a social media post (max 140 characters) about something exciting you saw in the USA. Use at least one American slang word.',
                country: 'usa',
                minWords: 5,
                maxWords: 30,
                cefrLevel: 'A2',
                respectReward: 75,
                dollarReward: 25,
            },
        ];

        for (const q of quests) {
            this.quests.set(q.id, q);
        }
        console.log(`[WritingQuestService] Loaded ${this.quests.size} writing quests`);
    }

    getQuest(id: string): WritingQuest | undefined {
        return this.quests.get(id);
    }

    getQuestsForCountry(country: string): WritingQuest[] {
        return Array.from(this.quests.values()).filter(q => q.country === country);
    }

    /**
     * Submit a writing quest answer. Stores it and does basic auto-grading.
     * Full AI grading (ClosedPaw) is done asynchronously in the teacher layer.
     */
    async submitWriting(playerId: number, questId: string, text: string): Promise<WritingSubmission> {
        const quest = this.quests.get(questId);
        if (!quest) throw new Error(`Unknown writing quest: ${questId}`);

        const wordCount = text.trim().split(/\s+/).length;

        // Basic auto-grade (simple heuristics — AI grading comes from teacher layer)
        const grade = this.autoGrade(text, quest);

        // Store submission
        const result = await this.db.query(
            `INSERT INTO campaign_writing_submissions (player_id, quest_id, text, word_count, grade_json)
             VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
            [playerId, questId, text, wordCount, JSON.stringify(grade)]
        );

        return {
            id: result.rows[0].id,
            playerId,
            questId,
            text,
            wordCount,
            submittedAt: result.rows[0].created_at,
            grade,
        };
    }

    /**
     * Simple auto-grading heuristics. Teacher layer / ClosedPaw upgrades this later.
     */
    private autoGrade(text: string, quest: WritingQuest): WritingGrade {
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

        // Coherence: meets word count requirements
        let coherenceScore = 15;
        if (wordCount >= quest.minWords) coherenceScore += 5;
        if (wordCount <= quest.maxWords) coherenceScore += 5;
        coherenceScore = Math.min(25, coherenceScore);

        // Effort: length and variety
        let effortScore = 10;
        if (wordCount >= quest.minWords) effortScore += 5;
        if (uniqueWords.size >= 5) effortScore += 5;
        if (sentences.length >= 2) effortScore += 5;
        effortScore = Math.min(25, effortScore);

        const total = vocabScore + grammarScore + coherenceScore + effortScore;

        let feedback: string;
        if (total >= 90) feedback = 'Excellent writing! Very well done.';
        else if (total >= 70) feedback = 'Good job! Keep practicing to improve.';
        else if (total >= 50) feedback = 'Not bad! Try to use more varied vocabulary and complete sentences.';
        else feedback = 'Keep trying! Remember to start with a capital letter and end with a period.';

        return {
            vocabulary: vocabScore,
            grammar: grammarScore,
            coherence: coherenceScore,
            effort: effortScore,
            total,
            feedback,
            corrections: [], // AI corrections added later by teacher layer
        };
    }

    /**
     * Get player's writing submissions.
     */
    async getSubmissions(playerId: number): Promise<WritingSubmission[]> {
        const result = await this.db.query(
            `SELECT id, player_id, quest_id, text, word_count, grade_json, created_at
             FROM campaign_writing_submissions
             WHERE player_id = $1 ORDER BY created_at DESC`,
            [playerId]
        );
        return result.rows.map((r: any) => ({
            id: r.id,
            playerId: r.player_id,
            questId: r.quest_id,
            text: r.text,
            wordCount: r.word_count,
            submittedAt: r.created_at,
            grade: r.grade_json ? (typeof r.grade_json === 'string' ? JSON.parse(r.grade_json) : r.grade_json) : undefined,
        }));
    }
}
