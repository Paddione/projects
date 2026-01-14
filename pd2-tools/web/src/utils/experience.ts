/**
 * Experience requirements for levels 80-99
 */
export const LEVEL_EXPERIENCE_TABLE: Record<number, number> = {
  80: 681027665,
  81: 742730244,
  82: 809986056,
  83: 883294891,
  84: 963201521,
  85: 1050299747,
  86: 1145236814,
  87: 1248718217,
  88: 1361512946,
  89: 1484459201,
  90: 1618470619,
  91: 1764543065,
  92: 1923762030,
  93: 2097310703,
  94: 2286478756,
  95: 2492671933,
  96: 2717422497,
  97: 2962400612,
  98: 3229426756,
  99: 3520485254,
};

/**
 * Calculates the percentage progress to the next level
 * @param level Current character level
 * @param experience Current character experience
 * @returns Percentage (0-100) or null if level 99 or invalid
 */
export function calculatePercentToNextLevel(
  level: number,
  experience: number
): number | null {
  // Level 99 is max level
  if (level >= 99) {
    return null;
  }

  // Level must be in our table (80-98)
  if (level < 80 || level > 98) {
    return null;
  }

  const currentLevelExp = LEVEL_EXPERIENCE_TABLE[level];
  const nextLevelExp = LEVEL_EXPERIENCE_TABLE[level + 1];

  // Sanity check
  if (!currentLevelExp || !nextLevelExp) {
    return null;
  }

  // Calculate progress
  const expIntoLevel = experience - currentLevelExp;
  const expNeededForLevel = nextLevelExp - currentLevelExp;

  // Avoid division by zero
  if (expNeededForLevel === 0) {
    return null;
  }

  const percent = (expIntoLevel / expNeededForLevel) * 100;

  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, percent));
}

/**
 * Formats experience number with comma separators
 * @param exp Experience value
 * @returns Formatted string (e.g., "1,234,567")
 */
export function formatExperience(exp: number): string {
  return exp.toLocaleString();
}
