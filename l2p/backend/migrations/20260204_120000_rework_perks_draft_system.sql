-- Migration: Rework perks to draft-based skill tree system
-- Created: 2026-02-04
-- Purpose: Replace flat auto-unlock perk system with draft-based gameplay perks

-- ============================================
-- PHASE 1: Archive old tables
-- ============================================

-- Archive existing perks table
CREATE TABLE IF NOT EXISTS perks_archive AS TABLE perks;
CREATE TABLE IF NOT EXISTS user_perks_archive AS TABLE user_perks;

-- Drop old trigger
DROP TRIGGER IF EXISTS trigger_perk_unlock ON users;
DROP FUNCTION IF EXISTS check_perk_unlocks();

-- ============================================
-- PHASE 2: Clear and restructure perks table
-- ============================================

-- Clear existing data
TRUNCATE user_perks CASCADE;
TRUNCATE perks CASCADE;

-- Alter perks table for draft system
DO $$
BEGIN
    -- Drop level_required if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'perks' AND column_name = 'level_required') THEN
        ALTER TABLE perks DROP COLUMN level_required;
    END IF;

    -- Add effect_type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'perks' AND column_name = 'effect_type') THEN
        ALTER TABLE perks ADD COLUMN effect_type VARCHAR(50);
    END IF;

    -- Add effect_config
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'perks' AND column_name = 'effect_config') THEN
        ALTER TABLE perks ADD COLUMN effect_config JSONB DEFAULT '{}';
    END IF;

    -- Add tier
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'perks' AND column_name = 'tier') THEN
        ALTER TABLE perks ADD COLUMN tier INTEGER DEFAULT 1;
    END IF;
END $$;

-- ============================================
-- PHASE 3: Create user_perk_drafts table
-- ============================================

CREATE TABLE IF NOT EXISTS user_perk_drafts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    level INTEGER NOT NULL,
    offered_perk_ids INTEGER[] NOT NULL,
    chosen_perk_id INTEGER,
    dumped BOOLEAN DEFAULT false,
    drafted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, level)
);

CREATE INDEX IF NOT EXISTS idx_user_perk_drafts_user_id ON user_perk_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_perk_drafts_chosen ON user_perk_drafts(user_id, chosen_perk_id) WHERE chosen_perk_id IS NOT NULL;

-- ============================================
-- PHASE 4: Add needs_perk_redraft to user_game_profiles
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'user_game_profiles' AND column_name = 'needs_perk_redraft') THEN
        ALTER TABLE user_game_profiles ADD COLUMN needs_perk_redraft BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Set needs_perk_redraft for existing players above level 1
UPDATE user_game_profiles SET needs_perk_redraft = true WHERE character_level > 1;

-- Also handle legacy users table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'needs_perk_redraft') THEN
        ALTER TABLE users ADD COLUMN needs_perk_redraft BOOLEAN DEFAULT false;
    END IF;
END $$;

UPDATE users SET needs_perk_redraft = true WHERE character_level > 1;

-- ============================================
-- PHASE 5: Seed 40 gameplay perks
-- ============================================

-- All perks use type='gameplay' and new categories: time, info, scoring, recovery, xp

-- ---------- TIME PERKS (8) ----------
INSERT INTO perks (name, category, type, effect_type, effect_config, tier, title, description, is_active) VALUES

-- Tier 1
('time_cushion', 'time', 'gameplay', 'bonus_seconds',
 '{"bonusSeconds": 3}', 1,
 'Time Cushion', '+3 bonus seconds effective time per question', true),

('slow_burn', 'time', 'gameplay', 'timer_speed',
 '{"timerSpeedMultiplier": 0.92}', 1,
 'Slow Burn', 'Timer runs 8% slower for score calculation', true),

-- Tier 2
('time_warp', 'time', 'gameplay', 'bonus_seconds',
 '{"bonusSeconds": 5}', 2,
 'Time Warp', '+5 bonus seconds effective time per question', true),

('zen_mode', 'time', 'gameplay', 'timer_speed',
 '{"timerSpeedMultiplier": 0.85}', 2,
 'Zen Mode', 'Timer runs 15% slower for score calculation', true),

