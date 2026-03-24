-- =============================================================================
-- CAMPAIGN CURRENCY & COUNTRY EXPANSION — Dollar system, rent, housing, phrases
-- =============================================================================
-- Extends 06-campaign-schema.sql with economic gameplay.
-- Run against: arena_db as arena_user (or postgres superuser)
-- =============================================================================

-- =============================================================================
-- EXTEND CAMPAIGN PLAYERS — Dollar balance + player name
-- =============================================================================
ALTER TABLE campaign_players ADD COLUMN IF NOT EXISTS dollar_balance INTEGER NOT NULL DEFAULT 200;
ALTER TABLE campaign_players ADD COLUMN IF NOT EXISTS player_name VARCHAR(50);

-- =============================================================================
-- RENT TRACKING
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_rent_ledger (
    id SERIAL PRIMARY KEY,
    payer_id INTEGER NOT NULL REFERENCES campaign_players(id),
    receiver_id INTEGER NOT NULL REFERENCES campaign_players(id),
    amount INTEGER NOT NULL DEFAULT 50,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- DOLLAR TRANSACTION LOG
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_dollar_transactions (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES campaign_players(id),
    amount INTEGER NOT NULL,  -- positive = earned, negative = spent
    source VARCHAR(50) NOT NULL,  -- 'quest_reward', 'boss_defeat', 'rent_paid', 'rent_received', 'job', 'item_sale', 'housing'
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- HOUSING OWNERSHIP
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_housing (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES campaign_players(id),
    property_id VARCHAR(100) NOT NULL,
    property_name VARCHAR(200) NOT NULL,
    country VARCHAR(60) NOT NULL DEFAULT 'germany',
    stage VARCHAR(20) NOT NULL DEFAULT 'rented',  -- 'rented', 'owned', 'upgraded'
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player_id, property_id)
);

-- =============================================================================
-- PHRASE COLLECTIBLES (syllables)
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaign_phrases (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES campaign_players(id),
    country_id VARCHAR(60) NOT NULL,
    syllable VARCHAR(20) NOT NULL,
    syllable_index INTEGER NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player_id, country_id, syllable_index)
);

-- =============================================================================
-- SEED 13 ENGLISH-SPEAKING COUNTRIES
-- =============================================================================
INSERT INTO campaign_world_state (country_id, name_en, name_de, continent, tile_color_slot, hex_color, difficulty_tier, boss_id, waypoints) VALUES
    ('singapore', 'Singapore', 'Singapur', 'asia', 'F', '#5EA8A0', 2, 'examiner_singapore', '[]'),
    ('philippines', 'Philippines', 'Philippinen', 'asia', 'D', '#C97A6B', 2, 'examiner_philippines', '[]'),
    ('new_zealand', 'New Zealand', 'Neuseeland', 'oceania', 'B', '#6B9E5E', 2, 'examiner_new_zealand', '[]'),
    ('ireland', 'Ireland', 'Irland', 'europe', 'B', '#6B9E5E', 2, 'examiner_ireland', '[]'),
    ('south_africa', 'South Africa', 'Südafrika', 'africa', 'A', '#E8C97A', 3, 'examiner_south_africa', '[]'),
    ('nigeria', 'Nigeria', 'Nigeria', 'africa', 'D', '#C97A6B', 3, 'examiner_nigeria', '[]'),
    ('jamaica', 'Jamaica', 'Jamaika', 'north_america', 'E', '#9EA855', 3, 'examiner_jamaica', '[]'),
    ('canada', 'Canada', 'Kanada', 'north_america', 'C', '#6B8CAE', 3, 'examiner_canada', '[]'),
    ('scotland', 'Scotland', 'Schottland', 'europe', 'G', '#8C4A5E', 3, 'examiner_scotland', '[]'),
    ('wales', 'Wales', 'Wales', 'europe', 'H', '#8C7AAE', 3, 'examiner_wales', '[]'),
    ('england', 'England', 'England', 'europe', 'C', '#6B8CAE', 4, 'examiner_england', '[]'),
    ('australia', 'Australia', 'Australien', 'oceania', 'A', '#E8C97A', 4, 'examiner_australia', '[]'),
    ('usa', 'USA', 'USA', 'north_america', 'D', '#C97A6B', 5, 'examiner_usa', '[]')
ON CONFLICT (country_id) DO NOTHING;

-- =============================================================================
-- MIGRATION TRACKING
-- =============================================================================
INSERT INTO schema_migrations (version, description) VALUES
    ('20260324_000000_campaign_currency', 'Dollar currency, rent, housing, phrases, 13 English countries')
ON CONFLICT (version) DO NOTHING;
