// Game modes
export const GAME_MODES = {
  SOFTCORE: "softcore",
  HARDCORE: "hardcore",
} as const;

export type GameMode = (typeof GAME_MODES)[keyof typeof GAME_MODES];

// Time ranges for statistics
export type TimeRange = "1d" | "7d" | "14d" | "1mo" | "3mo" | "all";

// Character page views
export type PlayerToggle = "player" | "merc";
export type SkillsView = "tree" | "text";

// Table sorting
export type SortOrder = "asc" | "desc";
export type SortField = "name" | "price" | "last7d" | "listed";
