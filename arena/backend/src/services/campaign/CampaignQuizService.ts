import { fetchCampaignQuestions } from '../../config/l2pClient.js';
import type { QuizQuestion } from '../../types/campaign.js';

interface CachedQuestions {
    questions: any[];  // raw from L2P, with correct answers
    fetchedAt: number;
}

export class CampaignQuizService {
    private cache: Map<string, CachedQuestions> = new Map();
    private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

    /**
     * Fetch questions for a dialogue quiz node.
     * Returns client-safe questions (no correct answers) and a server-side answer key.
     */
    async getQuestions(
        questionSetId: string,
        count: number
    ): Promise<{ clientQuestions: QuizQuestion[]; answerKey: Map<string, string> }> {
        const cacheKey = `${questionSetId}:${count}`;

        // Check cache
        const cached = this.cache.get(cacheKey);
        if (cached && !this.isStale(cached)) {
            return this.normalizeQuestions(cached.questions);
        }

        // Fetch from L2P
        // questionSetId is a string like "vogelsen_food_a1" — we pass it as a numeric array
        // The L2P API expects numeric IDs; campaign maps use string IDs for readability
        // We hash the string to a numeric ID for the API call
        const numericId = this.stringToSetId(questionSetId);
        const rawQuestions = await fetchCampaignQuestions([numericId], count);

        if (rawQuestions.length === 0) {
            console.warn(`[CampaignQuizService] No questions returned for set: ${questionSetId}`);
            return { clientQuestions: [], answerKey: new Map() };
        }

        // Cache the results
        this.cache.set(cacheKey, {
            questions: rawQuestions,
            fetchedAt: Date.now(),
        });

        return this.normalizeQuestions(rawQuestions);
    }

    /**
     * Score an answer server-side.
     */
    scoreAnswer(
        answerKey: Map<string, string>,
        questionId: string,
        playerAnswer: string
    ): { correct: boolean; score: number } {
        const correctAnswer = answerKey.get(questionId);
        if (!correctAnswer) {
            console.warn(`[CampaignQuizService] No answer key for question: ${questionId}`);
            return { correct: false, score: 0 };
        }

        const correct = playerAnswer === correctAnswer;
        return {
            correct,
            score: correct ? 1 : 0,
        };
    }

    /**
     * Clear the cache (e.g., on session end).
     */
    clearCache(): void {
        this.cache.clear();
    }

    private isStale(cached: CachedQuestions): boolean {
        return Date.now() - cached.fetchedAt > this.CACHE_TTL_MS;
    }

    /**
     * Strip correct answers from raw questions to build client-safe data and answer key.
     */
    private normalizeQuestions(
        rawQuestions: any[]
    ): { clientQuestions: QuizQuestion[]; answerKey: Map<string, string> } {
        const clientQuestions: QuizQuestion[] = [];
        const answerKey = new Map<string, string>();

        for (const q of rawQuestions) {
            const questionId = String(q.id || q.questionId || q.question_id);

            // Build answer options — L2P may return answers in different shapes
            const answers = this.extractAnswers(q);
            const correctAnswerId = this.extractCorrectAnswer(q, answers);

            if (correctAnswerId) {
                answerKey.set(questionId, correctAnswerId);
            }

            clientQuestions.push({
                id: questionId,
                text: q.text || q.question || q.question_text || '',
                answers: answers.map((a) => ({
                    id: String(a.id),
                    text: String(a.text),
                })),
                difficulty: q.difficulty || q.level || 1,
                hint: q.hint || undefined,
                answerType: q.answerType || q.answer_type || 'multiple_choice',
            });
        }

        return { clientQuestions, answerKey };
    }

    /**
     * Extract answers from a raw L2P question object.
     * L2P may return answers as `answers`, `options`, or `choices`.
     */
    private extractAnswers(q: any): Array<{ id: string; text: string }> {
        const raw = q.answers || q.options || q.choices || [];
        return raw.map((a: any, index: number) => ({
            id: String(a.id || a.answerId || a.answer_id || index),
            text: String(a.text || a.answer || a.answer_text || ''),
        }));
    }

    /**
     * Extract the correct answer ID from a raw L2P question.
     */
    private extractCorrectAnswer(q: any, answers: Array<{ id: string; text: string }>): string | null {
        // Direct correct answer ID
        if (q.correctAnswerId || q.correct_answer_id) {
            return String(q.correctAnswerId || q.correct_answer_id);
        }

        // Correct answer marked in the answers array
        const rawAnswers = q.answers || q.options || q.choices || [];
        for (const a of rawAnswers) {
            if (a.isCorrect || a.is_correct || a.correct) {
                return String(a.id || a.answerId || a.answer_id);
            }
        }

        // Fallback: correctAnswer field matches answer text
        if (q.correctAnswer || q.correct_answer) {
            const correctText = String(q.correctAnswer || q.correct_answer);
            const match = answers.find((a) => a.text === correctText);
            if (match) return match.id;
        }

        return null;
    }

    /**
     * Convert a string question set ID to a numeric ID.
     * Campaign uses readable strings; L2P API uses numeric IDs.
     * Simple hash that produces a stable positive integer.
     */
    private stringToSetId(setId: string): number {
        let hash = 0;
        for (let i = 0; i < setId.length; i++) {
            const char = setId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
}
