-- =============================================================================
-- ARENA DATABASE - Complete Schema (Final State)
-- =============================================================================
-- Consolidated from 3 migration files.
-- Run against: arena_db as arena_user (or postgres superuser)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- PLAYERS TABLE (characters renamed to academic theme)
-- =============================================================================
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    auth_user_id INTEGER NOT NULL UNIQUE,
    username VARCHAR(50) NOT NULL,
    selected_character VARCHAR(50) DEFAULT 'student',
    character_level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    total_kills INTEGER DEFAULT 0,
    total_deaths INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_players_auth_user_id ON players(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);
CREATE INDEX IF NOT EXISTS idx_players_experience ON players(experience DESC);

-- =============================================================================
-- LOBBIES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS lobbies (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    host_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    auth_user_id INTEGER,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'starting', 'playing', 'ended')),
    max_players INTEGER DEFAULT 4 CHECK (max_players BETWEEN 2 AND 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    settings JSONB DEFAULT '{
        "bestOf": 1,
        "shrinkingZone": false,
        "shrinkInterval": 30,
        "itemSpawns": true,
        "itemSpawnInterval": 60
    }'::jsonb,
    players JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_lobbies_code ON lobbies(code);
CREATE INDEX IF NOT EXISTS idx_lobbies_status ON lobbies(status);
CREATE INDEX IF NOT EXISTS idx_lobbies_host_id ON lobbies(host_id);
CREATE INDEX IF NOT EXISTS idx_lobbies_created_at ON lobbies(created_at);

-- =============================================================================
-- MATCHES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    lobby_code VARCHAR(10),
    winner_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
    player_count INTEGER NOT NULL,
    total_rounds INTEGER DEFAULT 1,
    duration_seconds INTEGER,
    map_config JSONB DEFAULT '{}'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_matches_started_at ON matches(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_winner_id ON matches(winner_id);

-- =============================================================================
-- MATCH RESULTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS match_results (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
    username VARCHAR(50) NOT NULL,
    character_name VARCHAR(50),
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    damage_dealt INTEGER DEFAULT 0,
    items_collected INTEGER DEFAULT 0,
    rounds_won INTEGER DEFAULT 0,
    placement INTEGER CHECK (placement BETWEEN 1 AND 4),
    experience_gained INTEGER DEFAULT 0,
    level_before INTEGER DEFAULT 1,
    level_after INTEGER DEFAULT 1,
    level_up_occurred BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_match_results_match_id ON match_results(match_id);
CREATE INDEX IF NOT EXISTS idx_match_results_player_id ON match_results(player_id);
CREATE INDEX IF NOT EXISTS idx_match_results_placement ON match_results(placement);
CREATE INDEX IF NOT EXISTS idx_match_results_experience ON match_results(experience_gained DESC);

-- =============================================================================
-- LEADERBOARD VIEW
-- =============================================================================
CREATE OR REPLACE VIEW arena_leaderboard AS
SELECT
    p.username,
    p.selected_character,
    p.total_kills,
    p.total_deaths,
    p.total_wins,
    p.games_played,
    p.experience,
    p.character_level,
    CASE WHEN p.total_deaths > 0
        THEN ROUND(p.total_kills::numeric / p.total_deaths, 2)
        ELSE p.total_kills
    END AS kd_ratio,
    CASE WHEN p.games_played > 0
        THEN ROUND(p.total_wins::numeric / p.games_played * 100, 1)
        ELSE 0
    END AS win_rate
FROM players p
ORDER BY p.total_wins DESC, p.total_kills DESC;

-- =============================================================================
-- HEALTH CHECK & MIGRATION TRACKING
-- =============================================================================
CREATE TABLE IF NOT EXISTS health_check (
    id SERIAL PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'OK',
    last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO health_check (status) VALUES ('OK') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version, description) VALUES
    ('20260308_000000_initial_schema', 'Initial Arena database schema'),
    ('20260310_000000_backfill_players', 'Backfill player data from match results'),
    ('20260310_000001_rename_characters', 'Rename characters to academic theme')
ON CONFLICT (version) DO NOTHING;
