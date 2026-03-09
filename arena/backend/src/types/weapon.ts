export type WeaponType = 'pistol' | 'machine_gun' | 'grenade_launcher';

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

export const GRENADE_LAUNCHER_PICKUP: WeaponState = {
    type: 'grenade_launcher',
    totalAmmo: 6,
    clipAmmo: 3,
    clipSize: 3,
    isReloading: false,
    reloadStartTime: null,
};

export const WEAPON_STATS: Record<WeaponType, { cooldownMs: number; damage: number; spreadRad: number }> = {
    pistol:             { cooldownMs: 400, damage: 1, spreadRad: 0 },
    machine_gun:        { cooldownMs: 100, damage: 1, spreadRad: 5 * (Math.PI / 180) },
    grenade_launcher:   { cooldownMs: 1200, damage: 3, spreadRad: 0 },
};

export const RELOAD_DURATION_MS = 2000;
