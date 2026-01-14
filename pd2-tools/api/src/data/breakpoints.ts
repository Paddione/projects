/**
 * Breakpoint data for all character classes in Project Diablo 2
 *
 * Breakpoints are specific IAS/FCR/FHR values where attack/cast/recovery animations
 * become noticeably faster by reducing the number of frames required.
 *
 * Note: These are baseline breakpoints and may vary slightly by weapon/form in PD2.
 * Always verify with current PD2 breakpoint calculators for exact values.
 */

export interface Breakpoint {
  value: number;    // The stat value (IAS/FCR/FHR percentage)
  frames: number;   // Animation frames at this breakpoint
}

export interface ClassBreakpoints {
  ias: Breakpoint[];      // Increased Attack Speed
  fcr: Breakpoint[];      // Faster Cast Rate
  fhr: Breakpoint[];      // Faster Hit Recovery
  fbr?: Breakpoint[];     // Faster Block Rate (for classes that block frequently)
}

export interface ResistanceThresholds {
  minimum: number;    // Absolute minimum for survival
  recommended: number; // Recommended for most content
  maximum: number;    // Hard cap
}

export const RESISTANCE_THRESHOLDS: ResistanceThresholds = {
  minimum: 50,
  recommended: 75,
  maximum: 75, // Standard cap (some builds can exceed with +max res gear)
};

/**
 * Breakpoint tables by class
 * Note: IAS breakpoints vary significantly by weapon type.
 * These represent common baseline values.
 */
