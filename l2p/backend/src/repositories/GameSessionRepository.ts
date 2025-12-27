import { BaseRepository } from './BaseRepository.js';

export interface GameSession {
  id: number;
  lobby_id: number;
  question_set_id?: number;
  started_at: Date;
  ended_at?: Date;
  total_questions: number;
  session_data: Record<string, any>;
}

export interface PlayerResult {
  id: number;
  session_id: number;
  user_id?: number;
  username: string;
  character_name?: string;
  final_score: number;
  correct_answers: number;
  total_questions: number;
  max_multiplier: number;
  completion_time?: number;
  answer_details: AnswerDetail[];
}

export interface AnswerDetail {
  questionId: number;
  selectedAnswer: string;
  isCorrect: boolean;
  timeElapsed: number;
  pointsEarned: number;
  multiplierUsed: number;
}

export interface CreateGameSessionData {
  lobby_id: number;
  question_set_id?: number;
  total_questions: number;
  session_data?: Record<string, any>;
}

export interface CreatePlayerResultData {
  session_id: number;
  user_id?: number;
  username: string;
  character_name?: string;
  final_score: number;
  correct_answers: number;
  total_questions: number;
  max_multiplier: number;
  completion_time?: number;
  answer_details: AnswerDetail[];
}

export class GameSessionRepository extends BaseRepository {
  private readonly gameSessionsTable = 'game_sessions';
  private readonly playerResultsTable = 'player_results';

  // Game Session Methods
  async findGameSessionById(id: number): Promise<GameSession | null> {
    return super.findById<GameSession>(this.gameSessionsTable, id);
  }

  async createGameSession(data: CreateGameSessionData): Promise<GameSession> {
    const sessionData = {
      ...data,
      session_data: data.session_data || {}
    };

    return super.create<GameSession>(this.gameSessionsTable, sessionData);
  }

  async updateGameSession(id: number, data: Partial<CreateGameSessionData>): Promise<GameSession | null> {
    return super.update<GameSession>(this.gameSessionsTable, id, data);
  }

  async endGameSession(id: number, sessionData?: Record<string, any>): Promise<GameSession | null> {
    const updateData: any = { ended_at: new Date() };
    if (sessionData) {
      updateData.session_data = sessionData;
    }

    return this.updateGameSession(id, updateData);
  }

  async findGameSessionsByLobby(lobbyId: number): Promise<GameSession[]> {
    const result = await this.db.query<GameSession>(
      'SELECT * FROM game_sessions WHERE lobby_id = $1 ORDER BY started_at DESC',
      [lobbyId]
    );
    return result.rows;
  }

  async findActiveGameSessions(): Promise<GameSession[]> {
    const result = await this.db.query<GameSession>(
      'SELECT * FROM game_sessions WHERE ended_at IS NULL ORDER BY started_at DESC'
    );
    return result.rows;
  }

  async getGameSessionCount(): Promise<number> {
    return super.count(this.gameSessionsTable);
  }

  async getCompletedGameSessionCount(): Promise<number> {
    return super.count(this.gameSessionsTable, 'ended_at IS NOT NULL');
  }

  // Player Result Methods
  async findPlayerResultById(id: number): Promise<PlayerResult | null> {
    return super.findById<PlayerResult>(this.playerResultsTable, id);
  }

  async createPlayerResult(data: CreatePlayerResultData): Promise<PlayerResult> {
    return super.create<PlayerResult>(this.playerResultsTable, data);
  }

  async updatePlayerResult(id: number, data: Partial<CreatePlayerResultData>): Promise<PlayerResult | null> {
    return super.update<PlayerResult>(this.playerResultsTable, id, data);
  }

  async findPlayerResultsBySession(sessionId: number): Promise<PlayerResult[]> {
    const result = await this.db.query<PlayerResult>(
      'SELECT * FROM player_results WHERE session_id = $1 ORDER BY final_score DESC',
      [sessionId]
    );
    return result.rows;
  }

