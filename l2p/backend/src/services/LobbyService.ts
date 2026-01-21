import { LobbyRepository, Lobby, CreateLobbyData } from '../repositories/LobbyRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { QuestionService } from './QuestionService.js';
import { GameProfileService } from './GameProfileService.js';

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
  isConnected: boolean;
  joinedAt: Date;
}

export interface CreateLobbyRequest {
  hostId: number;
  username?: string | undefined; // Username from JWT token
  selectedCharacter?: string | undefined; // Character from JWT token
  characterLevel?: number | undefined; // Character level from JWT token
  questionCount?: number | undefined;
  questionSetIds?: number[] | undefined;
  settings?: Record<string, unknown> | undefined;
}

export interface LobbySettings {
  questionSetIds: number[];
  questionCount: number;
  timeLimit: number;
  allowReplay: boolean;
  maxQuestionCount?: number; // Maximum available questions in selected sets
}

export interface JoinLobbyRequest {
  lobbyCode: string;
  player: Omit<Player, 'isHost' | 'score' | 'multiplier' | 'correctAnswers' | 'joinedAt'>;
}

export interface LobbyWithPlayers extends Omit<Lobby, 'players'> {
  players: Player[];
}

export class LobbyService {
  private lobbyRepository: LobbyRepository;
  private userRepository: UserRepository;
  private questionService: QuestionService;
  private gameProfileService: GameProfileService;

  constructor() {
    this.lobbyRepository = new LobbyRepository();
    this.userRepository = new UserRepository();
    this.gameProfileService = new GameProfileService();
    this.questionService = new QuestionService();
  }

  /**
   * Generate a unique 6-character lobby code
   */
  private async generateUniqueCode(): Promise<string> {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
      }

      // Check if code already exists
      const exists = await this.lobbyRepository.codeExists(code);
      if (!exists) {
        return code;
      }

