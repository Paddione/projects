-- 006_migrate_l2p_cosmetic_perks.sql
-- Add legacy L2P cosmetic perks to shop catalog and migrate existing unlocks

-- Add cosmetic avatar items to catalog (free — already earned via gameplay)
-- These map to the three L2P avatar perk collections:
--   custom_avatars_basic    (level 3):  scientist, explorer, artist
--   custom_avatars_advanced (level 12): detective, chef, astronaut
--   custom_avatars_elite    (level 20): wizard, ninja, dragon
INSERT INTO auth.shop_catalog (item_id, item_type, name, description, respect_cost) VALUES
  ('avatar_scientist', 'skin', 'Scientist Avatar', 'Methodical researcher with lab coat and goggles.', 0),
  ('avatar_explorer',  'skin', 'Explorer Avatar',  'Adventure seeker with safari hat and compass.',    0),
  ('avatar_artist',    'skin', 'Artist Avatar',    'Creative thinker with beret and palette.',         0),
  ('avatar_detective', 'skin', 'Detective Avatar', 'Sharp observer with magnifying glass and coat.',   0),
  ('avatar_chef',      'skin', 'Chef Avatar',      'Recipe for success with chef hat and apron.',      0),
  ('avatar_astronaut', 'skin', 'Astronaut Avatar', 'Shoots for the stars in space helmet and suit.',   0),
  ('avatar_wizard',    'skin', 'Wizard Avatar',    'Master of knowledge with pointy hat and staff.',   0),
  ('avatar_ninja',     'skin', 'Ninja Avatar',     'Silent but deadly accurate — masked and stealthy.',0),
  ('avatar_dragon',    'skin', 'Dragon Avatar',    'Mythical quiz beast in fearsome dragon form.',     0)
ON CONFLICT (item_id) DO NOTHING;

-- Grant newly added avatar items to all existing users (free items)
INSERT INTO auth.inventory (user_id, item_id, item_type, acquisition_source)
SELECT
  u.id,
  c.item_id,
  c.item_type,
  'initial_grant'
FROM auth.users u
CROSS JOIN auth.shop_catalog c
WHERE c.item_id LIKE 'avatar_%'
  AND c.respect_cost = 0
ON CONFLICT (user_id, item_id) DO NOTHING;

-- NOTE: Cross-database migration of L2P user_perk_drafts -> auth.inventory
-- requires a Node.js migration script since PostgreSQL cannot query across databases.
-- This will be handled by a one-time migration script run during deployment.
-- The script should:
--   1. Connect to l2p_db and query user_perk_drafts WHERE chosen_perk_id IS NOT NULL
--      AND perk_id matches a cosmetic avatar perk (custom_avatars_basic/advanced/elite).
--   2. Resolve the l2p user_id to an auth.users id via the auth_user_id column in
--      l2p_db.users or l2p_db.user_game_profiles.
--   3. For each matched user, insert into auth.inventory the specific avatar items
--      corresponding to the unlocked perk collection, with acquisition_source = 'level_unlock'.
--   4. Use ON CONFLICT DO NOTHING for idempotency.