  async findPlayerResultsByUser(userId: number, limit?: number): Promise<PlayerResult[]> {
    let query = 'SELECT * FROM player_results WHERE user_id = $1 ORDER BY id DESC';
    const params: any[] = [userId];

    if (limit) {
      query += ` LIMIT $2`;
      params.push(limit);
    }

    const result = await this.db.query<PlayerResult>(query, params);
    return result.rows;
  }

  async findPlayerResultsByUsername(username: string, limit?: number): Promise<PlayerResult[]> {
    let query = 'SELECT * FROM player_results WHERE username = $1 ORDER BY id DESC';
    const params: any[] = [username];

    if (limit) {
      query += ` LIMIT $2`;
      params.push(limit);
    }

    const result = await this.db.query<PlayerResult>(query, params);
    return result.rows;
  }

  async getPlayerStats(userId: number): Promise<{
    totalGames: number;
    totalScore: number;
    averageScore: number;
    averageAccuracy: number;
    maxMultiplier: number;
    bestScore: number;
  }> {
    const result = await this.db.query<{
      total_games: string;
      total_score: string;
      average_score: string;
      average_accuracy: string;
      max_multiplier: string;
      best_score: string;
    }>(
      `SELECT 
        COUNT(*) as total_games,
        SUM(final_score) as total_score,
        AVG(final_score) as average_score,
        AVG((correct_answers::float / total_questions::float) * 100) as average_accuracy,
        MAX(max_multiplier) as max_multiplier,
        MAX(final_score) as best_score
       FROM player_results 
       WHERE user_id = $1`,
      [userId]
    );

    const row = result.rows[0];
    return {
      totalGames: parseInt(row?.total_games || '0'),
      totalScore: parseInt(row?.total_score || '0'),
      averageScore: parseFloat(row?.average_score || '0'),
      averageAccuracy: parseFloat(row?.average_accuracy || '0'),
      maxMultiplier: parseInt(row?.max_multiplier || '1'),
      bestScore: parseInt(row?.best_score || '0')
    };
  }

  async getTopPlayersByScore(limit: number = 10): Promise<PlayerResult[]> {
    const result = await this.db.query<PlayerResult>(
      `SELECT * FROM player_results 
       ORDER BY final_score DESC 
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  async getRecentGames(limit: number = 20): Promise<Array<GameSession & { player_count: number }>> {
    const result = await this.db.query<GameSession & { player_count: number }>(
      `SELECT gs.*, 
        COUNT(pr.id) as player_count
       FROM game_sessions gs
       LEFT JOIN player_results pr ON gs.id = pr.session_id
       GROUP BY gs.id
       ORDER BY gs.started_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  async calculateAccuracy(sessionId: number, userId?: number): Promise<number> {
    let query = `
      SELECT 
        AVG((correct_answers::float / total_questions::float) * 100) as accuracy
      FROM player_results 
      WHERE session_id = $1
    `;
    const params: any[] = [sessionId];

    if (userId) {
      query += ' AND user_id = $2';
      params.push(userId);
    }

    const result = await this.db.query<{ accuracy: string }>(query, params);
    return parseFloat(result.rows[0]?.accuracy || '0');
  }

  async getSessionLeaderboard(sessionId: number): Promise<PlayerResult[]> {
    const result = await this.db.query<PlayerResult>(
      `SELECT * FROM player_results 
       WHERE session_id = $1 
       ORDER BY final_score DESC, completion_time ASC`,
      [sessionId]
    );
    return result.rows;
  }

  async deletePlayerResult(id: number): Promise<boolean> {
    return super.delete(this.playerResultsTable, id);
  }

  async deleteGameSession(id: number): Promise<boolean> {
    return super.delete(this.gameSessionsTable, id);
  }

  async cleanupOldSessions(daysOld: number = 30): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM game_sessions 
       WHERE ended_at < NOW() - INTERVAL '${daysOld} days'`
    );
    return result.rowCount || 0;
  }
}