-- Tier 3
('time_lord', 'time', 'gameplay', 'bonus_seconds',
 '{"bonusSeconds": 8}', 3,
 'Time Lord', '+8 bonus seconds effective time per question', true),

('temporal_anchor', 'time', 'gameplay', 'timer_speed',
 '{"timerSpeedMultiplier": 0.78}', 3,
 'Temporal Anchor', 'Timer runs 22% slower for score calculation', true),

('early_bird', 'time', 'gameplay', 'speed_threshold',
 '{"speedThresholdSeconds": 10, "speedBonusPoints": 25}', 1,
 'Early Bird', '+25 bonus points if you answer within 10 seconds', true),

('flash_answer', 'time', 'gameplay', 'speed_threshold',
 '{"speedThresholdSeconds": 5, "speedBonusPoints": 50}', 2,
 'Flash Answer', '+50 bonus points if you answer within 5 seconds', true),

-- ---------- INFORMATION PERKS (8) ----------
('fifty_fifty', 'info', 'gameplay', 'eliminate_wrong',
 '{"eliminateCount": 1, "usesPerGame": 3}', 1,
 'Fifty-Fifty Lite', 'Eliminate 1 wrong answer, 3 uses per game', true),

('double_eliminate', 'info', 'gameplay', 'eliminate_wrong',
 '{"eliminateCount": 2, "usesPerGame": 2}', 2,
 'Double Eliminate', 'Eliminate 2 wrong answers, 2 uses per game', true),

('category_reveal', 'info', 'gameplay', 'show_category',
 '{"showCategory": true}', 1,
 'Category Reveal', 'See the question category before answering', true),

('difficulty_sense', 'info', 'gameplay', 'show_difficulty',
 '{"showDifficulty": true}', 1,
 'Difficulty Sense', 'See the question difficulty rating', true),

('hint_master', 'info', 'gameplay', 'show_hint',
 '{"showHint": true, "usesPerGame": 2}', 2,
 'Hint Master', 'Get a subtle hint for 2 questions per game', true),

('answer_stats', 'info', 'gameplay', 'show_answer_stats',
 '{"showAnswerStats": true}', 1,
 'Answer Statistics', 'See how other players answered after each question', true),

('knowledge_map', 'info', 'gameplay', 'show_category',
 '{"showCategory": true, "showDifficulty": true}', 2,
 'Knowledge Map', 'See both category and difficulty for each question', true),

('oracle_vision', 'info', 'gameplay', 'eliminate_wrong',
 '{"eliminateCount": 2, "usesPerGame": 4}', 3,
 'Oracle Vision', 'Eliminate 2 wrong answers, 4 uses per game', true),

-- ---------- SCORING PERKS (8) ----------
('score_boost', 'scoring', 'gameplay', 'base_score_multiplier',
 '{"baseScoreMultiplier": 1.1}', 1,
 'Score Boost', '+10% base score on all correct answers', true),

('streak_master', 'scoring', 'gameplay', 'max_streak_multiplier',
 '{"maxStreakMultiplier": 6}', 1,
 'Streak Master', 'Maximum streak multiplier increased to 6x (from 5x)', true),

('combo_builder', 'scoring', 'gameplay', 'streak_growth',
 '{"streakGrowthRate": 1.5}', 2,
 'Combo Builder', 'Streak multiplier increases 50% faster', true),

('speed_demon', 'scoring', 'gameplay', 'speed_bonus_multiplier',
 '{"speedBonusMultiplier": 1.25}', 1,
 'Speed Demon', '+25% bonus on the time component of score', true),

('perfectionist', 'scoring', 'gameplay', 'perfect_bonus',
 '{"perfectGameBonus": 500}', 2,
 'Perfectionist', '+500 bonus points for a perfect game (all correct)', true),

('closer', 'scoring', 'gameplay', 'closer_bonus',
 '{"closerBonusPercentage": 0.15, "lastQuestionsCount": 3}', 2,
 'The Closer', '+15% score on the last 3 questions', true),

('mega_streak', 'scoring', 'gameplay', 'max_streak_multiplier',
 '{"maxStreakMultiplier": 7, "streakGrowthRate": 1.25}', 3,
 'Mega Streak', 'Max multiplier 7x and streak grows 25% faster', true),

