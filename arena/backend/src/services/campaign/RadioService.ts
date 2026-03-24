import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DatabaseService } from '../DatabaseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface RadioCatchQuestion {
    question: string;
    answers: string[];
    correct: number;
}

export interface RadioClip {
    id: string;
    title: string;
    duration: number;
    script: string;
    catchQuestion: RadioCatchQuestion;
    respectReward: number;
}

export interface RadioZone {
    id: string;
    country: string;
    zoneType: string;
    clips: RadioClip[];
}

export class RadioService {
    private db: DatabaseService;
    private zones: RadioZone[] = [];
    private clipIndex: Map<string, RadioClip> = new Map();

    constructor() {
        this.db = DatabaseService.getInstance();
        this.loadZones();
    }

    private loadZones(): void {
        const path = join(__dirname, '../../data/campaign/radio-zones.json');
        const data = JSON.parse(readFileSync(path, 'utf-8'));
        this.zones = data.zones as RadioZone[];

        // Build a fast lookup index for clips by ID
        for (const zone of this.zones) {
            for (const clip of zone.clips) {
                this.clipIndex.set(clip.id, clip);
            }
        }

        console.log(`[RadioService] Loaded ${this.zones.length} radio zones with ${this.clipIndex.size} clips`);
    }

    /** Get all radio zones for a specific country */
    getZonesForCountry(country: string): RadioZone[] {
        return this.zones.filter(z => z.country === country);
    }

    /** Get all zones of a specific type for a country */
    getZonesByType(country: string, zoneType: string): RadioZone[] {
        return this.zones.filter(z => z.country === country && z.zoneType === zoneType);
    }

    /** Get a random clip from a specific zone */
    getRandomClip(zoneId: string): RadioClip | undefined {
        const zone = this.zones.find(z => z.id === zoneId);
        if (!zone || zone.clips.length === 0) return undefined;
        const idx = Math.floor(Math.random() * zone.clips.length);
        return zone.clips[idx];
    }

    /** Look up a clip by its ID */
    getClip(clipId: string): RadioClip | undefined {
        return this.clipIndex.get(clipId);
    }

    /** Score a "Did you catch that?" answer */
    scoreCatchQuestion(clipId: string, answer: number): { correct: boolean; respectReward: number } {
        const clip = this.clipIndex.get(clipId);
        if (!clip) return { correct: false, respectReward: 0 };
        const isCorrect = answer === clip.catchQuestion.correct;
        return { correct: isCorrect, respectReward: isCorrect ? clip.respectReward : 0 };
    }

    /** Record a player's catch question attempt */
    async recordCatchAttempt(playerId: number, clipId: string, correct: boolean, respectEarned: number): Promise<void> {
        await this.db.query(
            `INSERT INTO campaign_radio_catches (player_id, clip_id, correct, respect_earned)
             VALUES ($1, $2, $3, $4)`,
            [playerId, clipId, correct, respectEarned]
        );
    }

    /** Get player's catch history */
    async getCatchHistory(playerId: number): Promise<Array<{ clipId: string; correct: boolean; respectEarned: number; answeredAt: string }>> {
        const result = await this.db.query(
            `SELECT clip_id, correct, respect_earned, answered_at
             FROM campaign_radio_catches
             WHERE player_id = $1
             ORDER BY answered_at DESC`,
            [playerId]
        );
        return result.rows.map((r: any) => ({
            clipId: r.clip_id,
            correct: r.correct,
            respectEarned: r.respect_earned,
            answeredAt: r.answered_at,
        }));
    }

    /** Get all clip IDs that a player has already answered correctly */
    async getCorrectClipIds(playerId: number): Promise<string[]> {
        const result = await this.db.query(
            'SELECT DISTINCT clip_id FROM campaign_radio_catches WHERE player_id = $1 AND correct = true',
            [playerId]
        );
        return result.rows.map((r: any) => r.clip_id);
    }
}
