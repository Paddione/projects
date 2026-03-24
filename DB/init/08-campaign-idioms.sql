-- =============================================================================
-- CAMPAIGN IDIOM CRAFTING — Fragment inventory, recipes, crafted items
-- =============================================================================
-- Extends 07-campaign-currency.sql with idiom crafting system.
-- Run against: arena_db as arena_user (or postgres superuser)
-- =============================================================================

-- =============================================================================
-- IDIOM FRAGMENT INVENTORY
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_idiom_fragments (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES campaign_players(id) ON DELETE CASCADE,
    fragment VARCHAR(30) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    UNIQUE(player_id, fragment)
);

-- =============================================================================
-- CRAFTED IDIOM ITEMS
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_crafted_idioms (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES campaign_players(id) ON DELETE CASCADE,
    idiom_id VARCHAR(100) NOT NULL,
    crafted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consumed_at TIMESTAMPTZ,  -- NULL if persistent or not yet used
    UNIQUE(player_id, idiom_id)  -- can only craft each idiom once
);

-- =============================================================================
-- MIGRATION TRACKING
-- =============================================================================
INSERT INTO schema_migrations (version, description) VALUES
    ('20260324_000001_campaign_idioms', 'Idiom crafting system: fragments, recipes, crafted items')
ON CONFLICT (version) DO NOTHING;
