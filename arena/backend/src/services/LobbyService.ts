import { DatabaseService } from './DatabaseService.js';
import type {
    ArenaPlayer,
    ArenaLobby,
    ArenaLobbySettings,
} from '../types/game.js';

interface CreateLobbyRequest {
    hostId: number;
    username: string;
    selectedCharacter?: string;
    selectedGender?: 'male' | 'female';
    characterLevel?: number;
    selectedPowerUp?: string | null;
    settings?: Partial<ArenaLobbySettings>;
}

interface JoinLobbyRequest {
    lobbyCode: string;
    player: Omit<ArenaPlayer, 'isHost' | 'joinedAt'>;
}

const DEFAULT_SETTINGS: ArenaLobbySettings = {
    maxPlayers: 4,
    bestOf: 1,
    shrinkingZone: false,
    shrinkInterval: 30,
    itemSpawns: true,
    itemSpawnInterval: 60,
    npcEnemies: 0,
    mapId: 'campus',
    mapSize: 1,
};

export class LobbyService {
    private db: DatabaseService;

    constructor() {
        this.db = DatabaseService.getInstance();
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

            const result = await this.db.query('SELECT 1 FROM lobbies WHERE code = $1', [code]);
            if (result.rowCount === 0) {
                return code;
            }
            attempts++;
        }

