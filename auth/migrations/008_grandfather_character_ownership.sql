-- Grant inventory entries for players who currently have a non-student character selected.
-- Uses 'migration' acquisition_source to distinguish from purchases.
INSERT INTO auth.inventory (user_id, item_id, item_type, acquisition_source)
SELECT
  p.user_id,
  'character_' || p.selected_character,
  'character',
  'migration'
FROM auth.profiles p
WHERE p.selected_character != 'student'
  AND p.selected_character IS NOT NULL
ON CONFLICT (user_id, item_id) DO NOTHING;
