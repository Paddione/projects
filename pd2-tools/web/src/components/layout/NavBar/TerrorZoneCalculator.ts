export default class TerrorZoneCalculator {
  private readonly zones: string[] = [
    "Blood Moor and Den of Evil",
    "Cold Plains and the Cave",
    "Stony Field and Tristram",
    "Dark Wood and the Underground Passage",
    "Black Marsh and the Hole",
    "Tamoe Highland and the Pit",
    "Burial Ground and Mausoleum",
    "Forgotten Tower",
    "Outer Cloister and Barracks",
    "Jail, Inner Cloister, and Cathedral",
    "Catacombs",
    "Cow Level",
    "Rocky Waste and the Stony Tomb",
    "Dry Hills and the Halls of the Dead",
    "Far Oasis and the Maggot Lair",
    "Lost City, Ancient Tunnels, and Claw Viper Temple",
    "Canyon of the Magi and Tal Rasha's Tomb",
    "Lut Gholein Sewers and the Palace Cellars",
    "Arcane Sanctuary",
    "Spider Forest, Arachnid Lair, and Spider Cavern",
    "Great Marsh and the Swampy Pit",
    "Flayer Jungle and the Flayer Dungeon",
    "Lower Kurast and the Kurast Sewers",
    "Kurast Bazaar, Ruined Temple, and Disused Fane",
    "Upper Kurast, the Forgotten Reliquary, and Forgotten Temple",
    "Travincal, the Ruined Fane, and Disused Reliquary",
    "Durance of Hate",
    "Outer Steppes and the Plains of Despair",
    "City of the Damned and the River of Flame",
    "Chaos Sanctuary",
    "Bloody Foothills and the Frigid Highlands",
    "Arreat Plateau, Crystalline Passage, and Frozen River",
    "Glacial Trail, Drifter Cavern, and Frozen Tundra",
    "Ancients' Way and the Icy Cellar",
    "Nihlathak's Temple",
    "Abaddon, the Pit of Acheron, and the Infernal Pit",
    "Worldstone Keep and Throne of Destruction",
  ];

  private readonly fifteenMinutesInMs = 900e3; // 900 * 1000 = 15 minutes
  private readonly dayInMs = 86400000; // 24 * 60 * 60 * 1000

  private readonly prngMultiplier = 214013;
  private readonly prngIncrement = 2531011;
  private readonly prngMask = BigInt(32767);

  constructor() {}

  private getNextPrng(seed: number): number {
    return Number(
      ((BigInt(seed) * BigInt(this.prngMultiplier) +
        BigInt(this.prngIncrement)) >>
        BigInt(16)) &
        this.prngMask
    );
  }

  /**
   * Calculates zone information for a given base timestamp and an offset.
   * @param baseTimestamp The base time in milliseconds, defaults to Date.now().
   * @param offsetIndex The number of 15-minute intervals to offset from the baseTimestamp.
   * @returns An object containing the zone name, its start timestamp (ts), and the seed used.
   */
  private getZoneInfoByTimeOffset(
    baseTimestamp: number = Date.now(),
    offsetIndex: number = 0
  ): { zone: string; ts: number; seed: number } {
    // Round baseTimestamp down to the start of its current 15-minute interval
    let ts =
      Math.floor(baseTimestamp / this.fifteenMinutesInMs) *
      this.fifteenMinutesInMs;
    // Add the offset
    ts += this.fifteenMinutesInMs * offsetIndex;

    const a = Math.floor(ts / this.fifteenMinutesInMs); // Equivalent to ~~(ts / 900000)
    const b = Math.floor(ts / this.dayInMs); // Equivalent to ~~(ts / 86400000)
    const seed = a + b;
    const zoneIndex = this.getNextPrng(seed) % this.zones.length;

    return { zone: this.zones[zoneIndex], ts, seed };
  }

  /**
   * Gets the current terrorized zone.
   * @returns An object with the current zone name, its start timestamp, and seconds until the next zone change.
   */
  public getCurrentZone(): {
    zone: string;
    ts: number;
    secondsUntilNext: number;
  } {
    const now = Date.now();
    const currentZoneInfo = this.getZoneInfoByTimeOffset(now, 0);
    const secondsUntilNext = Math.max(
      0,
      Math.floor((currentZoneInfo.ts + this.fifteenMinutesInMs - now) / 1000)
    );

    return {
      zone: currentZoneInfo.zone,
      ts: currentZoneInfo.ts,
      secondsUntilNext,
    };
  }

  /**
   * Gets the next X terrorized zones.
   * @param count The number of upcoming zones to retrieve.
   * @returns An array of objects, each containing the zone name, its start timestamp, and seconds until it becomes active.
   */
  public getNextXZones(
    count: number
  ): Array<{ zone: string; ts: number; secondsUntilActive: number }> {
    const nextZones: Array<{
      zone: string;
      ts: number;
      secondsUntilActive: number;
    }> = [];
    const now = Date.now();

    for (let i = 1; i <= count; i++) {
      // Start from offset 1 for *next* zones
      const zoneInfo = this.getZoneInfoByTimeOffset(now, i);
      const secondsUntilActive = Math.max(
        0,
        Math.floor((zoneInfo.ts - now) / 1000)
      );
      nextZones.push({
        zone: zoneInfo.zone,
        ts: zoneInfo.ts,
        secondsUntilActive,
      });
    }
    return nextZones;
  }

  /**
   * Gets the time until a specific zone becomes terrorized.
   * It will search up to `zones.length * 2` future 15-minute slots.
   * @param targetZoneName The name of the zone to search for.
   * @returns An object with the zone name, its next start timestamp, and seconds until it becomes active, or null if not found within a reasonable future.
   */
  public getSecondsUntilNextSpecificZone(
    targetZoneName: string
  ): { zone: string; ts: number; secondsUntilActive: number } | null {
    const now = Date.now();
    // Search a reasonable number of future slots.
    // Each zone should appear roughly once every (zones.length * 15) minutes.
    // Searching zones.length * 2 slots should be sufficient to find any zone.
    const maxSearchOffset = this.zones.length * 2;

    for (let i = 0; i <= maxSearchOffset; i++) {
      const zoneInfo = this.getZoneInfoByTimeOffset(now, i);
      if (zoneInfo.zone === targetZoneName) {
        const secondsUntilActive = Math.max(
          0,
          Math.floor((zoneInfo.ts - now) / 1000)
        );
        // If i is 0 and secondsUntilActive is 0, it means the zone is current.
        // If we want strictly the *next* occurrence if it's current, we'd need to start i from 1 or adjust.
        // The current implementation will return the current one if it matches and hasn't passed.
        return {
          zone: zoneInfo.zone,
          ts: zoneInfo.ts,
          secondsUntilActive,
        };
      }
    }
    return null; // Zone not found in the near future
  }
}