        throw new Error('Failed to generate unique lobby code after maximum attempts');
    }

    /**
     * Create a new lobby with a specific code (for private matches)
     */
    async createLobbyWithCode(code: string, request: CreateLobbyRequest): Promise<ArenaLobby> {
        const settings: ArenaLobbySettings = {
            ...DEFAULT_SETTINGS,
            ...request.settings,
        };

        const hostPlayer: ArenaPlayer = {
            id: String(request.hostId),
            username: request.username,
            character: request.selectedCharacter || 'student',
            gender: request.selectedGender || 'male',
            characterLevel: request.characterLevel || 1,
            isReady: true,
            isHost: true,
            isConnected: true,
            joinedAt: new Date(),
            powerUp: request.selectedPowerUp ?? null,
        };

        const result = await this.db.query(
            `INSERT INTO lobbies (code, auth_user_id, max_players, settings, players)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO NOTHING
       RETURNING *`,
            [code, request.hostId, settings.maxPlayers, JSON.stringify(settings), JSON.stringify([hostPlayer])]
        );

        if (result.rowCount === 0) {
            // Lobby already exists (race condition), fetch it
            return (await this.findByCode(code))!;
        }

        return this.formatLobby(result.rows[0]);
    }

    /**
     * Create a new lobby
     */
    async createLobby(request: CreateLobbyRequest): Promise<ArenaLobby> {
        const code = await this.generateUniqueCode();

        const settings: ArenaLobbySettings = {
            ...DEFAULT_SETTINGS,
            ...request.settings,
        };

        const hostPlayer: ArenaPlayer = {
            id: String(request.hostId),
            username: request.username,
            character: request.selectedCharacter || 'student',
            gender: request.selectedGender || 'male',
            characterLevel: request.characterLevel || 1,
            isReady: false,
            isHost: true,
            isConnected: true,
            joinedAt: new Date(),
            powerUp: request.selectedPowerUp ?? null,
        };

        const result = await this.db.query(
            `INSERT INTO lobbies (code, auth_user_id, max_players, settings, players)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [code, request.hostId, settings.maxPlayers, JSON.stringify(settings), JSON.stringify([hostPlayer])]
        );

        return this.formatLobby(result.rows[0]);
    }

    /**
     * Join an existing lobby
     */
    async joinLobby(request: JoinLobbyRequest): Promise<ArenaLobby> {
        const lobby = await this.findByCode(request.lobbyCode);
        if (!lobby) {
            throw new Error('Lobby not found');
        }

        if (lobby.status !== 'waiting') {
            throw new Error('Cannot join lobby that is not in waiting status');
        }

        if (lobby.players.length >= lobby.maxPlayers) {
            throw new Error('Lobby is full');
        }

        // Check for duplicate players
        const existing = lobby.players.find(
            (p) => String(p.id) === String(request.player.id) ||
                p.username.toLowerCase() === request.player.username.toLowerCase()
        );
        if (existing) {
            // Player reconnecting - update isConnected status and return current lobby state
            const updatedPlayers = lobby.players.map((p) =>
                String(p.id) === String(request.player.id) ? { ...p, isConnected: true } : p
            );
            const result = await this.db.query(
                `UPDATE lobbies SET players = $1 WHERE code = $2 RETURNING *`,
                [JSON.stringify(updatedPlayers), request.lobbyCode]
            );
            return this.formatLobby(result.rows[0]);
        }

        const newPlayer: ArenaPlayer = {
            ...request.player,
            isHost: false,
            joinedAt: new Date(),
        };

        const updatedPlayers = [...lobby.players, newPlayer];

        const result = await this.db.query(
            `UPDATE lobbies SET players = $1 WHERE code = $2 RETURNING *`,
            [JSON.stringify(updatedPlayers), request.lobbyCode]
        );

        return this.formatLobby(result.rows[0]);
    }

    /**
     * Leave a lobby
     */
    async leaveLobby(lobbyCode: string, playerId: string): Promise<ArenaLobby | null> {
        const lobby = await this.findByCode(lobbyCode);
        if (!lobby) return null;

        const player = lobby.players.find((p) => String(p.id) === String(playerId));
        if (!player) return null;

        // Host leaving = delete lobby
        if (player.isHost) {
            await this.db.query('DELETE FROM lobbies WHERE code = $1', [lobbyCode]);
            return null;
        }

        // Regular player leaves
        const updatedPlayers = lobby.players.filter((p) => String(p.id) !== String(playerId));
        const result = await this.db.query(
            `UPDATE lobbies SET players = $1 WHERE code = $2 RETURNING *`,
            [JSON.stringify(updatedPlayers), lobbyCode]
        );

        return this.formatLobby(result.rows[0]);
    }

    /**
     * Update player ready status
     */
    async updatePlayerReady(lobbyCode: string, playerId: string, isReady: boolean): Promise<ArenaLobby> {
        const lobby = await this.findByCode(lobbyCode);
        if (!lobby) throw new Error('Lobby not found');

        const playerExists = lobby.players.some((p) => String(p.id) === String(playerId));
        if (!playerExists) throw new Error('Player not found in lobby');

        const updatedPlayers = lobby.players.map((p) =>
            String(p.id) === String(playerId) ? { ...p, isReady } : p
        );

        const result = await this.db.query(
            `UPDATE lobbies SET players = $1 WHERE code = $2 RETURNING *`,
            [JSON.stringify(updatedPlayers), lobbyCode]
        );

        return this.formatLobby(result.rows[0]);
    }

    /**
     * Update lobby settings (host only)
     */
    async updateSettings(lobbyCode: string, hostId: number, settings: Partial<ArenaLobbySettings>): Promise<ArenaLobby> {
        const lobby = await this.findByCode(lobbyCode);
        if (!lobby) throw new Error('Lobby not found');

        if (lobby.authUserId !== hostId) {
            throw new Error('Only the host can update lobby settings');
        }

        if (lobby.status !== 'waiting') {
            throw new Error('Cannot update settings after game has started');
        }

        const updatedSettings: ArenaLobbySettings = {
            ...lobby.settings,
            ...settings,
        };

        // Update max_players column too if changed
        const result = await this.db.query(
            `UPDATE lobbies SET settings = $1, max_players = $2 WHERE code = $3 RETURNING *`,
            [JSON.stringify(updatedSettings), updatedSettings.maxPlayers, lobbyCode]
        );

        return this.formatLobby(result.rows[0]);
    }

    /**
     * Start a game (host only)
     */
    async startGame(lobbyCode: string, hostId: number): Promise<ArenaLobby> {
        const lobby = await this.findByCode(lobbyCode);
        if (!lobby) throw new Error('Lobby not found');

        if (lobby.authUserId !== hostId) {
            throw new Error('Only the host can start the game');
        }

        if (lobby.status !== 'waiting') {
            throw new Error('Cannot start game for lobby that is not in waiting status');
        }

        const totalParticipants = lobby.players.length + (lobby.settings.npcEnemies || 0);
        if (totalParticipants < 2) {
            throw new Error('At least 2 players are required to start');
        }

        const allReady = lobby.players.every((p) => p.isReady);
        if (!allReady) {
            throw new Error('All players must be ready to start the game');
        }

        const result = await this.db.query(
            `UPDATE lobbies SET status = 'starting', started_at = CURRENT_TIMESTAMP WHERE code = $1 RETURNING *`,
            [lobbyCode]
        );

        return this.formatLobby(result.rows[0]);
    }

    /**
     * Get lobby by code
     */
    async getLobbyByCode(code: string): Promise<ArenaLobby | null> {
        return this.findByCode(code);
    }

    /**
     * Update lobby status
     */
    async updateLobbyStatus(lobbyCode: string, status: ArenaLobby['status']): Promise<ArenaLobby> {
        const result = await this.db.query(
            `UPDATE lobbies SET status = $1 WHERE code = $2 RETURNING *`,
            [status, lobbyCode]
        );
        if (result.rowCount === 0) throw new Error('Lobby not found');
        return this.formatLobby(result.rows[0]);
    }

    /**
     * Get active lobbies
     */
    async getActiveLobbies(limit = 50): Promise<ArenaLobby[]> {
        const result = await this.db.query(
            `SELECT * FROM lobbies WHERE status IN ('waiting', 'starting') ORDER BY created_at DESC LIMIT $1`,
            [limit]
        );
        return result.rows.map((row: Record<string, unknown>) => this.formatLobby(row));
    }

    /**
     * Delete a lobby
     */
    async deleteLobbyByCode(lobbyCode: string): Promise<boolean> {
        const result = await this.db.query('DELETE FROM lobbies WHERE code = $1', [lobbyCode]);
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Cleanup old lobbies
     */
    async cleanupOldLobbies(hoursOld = 24): Promise<number> {
        const result = await this.db.query(
            `DELETE FROM lobbies WHERE created_at < NOW() - INTERVAL '1 hour' * $1`,
            [hoursOld]
        );
        return result.rowCount ?? 0;
    }

    /**
     * Reconcile stale lobbies on startup
     */
    async reconcileStaleLobbies(): Promise<number> {
        const result = await this.db.query(
            `DELETE FROM lobbies WHERE status IN ('starting', 'playing')`
        );
        const count = result.rowCount ?? 0;
        if (count > 0) {
            console.log(`Reconciled ${count} stale lobbies`);
        }
        return count;
    }

    // -- Internal helpers --

    private async findByCode(code: string): Promise<ArenaLobby | null> {
        const result = await this.db.query('SELECT * FROM lobbies WHERE code = $1', [code]);
        if (result.rowCount === 0) return null;
        return this.formatLobby(result.rows[0]);
    }

    private formatLobby(row: Record<string, unknown>): ArenaLobby {
        const players: ArenaPlayer[] = Array.isArray(row.players)
            ? (row.players as ArenaPlayer[])
            : typeof row.players === 'string'
                ? JSON.parse(row.players as string)
                : [];

        const settings: ArenaLobbySettings = typeof row.settings === 'string'
            ? JSON.parse(row.settings as string)
            : (row.settings as ArenaLobbySettings) || DEFAULT_SETTINGS;

        return {
            id: row.id as number,
            code: row.code as string,
            hostId: row.host_id as number | null,
            authUserId: row.auth_user_id as number | null,
            status: row.status as ArenaLobby['status'],
            maxPlayers: row.max_players as number,
            settings,
            players: players.map((p) => ({
                ...p,
                joinedAt: p.joinedAt ? new Date(p.joinedAt) : new Date(),
            })),
            createdAt: new Date(row.created_at as string),
        };
    }

    static isValidLobbyCode(code: string): boolean {
        return /^[A-Z0-9]{6}$/.test(code);
    }
}
