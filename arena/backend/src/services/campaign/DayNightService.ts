import type { TimeOfDay, DayNightState } from '../../types/campaign.js';

/**
 * Day/Night Cycle Service
 *
 * Uses real Berlin timezone (Europe/Berlin) — game clock mirrors real time.
 * Sunrise/sunset calculated per in-game location using approximate latitude.
 *
 * Rules:
 * - Day: all NPCs accessible, markets open, bright tile palettes
 * - Night: some NPCs unavailable, night-specific NPCs appear, enemy spawns increase
 * - Dawn/dusk: atmospheric lighting shift, golden hour tile tint
 * - Boss zones are always daytime (never block progression behind time-gating)
 */
export class DayNightService {
    // Country latitudes for sunrise/sunset calculation (approximate)
    private static COUNTRY_LATITUDES: Record<string, number> = {
        germany: 53.2,       // Luneburg
        singapore: 1.3,
        philippines: 14.6,
        new_zealand: -41.3,
        ireland: 53.3,
        south_africa: -33.9,
        nigeria: 9.1,
        jamaica: 18.1,
        canada: 45.4,
        scotland: 55.9,
        wales: 51.5,
        england: 51.5,
        australia: -33.9,
        usa: 40.7,
    };

    // Day-only NPCs (shops, services)
    private static DAY_ONLY_NPCS = new Set([
        'mehmet', 'rosa', 'borla', 'enzo', 'lea', 'klaus',
    ]);

    // Night-only NPCs
    private static NIGHT_ONLY_NPCS = new Set([
        'night_watchman', 'owl_scholar',
    ]);

    /**
     * Get current day/night state for a country.
     * Uses Europe/Berlin timezone for all calculations.
     */
    static getState(countryId: string): DayNightState {
        const now = new Date();
        // Convert to Europe/Berlin timezone
        const berlinTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
        const hour = berlinTime.getHours();
        const minute = berlinTime.getMinutes();

        const latitude = this.COUNTRY_LATITUDES[countryId] ?? 50;
        const { sunrise, sunset } = this.calculateSunTimes(latitude, berlinTime);

        const sunAngle = ((hour * 60 + minute) / 1440) * 360;

        let timeOfDay: TimeOfDay;
        let lightLevel: number;
        let tintColor: string;

        const currentMinutes = hour * 60 + minute;
        const sunriseMin = sunrise * 60;
        const sunsetMin = sunset * 60;
        const dawnStart = sunriseMin - 45;
        const dawnEnd = sunriseMin + 30;
        const duskStart = sunsetMin - 30;
        const duskEnd = sunsetMin + 45;

        if (currentMinutes >= dawnStart && currentMinutes < dawnEnd) {
            timeOfDay = 'dawn';
            lightLevel = (currentMinutes - dawnStart) / (dawnEnd - dawnStart);
            tintColor = '#FFD700'; // golden
        } else if (currentMinutes >= dawnEnd && currentMinutes < duskStart) {
            timeOfDay = 'day';
            lightLevel = 1.0;
            tintColor = '#FFFFFF';
        } else if (currentMinutes >= duskStart && currentMinutes < duskEnd) {
            timeOfDay = 'dusk';
            lightLevel = 1.0 - (currentMinutes - duskStart) / (duskEnd - duskStart);
            tintColor = '#FF8C00'; // dark orange
        } else {
            timeOfDay = 'night';
            lightLevel = 0.15;
            tintColor = '#1a1a3e'; // deep blue
        }

        return { timeOfDay, sunAngle, lightLevel, tintColor, hour, minute };
    }

    /**
     * Simple sunrise/sunset approximation by latitude and day-of-year.
     * Returns hours from midnight (e.g., sunrise=6.5 means 6:30 AM).
     * Clamped to reasonable bounds (4-10 sunrise, 16-22 sunset).
     */
    private static calculateSunTimes(latitude: number, date: Date): { sunrise: number; sunset: number } {
        const dayOfYear = Math.floor(
            (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
        );
        const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
        const latRad = (latitude * Math.PI) / 180;
        const declRad = (declination * Math.PI) / 180;

        let hourAngle = Math.acos(-Math.tan(latRad) * Math.tan(declRad));
        // Clamp for polar regions (midnight sun / polar night)
        if (isNaN(hourAngle)) hourAngle = latitude > 0 ? Math.PI : 0;

        const hours = (hourAngle * 180) / (15 * Math.PI);
        const sunrise = 12 - hours;
        const sunset = 12 + hours;

        return {
            sunrise: Math.max(4, Math.min(10, sunrise)),
            sunset: Math.max(16, Math.min(22, sunset)),
        };
    }

    /**
     * Whether a specific NPC is available at this time of day.
     * Night-only NPCs appear only at night.
     * Day-only NPCs (shops/services) are available during dawn, day, and dusk.
     * All other NPCs are always available.
     */
    static isNPCAvailable(npcId: string, timeOfDay: TimeOfDay): boolean {
        if (this.NIGHT_ONLY_NPCS.has(npcId)) {
            return timeOfDay === 'night';
        }

        if (this.DAY_ONLY_NPCS.has(npcId)) {
            return timeOfDay === 'day' || timeOfDay === 'dawn' || timeOfDay === 'dusk';
        }

        // Always available
        return true;
    }

    /**
     * Enemy spawn multiplier based on time of day.
     * Night doubles spawns, dusk 1.5x, dawn 1.2x.
     */
    static getEnemySpawnMultiplier(timeOfDay: TimeOfDay): number {
        switch (timeOfDay) {
            case 'night': return 2.0;
            case 'dusk': return 1.5;
            case 'dawn': return 1.2;
            case 'day': return 1.0;
        }
    }

    /**
     * Whether this is a boss zone (always daytime — never block progression).
     */
    static isBossZone(mapId: string): boolean {
        return mapId.startsWith('boss_');
    }
}
