export type WeaponType = 'pistol' | 'machine_gun';

export interface WeaponState {
    type: WeaponType;
    totalAmmo: number;
    clipAmmo: number;
    clipSize: number;
    isReloading: boolean;
    reloadStartTime: number | null;
}

export const PISTOL_DEFAULT: WeaponState = {
    type: 'pistol',
    totalAmmo: Infinity,
    clipAmmo: Infinity,
    clipSize: Infinity,
    isReloading: false,
    reloadStartTime: null,
};

export const MACHINE_GUN_PICKUP: WeaponState = {
    type: 'machine_gun',
    totalAmmo: 60,
    clipAmmo: 30,
    clipSize: 30,
    isReloading: false,
    reloadStartTime: null,
};

export const WEAPON_STATS: Record<WeaponType, { cooldownMs: number; damage: number; spreadRad: number }> = {
    pistol:      { cooldownMs: 400, damage: 1, spreadRad: 0 },
    machine_gun: { cooldownMs: 100, damage: 1, spreadRad: 5 * (Math.PI / 180) },
};

export const RELOAD_DURATION_MS = 2000;
