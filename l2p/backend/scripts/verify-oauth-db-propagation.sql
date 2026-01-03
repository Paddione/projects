-- Manual SQL queries to verify OAuth database propagation
-- Run these queries to check if user game profiles are being created properly

-- 1. Check how many game profiles exist
SELECT COUNT(*) as total_game_profiles FROM user_game_profiles;

-- 2. View all game profiles with details
SELECT
    auth_user_id,
    selected_character,
    character_level,
    experience_points,
    created_at,
    updated_at
FROM user_game_profiles
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check if a specific user (by auth_user_id) has a game profile
-- Replace <USER_ID> with the actual userId from the auth service
-- SELECT * FROM user_game_profiles WHERE auth_user_id = <USER_ID>;

-- 4. Monitor new game profiles being created (run before and after OAuth login)
SELECT
    auth_user_id,
    selected_character,
    character_level,
    created_at
FROM user_game_profiles
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;

-- 5. Check for any orphaned profiles (profiles without corresponding auth users)
-- This is informational only - you'll need to join with auth service data to verify

-- 6. Clean up test users (CAREFUL - only run if you know what you're doing!)
-- DELETE FROM user_game_profiles WHERE auth_user_id IN (
--     SELECT auth_user_id FROM user_game_profiles
--     WHERE created_at > NOW() - INTERVAL '1 hour'
--     AND selected_character = 'student'
--     LIMIT 5
-- );
