// ============================================================================
// Power-Up Effect Definitions
// ============================================================================

export interface PowerUpData {
    bonusArmor: number;
    speedMultiplier: number;
    damageMultiplier: number;
    healOnKill: number;     // fraction (0.15 = 15% of max HP)
    lootMultiplier: number;
    furyEndsAt: number;     // timestamp when fury bonus expires (0 if not active)
}

export const DEFAULT_POWER_UP_DATA: PowerUpData = {
    bonusArmor: 0,
    speedMultiplier: 1,
    damageMultiplier: 1,
    healOnKill: 0,
    lootMultiplier: 1,
    furyEndsAt: 0,
};

export const POWER_UP_EFFECTS: Record<string, Partial<PowerUpData>> = {
    power_shield:   { bonusArmor: 25 },
    power_haste:    { speedMultiplier: 1.1 },
    power_vampiric: { healOnKill: 0.15 },
    power_lucky:    { lootMultiplier: 1.5 },
    power_fury:     { damageMultiplier: 1.15 },
};

/**
 * Build a PowerUpData object for a given power-up ID.
 * Returns null if the ID is unknown or null.
 */
export function buildPowerUpData(powerUpId: string | null | undefined): PowerUpData | null {
    if (!powerUpId) return null;
    const effects = POWER_UP_EFFECTS[powerUpId];
    if (!effects) return null;
    return { ...DEFAULT_POWER_UP_DATA, ...effects };
}
