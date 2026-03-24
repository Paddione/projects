-- =============================================================================
-- CAMPAIGN NEWSPAPER & RADIO — Read tracking and catch-question answers
-- =============================================================================
-- Extends campaign schema with newspaper/radio learning systems.
-- Run against: arena_db as arena_user (or postgres superuser)
-- =============================================================================

-- =============================================================================
-- NEWSPAPER READ TRACKING
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_newspaper_reads (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES campaign_players(id) ON DELETE CASCADE,
    country_id VARCHAR(60) NOT NULL,
    article_id VARCHAR(100) NOT NULL,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_newspaper_reads_player
    ON campaign_newspaper_reads(player_id);

-- =============================================================================
-- RADIO "DID YOU CATCH THAT?" ANSWERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_radio_catches (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES campaign_players(id) ON DELETE CASCADE,
    clip_id VARCHAR(100) NOT NULL,
    correct BOOLEAN NOT NULL,
    respect_earned INTEGER NOT NULL DEFAULT 0,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_radio_catches_player
    ON campaign_radio_catches(player_id);

-- =============================================================================
-- MIGRATION TRACKING
-- =============================================================================
INSERT INTO schema_migrations (version, description) VALUES
    ('20260324_000003_campaign_newspaper_radio', 'Newspaper reads and radio catch tracking')
ON CONFLICT (version) DO NOTHING;
