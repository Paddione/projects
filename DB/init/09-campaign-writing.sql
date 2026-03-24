-- =============================================================================
-- CAMPAIGN WRITING QUEST SUBMISSIONS
-- =============================================================================
-- Writing quest submissions for English learning system.
-- Run against: arena_db as arena_user (or postgres superuser)
-- =============================================================================

-- Writing quest submissions
CREATE TABLE IF NOT EXISTS campaign_writing_submissions (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES campaign_players(id) ON DELETE CASCADE,
    quest_id VARCHAR(100) NOT NULL,
    text TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    grade_json JSONB,
    ai_graded BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_writing_player
    ON campaign_writing_submissions(player_id);

INSERT INTO schema_migrations (version, description) VALUES
    ('20260324_000002_campaign_writing', 'Writing quest submissions table')
ON CONFLICT (version) DO NOTHING;
