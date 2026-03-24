-- =============================================================================
-- CAMPAIGN LEADERBOARDS — Weekly snapshots, player stats cache, friends
-- =============================================================================
-- Extends campaign schema with leaderboard infrastructure.
-- Run against: arena_db as arena_user (or postgres superuser)
-- =============================================================================

-- =============================================================================
-- WEEKLY SNAPSHOTS — Time-based leaderboard history
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_leaderboard_snapshots (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES campaign_players(id) ON DELETE CASCADE,
    board_type VARCHAR(30) NOT NULL,
    score NUMERIC NOT NULL DEFAULT 0,
    week_start DATE NOT NULL,
    UNIQUE(player_id, board_type, week_start)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_week
    ON campaign_leaderboard_snapshots(board_type, week_start, score DESC);

-- =============================================================================
-- PLAYER STATS CACHE — Updated periodically for leaderboard queries
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_player_stats (
    player_id INTEGER PRIMARY KEY REFERENCES campaign_players(id) ON DELETE CASCADE,
    vocab_count INTEGER NOT NULL DEFAULT 0,
    quiz_accuracy NUMERIC(5,2) DEFAULT 0,
    quiz_count INTEGER DEFAULT 0,
    countries_visited INTEGER DEFAULT 0,
    enemies_defeated INTEGER DEFAULT 0,
    penpal_avg_grade NUMERIC(5,2) DEFAULT 0,
    penpal_count INTEGER DEFAULT 0,
    emotes_unlocked INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- FRIENDS LIST — Bidirectional friendship for friends leaderboard scope
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_friends (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES campaign_players(id) ON DELETE CASCADE,
    friend_player_id INTEGER NOT NULL REFERENCES campaign_players(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player_id, friend_player_id)
);

-- =============================================================================
-- MIGRATION TRACKING
-- =============================================================================
INSERT INTO schema_migrations (version, description) VALUES
    ('20260324_000005_campaign_leaderboards', 'Leaderboard snapshots, player stats cache, friends')
ON CONFLICT (version) DO NOTHING;
