import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DatabaseService } from '../DatabaseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface NewspaperQuizQuestion {
    question: string;
    answers: string[];
    correct: number;
}

export interface NewspaperArticle {
    id: string;
    headline: string;
    body: string;
    wordCount: number;
    highlightedVocab: string[];
    quiz: NewspaperQuizQuestion[];
}

export interface Newspaper {
    countryId: string;
    title: string;
    edition: number;
    articles: NewspaperArticle[];
}

export class NewspaperService {
    private db: DatabaseService;
    private newspapers: Map<string, Newspaper> = new Map();

    constructor() {
        this.db = DatabaseService.getInstance();
        this.loadNewspapers();
    }

    private loadNewspapers(): void {
        const path = join(__dirname, '../../data/campaign/newspapers.json');
        const data = JSON.parse(readFileSync(path, 'utf-8'));
        for (const [country, newspaper] of Object.entries(data.newspapers)) {
            this.newspapers.set(country, newspaper as Newspaper);
        }
        console.log(`[NewspaperService] Loaded newspapers for ${this.newspapers.size} countries`);
    }

    /** Get the newspaper for a specific country */
    getNewspaper(countryId: string): Newspaper | undefined {
        return this.newspapers.get(countryId);
    }

    /** Get all available country IDs that have newspapers */
    getAvailableCountries(): string[] {
        return Array.from(this.newspapers.keys());
    }

    /** Find an article by its ID across all newspapers */
    getArticle(articleId: string): NewspaperArticle | undefined {
        for (const newspaper of this.newspapers.values()) {
            const article = newspaper.articles.find(a => a.id === articleId);
            if (article) return article;
        }
        return undefined;
    }

    /** Score a newspaper quiz — returns score, correct count, total, and feedback */
    scoreQuiz(articleId: string, answers: number[]): { score: number; correct: number; total: number; feedback: string } {
        const article = this.getArticle(articleId);
        if (!article) return { score: 0, correct: 0, total: 0, feedback: 'Article not found' };

        let correct = 0;
        const total = article.quiz.length;
        for (let i = 0; i < total; i++) {
            if (answers[i] === article.quiz[i].correct) correct++;
        }

        const score = Math.round((correct / total) * 100);
        let feedback: string;
        if (score === 100) feedback = 'Perfect! You understood everything.';
        else if (score >= 67) feedback = 'Good reading comprehension!';
        else feedback = 'Try reading the article again more carefully.';

        return { score, correct, total, feedback };
    }

    /** Track that a player has read a newspaper article */
    async markAsRead(playerId: number, countryId: string, articleId: string): Promise<void> {
        await this.db.query(
            `INSERT INTO campaign_newspaper_reads (player_id, country_id, article_id)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [playerId, countryId, articleId]
        );
    }

    /** Get player's read article IDs */
    async getReadArticles(playerId: number): Promise<string[]> {
        const result = await this.db.query(
            'SELECT article_id FROM campaign_newspaper_reads WHERE player_id = $1',
            [playerId]
        );
        return result.rows.map((r: any) => r.article_id);
    }

    /** Get read article count per country for a player */
    async getReadCountByCountry(playerId: number): Promise<Record<string, number>> {
        const result = await this.db.query(
            `SELECT country_id, COUNT(*) as read_count
             FROM campaign_newspaper_reads WHERE player_id = $1
             GROUP BY country_id`,
            [playerId]
        );
        const counts: Record<string, number> = {};
        for (const row of result.rows) {
            counts[row.country_id] = parseInt(row.read_count, 10);
        }
        return counts;
    }
}
