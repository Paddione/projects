export interface PlayerStats {
  online: number;
  in_game: number;
}

export interface LeaderboardSpot {
  name: string;
  rank: number;
  class: string;
  level: number;
  experience: number;
  dead?: boolean;
}

export interface ILadderInfo {
  name: string;
  rank: number;
  class: string;
  level: number;
  experience: number;
  dead: boolean;
}

export interface Leaderboard {
  softcore: {
    overall: LeaderboardSpot[];
    amazon: LeaderboardSpot[];
    sorceress: LeaderboardSpot[];
    necromancer: LeaderboardSpot[];
    paladin: LeaderboardSpot[];
    barbarian: LeaderboardSpot[];
    druid: LeaderboardSpot[];
    assassin: LeaderboardSpot[];
  };
  hardcore: {
    overall: LeaderboardSpot[];
    amazon: LeaderboardSpot[];
    sorceress: LeaderboardSpot[];
    necromancer: LeaderboardSpot[];
    paladin: LeaderboardSpot[];
    barbarian: LeaderboardSpot[];
    druid: LeaderboardSpot[];
    assassin: LeaderboardSpot[];
  };
}
