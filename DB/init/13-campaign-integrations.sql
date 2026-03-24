-- =============================================================================
-- CAMPAIGN INTEGRATIONS — Google Docs exports + Jitsi recording tracking
-- =============================================================================
-- Extends campaign schema with integration infrastructure.
-- Run against: arena_db as arena_user (or postgres superuser)
-- =============================================================================

-- =============================================================================
-- GOOGLE DOCS EXPORT TRACKING
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_doc_exports (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL,
    doc_type VARCHAR(20) NOT NULL CHECK (doc_type IN ('journal', 'penpal', 'vocab', 'report')),
    title VARCHAR(200) NOT NULL,
    folder VARCHAR(200) NOT NULL,
    content_preview TEXT,
    google_doc_id VARCHAR(200),
    google_doc_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'exported', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_exports_player ON campaign_doc_exports(player_id);

-- =============================================================================
-- JITSI RECORDING TRACKING
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_jitsi_recordings (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    jitsi_room VARCHAR(200) NOT NULL,
    participants JSONB NOT NULL DEFAULT '[]'::jsonb,
    country_id VARCHAR(60),
    videovault_clip_id VARCHAR(100),
    google_drive_url TEXT,
    duration_seconds INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'recording' CHECK (status IN ('recording', 'processing', 'complete', 'failed')),
    recording_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recording_ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jitsi_recordings_session ON campaign_jitsi_recordings(session_id);

-- =============================================================================
-- MIGRATION TRACKING
-- =============================================================================
INSERT INTO schema_migrations (version, description) VALUES
    ('20260324_000006_campaign_integrations', 'Google Docs exports + Jitsi recording tracking')
ON CONFLICT (version) DO NOTHING;