export const CLASS_BREAKPOINTS: Record<string, ClassBreakpoints> = {
  Amazon: {
    // Bowazon typical breakpoints
    ias: [
      { value: 0, frames: 19 },
      { value: 7, frames: 18 },
      { value: 14, frames: 17 },
      { value: 22, frames: 16 },
      { value: 32, frames: 15 },
      { value: 48, frames: 14 },
      { value: 68, frames: 13 },
      { value: 99, frames: 12 },
      { value: 152, frames: 11 },
    ],
    fcr: [
      { value: 0, frames: 19 },
      { value: 7, frames: 18 },
      { value: 14, frames: 17 },
      { value: 22, frames: 16 },
      { value: 32, frames: 15 },
      { value: 48, frames: 14 },
      { value: 68, frames: 13 },
      { value: 102, frames: 12 },
      { value: 174, frames: 11 },
    ],
    fhr: [
      { value: 0, frames: 11 },
      { value: 6, frames: 10 },
      { value: 13, frames: 9 },
      { value: 20, frames: 8 },
      { value: 32, frames: 7 },
      { value: 52, frames: 6 },
      { value: 86, frames: 5 },
      { value: 174, frames: 4 },
      { value: 600, frames: 3 },
    ],
    fbr: [
      { value: 0, frames: 5 },
      { value: 13, frames: 4 },
      { value: 32, frames: 3 },
      { value: 86, frames: 2 },
      { value: 600, frames: 1 },
    ],
  },

  Sorceress: {
    ias: [
      { value: 0, frames: 18 },
      { value: 9, frames: 17 },
      { value: 20, frames: 16 },
      { value: 37, frames: 15 },
      { value: 63, frames: 14 },
      { value: 105, frames: 13 },
      { value: 200, frames: 12 },
    ],
    fcr: [
      { value: 0, frames: 13 },
      { value: 9, frames: 12 },
      { value: 20, frames: 11 },
      { value: 37, frames: 10 },
      { value: 63, frames: 9 },
      { value: 105, frames: 8 },
      { value: 200, frames: 7 },
    ],
    fhr: [
      { value: 0, frames: 15 },
      { value: 5, frames: 14 },
      { value: 9, frames: 13 },
      { value: 14, frames: 12 },
      { value: 20, frames: 11 },
      { value: 30, frames: 10 },
      { value: 42, frames: 9 },
      { value: 60, frames: 8 },
      { value: 86, frames: 7 },
      { value: 142, frames: 6 },
      { value: 280, frames: 5 },
      { value: 1480, frames: 4 },
    ],
    fbr: [
      { value: 0, frames: 9 },
      { value: 7, frames: 8 },
      { value: 15, frames: 7 },
      { value: 27, frames: 6 },
      { value: 48, frames: 5 },
      { value: 86, frames: 4 },
      { value: 200, frames: 3 },
      { value: 4680, frames: 2 },
    ],
  },

  Necromancer: {
    ias: [
      { value: 0, frames: 18 },
      { value: 9, frames: 17 },
      { value: 18, frames: 16 },
      { value: 34, frames: 15 },
      { value: 56, frames: 14 },
      { value: 89, frames: 13 },
      { value: 147, frames: 12 },
    ],
    fcr: [
      { value: 0, frames: 15 },
      { value: 9, frames: 14 },
      { value: 18, frames: 13 },
      { value: 30, frames: 12 },
      { value: 48, frames: 11 },
      { value: 75, frames: 10 },
      { value: 125, frames: 9 },
    ],
    fhr: [
      { value: 0, frames: 13 },
      { value: 5, frames: 12 },
      { value: 10, frames: 11 },
      { value: 16, frames: 10 },
      { value: 26, frames: 9 },
      { value: 39, frames: 8 },
      { value: 56, frames: 7 },
      { value: 86, frames: 6 },
      { value: 152, frames: 5 },
      { value: 377, frames: 4 },
    ],
    fbr: [
      { value: 0, frames: 8 },
      { value: 6, frames: 7 },
      { value: 13, frames: 6 },
      { value: 20, frames: 5 },
      { value: 32, frames: 4 },
      { value: 52, frames: 3 },
      { value: 86, frames: 2 },
      { value: 600, frames: 1 },
    ],
  },

  Paladin: {
    ias: [
      { value: 0, frames: 16 },
      { value: 12, frames: 15 },
      { value: 23, frames: 14 },
      { value: 40, frames: 13 },
      { value: 65, frames: 12 },
      { value: 109, frames: 11 },
    ],
    fcr: [
      { value: 0, frames: 15 },
      { value: 9, frames: 14 },
      { value: 18, frames: 13 },
      { value: 30, frames: 12 },
      { value: 48, frames: 11 },
      { value: 75, frames: 10 },
      { value: 125, frames: 9 },
    ],
    fhr: [
      { value: 0, frames: 9 },
      { value: 7, frames: 8 },
      { value: 15, frames: 7 },
      { value: 27, frames: 6 },
      { value: 48, frames: 5 },
      { value: 86, frames: 4 },
      { value: 200, frames: 3 },
    ],
    fbr: [
      { value: 0, frames: 5 },
      { value: 13, frames: 4 },
      { value: 32, frames: 3 },
      { value: 86, frames: 2 },
      { value: 600, frames: 1 },
    ],
  },

  Barbarian: {
    ias: [
      { value: 0, frames: 16 },
      { value: 9, frames: 15 },
      { value: 20, frames: 14 },
      { value: 35, frames: 13 },
      { value: 58, frames: 12 },
      { value: 95, frames: 11 },
      { value: 157, frames: 10 },
    ],
    fcr: [
      { value: 0, frames: 13 },
      { value: 9, frames: 12 },
      { value: 20, frames: 11 },
      { value: 37, frames: 10 },
      { value: 63, frames: 9 },
      { value: 105, frames: 8 },
      { value: 200, frames: 7 },
    ],
    fhr: [
      { value: 0, frames: 9 },
      { value: 7, frames: 8 },
      { value: 15, frames: 7 },
      { value: 27, frames: 6 },
      { value: 48, frames: 5 },
      { value: 86, frames: 4 },
      { value: 200, frames: 3 },
      { value: 4680, frames: 2 },
    ],
    fbr: [
      { value: 0, frames: 7 },
      { value: 9, frames: 6 },
      { value: 20, frames: 5 },
      { value: 42, frames: 4 },
      { value: 86, frames: 3 },
      { value: 280, frames: 2 },
      { value: 4680, frames: 1 },
    ],
  },

  Druid: {
    ias: [
      { value: 0, frames: 16 },
      { value: 10, frames: 15 },
      { value: 24, frames: 14 },
      { value: 40, frames: 13 },
      { value: 58, frames: 12 },
      { value: 80, frames: 11 },
      { value: 109, frames: 10 },
      { value: 147, frames: 9 },
    ],
    fcr: [
      { value: 0, frames: 18 },
      { value: 4, frames: 17 },
      { value: 10, frames: 16 },
      { value: 19, frames: 15 },
      { value: 30, frames: 14 },
      { value: 46, frames: 13 },
      { value: 68, frames: 12 },
      { value: 99, frames: 11 },
      { value: 163, frames: 10 },
    ],
    fhr: [
      { value: 0, frames: 12 },
      { value: 3, frames: 11 },
      { value: 7, frames: 10 },
      { value: 13, frames: 9 },
      { value: 19, frames: 8 },
      { value: 29, frames: 7 },
      { value: 42, frames: 6 },
      { value: 63, frames: 5 },
      { value: 99, frames: 4 },
      { value: 200, frames: 3 },
    ],
    fbr: [
      { value: 0, frames: 11 },
      { value: 6, frames: 10 },
      { value: 13, frames: 9 },
      { value: 20, frames: 8 },
      { value: 32, frames: 7 },
      { value: 52, frames: 6 },
      { value: 86, frames: 5 },
      { value: 174, frames: 4 },
      { value: 600, frames: 3 },
    ],
  },

  Assassin: {
    ias: [
      { value: 0, frames: 16 },
      { value: 8, frames: 15 },
      { value: 16, frames: 14 },
      { value: 27, frames: 13 },
      { value: 42, frames: 12 },
      { value: 65, frames: 11 },
      { value: 102, frames: 10 },
      { value: 174, frames: 9 },
    ],
    fcr: [
      { value: 0, frames: 16 },
      { value: 8, frames: 15 },
      { value: 16, frames: 14 },
      { value: 27, frames: 13 },
      { value: 42, frames: 12 },
      { value: 65, frames: 11 },
      { value: 102, frames: 10 },
      { value: 174, frames: 9 },
    ],
    fhr: [
      { value: 0, frames: 9 },
      { value: 7, frames: 8 },
      { value: 15, frames: 7 },
      { value: 27, frames: 6 },
      { value: 48, frames: 5 },
      { value: 86, frames: 4 },
      { value: 200, frames: 3 },
      { value: 4680, frames: 2 },
    ],
    fbr: [
      { value: 0, frames: 5 },
      { value: 13, frames: 4 },
      { value: 32, frames: 3 },
      { value: 86, frames: 2 },
      { value: 600, frames: 1 },
    ],
  },
};

