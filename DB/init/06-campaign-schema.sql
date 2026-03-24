-- =============================================================================
-- CAMPAIGN DATABASE TABLES - Lives in arena_db
-- =============================================================================
-- World Campaign mode: persistent progression, quests, NPC dialogue, vocab cards.
-- All tables prefixed with campaign_ to avoid collision with deathmatch tables.
-- Run against: arena_db as arena_user (or postgres superuser)
-- =============================================================================

-- =============================================================================
-- CAMPAIGN PLAYERS — Persistent world state per user
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_players (
    id SERIAL PRIMARY KEY,
    auth_user_id INTEGER NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'protagonist'
        CHECK (role IN ('protagonist', 'auxiliary')),
    protagonist_slot SMALLINT
        CHECK (protagonist_slot IS NULL OR protagonist_slot IN (1, 2)),
    character_id VARCHAR(50) NOT NULL DEFAULT 'student'
        CHECK (character_id IN ('student', 'researcher', 'professor', 'dean', 'librarian')),
    current_map_id VARCHAR(100) NOT NULL DEFAULT 'vogelsen',
    current_tile_x INTEGER NOT NULL DEFAULT 8,
    current_tile_y INTEGER NOT NULL DEFAULT 12,
    english_level VARCHAR(5) NOT NULL DEFAULT 'A1'
        CHECK (english_level IN ('A1', 'A2', 'B1', 'B2', 'C1')),
    passport JSONB NOT NULL DEFAULT '{
        "stamps": [],
        "countries_visited": ["germany"],
        "waypoints_unlocked": []
    }'::jsonb,
    total_respect_earned INTEGER NOT NULL DEFAULT 0,
    total_quizzes_completed INTEGER NOT NULL DEFAULT 0,
    total_quiz_accuracy NUMERIC(5,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_checkpoint_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_players_auth_user
    ON campaign_players(auth_user_id);

-- =============================================================================
-- CAMPAIGN QUESTS — Per-player quest tracking
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_quests (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES campaign_players(id) ON DELETE CASCADE,
    quest_id VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('available', 'active', 'complete', 'failed', 'hint_passed')),
    progress JSONB NOT NULL DEFAULT '{}'::jsonb,
    respect_earned INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE(player_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_quests_player
    ON campaign_quests(player_id);
CREATE INDEX IF NOT EXISTS idx_campaign_quests_status
    ON campaign_quests(player_id, status);

-- =============================================================================
-- CAMPAIGN WORLD STATE — Seeded country/region data (not per-player)
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_world_state (
    country_id VARCHAR(60) PRIMARY KEY,
    name_en VARCHAR(100) NOT NULL,
    name_de VARCHAR(100) NOT NULL,
    continent VARCHAR(30) NOT NULL,
    tile_color_slot CHAR(1) NOT NULL
        CHECK (tile_color_slot IN ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H')),
    hex_color VARCHAR(7) NOT NULL,
    difficulty_tier SMALLINT NOT NULL DEFAULT 1
        CHECK (difficulty_tier BETWEEN 1 AND 5),
    boss_id VARCHAR(100),
    l2p_quiz_set_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    videovault_intro VARCHAR(100),
    waypoints JSONB NOT NULL DEFAULT '[]'::jsonb,
    unlocked_at TIMESTAMPTZ
);

-- Seed Germany as the starting country
INSERT INTO campaign_world_state (country_id, name_en, name_de, continent, tile_color_slot, hex_color, difficulty_tier, boss_id, waypoints)
VALUES (
    'germany',
    'Germany',
    'Deutschland',
    'europe',
    'A',
    '#E8C97A',
    1,
    'examiner_germany',
    '[
        {"id": "waypoint_de_fr_kehl", "name": "Kehl Border Crossing", "to_country": "france"},
        {"id": "waypoint_de_nl_bad_nieuweschans", "name": "Bad Nieuweschans", "to_country": "netherlands"},
        {"id": "waypoint_de_pl_frankfurt_oder", "name": "Frankfurt (Oder)", "to_country": "poland"}
    ]'::jsonb
) ON CONFLICT (country_id) DO NOTHING;

-- =============================================================================
-- CAMPAIGN VOCAB — Collected vocabulary cards per player
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_vocab (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES campaign_players(id) ON DELETE CASCADE,
    word_en VARCHAR(100) NOT NULL,
    word_de VARCHAR(100) NOT NULL,
    definition_en TEXT,
    example_en TEXT,
    found_in_country VARCHAR(60) DEFAULT 'germany',
    found_at_npc VARCHAR(100),
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player_id, word_en)
);

CREATE INDEX IF NOT EXISTS idx_campaign_vocab_player
    ON campaign_vocab(player_id);

-- =============================================================================
-- CAMPAIGN SESSIONS — Session log for analytics / reconnect
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_sessions (
    id SERIAL PRIMARY KEY,
    host_player_id INTEGER NOT NULL REFERENCES campaign_players(id) ON DELETE CASCADE,
    companion_player_id INTEGER REFERENCES campaign_players(id) ON DELETE SET NULL,
    auxiliary_count INTEGER NOT NULL DEFAULT 0,
    current_map_id VARCHAR(100) NOT NULL DEFAULT 'vogelsen',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    respect_earned INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_campaign_sessions_host
    ON campaign_sessions(host_player_id);

-- =============================================================================
-- CAMPAIGN PENDING REWARDS — Retry queue for failed auth service calls
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_pending_rewards (
    id SERIAL PRIMARY KEY,
    auth_user_id INTEGER NOT NULL,
    reward_type VARCHAR(20) NOT NULL CHECK (reward_type IN ('respect', 'xp')),
    amount INTEGER NOT NULL,
    metadata JSONB,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MIGRATION TRACKING
-- =============================================================================
INSERT INTO schema_migrations (version, description) VALUES
    ('20260323_000000_campaign_schema', 'Campaign mode tables: players, quests, world state, vocab, sessions')
ON CONFLICT (version) DO NOTHING;
