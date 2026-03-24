import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { SeasonalEventDef, ActiveSeasonalEvent } from '../../types/campaign.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Seasonal Event Service
 *
 * Triggers world events based on real calendar date + player's current country.
 * Events modify tile skins, spawn special NPCs, unlock quests, and change music.
 */
export class SeasonalEventService {
    private events: SeasonalEventDef[] = [];

    constructor() {
        this.loadEvents();
    }

    private loadEvents(): void {
        try {
            const dataPath = join(__dirname, '../../data/campaign/seasonal-events.json');
            const raw = readFileSync(dataPath, 'utf-8');
            const data = JSON.parse(raw) as { events: SeasonalEventDef[] };
            this.events = data.events;
            console.log(`[SeasonalEventService] Loaded ${this.events.length} seasonal events`);
        } catch (error) {
            console.error('[SeasonalEventService] Failed to load seasonal events:', error);
        }
    }

    /**
     * Get active events for a country right now.
     * Uses Europe/Berlin timezone for date calculations.
     */
    getActiveEvents(countryId: string): ActiveSeasonalEvent[] {
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
        const month = now.getMonth() + 1;
        const day = now.getDate();

        const results: ActiveSeasonalEvent[] = [];

        for (const event of this.events) {
            // Check date range (handles year wraparound like Dec 31 - Jan 1)
            const inRange = this.isDateInRange(
                month, day,
                event.startMonth, event.startDay,
                event.endMonth, event.endDay
            );
            if (!inRange) continue;

            // Check country participation
            const scale = event.countries[countryId];
            if (scale === undefined) continue;

            results.push({ event, scale });
        }

        return results;
    }

    /**
     * Get event scale for a country ('full' or 'partial').
     */
    getEventScale(event: SeasonalEventDef, countryId: string): 'full' | 'partial' | null {
        return event.countries[countryId] ?? null;
    }

    /**
     * Get all known events (for admin/debug).
     */
    getAllEvents(): SeasonalEventDef[] {
        return [...this.events];
    }

    /**
     * Check if a date falls within a range, handling year wraparound.
     * Example: Dec 15 - Jan 5 wraps around the year boundary.
     */
    private isDateInRange(
        month: number, day: number,
        sm: number, sd: number,
        em: number, ed: number
    ): boolean {
        const current = month * 100 + day;
        const start = sm * 100 + sd;
        const end = em * 100 + ed;

        if (start <= end) {
            // Normal range (e.g., Mar 17 - Mar 17, or Dec 1 - Dec 25)
            return current >= start && current <= end;
        }
        // Wraparound range (e.g., Dec 15 - Jan 5)
        return current >= start || current <= end;
    }
}
