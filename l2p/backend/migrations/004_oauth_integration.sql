-- Migration: OAuth Integration with Auth Service
-- Created: 2025-01-01
-- Description: Adds game profiles table and migration mapping for OAuth integration

-- ============================================================================
-- User Game Profiles Table
-- Stores game-specific data linked to auth service users
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_game_profiles (
    auth_user_id INTEGER PRIMARY KEY,  -- References auth.users.id from auth service
    selected_character VARCHAR(50) DEFAULT 'student',
    character_level INTEGER DEFAULT 1 NOT NULL,
    experience_points INTEGER DEFAULT 0 NOT NULL,
    preferences JSONB DEFAULT '{"language": "en", "theme": "light"}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for user_game_profiles
CREATE INDEX user_game_profiles_level_idx ON user_game_profiles(character_level);
CREATE INDEX user_game_profiles_character_idx ON user_game_profiles(selected_character);

-- ============================================================================
-- User Migration Mapping Table
-- Tracks mapping between old L2P users and new auth service users
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_migration_mapping (
    old_l2p_user_id INTEGER PRIMARY KEY,  -- Old users.id from L2P
    auth_user_id INTEGER NOT NULL,        -- New auth.users.id from auth service
    migration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    migration_strategy VARCHAR(50) NOT NULL,  -- 'created', 'merged', 'matched'
    UNIQUE(auth_user_id)
);

-- Create index for user_migration_mapping
CREATE INDEX user_migration_mapping_auth_id_idx ON user_migration_mapping(auth_user_id);

-- ============================================================================
-- Add auth_user_id columns to existing tables for gradual migration
-- ============================================================================
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS auth_user_id INTEGER;
ALTER TABLE player_results ADD COLUMN IF NOT EXISTS auth_user_id INTEGER;
ALTER TABLE hall_of_fame ADD COLUMN IF NOT EXISTS auth_user_id INTEGER;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS lobbies_auth_user_id_idx ON lobbies(auth_user_id);
CREATE INDEX IF NOT EXISTS player_results_auth_user_id_idx ON player_results(auth_user_id);
CREATE INDEX IF NOT EXISTS hall_of_fame_auth_user_id_idx ON hall_of_fame(auth_user_id);

-- ============================================================================
-- Helper function to get game profile with defaults
-- ============================================================================
CREATE OR REPLACE FUNCTION get_or_create_game_profile(p_auth_user_id INTEGER)
RETURNS TABLE (
    auth_user_id INTEGER,
    selected_character VARCHAR(50),
    character_level INTEGER,
    experience_points INTEGER,
    preferences JSONB,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
) AS $$
BEGIN
    -- Try to get existing profile
    RETURN QUERY
    SELECT * FROM user_game_profiles WHERE user_game_profiles.auth_user_id = p_auth_user_id;

    -- If no profile found, create one
    IF NOT FOUND THEN
        INSERT INTO user_game_profiles (auth_user_id)
        VALUES (p_auth_user_id)
        ON CONFLICT ON CONSTRAINT user_game_profiles_pkey DO NOTHING;

        RETURN QUERY
        SELECT * FROM user_game_profiles WHERE user_game_profiles.auth_user_id = p_auth_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_or_create_game_profile IS 'Get game profile for user, creating if it does not exist';

-- ============================================================================
-- Trigger to update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_game_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_game_profiles_updated_at
BEFORE UPDATE ON user_game_profiles
FOR EACH ROW
EXECUTE FUNCTION update_game_profile_timestamp();
