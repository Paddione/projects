-- Migration: Rename characters from medieval to L2P academic theme
-- Date: 2026-03-10

BEGIN;

-- Update players table defaults and existing values
ALTER TABLE players ALTER COLUMN selected_character SET DEFAULT 'student';

UPDATE players SET selected_character = CASE selected_character
    WHEN 'warrior' THEN 'student'
    WHEN 'soldier' THEN 'student'
    WHEN 'rogue' THEN 'researcher'
    WHEN 'mage' THEN 'professor'
    WHEN 'tank' THEN 'dean'
    WHEN 'zombie' THEN 'librarian'
    ELSE selected_character
END
WHERE selected_character IN ('warrior', 'soldier', 'rogue', 'mage', 'tank', 'zombie');

-- Update match_results character names
UPDATE match_results SET character_name = CASE character_name
    WHEN 'warrior' THEN 'student'
    WHEN 'soldier' THEN 'student'
    WHEN 'rogue' THEN 'researcher'
    WHEN 'mage' THEN 'professor'
    WHEN 'tank' THEN 'dean'
    WHEN 'zombie' THEN 'librarian'
    ELSE character_name
END
WHERE character_name IN ('warrior', 'soldier', 'rogue', 'mage', 'tank', 'zombie');

-- Record migration
INSERT INTO schema_migrations (version, description)
VALUES ('20260310_000001_rename_characters', 'Rename characters from medieval to L2P academic theme');

COMMIT;