/**
 * Helper to find the achieved breakpoint tier for a given stat value
 */
export function findBreakpointTier(
  breakpoints: Breakpoint[],
  value: number
): { current: Breakpoint; next: Breakpoint | null; progress: number } {
  let current = breakpoints[0];
  let next: Breakpoint | null = null;

  for (let i = 0; i < breakpoints.length; i++) {
    if (value >= breakpoints[i].value) {
      current = breakpoints[i];
      next = i < breakpoints.length - 1 ? breakpoints[i + 1] : null;
    } else {
      break;
    }
  }

  const progress = next
    ? Math.round(
        ((value - current.value) / (next.value - current.value)) * 100
      )
    : 100;

  return { current, next, progress };
}

/**
 * Stat priorities by class for optimization recommendations
 */
export const STAT_PRIORITIES: Record<
  string,
  { primary: string[]; secondary: string[] }
> = {
  Amazon: {
    primary: ["IAS", "Critical Strike", "Deadly Strike"],
    secondary: ["FHR", "Resistances", "Life"],
  },
  Sorceress: {
    primary: ["FCR", "+Skills", "Resistances"],
    secondary: ["FHR", "Mana", "Magic Find"],
  },
  Necromancer: {
    primary: ["FCR", "+Skills", "+Summon Skills"],
    secondary: ["Resistances", "FHR", "Life"],
  },
  Paladin: {
    primary: ["Resistances", "FHR", "IAS/FCR"],
    secondary: ["Life", "+Skills", "Faster Block Rate"],
  },
  Barbarian: {
    primary: ["IAS", "Life", "Resistances"],
    secondary: ["FHR", "Damage", "Find Item"],
  },
  Druid: {
    primary: ["FCR", "+Skills", "Resistances"],
    secondary: ["FHR", "Life/Mana", "Summon Damage"],
  },
  Assassin: {
    primary: ["IAS", "Resistances", "Life"],
    secondary: ["FHR", "+Skills", "Block"],
  },
};
