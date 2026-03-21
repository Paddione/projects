import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { DatabaseService } from './services/DatabaseService.js';
import { LobbyService } from './services/LobbyService.js';
import { attachAuthUser } from './middleware/auth.js';
import { authFetch } from './config/authClient.js';

const app = express();

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    originAgentCluster: false
}));
app.use(cors({
    origin: config.cors.origin,
    credentials: true,
}));
app.use(express.json());
app.use(attachAuthUser);

// ============================================================================
// HEALTH
// ============================================================================

app.get('/api/health', async (_req, res) => {
    try {
        const db = DatabaseService.getInstance();
        const isHealthy = await db.healthCheck();
        res.json({
            status: isHealthy ? 'OK' : 'DEGRADED',
            service: 'arena-backend',
            timestamp: new Date().toISOString(),
            database: isHealthy ? 'connected' : 'disconnected',
        });
    } catch {
        res.status(503).json({
            status: 'ERROR',
            service: 'arena-backend',
            timestamp: new Date().toISOString(),
        });
    }
});

// ============================================================================
// AUTH
// ============================================================================

app.get('/api/auth/me', (req, res) => {
    const user = (req as any).user;
    if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ user });
});

// ============================================================================
// LOBBIES
// ============================================================================

const lobbyService = new LobbyService();

app.post('/api/lobbies', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        // Fetch character/gender/powerUp from auth service profile
        let selectedCharacter: string | undefined;
        let selectedGender: 'male' | 'female' | undefined;
        let selectedPowerUp: string | null = null;
        const cookie = req.headers.cookie;
        if (cookie) {
            try {
                const profileRes = await authFetch('/api/profile', {
                    headers: { cookie },
                });
                if (profileRes.ok) {
                    const profile = await profileRes.json();
                    if (profile) {
                        selectedCharacter = profile.selectedCharacter || profile.selected_character;
                        selectedGender = profile.selectedGender || profile.selected_gender;
                        selectedPowerUp = profile.equippedPowerUp || profile.equipped_power_up || null;
                    }
                }
            } catch {
                // Auth service unreachable, use defaults
            }
        }

        const lobby = await lobbyService.createLobby({
            hostId: user.userId,
            username: user.username,
            selectedCharacter,
            selectedGender,
            selectedPowerUp,
            settings: req.body.settings,
        });
        res.status(201).json(lobby);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

app.get('/api/lobbies/:code', async (req, res) => {
    try {
        const lobby = await lobbyService.getLobbyByCode(req.params.code);
        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found' });
        }
        res.json(lobby);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/lobbies', async (_req, res) => {
    try {
        const lobbies = await lobbyService.getActiveLobbies();
        res.json(lobbies);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.delete('/api/lobbies/:code', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const lobby = await lobbyService.getLobbyByCode(req.params.code);
        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found' });
        }
        if (!lobby.authUserId || lobby.authUserId !== user.userId) {
            return res.status(403).json({ error: 'Only the host can delete a lobby' });
        }
        await lobbyService.deleteLobbyByCode(req.params.code);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================================================
// LEADERBOARD
// ============================================================================

app.get('/api/leaderboard', async (_req, res) => {
    try {
        const db = DatabaseService.getInstance();
        const result = await db.query(
            'SELECT * FROM arena_leaderboard LIMIT 100'
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================================================
// PLAYER PROFILE
// ============================================================================

app.get('/api/players/:authUserId', async (req, res) => {
    try {
        const db = DatabaseService.getInstance();
        const result = await db.query(
            'SELECT * FROM players WHERE auth_user_id = $1',
            [parseInt(req.params.authUserId)]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/players', async (req, res) => {
    try {
        const user = (req as any).user;
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const { selectedCharacter } = req.body;
        const db = DatabaseService.getInstance();
        const result = await db.query(
            `INSERT INTO players (auth_user_id, username, selected_character)
       VALUES ($1, $2, $3)
       ON CONFLICT (auth_user_id) DO UPDATE SET username = $2, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
            [user.userId, user.username, selectedCharacter || 'student']
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

// ============================================================================
// MATCH HISTORY
// ============================================================================

app.get('/api/matches', async (req, res) => {
    try {
        const db = DatabaseService.getInstance();
        const limit = parseInt(req.query.limit as string) || 20;
        const result = await db.query(
            'SELECT * FROM matches ORDER BY started_at DESC LIMIT $1',
            [limit]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/matches/:id/results', async (req, res) => {
    try {
        const db = DatabaseService.getInstance();
        const matchId = parseInt(req.params.id);

        // Fetch match metadata (for winnerId)
        const matchRow = await db.query(
            `SELECT m.id, p.auth_user_id as winner_auth_id
             FROM matches m
             LEFT JOIN players p ON m.winner_id = p.id
             WHERE m.id = $1`,
            [matchId]
        );
        if (matchRow.rows.length === 0) {
            res.status(404).json({ error: 'Match not found' });
            return;
        }

        // Fetch results with camelCase aliases
        const result = await db.query(
            `SELECT
                p.auth_user_id AS "playerId",
                mr.username,
                mr.character_name AS "character",
                mr.kills,
                mr.deaths,
                mr.damage_dealt AS "damageDealt",
                mr.items_collected AS "itemsCollected",
                mr.rounds_won AS "roundsWon",
                mr.placement,
                mr.experience_gained AS "experienceGained",
                mr.level_before AS "levelBefore",
                mr.level_after AS "levelAfter"
             FROM match_results mr
             JOIN players p ON mr.player_id = p.id
             WHERE mr.match_id = $1
             ORDER BY mr.placement ASC`,
            [matchId]
        );

        const winnerAuthId = matchRow.rows[0].winner_auth_id;
        res.json({
            winnerId: winnerAuthId ? String(winnerAuthId) : '',
            results: result.rows.map(row => ({
                ...row,
                playerId: String(row.playerId),
            })),
        });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default app;
