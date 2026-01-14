export interface PD2APIParams {
  jwt?: string;
}

export type CharacterApiResponse = {
  character?: {
    name?: string;
    level?: number;
    status?: {
      is_ladder?: boolean;
      is_hardcore?: boolean;
    };
  };
  lastUpdated?: number;
  realSkills?: unknown[];
  [key: string]: unknown;
};
