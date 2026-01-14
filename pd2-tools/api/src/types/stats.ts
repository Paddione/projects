export interface CharStats {
  //Resists
  fireRes: number;
  maxFireRes: number;
  coldRes: number;
  maxColdRes: number;
  lightningRes: number;
  maxLightningRes: number;
  poisonRes: number;
  maxPoisonRes: number;

  //Stats
  strength: number;
  dexterity: number;
  vitality: number;
  energy: number;

  //Misc
  fcr: number;
  ias: number;
  mf: number;
  gf: number;
  frw: number;
  pdr: number;
  fhr: number;

  lAbsorbPct: number;
  lAbsorbFlat: number;

  cAbsorbPct: number;
  cAbsorbFlat: number;

  fAbsorbPct: number;
  fAbsorbFlat: number;
}
