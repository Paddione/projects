-- Migration: Backfill players table and fix orphaned match data
-- Date: 2026-03-10
-- Description: The players table was never populated because the frontend
--   never called POST /api/players. Match results and matches were saved
--   with NULL player_id and winner_id due to subqueries against empty table.
--   This migration creates player rows from match_results, then backfills
--   all FK references and recalculates aggregate stats.

BEGIN;

-- Step 1: Create player rows from distinct match_results usernames
-- auth_user_id 1 = paddione, auth_user_id 3 = test_admin (from auth.users)
INSERT INTO players (auth_user_id, username, selected_character, character_level, experience,
                     total_kills, total_deaths, total_wins, games_played, created_at)
SELECT
    CASE username
        WHEN 'paddione' THEN 1
        WHEN 'test_admin' THEN 3
    END as auth_user_id,
    username,
    COALESCE(
        (SELECT mr2.character_name FROM match_results mr2 WHERE mr2.username = mr.username AND mr2.character_name IS NOT NULL LIMIT 1),
        'student'
    ) as selected_character,
    1 as character_level,
    0 as experience,
    0 as total_kills,
    0 as total_deaths,
    0 as total_wins,
    0 as games_played,
    MIN(m.started_at) as created_at
FROM match_results mr
JOIN matches m ON m.id = mr.match_id
WHERE mr.player_id IS NULL
GROUP BY mr.username
ON CONFLICT (auth_user_id) DO NOTHING;

-- Step 2: Backfill player_id in match_results
UPDATE match_results mr
SET player_id = p.id
FROM players p
WHERE mr.username = p.username
  AND mr.player_id IS NULL;

-- Step 3: Backfill winner_id in matches (winner = placement 1)
UPDATE matches m
SET winner_id = mr.player_id
FROM match_results mr
WHERE mr.match_id = m.id
  AND mr.placement = 1
  AND m.winner_id IS NULL;

-- Step 4: Recalculate aggregate player stats from all match_results
UPDATE players p
SET
    total_kills = stats.sum_kills,
    total_deaths = stats.sum_deaths,
    total_wins = stats.sum_wins,
    games_played = stats.total_games,
    experience = stats.sum_xp,
    character_level = GREATEST(1, FLOOR(1 + SQRT(stats.sum_xp::numeric / 50))::int),
    updated_at = CURRENT_TIMESTAMP
FROM (
    SELECT
        player_id,
        COALESCE(SUM(kills), 0) as sum_kills,
        COALESCE(SUM(deaths), 0) as sum_deaths,
        COUNT(CASE WHEN placement = 1 THEN 1 END) as sum_wins,
        COUNT(*) as total_games,
        COALESCE(SUM(experience_gained), 0) as sum_xp
    FROM match_results
    WHERE player_id IS NOT NULL
    GROUP BY player_id
) stats
WHERE p.id = stats.player_id;

-- Step 5: Record migration
INSERT INTO schema_migrations (version, description)
VALUES ('20260310_000000_backfill_players', 'Backfill players table and fix orphaned match data');

COMMIT;
