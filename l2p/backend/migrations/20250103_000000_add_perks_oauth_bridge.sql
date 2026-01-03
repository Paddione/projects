-- Migration: Add OAuth bridge for perks system
-- This allows OAuth users to use the perks system by creating placeholder users
-- in the legacy users table and maintaining a mapping

-- Add auth_user_id to user_perks for future reference
ALTER TABLE user_perks ADD COLUMN IF NOT EXISTS auth_user_id INTEGER;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS user_perks_auth_user_id_idx ON user_perks(auth_user_id);

-- Function to get or create legacy user_id for OAuth users (perks bridge)
-- This function ensures OAuth users can interact with the perks system
-- by creating a placeholder user in the legacy users table
CREATE OR REPLACE FUNCTION get_or_create_legacy_user_id(p_auth_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_user_id INTEGER;
BEGIN
  -- Check if mapping already exists
  SELECT old_l2p_user_id INTO v_user_id
  FROM user_migration_mapping
  WHERE auth_user_id = p_auth_user_id;

  IF v_user_id IS NOT NULL THEN
    RETURN v_user_id;
  END IF;

  -- Create placeholder user for OAuth user
  -- This user exists only to satisfy foreign key constraints in the perks system
  INSERT INTO users (
    username,
    email,
    password_hash,
    selected_character,
    character_level,
    experience_points,
    is_active
  )
  SELECT
    'oauth_' || p_auth_user_id::text,
    'oauth_' || p_auth_user_id::text || '@placeholder.local',
    'OAUTH_USER_NO_PASSWORD',
    COALESCE(ugp.selected_character, 'student'),
    COALESCE(ugp.character_level, 1),
    COALESCE(ugp.experience_points, 0),
    true
  FROM user_game_profiles ugp
  WHERE ugp.auth_user_id = p_auth_user_id
  ON CONFLICT (username) DO NOTHING
  RETURNING id INTO v_user_id;

  -- If conflict occurred (user already exists), fetch the existing user_id
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM users
    WHERE username = 'oauth_' || p_auth_user_id::text;
  END IF;

  -- Create mapping between auth_user_id and legacy user_id
  INSERT INTO user_migration_mapping (old_l2p_user_id, auth_user_id, migration_strategy)
  VALUES (v_user_id, p_auth_user_id, 'oauth_bridge')
  ON CONFLICT (auth_user_id) DO UPDATE SET old_l2p_user_id = v_user_id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;
