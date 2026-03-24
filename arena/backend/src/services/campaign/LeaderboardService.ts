import { DatabaseService } from '../DatabaseService.js';

export type LeaderboardType = 'vocab_king' | 'scholar' | 'explorer' | 'richest' | 'fighter' | 'penpal_pro' | 'emote_lord';
export type LeaderboardScope = 'global' | 'class' | 'friends';
export type LeaderboardPeriod = 'weekly' | 'alltime';

export interface LeaderboardEntry {
    rank: number;
    authUserId: number;
    username: string;
    characterId: string;
    score: number;
    isCurrentPlayer: boolean;
}

export interface LeaderboardConfig {
    type: LeaderboardType;
    name: string;
    icon: string;
    description: string;
    periods: LeaderboardPeriod[];
    scoreQuery: string;
}

const LEADERBOARD_CONFIGS: LeaderboardConfig[] = [
    {
        type: 'vocab_king',
        name: 'Vocab King',
        icon: '👑',
        description: 'Most vocab cards collected',
        periods: ['weekly', 'alltime'],
        scoreQuery: `SELECT cp.auth_user_id, cp.player_name AS username, cp.character_id,
                      COUNT(cv.id)::int AS score
                      FROM campaign_players cp
                      LEFT JOIN campaign_vocab cv ON cv.player_id = cp.id
                      GROUP BY cp.id, cp.auth_user_id, cp.player_name, cp.character_id`,
    },
    {
        type: 'scholar',
        name: 'Scholar',
        icon: '🎓',
        description: 'Highest L2P quiz accuracy (min 50 questions)',
        periods: ['weekly', 'alltime'],
        scoreQuery: `SELECT cp.auth_user_id, cp.player_name AS username, cp.character_id,
                      COALESCE(cp.total_quiz_accuracy, 0)::numeric AS score
                      FROM campaign_players cp
                      WHERE cp.total_quizzes_completed >= 50`,
    },
    {
        type: 'explorer',
        name: 'Explorer',
        icon: '🌍',
        description: 'Most countries visited',
        periods: ['alltime'],
        scoreQuery: `SELECT cp.auth_user_id, cp.player_name AS username, cp.character_id,
                      jsonb_array_length(COALESCE(cp.passport->'countries_visited', '[]'::jsonb))::int AS score
                      FROM campaign_players cp`,
    },
    {
        type: 'richest',
        name: 'Richest',
        icon: '💰',
        description: 'Highest Dollar balance',
        periods: ['weekly', 'alltime'],
        scoreQuery: `SELECT cp.auth_user_id, cp.player_name AS username, cp.character_id,
                      cp.dollar_balance::int AS score
                      FROM campaign_players cp`,
    },
    {
        type: 'fighter',
        name: 'Fighter',
        icon: '⚔️',
        description: 'Most enemies defeated',
        periods: ['weekly', 'alltime'],
        scoreQuery: `SELECT cp.auth_user_id, cp.player_name AS username, cp.character_id,
                      COALESCE(ps.enemies_defeated, 0)::int AS score
                      FROM campaign_players cp
                      LEFT JOIN campaign_player_stats ps ON ps.player_id = cp.id`,
    },
    {
        type: 'penpal_pro',
        name: 'Penpal Pro',
        icon: '📝',
        description: 'Highest average penpal letter grade',
        periods: ['alltime'],
        scoreQuery: `SELECT cp.auth_user_id, cp.player_name AS username, cp.character_id,
                      COALESCE(AVG((pl.grade_json->>'total')::numeric), 0)::numeric AS score
                      FROM campaign_players cp
                      LEFT JOIN campaign_penpal_letters pl ON pl.player_id = cp.id AND pl.direction = 'reply' AND pl.grade_json IS NOT NULL
                      GROUP BY cp.id, cp.auth_user_id, cp.player_name, cp.character_id
                      HAVING COUNT(pl.id) >= 3`,
    },
    {
        type: 'emote_lord',
        name: 'Emote Lord',
        icon: '🎭',
        description: 'Most emotes unlocked',
        periods: ['alltime'],
        scoreQuery: `SELECT cp.auth_user_id, cp.player_name AS username, cp.character_id,
                      COALESCE(ps.emotes_unlocked, 0)::int AS score
                      FROM campaign_players cp
                      LEFT JOIN campaign_player_stats ps ON ps.player_id = cp.id`,
    },
];

