import { BaseRepository } from './BaseRepository.js';

export interface Lobby {
  id: number;
  code: string;
  host_id: number;
  status: 'waiting' | 'starting' | 'playing' | 'ended';
  question_count: number;
  current_question: number;
  created_at: Date;
  started_at?: Date;
  ended_at?: Date;
  settings: Record<string, any>;
  players: any[];
}

export interface CreateLobbyData {
  code: string;
  host_id: number;
  question_count?: number;
  settings?: Record<string, any>;
}

export interface UpdateLobbyData {
  status?: 'waiting' | 'starting' | 'playing' | 'ended';
  host_id?: number;
  question_count?: number;
  current_question?: number;
  started_at?: Date;
  ended_at?: Date;
  settings?: Record<string, any>;
  players?: any[];
}

export class LobbyRepository extends BaseRepository {
  private readonly tableName = 'lobbies';

  async findLobbyById(id: number): Promise<Lobby | null> {
    return super.findById<Lobby>(this.tableName, id);
  }

  async findByCode(code: string): Promise<Lobby | null> {
    const result = await this.getDb().query<Lobby>(
      'SELECT * FROM lobbies WHERE code = $1',
      [code]
    );
    return result.rows[0] || null;
  }

  async createLobby(lobbyData: CreateLobbyData): Promise<Lobby> {
    const data = {
      ...lobbyData,
      question_count: lobbyData.question_count || 10,
      settings: lobbyData.settings || {},
      players: []
    };

    return super.create<Lobby>(this.tableName, data);
  }

  async updateLobby(id: number, lobbyData: UpdateLobbyData): Promise<Lobby | null> {
    return super.update<Lobby>(this.tableName, id, lobbyData);
  }

  async deleteLobby(id: number): Promise<boolean> {
    return super.delete(this.tableName, id);
  }

  async findActiveLobbies(limit?: number): Promise<Lobby[]> {
    let query = 'SELECT * FROM lobbies WHERE status IN ($1, $2) ORDER BY created_at DESC';
    const params: any[] = ['waiting', 'starting'];

    if (limit) {
      query += ` LIMIT $3`;
      params.push(limit);
    }

    const result = await this.getDb().query<Lobby>(query, params);
    return result.rows;
  }

  async findLobbiesByHost(hostId: number): Promise<Lobby[]> {
    const result = await this.getDb().query<Lobby>(
      'SELECT * FROM lobbies WHERE host_id = $1 ORDER BY created_at DESC',
      [hostId]
    );
    return result.rows;
  }

  async updateLobbyStatus(id: number, status: Lobby['status']): Promise<Lobby | null> {
    const updateData: any = { status };
    
    if (status === 'playing') {
      updateData.started_at = new Date();
    } else if (status === 'ended') {
      updateData.ended_at = new Date();
    }

    return this.updateLobby(id, updateData);
  }

  async addPlayerToLobby(lobbyId: number, player: any): Promise<Lobby | null> {
    const lobby = await this.findLobbyById(lobbyId);
    if (!lobby) return null;

    // Ensure players is an array
    const currentPlayers = Array.isArray(lobby.players) ? lobby.players : [];
    const updatedPlayers = [...currentPlayers, player];
    return this.updateLobby(lobbyId, { players: updatedPlayers });
  }

  async removePlayerFromLobby(lobbyId: number, playerId: string): Promise<Lobby | null> {
    const lobby = await this.findLobbyById(lobbyId);
    if (!lobby) return null;

    // Ensure players is an array
    const currentPlayers = Array.isArray(lobby.players) ? lobby.players : [];
    const updatedPlayers = currentPlayers.filter((p: any) => p.id !== playerId);
    return this.updateLobby(lobbyId, { players: updatedPlayers });
  }

  async updatePlayerInLobby(lobbyId: number, playerId: string, playerData: any): Promise<Lobby | null> {
    const lobby = await this.findLobbyById(lobbyId);
    if (!lobby) return null;

    // Ensure players is an array
    const currentPlayers = Array.isArray(lobby.players) ? lobby.players : [];
    const updatedPlayers = currentPlayers.map((p: any) => 
      p.id === playerId ? { ...p, ...playerData } : p
    );
    
    return this.updateLobby(lobbyId, { players: updatedPlayers });
  }

  async codeExists(code: string): Promise<boolean> {
    return super.exists(this.tableName, 'code', code);
  }

  async getLobbyCount(): Promise<number> {
    return super.count(this.tableName);
  }

  async getActiveLobbyCount(): Promise<number> {
    return super.count(this.tableName, 'status IN ($1, $2)', ['waiting', 'starting']);
  }

  async cleanupOldLobbies(hoursOld: number = 24): Promise<number> {
    const result = await this.getDb().query(
      `DELETE FROM lobbies 
       WHERE created_at < NOW() - INTERVAL '${hoursOld} hours' 
       AND status = 'ended'`
    );
    return result.rowCount || 0;
  }

  /**
   * Clean up inactive lobbies that haven't started a game within the specified minutes
   * Only deletes lobbies in 'waiting' or 'starting' status that are older than the specified time
   */
  async cleanupInactiveLobbies(minutesOld: number = 10): Promise<number> {
    const result = await this.getDb().query(
      `DELETE FROM lobbies 
       WHERE created_at < NOW() - INTERVAL '${minutesOld} minutes' 
       AND status IN ('waiting', 'starting')`
    );
    return result.rowCount || 0;
  }
}