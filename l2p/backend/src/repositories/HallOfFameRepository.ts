import { BaseRepository } from './BaseRepository.js';

export interface HallOfFameEntry {
  id: number;
  username: string;
  character_name?: string;
  score: number;
  accuracy: number;
  max_multiplier: number;
  question_set_name: string;
  question_set_id: number;
  completed_at: Date;
  session_id: number;
}

export interface CreateHallOfFameData {
  username: string;
  character_name?: string;
  score: number;
  accuracy: number;
  max_multiplier: number;
  question_set_name: string;
  question_set_id: number;
  session_id: number;
}

export class HallOfFameRepository extends BaseRepository {
  private readonly tableName = 'hall_of_fame';

  async findEntryById(id: number): Promise<HallOfFameEntry | null> {
    return super.findById<HallOfFameEntry>(this.tableName, id);
  }

  async createEntry(data: CreateHallOfFameData): Promise<HallOfFameEntry> {
    return super.create<HallOfFameEntry>(this.tableName, data);
  }

  async updateEntry(id: number, data: Partial<CreateHallOfFameData>): Promise<HallOfFameEntry | null> {
    return super.update<HallOfFameEntry>(this.tableName, id, data);
  }

  async deleteEntry(id: number): Promise<boolean> {
    return super.delete(this.tableName, id);
  }

  async getTopScores(questionSetId?: number, limit: number = 10): Promise<HallOfFameEntry[]> {
    let query = 'SELECT * FROM hall_of_fame';
    const params: any[] = [];

    if (questionSetId) {
      query += ' WHERE question_set_id = $1';
      params.push(questionSetId);
    }

    query += ' ORDER BY score DESC, completed_at ASC';

    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }

    const result = await this.getDb().query<HallOfFameEntry>(query, params);
    return result.rows;
  }

  async getTopScoresByQuestionSet(limit: number = 10): Promise<Array<HallOfFameEntry & { rank: number }>> {
    const result = await this.getDb().query<HallOfFameEntry & { rank: number }>(
      `WITH ranked_entries AS (
         SELECT *, 
           ROW_NUMBER() OVER (PARTITION BY question_set_id ORDER BY score DESC, completed_at ASC) as rank
         FROM hall_of_fame
       )
       SELECT * FROM ranked_entries
       WHERE rank <= $1
       ORDER BY question_set_name, rank`,
      [limit]
    );
    return result.rows;
  }

  async getUserBestScores(username: string): Promise<HallOfFameEntry[]> {
    const result = await this.getDb().query<HallOfFameEntry>(
      `SELECT DISTINCT ON (question_set_id) *
       FROM hall_of_fame 
       WHERE username = $1
       ORDER BY question_set_id, score DESC, completed_at ASC`,
      [username]
    );
    return result.rows;
  }

  async getUserRankInQuestionSet(username: string, questionSetId: number): Promise<number | null> {
    const result = await this.getDb().query<{ rank: string }>(
      `SELECT rank FROM (
        SELECT username, 
          ROW_NUMBER() OVER (ORDER BY score DESC, completed_at ASC) as rank
        FROM hall_of_fame 
        WHERE question_set_id = $1
      ) ranked 
      WHERE username = $2`,
      [questionSetId, username]
    );

    return result.rows[0] ? parseInt(result.rows[0].rank) : null;
  }

  async getQuestionSetLeaderboard(questionSetId: number, limit: number = 10): Promise<Array<HallOfFameEntry & { rank: number }>> {
    const result = await this.getDb().query<HallOfFameEntry & { rank: number }>(
      `SELECT *, 
        ROW_NUMBER() OVER (ORDER BY score DESC, completed_at ASC) as rank
       FROM hall_of_fame 
       WHERE question_set_id = $1
       ORDER BY score DESC, completed_at ASC
       LIMIT $2`,
      [questionSetId, limit]
    );
    return result.rows;
  }

  async getRecentEntries(limit: number = 20): Promise<HallOfFameEntry[]> {
    const result = await this.getDb().query<HallOfFameEntry>(
      'SELECT * FROM hall_of_fame ORDER BY completed_at DESC LIMIT $1',
      [limit]
    );
    return result.rows;
  }

  async getTopThreeByQuestionSet(questionSetId: number): Promise<HallOfFameEntry[]> {
    return this.getQuestionSetLeaderboard(questionSetId, 3);
  }

  async getAllQuestionSetLeaderboards(): Promise<Record<string, HallOfFameEntry[]>> {
    const result = await this.getDb().query<HallOfFameEntry & { rank: number }>(
      `WITH ranked_entries AS (
         SELECT *, 
           ROW_NUMBER() OVER (PARTITION BY question_set_id ORDER BY score DESC, completed_at ASC) as rank
         FROM hall_of_fame
       )
       SELECT * FROM ranked_entries
       WHERE rank <= 10
       ORDER BY question_set_name, rank`
    );

    const leaderboards: Record<string, HallOfFameEntry[]> = {};
    
    for (const entry of result.rows) {
      if (!leaderboards[entry.question_set_name]) {
        leaderboards[entry.question_set_name] = [];
      }
      leaderboards[entry.question_set_name]!.push(entry);
    }

    return leaderboards;
  }

  async getStatistics(): Promise<{
    totalEntries: number;
    uniquePlayers: number;
    averageScore: number;
    highestScore: number;
    averageAccuracy: number;
  }> {
    const result = await this.getDb().query<{
      total_entries: string;
      unique_players: string;
      average_score: string;
      highest_score: string;
      average_accuracy: string;
    }>(
      `SELECT 
        COUNT(*) as total_entries,
        COUNT(DISTINCT username) as unique_players,
        AVG(score) as average_score,
        MAX(score) as highest_score,
        AVG(accuracy) as average_accuracy
       FROM hall_of_fame`
    );

    const row = result.rows[0];
    return {
      totalEntries: parseInt(row?.total_entries || '0'),
      uniquePlayers: parseInt(row?.unique_players || '0'),
      averageScore: parseFloat(row?.average_score || '0'),
      highestScore: parseInt(row?.highest_score || '0'),
      averageAccuracy: parseFloat(row?.average_accuracy || '0')
    };
  }

  async isScoreEligibleForHallOfFame(score: number, questionSetId: number): Promise<boolean> {
    const result = await this.getDb().query<{ min_score: string }>(
      `SELECT MIN(score) as min_score 
       FROM (
         SELECT score 
         FROM hall_of_fame 
         WHERE question_set_id = $1 
         ORDER BY score DESC 
         LIMIT 10
       ) top_scores`,
      [questionSetId]
    );

    const minScore = parseInt(result.rows[0]?.min_score || '0');
    const entryCount = await this.getEntryCountForQuestionSet(questionSetId);

    // If less than 10 entries, always eligible
    if (entryCount < 10) {
      return true;
    }

    // Otherwise, score must be higher than the lowest top 10 score
    return score > minScore;
  }

  async getEntryCountForQuestionSet(questionSetId: number): Promise<number> {
    return super.count(this.tableName, 'question_set_id = $1', [questionSetId]);
  }

  async searchEntries(searchTerm: string, limit: number = 50): Promise<HallOfFameEntry[]> {
    const result = await this.getDb().query<HallOfFameEntry>(
      `SELECT * FROM hall_of_fame 
       WHERE username ILIKE $1 
          OR character_name ILIKE $1 
          OR question_set_name ILIKE $1
       ORDER BY score DESC 
       LIMIT $2`,
      [`%${searchTerm}%`, limit]
    );
    return result.rows;
  }

  async cleanupOldEntries(daysOld: number = 365): Promise<number> {
    const result = await this.getDb().query(
      `DELETE FROM hall_of_fame 
       WHERE completed_at < NOW() - INTERVAL '${daysOld} days'`
    );
    return result.rowCount || 0;
  }

  async getEntryCount(): Promise<number> {
    return super.count(this.tableName);
  }
}