export class LeaderboardService {
    private db: DatabaseService;

    constructor() {
        this.db = DatabaseService.getInstance();
    }

    /**
     * Get a leaderboard by type, scope, and period.
     */
    async getLeaderboard(
        type: LeaderboardType,
        scope: LeaderboardScope,
        period: LeaderboardPeriod,
        currentAuthUserId: number,
        classId?: number,
        limit: number = 25,
    ): Promise<LeaderboardEntry[]> {
        const config = LEADERBOARD_CONFIGS.find(c => c.type === type);
        if (!config) return [];

        let query: string;
        const params: unknown[] = [];

        if (period === 'alltime') {
            // Live query from source tables
            query = `WITH scores AS (${config.scoreQuery})
                     SELECT auth_user_id, username, character_id, score
                     FROM scores`;

            // Apply scope filter
            if (scope === 'class' && classId) {
                query += ` WHERE auth_user_id IN (SELECT student_auth_user_id FROM campaign_class_members WHERE class_id = $1)`;
                params.push(classId);
            } else if (scope === 'friends') {
                query += ` WHERE auth_user_id IN (
                    SELECT cp2.auth_user_id FROM campaign_friends cf
                    JOIN campaign_players cp1 ON cf.player_id = cp1.id
                    JOIN campaign_players cp2 ON cf.friend_player_id = cp2.id
                    WHERE cp1.auth_user_id = $1
                    UNION SELECT $1
                )`;
                params.push(currentAuthUserId);
            }

            query += ` ORDER BY score DESC LIMIT $${params.length + 1}`;
            params.push(limit);
        } else {
            // Weekly from snapshots table
            const weekStart = this.getCurrentWeekStart();
            query = `SELECT cp.auth_user_id, cp.player_name AS username, cp.character_id,
                      COALESCE(ls.score, 0) AS score
                     FROM campaign_players cp
                     LEFT JOIN campaign_leaderboard_snapshots ls ON ls.player_id = cp.id
                       AND ls.board_type = $1 AND ls.week_start = $2`;
            params.push(type, weekStart);

            if (scope === 'class' && classId) {
                query += ` WHERE cp.auth_user_id IN (SELECT student_auth_user_id FROM campaign_class_members WHERE class_id = $${params.length + 1})`;
                params.push(classId);
            } else if (scope === 'friends') {
                query += ` WHERE cp.auth_user_id IN (
                    SELECT cp2.auth_user_id FROM campaign_friends cf
                    JOIN campaign_players cp1 ON cf.player_id = cp1.id
                    JOIN campaign_players cp2 ON cf.friend_player_id = cp2.id
                    WHERE cp1.auth_user_id = $${params.length + 1}
                    UNION SELECT $${params.length + 1}
                )`;
                params.push(currentAuthUserId);
            }

            query += ` ORDER BY score DESC LIMIT $${params.length + 1}`;
            params.push(limit);
        }

        const result = await this.db.query(query, params);

        return result.rows.map((row: Record<string, unknown>, index: number) => ({
            rank: index + 1,
            authUserId: row.auth_user_id as number,
            username: (row.username as string) || 'Unknown',
            characterId: (row.character_id as string) || 'student',
            score: Number(row.score) || 0,
            isCurrentPlayer: (row.auth_user_id as number) === currentAuthUserId,
        }));
    }

    /**
     * Get all leaderboard types with metadata.
     */
    getLeaderboardTypes(): Array<{
        type: LeaderboardType;
        name: string;
        icon: string;
        description: string;
        periods: LeaderboardPeriod[];
    }> {
        return LEADERBOARD_CONFIGS.map(c => ({
            type: c.type,
            name: c.name,
            icon: c.icon,
            description: c.description,
            periods: c.periods,
        }));
    }