      attempts++;
    }

    throw new Error('Failed to generate unique lobby code after maximum attempts');
  }

  /**
   * Create a new lobby
   * Supports both OAuth users (game profiles) and legacy users
   */
  async createLobby(request: CreateLobbyRequest): Promise<LobbyWithPlayers> {
    let hostUsername = request.username || `user_${request.hostId}`;
    let hostCharacter = request.selectedCharacter || 'student';
    let hostCharacterLevel = request.characterLevel || 1;

    let isLegacyUser = false;

    // If user data wasn't provided in the request (legacy flow), try to fetch it
    if (!request.username) {
      // Try to get game profile first (OAuth users)
      try {
        const profile = await this.gameProfileService.getOrCreateProfile(request.hostId);
        hostCharacter = profile.selectedCharacter;
        hostCharacterLevel = profile.characterLevel;
      } catch (error) {
        // Fall back to legacy user
        const host = await this.userRepository.findUserById(request.hostId);
        if (!host) {
          throw new Error('Host user not found');
        }
        hostUsername = host.username;
        hostCharacter = host.selected_character || 'student';
        hostCharacterLevel = host.character_level;
        isLegacyUser = true;
      }
    } else {
      // If username is provided, we check if it's a legacy user in the database
      // to determine if we should set host_id or auth_user_id
      const host = await this.userRepository.findUserById(request.hostId);
      if (host) {
        isLegacyUser = true;
      }
    }

    // Generate unique code
    const code = await this.generateUniqueCode();

    // Prepare lobby data
    const lobbyData: CreateLobbyData = {
      code,
      // For unified auth/OAuth users, we use auth_user_id.
      // For legacy users that exist in the local users table, we use host_id.
      host_id: isLegacyUser ? request.hostId : null,
      auth_user_id: isLegacyUser ? null : request.hostId,
      question_count: request.questionCount || 10,
      settings: {
        questionSetIds: request.questionSetIds || [],
        timeLimit: 60,
        allowReplay: false,
        ...request.settings
      }
    };

    // Create lobby
    const lobby = await this.lobbyRepository.createLobby(lobbyData);

    // Add host as first player
    const hostPlayer: Player = {
      id: String(request.hostId),
      username: hostUsername,
      character: hostCharacter,
      characterLevel: hostCharacterLevel,
      isReady: false,
      isHost: true,
      score: 0,
      multiplier: 1,
      correctAnswers: 0,
      isConnected: true,
      joinedAt: new Date()
    };

    // Update lobby with host player
    const updatedLobby = await this.lobbyRepository.updateLobby(lobby.id, {
      players: [hostPlayer]
    });

    if (!updatedLobby) {
      throw new Error('Failed to add host to lobby');
    }

    return this.formatLobbyResponse(updatedLobby);
  }

  /**
   * Join an existing lobby
   */
  async joinLobby(request: JoinLobbyRequest): Promise<LobbyWithPlayers> {
    // Find lobby by code
    const lobby = await this.lobbyRepository.findByCode(request.lobbyCode);
    if (!lobby) {
      throw new Error('Lobby not found');
    }

    // Check lobby status
    if (lobby.status !== 'waiting') {
      throw new Error('Cannot join lobby that is not in waiting status');
    }

    // Check if lobby is full (max 8 players)
    const currentPlayers: Player[] = Array.isArray(lobby.players) ? (lobby.players as Player[]) : [];
    if (currentPlayers.length >= 8) {
      throw new Error('Lobby is full');
    }

    // Check if player is already in lobby (extremely robust check)
    const existingPlayer = currentPlayers.find((p) => {
      const pId = String(p.id || '').trim();
      const reqId = String(request.player.id || '').trim();
      const pUsername = String(p.username || '').trim().toLowerCase();
      const reqUsername = String(request.player.username || '').trim().toLowerCase();

      // Match if IDs match AND are not empty, OR if usernames match AND are not empty
      const idMatch = pId !== '' && pId === reqId;
      const nameMatch = pUsername !== '' && pUsername === reqUsername;

      return idMatch || nameMatch;
    });

    if (existingPlayer) {
      // If found, we can optionally update their connection status here
      // but for now we follow the existing pattern of throwing an error 
      // which the SocketService handles gracefully for existing sessions.
      throw new Error('Player already in lobby');
    }

    // Add new player
    const newPlayer: Player = {
      ...request.player,
      isHost: false,
      score: 0,
      multiplier: 1,
      correctAnswers: 0,
      joinedAt: new Date()
    };

    const updatedPlayers = [...currentPlayers, newPlayer];
    const updatedLobby = await this.lobbyRepository.updateLobby(lobby.id, {
      players: updatedPlayers
    });

    if (!updatedLobby) {
      throw new Error('Failed to add player to lobby');
    }

    return this.formatLobbyResponse(updatedLobby);
  }

  /**
   * Leave a lobby
   */
  async leaveLobby(lobbyCode: string, playerId: string): Promise<LobbyWithPlayers | null> {
    const lobby = await this.lobbyRepository.findByCode(lobbyCode);
    if (!lobby) {
      return null;
    }

    const currentPlayers: Player[] = Array.isArray(lobby.players) ? (lobby.players as Player[]) : [];
    const playerToRemove = currentPlayers.find((p) => p.id === playerId);

    if (!playerToRemove) {
      // Tests expect a graceful no-op returning null when player isn't in lobby
      return null;
    }

    // Check if the leaving player is the host (using both host_id and auth_user_id)
    const isHost = lobby.host_id === parseInt(playerId) || lobby.auth_user_id === parseInt(playerId);
    if (isHost) {
      // Host is leaving - delete the entire lobby
      await this.lobbyRepository.deleteLobby(lobby.id);
      return null;
    } else {
      // Regular player is leaving - remove them from the lobby
      const updatedPlayers = currentPlayers.filter((p) => p.id !== playerId);

      const updatedLobby = await this.lobbyRepository.updateLobby(lobby.id, {
        players: updatedPlayers
      });

      if (!updatedLobby) {
        throw new Error('Failed to remove player from lobby');
      }

      return this.formatLobbyResponse(updatedLobby);
    }
  }

  /**
   * Update player ready status
   */
  async updatePlayerReady(lobbyCode: string, playerId: string, isReady: boolean): Promise<LobbyWithPlayers> {
    const lobby = await this.lobbyRepository.findByCode(lobbyCode);
    if (!lobby) {
      throw new Error('Lobby not found');
    }

    const currentPlayers: Player[] = Array.isArray(lobby.players) ? (lobby.players as Player[]) : [];
    const playerExists = currentPlayers.some((p) => p.id === playerId);
    if (!playerExists) {
      throw new Error('Player not found in lobby');
    }
    const updatedPlayers = currentPlayers.map((p) =>
      p.id === playerId ? { ...p, isReady } : p
    );

    const updatedLobby = await this.lobbyRepository.updateLobby(lobby.id, {
      players: updatedPlayers
    });

    if (!updatedLobby) {
      throw new Error('Failed to update player ready status');
    }

    return this.formatLobbyResponse(updatedLobby);
  }

  /**
   * Update player connection status
   */
  async updatePlayerConnection(lobbyCode: string, playerId: string, isConnected: boolean): Promise<LobbyWithPlayers> {
    const lobby = await this.lobbyRepository.findByCode(lobbyCode);
    if (!lobby) {
      throw new Error('Lobby not found');
    }

    const currentPlayers: Player[] = Array.isArray(lobby.players) ? (lobby.players as Player[]) : [];
    const updatedPlayers = currentPlayers.map((p) =>
      p.id === playerId ? { ...p, isConnected } : p
    );

    const updatedLobby = await this.lobbyRepository.updateLobby(lobby.id, {
      players: updatedPlayers
    });

    if (!updatedLobby) {
      throw new Error('Failed to update player connection status');
    }

    return this.formatLobbyResponse(updatedLobby);
  }

  /**
   * Get lobby by code
   */
  async getLobbyByCode(code: string): Promise<LobbyWithPlayers | null> {
    const lobby = await this.lobbyRepository.findByCode(code);
    return lobby ? this.formatLobbyResponse(lobby) : null;
  }

  /**
   * Update lobby status by lobby code
   */
  async updateLobbyStatus(lobbyCode: string, status: Lobby['status']): Promise<LobbyWithPlayers> {
    const lobby = await this.lobbyRepository.findByCode(lobbyCode);
    if (!lobby) {
      throw new Error('Lobby not found');
    }
    const updated = await this.lobbyRepository.updateLobbyStatus(lobby.id, status);
    if (!updated) {
      throw new Error('Failed to update lobby status');
    }
    return this.formatLobbyResponse(updated);
  }

  /**
   * Get lobby by ID
   */
  async getLobbyById(id: number): Promise<LobbyWithPlayers | null> {
    const lobby = await this.lobbyRepository.findLobbyById(id);
    return lobby ? this.formatLobbyResponse(lobby) : null;
  }

  /**
   * Get active lobbies (waiting or starting)
   */
  async getActiveLobbies(limit?: number): Promise<LobbyWithPlayers[]> {
    const lobbies = await this.lobbyRepository.findActiveLobbies(limit);
    return lobbies.map((lobby: Lobby) => this.formatLobbyResponse(lobby));
  }

  /**
   * Get lobbies by host
   */
  async getLobbiesByHost(hostId: number): Promise<LobbyWithPlayers[]> {
    const lobbies = await this.lobbyRepository.findLobbiesByHost(hostId);
    return lobbies.map((lobby: Lobby) => this.formatLobbyResponse(lobby));
  }

  /**
   * Update lobby settings
   */
  async updateLobbySettings(lobbyCode: string, hostId: number, settings: Partial<LobbySettings>): Promise<LobbyWithPlayers> {
    const lobby = await this.lobbyRepository.findByCode(lobbyCode);
    if (!lobby) {
      throw new Error('Lobby not found');
    }

    // Verify host permission (check both host_id and auth_user_id)
    const isHost = lobby.host_id === hostId || lobby.auth_user_id === hostId;
    if (!isHost) {
      throw new Error('Only the host can update lobby settings');
    }

    // Verify lobby is in waiting state
    if (lobby.status !== 'waiting') {
      throw new Error('Cannot update settings for lobby that is not in waiting status');
    }

    const updatedSettings = {
      ...lobby.settings,
      ...settings
    };

    // Only include question_count in update when explicitly provided to avoid
    // clobbering concurrent updates with stale values.
    const updateData: any = {
      settings: updatedSettings
    };
    if (typeof settings.questionCount === 'number') {
      updateData.question_count = settings.questionCount;
    }

    const updatedLobby = await this.lobbyRepository.updateLobby(lobby.id, updateData);

    if (!updatedLobby) {
      throw new Error('Failed to update lobby settings');
    }

    return this.formatLobbyResponse(updatedLobby);
  }

  /**
   * Start a game (update lobby status to starting)
   */
  async startGame(lobbyCode: string, hostId: number): Promise<LobbyWithPlayers> {
    const lobby = await this.lobbyRepository.findByCode(lobbyCode);
    if (!lobby) {
      throw new Error('Lobby not found');
    }

    // Verify host permission (check both host_id and auth_user_id)
    const isHost = lobby.host_id === hostId || lobby.auth_user_id === hostId;
    if (!isHost) {
      throw new Error('Only the host can start the game');
    }

    // Verify lobby is in waiting state
    if (lobby.status !== 'waiting') {
      throw new Error('Cannot start game for lobby that is not in waiting status');
    }

    // Check minimum players (at least 2 players) before readiness per test expectations
    const currentPlayers: Player[] = Array.isArray(lobby.players) ? (lobby.players as Player[]) : [];
    if (currentPlayers.length < 2) {
      throw new Error('At least 2 players are required to start the game');
    }
    // Then ensure all players are ready
    const allReady = currentPlayers.every((p) => p.isReady);
    if (!allReady) {
      throw new Error('All players must be ready to start the game');
    }

    const updatedLobby = await this.lobbyRepository.updateLobbyStatus(lobby.id, 'starting');
    if (!updatedLobby) {
      throw new Error('Failed to start game');
    }

    return this.formatLobbyResponse(updatedLobby);
  }

  /**
   * Clean up old lobbies
   */
  async cleanupOldLobbies(hoursOld: number = 24): Promise<number> {
    return await this.lobbyRepository.cleanupOldLobbies(hoursOld);
  }

  /**
   * Clean up inactive lobbies that haven't started a game within the specified minutes
   * Only deletes lobbies in 'waiting' or 'starting' status
   */
  async cleanupInactiveLobbies(minutesOld: number = 10): Promise<number> {
    return await this.lobbyRepository.cleanupInactiveLobbies(minutesOld);
  }

  /**
   * Get lobby statistics
   */
  async getLobbyStats(): Promise<{
    totalLobbies: number;
    activeLobbies: number;
    averagePlayersPerLobby: number;
  }> {
    const totalLobbies = await this.lobbyRepository.getLobbyCount();
    const activeLobbies = await this.lobbyRepository.getActiveLobbyCount();

    // Calculate average players per active lobby
    const activeLobbiesList = await this.lobbyRepository.findActiveLobbies();
    const totalPlayers = activeLobbiesList.reduce((sum, lobby) => {
      const players = Array.isArray(lobby.players) ? lobby.players : [];
      return sum + players.length;
    }, 0);

    const lobbyCount = activeLobbiesList.length;
    const averagePlayersPerLobby = lobbyCount > 0 ? totalPlayers / lobbyCount : 0;

    return {
      totalLobbies,
      activeLobbies,
      averagePlayersPerLobby: Math.round(averagePlayersPerLobby * 100) / 100
    };
  }

  /**
   * Format lobby response with proper player typing
   */
  private formatLobbyResponse(lobby: Lobby): LobbyWithPlayers {
    const players = Array.isArray(lobby.players) ? lobby.players as Player[] : [];

    return {
      ...lobby,
      players: players.map(player => ({
        ...player,
        joinedAt: player.joinedAt ? new Date(player.joinedAt) : new Date()
      }))
    };
  }

  /**
   * Validate lobby code format
   */
  static isValidLobbyCode(code: string): boolean {
    return /^[A-Z0-9]{6}$/.test(code);
  }

  /**
   * Validate question set selection and get available question count
   */
  async validateQuestionSetSelection(questionSetIds: number[]): Promise<{
    isValid: boolean;
    totalQuestions: number;
    questionSets: Array<{ id: number; name: string; questionCount: number }>;
    errors: string[];
  }> {
    const errors: string[] = [];
    const questionSets: Array<{ id: number; name: string; questionCount: number }> = [];
    let totalQuestions = 0;

    if (questionSetIds.length === 0) {
      errors.push('At least one question set must be selected');
      return { isValid: false, totalQuestions: 0, questionSets, errors };
    }

    for (const setId of questionSetIds) {
      const questionSet = await this.questionService.getQuestionSetById(setId);
      if (!questionSet) {
        errors.push(`Question set with ID ${setId} not found`);
        continue;
      }

      if (!questionSet.is_active) {
        errors.push(`Question set "${questionSet.name}" is not active`);
        continue;
      }

      const questions = await this.questionService.getQuestionsBySetId(setId);
      const questionCount = questions.length;

      if (questionCount === 0) {
        errors.push(`Question set "${questionSet.name}" has no questions`);
        continue;
      }

      questionSets.push({
        id: setId,
        name: questionSet.name,
        questionCount
      });

      totalQuestions += questionCount;
    }

    return {
      isValid: errors.length === 0,
      totalQuestions,
      questionSets,
      errors
    };
  }

  /**
   * Get available question sets for lobby creation
   */
  async getAvailableQuestionSets(): Promise<Array<{
    id: number;
    name: string;
    category: string;
    difficulty: string;
    questionCount: number;
    isActive: boolean;
  }>> {
    const questionSets = await this.questionService.getAllQuestionSetsWithStats(false);

    return questionSets.map((qs: any) => ({
      id: (qs as any).id,
      name: (qs as any).name,
      category: (qs as any).category || 'General',
      difficulty: (qs as any).difficulty || 'medium',
      questionCount: qs.questionCount,
      isActive: (qs as any).is_active
    }));
  }

  /**
   * Update lobby question set settings
   */
  async updateLobbyQuestionSets(
    lobbyCode: string,
    hostId: number,
    questionSetIds: number[],
    questionCount: number
  ): Promise<LobbyWithPlayers> {
    const lobby = await this.lobbyRepository.findByCode(lobbyCode);
    if (!lobby) {
      throw new Error('Lobby not found');
    }

    // Verify host permission (check both host_id and auth_user_id)
    const isHost = lobby.host_id === hostId || lobby.auth_user_id === hostId;
    if (!isHost) {
      throw new Error('Only the host can update question set settings');
    }

    // Verify lobby is in waiting state
    if (lobby.status !== 'waiting') {
      throw new Error('Cannot update settings after game has started');
    }

    // Validate question set selection
    const validation = await this.validateQuestionSetSelection(questionSetIds);
    if (!validation.isValid) {
      throw new Error(`Invalid question set selection: ${validation.errors.join(', ')}`);
    }

    // Validate question count
    if (questionCount < 5) {
      throw new Error('Minimum 5 questions required');
    }

    if (questionCount > validation.totalQuestions) {
      throw new Error(`Maximum ${validation.totalQuestions} questions available in selected sets`);
    }

    // Update lobby settings
    const updatedSettings = {
      ...lobby.settings,
      questionSetIds,
      questionCount,
      maxQuestionCount: validation.totalQuestions
    };

    const updatedLobby = await this.lobbyRepository.updateLobby(lobby.id, {
      settings: updatedSettings,
      question_count: questionCount
    });

    if (!updatedLobby) {
      throw new Error('Failed to update lobby question set settings');
    }

    return this.formatLobbyResponse(updatedLobby);
  }

  /**
   * Get lobby question set information
   */
  async getLobbyQuestionSetInfo(lobbyCode: string): Promise<{
    selectedSets: Array<{ id: number; name: string; questionCount: number }>;
    totalQuestions: number;
    selectedQuestionCount: number;
    maxQuestionCount: number;
  } | null> {
    const lobby = await this.lobbyRepository.findByCode(lobbyCode);
    if (!lobby) {
      return null;
    }

    const settings = lobby.settings as LobbySettings;
    const questionSetIds = settings?.questionSetIds || [];
    const selectedQuestionCount = settings?.questionCount || lobby.question_count;
    const maxQuestionCount = settings?.maxQuestionCount || 0;

    if (questionSetIds.length === 0) {
      return {
        selectedSets: [],
        totalQuestions: 0,
        selectedQuestionCount,
        maxQuestionCount
      };
    }

    const validation = await this.validateQuestionSetSelection(questionSetIds);

    return {
      selectedSets: validation.questionSets,
      totalQuestions: validation.totalQuestions,
      selectedQuestionCount,
      maxQuestionCount: Math.max(maxQuestionCount, validation.totalQuestions)
    };
  }
}
