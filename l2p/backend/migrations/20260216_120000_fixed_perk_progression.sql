-- Migration: Replace draft-based perks with fixed per-level progression
-- Created: 2026-02-16
-- Purpose: Add level_required back to gameplay perks for deterministic unlocking

-- ============================================
-- PHASE 1: Re-add level_required column
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'perks' AND column_name = 'level_required') THEN
        ALTER TABLE perks ADD COLUMN level_required INTEGER DEFAULT 0;
    END IF;
END $$;

-- ============================================
-- PHASE 2: Assign fixed levels to all 40 gameplay perks
-- Category rotation: time -> info -> scoring -> recovery -> xp
-- Tier escalation: Tier 1 (L1-15), Tier 2 (L16-30), Tier 3 (L31-40)
-- ============================================

-- Level 1-5: Tier 1, one from each category
UPDATE perks SET level_required = 1 WHERE name = 'time_cushion';
UPDATE perks SET level_required = 2 WHERE name = 'category_reveal';
UPDATE perks SET level_required = 3 WHERE name = 'score_boost';
UPDATE perks SET level_required = 4 WHERE name = 'safety_net';
UPDATE perks SET level_required = 5 WHERE name = 'xp_boost_light';

-- Level 6-10: Tier 1
UPDATE perks SET level_required = 6 WHERE name = 'slow_burn';
UPDATE perks SET level_required = 7 WHERE name = 'difficulty_sense';
UPDATE perks SET level_required = 8 WHERE name = 'speed_demon';
UPDATE perks SET level_required = 9 WHERE name = 'partial_credit';
UPDATE perks SET level_required = 10 WHERE name = 'study_bonus';

-- Level 11-15: Tier 1
UPDATE perks SET level_required = 11 WHERE name = 'early_bird';
UPDATE perks SET level_required = 12 WHERE name = 'fifty_fifty';
UPDATE perks SET level_required = 13 WHERE name = 'streak_master';
UPDATE perks SET level_required = 14 WHERE name = 'bounce_back';
UPDATE perks SET level_required = 15 WHERE name = 'completion_reward';

-- Level 16-20: Tier 2
UPDATE perks SET level_required = 16 WHERE name = 'time_warp';
UPDATE perks SET level_required = 17 WHERE name = 'knowledge_map';
UPDATE perks SET level_required = 18 WHERE name = 'combo_builder';
UPDATE perks SET level_required = 19 WHERE name = 'resilient';
UPDATE perks SET level_required = 20 WHERE name = 'xp_boost_medium';

-- Level 21-25: Tier 2
UPDATE perks SET level_required = 21 WHERE name = 'zen_mode';
UPDATE perks SET level_required = 22 WHERE name = 'hint_master';
UPDATE perks SET level_required = 23 WHERE name = 'perfectionist';
UPDATE perks SET level_required = 24 WHERE name = 'comeback_king';
UPDATE perks SET level_required = 25 WHERE name = 'accuracy_xp';

-- Level 26-30: Tier 2
UPDATE perks SET level_required = 26 WHERE name = 'flash_answer';
UPDATE perks SET level_required = 27 WHERE name = 'double_eliminate';
UPDATE perks SET level_required = 28 WHERE name = 'closer';
UPDATE perks SET level_required = 29 WHERE name = 'double_safety';
UPDATE perks SET level_required = 30 WHERE name = 'streak_xp';

-- Level 31-35: Tier 3
UPDATE perks SET level_required = 31 WHERE name = 'time_lord';
UPDATE perks SET level_required = 32 WHERE name = 'answer_stats';
UPDATE perks SET level_required = 33 WHERE name = 'mega_streak';
UPDATE perks SET level_required = 34 WHERE name = 'iron_will';
UPDATE perks SET level_required = 35 WHERE name = 'xp_boost_major';

-- Level 36-40: Tier 3
UPDATE perks SET level_required = 36 WHERE name = 'temporal_anchor';
UPDATE perks SET level_required = 37 WHERE name = 'oracle_vision';
UPDATE perks SET level_required = 38 WHERE name = 'grand_scorer';
UPDATE perks SET level_required = 39 WHERE name = 'phoenix';
UPDATE perks SET level_required = 40 WHERE name = 'mastery_xp';

-- Create index for level-based lookups
CREATE INDEX IF NOT EXISTS idx_perks_level_required ON perks(level_required);

-- Verify: all 40 gameplay perks should have level_required > 0
DO $$
DECLARE
    unset_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unset_count FROM perks WHERE type = 'gameplay' AND (level_required IS NULL OR level_required = 0);
    IF unset_count > 0 THEN
        RAISE WARNING '% gameplay perks still have level_required = 0 or NULL', unset_count;
    END IF;
END $$;