    /**
     * Take a weekly snapshot for all players on all weekly boards.
     * Should be called by a cron job or scheduled task at the start of each week.
     */
    async takeWeeklySnapshot(): Promise<void> {
        const weekStart = this.getCurrentWeekStart();

        for (const config of LEADERBOARD_CONFIGS) {
            if (!config.periods.includes('weekly')) continue;

            await this.db.query(
                `INSERT INTO campaign_leaderboard_snapshots (player_id, board_type, score, week_start)
                 SELECT cp.id, $1, COALESCE(s.score, 0), $2
                 FROM campaign_players cp
                 LEFT JOIN (${config.scoreQuery}) s ON s.auth_user_id = cp.auth_user_id
                 ON CONFLICT (player_id, board_type, week_start)
                 DO UPDATE SET score = EXCLUDED.score`,
                [config.type, weekStart],
            );
        }
    }

    /**
     * Update player stats cache for a specific player.
     */
    async updatePlayerStats(playerId: number): Promise<void> {
        await this.db.query(
            `INSERT INTO campaign_player_stats (player_id, vocab_count, enemies_defeated, updated_at)
             VALUES ($1,
                (SELECT COUNT(*) FROM campaign_vocab WHERE player_id = $1),
                0,
                NOW()
             )
             ON CONFLICT (player_id) DO UPDATE SET
                vocab_count = (SELECT COUNT(*) FROM campaign_vocab WHERE player_id = $1),
                updated_at = NOW()`,
            [playerId],
        );
    }

    /**
     * Increment enemies_defeated counter in the stats cache.
     */
    async incrementEnemiesDefeated(playerId: number): Promise<void> {
        await this.db.query(
            `INSERT INTO campaign_player_stats (player_id, enemies_defeated, updated_at)
             VALUES ($1, 1, NOW())
             ON CONFLICT (player_id) DO UPDATE SET
                enemies_defeated = campaign_player_stats.enemies_defeated + 1,
                updated_at = NOW()`,
            [playerId],
        );
    }

    /**
     * Add a friend (bidirectional).
     */
    async addFriend(playerId: number, friendPlayerId: number): Promise<void> {
        if (playerId === friendPlayerId) return;
        // Insert both directions
        await this.db.query(
            `INSERT INTO campaign_friends (player_id, friend_player_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [playerId, friendPlayerId],
        );
        await this.db.query(
            `INSERT INTO campaign_friends (player_id, friend_player_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [friendPlayerId, playerId],
        );
    }

    /**
     * Remove a friend (bidirectional).
     */
    async removeFriend(playerId: number, friendPlayerId: number): Promise<void> {
        await this.db.query(
            `DELETE FROM campaign_friends WHERE (player_id = $1 AND friend_player_id = $2) OR (player_id = $2 AND friend_player_id = $1)`,
            [playerId, friendPlayerId],
        );
    }

    /**
     * Get friends list for a player.
     */
    async getFriends(playerId: number): Promise<Array<{ playerId: number; authUserId: number; playerName: string }>> {
        const result = await this.db.query(
            `SELECT cp.id AS player_id, cp.auth_user_id, cp.player_name
             FROM campaign_friends cf
             JOIN campaign_players cp ON cf.friend_player_id = cp.id
             WHERE cf.player_id = $1
             ORDER BY cp.player_name`,
            [playerId],
        );
        return result.rows.map((row: Record<string, unknown>) => ({
            playerId: row.player_id as number,
            authUserId: row.auth_user_id as number,
            playerName: (row.player_name as string) || 'Unknown',
        }));
    }

    /**
     * Get the Monday of the current week as YYYY-MM-DD.
     */
    private getCurrentWeekStart(): string {
        const now = new Date();
        const day = now.getDay();
        const diff = day === 0 ? -6 : 1 - day; // Monday
        const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
        return monday.toISOString().split('T')[0];
    }
}
