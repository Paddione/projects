// Shared TypeScript types and interfaces

export interface CosmeticSlotConfig {
  perk_id: number;
  perk_name?: string;
  configuration: Record<string, unknown>;
}

export interface CosmeticEffects {
  helper?: CosmeticSlotConfig;
  display?: CosmeticSlotConfig;
  emote?: CosmeticSlotConfig;
  multiplier?: CosmeticSlotConfig;
}

export interface Player {
  id: string;
  username: string;
  character: string;
  characterLevel?: number;
  isReady: boolean;
  isHost: boolean;
  score: number;
  multiplier: number;
  correctAnswers: number;
  currentStreak: number; // Track consecutive correct answers for streak sounds
  isConnected: boolean;
  title?: string;
  badge?: string;
  cosmeticEffects?: CosmeticEffects;
}

export interface Lobby {
  id: number;
  code: string;
  hostId: string;
  status: 'waiting' | 'starting' | 'playing' | 'ended';
  players: Player[];
  questionCount: number;
  currentQuestion: number;
  settings: {
    questionSetIds: number[];
    timeLimit: number;
    allowReplay: boolean;
  };
}

export interface Answer {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: number;
  questionText: string;
  answers: Answer[];
  explanation?: string;
  difficulty: number;
}

export interface QuestionSet {
  id: number;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  is_active: boolean;
  is_public?: boolean;
  is_featured?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
  owner_id?: number;
  created_at?: string;
  updated_at?: string;
  questions?: Question[];
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: string[];
}

export interface CreateLobbyRequest {
  questionCount: number;
  questionSetIds?: number[];
  timeLimit?: number;
  settings?: {
    timeLimit?: number;
    allowReplay?: boolean;
    [key: string]: unknown;
  };
}

export interface JoinLobbyRequest {
  lobbyCode: string;
}

export interface AuthRequest {
  username: string;
  email?: string;
  password: string;
  selectedCharacter?: string;
}

export interface Character {
  id: string;
  name: string;
  emoji: string;
  description: string;
  unlockLevel: number;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  characterInfo: {
    character: string;
    level: number;
    experience: number;
    progress: {
      currentLevel: number;
      progress: number;
      expInLevel: number;
      expForNextLevel: number;
    };
    availableCharacters: Character[];
  };
}

export interface LobbyResponse {
  id: number;
  code: string;
  host_id: number;
  status: string;
  question_count: number;
  created_at: string;
  updated_at: string;
  players: Array<{
    id: string;
    username: string;
    character: string;
    characterLevel: number;
    isReady: boolean;
    isHost: boolean;
    score: number;
    multiplier: number;
    correctAnswers: number;
    isConnected: boolean;
    joinedAt: string;
  }>;
  settings: {
    questionSetIds: number[];
    timeLimit: number;
    allowReplay: boolean;
  };
}

export interface LobbyListResponse {
  lobbies: LobbyResponse[];
}

export interface MockLobby {
  code: string;
  players: Array<{
    id: string;
    username: string;
    isHost: boolean;
    isReady: boolean;
  }>;
  status: string;
}

export interface QuestionData {
  question_text: string;
  answers: string[];
  explanation: string;
}

export interface QuestionSetData {
  questionSet: {
    id: number;
    name: string;
    description: string;
    category: string;
    difficulty: string;
    is_active: boolean;
    is_public?: boolean;
    is_featured?: boolean;
    tags?: string[];
    metadata?: Record<string, unknown>;
    owner_id?: number;
    created_at?: string;
    updated_at?: string;
  };
  questions: QuestionData[];
}

export interface AuthData {
  user: {
    id: string;
    username: string;
    email: string;
    selectedCharacter: string;
    characterLevel: number;
    isAdmin: boolean;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface MockDraftPerk {
  id: number;
  name: string;
  description: string;
  category: string;
  tier: number;
  effect_type: string;
  effect_config: Record<string, any>;
}

export interface MockDraftOffer {
  level: number;
  perks: MockDraftPerk[];
  drafted: boolean;
  dumped: boolean;
  chosenPerkId?: number;
}

export interface MockDraftRecord {
  level: number;
  offeredPerkIds: number[];
  chosenPerkId: number | null;
  dumped: boolean;
  draftedAt: string;
}

export interface MockData {
  users: any[];
  lobbies: Record<string, MockLobby>;
  characters: Character[];
  questionSets: QuestionSetData[];
  questions: QuestionData[];
  gameplayPerks?: MockDraftPerk[];
  pendingDrafts?: MockDraftOffer[];
  draftHistory?: MockDraftRecord[];
}

// Additional types for API responses
export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    isAdmin: boolean;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface CharacterProfile {
  character: Character;
  level: number;
  experience: number;
  progress: {
    currentLevel: number;
    progress: number;
    expInLevel: number;
    expForNextLevel: number;
  };
  availableCharacters: Character[];
}

export interface LobbyData {
  id: number;
  code: string;
  hostId: string;
  status: string;
  players: Player[];
  questionCount: number;
  settings: {
    questionSetIds: number[];
    timeLimit: number;
    allowReplay: boolean;
  };
}

export interface FileMetadata {
  source: string;
  type: string;
  subject?: string;
  title?: string;
  author?: string;
  uploadedAt: string;
}

export interface MockQuestion {
  id: number;
  question_set_id: number;
  question_text: string | { en?: string; de?: string };
  answers: string[];
  explanation?: string;
  difficulty: number;
  created_at: string;
  updated_at: string;
}

// German-only question types (to replace LocalizedText)
export type QuestionText = string;
export type QuestionAnswers = string[];
export type QuestionExplanation = string;
