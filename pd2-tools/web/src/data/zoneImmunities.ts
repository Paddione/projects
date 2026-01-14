export type ImmunityType =
  | "Physical"
  | "Magic"
  | "Fire"
  | "Lightning"
  | "Cold"
  | "Poison";

export interface ZoneImmunity {
  subZone: string;
  immunities: ImmunityType[];
}

export const IMMUNITY_COLORS: Record<ImmunityType, string> = {
  Fire: "#FF8000",
  Cold: "#96C8FF",
  Lightning: "#FFF000",
  Poison: "#84FC00",
  Physical: "#C7C7C7",
  Magic: "#C896FF",
};

export const zoneImmunities: Record<string, ZoneImmunity[]> = {
  "Blood Moor and Den of Evil": [
    { subZone: "Blood Moor", immunities: ["Cold", "Fire"] },
    { subZone: "Den of Evil", immunities: ["Cold", "Fire", "Poison"] },
  ],
  "Cold Plains and the Cave": [
    { subZone: "Cold Plains", immunities: ["Fire", "Lightning", "Poison"] },
    { subZone: "Cave Level 1", immunities: ["Cold", "Fire", "Lightning"] },
    { subZone: "Cave Level 2", immunities: ["Cold", "Fire", "Lightning"] },
  ],
  "Stony Field and Tristram": [
    {
      subZone: "Stony Field",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
    { subZone: "Tristram", immunities: ["Cold", "Fire", "Poison"] },
  ],
  "Dark Wood and the Underground Passage": [
    { subZone: "Dark Wood", immunities: ["Fire", "Lightning", "Poison"] },
    {
      subZone: "Underground Passage Level 1",
      immunities: ["Cold", "Fire", "Poison"],
    },
    {
      subZone: "Underground Passage Level 2",
      immunities: ["Cold", "Fire", "Poison"],
    },
  ],
  "Black Marsh and the Hole": [
    { subZone: "Black Marsh", immunities: ["Cold", "Fire", "Poison"] },
    { subZone: "Hole Level 1", immunities: ["Cold", "Fire", "Poison"] },
    { subZone: "Hole Level 2", immunities: ["Cold", "Fire", "Poison"] },
  ],
  "Tamoe Highland and the Pit": [
    { subZone: "Tamoe Highland", immunities: ["Fire", "Lightning", "Poison"] },
    {
      subZone: "Pit Level 1",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
    {
      subZone: "Pit Level 2",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
  ],
  "Burial Ground and Mausoleum": [
    { subZone: "Burial Grounds", immunities: ["Cold", "Lightning"] },
    { subZone: "Crypt", immunities: ["Cold", "Lightning"] },
    { subZone: "Mausoleum", immunities: ["Cold", "Lightning"] },
  ],
  "Forgotten Tower": [
    { subZone: "Tower Cellar Level 1", immunities: ["Fire", "Lightning"] },
    { subZone: "Tower Cellar Level 2", immunities: ["Fire", "Lightning"] },
    { subZone: "Tower Cellar Level 3", immunities: ["Fire", "Lightning"] },
    { subZone: "Tower Cellar Level 4", immunities: ["Fire", "Lightning"] },
    {
      subZone: "Tower Cellar Level 5",
      immunities: ["Fire", "Lightning", "Poison"],
    },
  ],
  "Outer Cloister and Barracks": [
    { subZone: "Monastery Gate", immunities: ["Cold", "Lightning", "Poison"] },
    { subZone: "Outer Cloister", immunities: ["Fire", "Poison"] },
    { subZone: "Barracks", immunities: ["Fire", "Poison"] },
  ],
  "Jail, Inner Cloister, and Cathedral": [
    { subZone: "Jail Level 1", immunities: ["Fire", "Poison"] },
    { subZone: "Jail Level 2", immunities: ["Cold", "Fire", "Poison"] },
    { subZone: "Jail Level 3", immunities: ["Fire", "Lightning", "Poison"] },
    { subZone: "Inner Cloister", immunities: ["Fire", "Lightning"] },
    { subZone: "Cathedral", immunities: ["Cold", "Fire", "Poison"] },
  ],
  Catacombs: [
    { subZone: "Catacombs Level 1", immunities: ["Cold", "Fire", "Poison"] },
    { subZone: "Catacombs Level 2", immunities: ["Cold", "Fire", "Poison"] },
    { subZone: "Catacombs Level 3", immunities: ["Cold", "Fire", "Poison"] },
    { subZone: "Catacombs Level 4", immunities: ["Cold", "Fire"] },
  ],
  "Cow Level": [{ subZone: "Secret Cow Level", immunities: ["Lightning"] }],
  // Act 2 zones
  "Rocky Waste and the Stony Tomb": [
    {
      subZone: "Rocky Waste",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
    { subZone: "Stony Tomb Level 1", immunities: ["Cold", "Lightning"] },
    {
      subZone: "Stony Tomb Level 2",
      immunities: ["Cold", "Lightning", "Poison"],
    },
  ],
  "Dry Hills and the Halls of the Dead": [
    { subZone: "Dry Hills", immunities: ["Cold", "Fire", "Lightning"] },
    {
      subZone: "Halls of the Dead Level 1",
      immunities: ["Cold", "Fire", "Poison"],
    },
    {
      subZone: "Halls of the Dead Level 2",
      immunities: ["Cold", "Fire", "Poison"],
    },
    {
      subZone: "Halls of the Dead Level 3",
      immunities: ["Cold", "Fire", "Poison"],
    },
  ],
  "Far Oasis and the Maggot Lair": [
    { subZone: "Far Oasis", immunities: ["Cold", "Lightning", "Poison"] },
    { subZone: "Maggot Lair Level 1", immunities: ["Cold", "Lightning"] },
    { subZone: "Maggot Lair Level 2", immunities: ["Cold", "Lightning"] },
    {
      subZone: "Maggot Lair Level 3",
      immunities: ["Cold", "Lightning", "Poison"],
    },
  ],
  "Lost City, Ancient Tunnels, and Claw Viper Temple": [
    {
      subZone: "Lost City",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
    { subZone: "Ancient Tunnels", immunities: ["Cold", "Fire", "Lightning"] },
    { subZone: "Claw Viper Temple Level 1", immunities: ["Cold", "Fire"] },
    { subZone: "Claw Viper Temple Level 2", immunities: ["Cold", "Fire"] },
  ],
  "Canyon of the Magi and Tal Rasha's Tomb": [
    {
      subZone: "Canyon of the Magi",
      immunities: ["Cold", "Lightning", "Poison"],
    },
    { subZone: "Tal Rasha's Tomb", immunities: ["Cold", "Fire", "Poison"] },
  ],
  "Lut Gholein Sewers and the Palace Cellars": [
    { subZone: "Sewers Level 1", immunities: ["Fire", "Lightning", "Poison"] },
    { subZone: "Sewers Level 2", immunities: ["Fire", "Lightning", "Poison"] },
    { subZone: "Sewers Level 3", immunities: ["Cold", "Fire", "Poison"] },
    { subZone: "Harem Level 2", immunities: ["Cold", "Fire", "Lightning"] },
    {
      subZone: "Palace Cellar Level 1",
      immunities: ["Cold", "Fire", "Lightning"],
    },
    {
      subZone: "Palace Cellar Level 2",
      immunities: ["Cold", "Fire", "Lightning"],
    },
    {
      subZone: "Palace Cellar Level 3",
      immunities: ["Cold", "Fire", "Lightning"],
    },
  ],
  "Arcane Sanctuary": [
    { subZone: "Arcane Sanctuary", immunities: ["Cold", "Fire", "Lightning"] },
  ],
  // Act 3 zones
  "Spider Forest, Arachnid Lair, and Spider Cavern": [
    { subZone: "Spider Forest", immunities: ["Cold", "Fire"] },
    { subZone: "Arachnid Lair", immunities: ["Cold", "Fire", "Lightning"] },
    { subZone: "Spider Cavern", immunities: ["Cold", "Fire", "Lightning"] },
  ],
  "Great Marsh and the Swampy Pit": [
    { subZone: "Great Marsh", immunities: ["Cold", "Fire", "Lightning"] },
    {
      subZone: "Swampy Pit Level 1",
      immunities: ["Cold", "Lightning", "Poison"],
    },
    {
      subZone: "Swampy Pit Level 2",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
    { subZone: "Swampy Pit Level 3", immunities: ["Lightning", "Poison"] },
  ],
  "Flayer Jungle and the Flayer Dungeon": [
    { subZone: "Flayer Jungle", immunities: ["Cold", "Fire", "Lightning"] },
    {
      subZone: "Flayer Dungeon Level 1",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
    {
      subZone: "Flayer Dungeon Level 2",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
    {
      subZone: "Flayer Dungeon Level 3",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
  ],
  "Lower Kurast and the Kurast Sewers": [
    { subZone: "Lower Kurast", immunities: ["Cold", "Fire", "Lightning"] },
    {
      subZone: "Kurast Sewers Level 1",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
    {
      subZone: "Kurast Sewers Level 2",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
  ],
  "Kurast Bazaar, Ruined Temple, and Disused Fane": [
    { subZone: "Kurast Bazaar", immunities: ["Cold", "Fire"] },
    { subZone: "Ruined Temple", immunities: ["Cold", "Fire", "Poison"] },
    { subZone: "Disused Fane", immunities: ["Cold", "Fire", "Poison"] },
  ],
  "Upper Kurast, the Forgotten Reliquary, and Forgotten Temple": [
    { subZone: "Upper Kurast", immunities: ["Cold", "Lightning"] },
    { subZone: "Forgotten Reliquary", immunities: ["Cold", "Fire", "Poison"] },
    { subZone: "Forgotten Temple", immunities: ["Cold", "Lightning"] },
  ],
  "Travincal, the Ruined Fane, and Disused Reliquary": [
    { subZone: "Travincal", immunities: ["Cold", "Fire", "Lightning"] },
    { subZone: "Ruined Fane", immunities: ["Cold", "Lightning"] },
    { subZone: "Disused Reliquary", immunities: ["Cold", "Lightning"] },
  ],
  "Durance of Hate": [
    {
      subZone: "Durance of Hate Level 1",
      immunities: ["Cold", "Lightning", "Poison"],
    },
    {
      subZone: "Durance of Hate Level 2",
      immunities: ["Cold", "Lightning", "Poison"],
    },
    {
      subZone: "Durance of Hate Level 3",
      immunities: ["Cold", "Fire", "Lightning"],
    },
  ],
  // Act 4 zones
  "Outer Steppes and the Plains of Despair": [
    { subZone: "Outer Steppes", immunities: ["Fire", "Lightning", "Poison"] },
    {
      subZone: "Plains of Despair",
      immunities: ["Fire", "Lightning", "Poison"],
    },
  ],
  "City of the Damned and the River of Flame": [
    {
      subZone: "City of the Damned",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
    {
      subZone: "River of Flame",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
  ],
  "Chaos Sanctuary": [
    { subZone: "Chaos Sanctuary", immunities: ["Cold", "Fire", "Lightning"] },
  ],
  // Act 5 zones
  "Bloody Foothills and the Frigid Highlands": [
    {
      subZone: "Bloody Foothills",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
    {
      subZone: "Frigid Highlands",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
  ],
  "Arreat Plateau, Crystalline Passage, and Frozen River": [
    {
      subZone: "Arreat Plateau",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
    {
      subZone: "Crystalline Passage",
      immunities: ["Cold", "Fire", "Lightning"],
    },
    { subZone: "Frozen River", immunities: ["Cold", "Lightning"] },
  ],
  "Glacial Trail, Drifter Cavern, and Frozen Tundra": [
    {
      subZone: "Glacial Trail",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
    { subZone: "Drifter Cavern", immunities: ["Cold", "Fire", "Lightning"] },
    {
      subZone: "Frozen Tundra",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
  ],
  "Ancients' Way and the Icy Cellar": [
    { subZone: "Ancients' Way", immunities: ["Cold", "Lightning"] },
    {
      subZone: "Icy Cellar",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
  ],
  "Nihlathak's Temple": [
    { subZone: "Nihlathak's Temple", immunities: ["Cold"] },
  ],
  "Abaddon, the Pit of Acheron, and the Infernal Pit": [
    { subZone: "Abaddon", immunities: ["Cold", "Fire", "Lightning"] },
    {
      subZone: "Pit of Acheron",
      immunities: ["Cold", "Fire", "Lightning", "Poison"],
    },
    { subZone: "Infernal Pit", immunities: ["Cold", "Fire", "Lightning"] },
  ],
  "Worldstone Keep and Throne of Destruction": [
    {
      subZone: "Worldstone Keep Level 1",
      immunities: ["Cold", "Fire", "Lightning"],
    },
    {
      subZone: "Worldstone Keep Level 2",
      immunities: ["Cold", "Fire", "Lightning"],
    },
    {
      subZone: "Worldstone Keep Level 3",
      immunities: ["Cold", "Fire", "Lightning"],
    },
    {
      subZone: "Throne of Destruction",
      immunities: ["Cold", "Fire", "Lightning"],
    },
  ],
};