('grand_scorer', 'scoring', 'gameplay', 'base_score_multiplier',
 '{"baseScoreMultiplier": 1.2}', 3,
 'Grand Scorer', '+20% base score on all correct answers', true),

-- ---------- RECOVERY PERKS (8) ----------
('safety_net', 'recovery', 'gameplay', 'free_wrong_answers',
 '{"freeWrongAnswers": 1}', 1,
 'Safety Net', '1 wrong answer per game that does not reset your streak', true),

('partial_credit', 'recovery', 'gameplay', 'partial_credit',
 '{"partialCreditRate": 0.25}', 1,
 'Partial Credit', 'Earn 25% of possible points even on wrong answers', true),

('bounce_back', 'recovery', 'gameplay', 'bounce_back',
 '{"bounceBackBonus": 15}', 1,
 'Bounce Back', '+15 bonus points on the first correct answer after a wrong one', true),

('resilient', 'recovery', 'gameplay', 'base_multiplier',
 '{"baseMultiplier": 1.5}', 2,
 'Resilient', 'After streak reset, multiplier starts at 1.5x instead of 1x', true),

('double_safety', 'recovery', 'gameplay', 'free_wrong_answers',
 '{"freeWrongAnswers": 2}', 2,
 'Double Safety', '2 wrong answers per game without streak reset', true),

('comeback_king', 'recovery', 'gameplay', 'comeback',
 '{"comebackThreshold": 0.5, "comebackMultiplier": 1.3}', 2,
 'Comeback King', 'If below 50% accuracy midgame, +30% score on remaining questions', true),

('iron_will', 'recovery', 'gameplay', 'free_wrong_answers',
 '{"freeWrongAnswers": 3, "partialCreditRate": 0.1}', 3,
 'Iron Will', '3 free wrong answers + 10% partial credit on others', true),

('phoenix', 'recovery', 'gameplay', 'phoenix',
 '{"phoenixThreshold": 3, "phoenixMultiplier": 2.0}', 3,
 'Phoenix', 'After 3 wrong answers in a row, next correct answer scores 2x', true),

-- ---------- XP PERKS (8) ----------
('xp_boost_light', 'xp', 'gameplay', 'xp_multiplier',
 '{"xpMultiplier": 1.1}', 1,
 'XP Boost I', '+10% XP earned from games', true),

('study_bonus', 'xp', 'gameplay', 'study_bonus',
 '{"studyBonusRate": 0.05}', 1,
 'Study Bonus', '+5% XP for each unique question set played', true),

('completion_reward', 'xp', 'gameplay', 'completion_bonus',
 '{"completionBonus": 50}', 1,
 'Completion Reward', '+50 flat XP for finishing any game', true),

('xp_boost_medium', 'xp', 'gameplay', 'xp_multiplier',
 '{"xpMultiplier": 1.2}', 2,
 'XP Boost II', '+20% XP earned from games', true),

('accuracy_xp', 'xp', 'gameplay', 'accuracy_xp',
 '{"accuracyThreshold": 0.8, "accuracyXpBonus": 100}', 2,
 'Accuracy Bonus', '+100 XP if game accuracy is above 80%', true),

('streak_xp', 'xp', 'gameplay', 'streak_xp',
 '{"streakXpPerStreak": 10, "maxStreakXp": 100}', 1,
 'Streak XP', '+10 XP per streak maintained, up to +100 per game', true),

('xp_boost_major', 'xp', 'gameplay', 'xp_multiplier',
 '{"xpMultiplier": 1.35}', 3,
 'XP Boost III', '+35% XP earned from games', true),

('mastery_xp', 'xp', 'gameplay', 'mastery_xp',
 '{"masteryXpBonus": 200, "perfectRequired": true}', 3,
 'Mastery XP', '+200 XP for a perfect game', true)

ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  type = EXCLUDED.type,
  effect_type = EXCLUDED.effect_type,
  effect_config = EXCLUDED.effect_config,
  tier = EXCLUDED.tier,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP;

-- Drop old indexes that reference level_required
DROP INDEX IF EXISTS idx_perks_level;
DROP INDEX IF EXISTS idx_perks_level_required;

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_perks_tier ON perks(tier);
CREATE INDEX IF NOT EXISTS idx_perks_effect_type ON perks(effect_type);
