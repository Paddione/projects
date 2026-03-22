-- =============================================================================
-- L2P DATABASE - Complete Schema (Final State)
-- =============================================================================
-- Consolidated from 24 migration files (2024-01 through 2026-03).
-- Run against: l2p_db as l2p_user (or postgres superuser)
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- USERS TABLE (final state after all ALTER TABLE migrations)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    preferences JSONB DEFAULT '{"language": "en", "theme": "light"}'::jsonb,
    -- Authentication fields (migration 000001)
    email_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    selected_character VARCHAR(50) DEFAULT 'student',
    character_level INTEGER DEFAULT 1,
    experience_points INTEGER DEFAULT 0,
    -- Preferences (migration 000001)
    avatar_url VARCHAR(500),
    timezone VARCHAR(50) DEFAULT 'UTC',
    notification_settings JSONB DEFAULT '{"email": true, "push": true}'::jsonb,
    -- Admin flag (migration 20250101)
    is_admin BOOLEAN DEFAULT false,
    -- Perks cosmetic fields (migration 20250901)
    active_avatar VARCHAR(50) DEFAULT 'student',
    active_badge VARCHAR(50),
    active_theme VARCHAR(50) DEFAULT 'default',
    active_title VARCHAR(100),
    perks_config JSONB DEFAULT '{}',
    -- Security fields (migration 20251226)
    failed_login_attempts INTEGER DEFAULT 0,
    last_failed_login TIMESTAMP,
    account_locked_until TIMESTAMP,
    current_session_id VARCHAR(255),
    -- Perk redraft flag (migration 20260204)
    needs_perk_redraft BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_timezone ON users(timezone);

-- Trigram indexes for search
CREATE INDEX IF NOT EXISTS idx_users_username_trgm ON users USING gin(username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin(email gin_trgm_ops);

-- =============================================================================
-- LOBBIES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS lobbies (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    host_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'starting', 'playing', 'ended')),
    question_count INTEGER DEFAULT 10 CHECK (question_count BETWEEN 1 AND 100),
    current_question INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    settings JSONB DEFAULT '{}'::jsonb,
    players JSONB DEFAULT '[]'::jsonb,
    auth_user_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_lobbies_code ON lobbies(code);
CREATE INDEX IF NOT EXISTS idx_lobbies_status ON lobbies(status);
CREATE INDEX IF NOT EXISTS idx_lobbies_host_id ON lobbies(host_id);
CREATE INDEX IF NOT EXISTS idx_lobbies_created_at ON lobbies(created_at);
CREATE INDEX IF NOT EXISTS lobbies_auth_user_id_idx ON lobbies(auth_user_id);

-- =============================================================================
-- CATEGORIES TABLE (migration 20260308)
-- =============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO categories (name) VALUES ('IT'), ('Language'), ('undefined') ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- QUESTION SETS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS question_sets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    difficulty VARCHAR(20) CHECK (difficulty IN ('easy', 'medium', 'hard')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_question_sets_active ON question_sets(is_active);
CREATE INDEX IF NOT EXISTS idx_question_sets_category ON question_sets(category);

-- =============================================================================
-- QUESTIONS TABLE (final state: single-language TEXT, decoupled from sets)
-- =============================================================================
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    question_text TEXT NOT NULL,
    answers JSONB NOT NULL,
    explanation TEXT,
    difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Freetext/hints (migration 20260215)
    answer_type VARCHAR(20) DEFAULT 'multiple_choice'
        CHECK (answer_type IN ('multiple_choice', 'free_text', 'true_false', 'estimation', 'ordering', 'matching', 'fill_in_blank')),
    hint TEXT,
    answer_metadata JSONB,
    -- Category (migration 20260307/20260308)
    language VARCHAR(10) DEFAULT 'de',
    category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_category_id ON questions(category_id);
CREATE INDEX IF NOT EXISTS idx_questions_answer_type ON questions(answer_type);

-- =============================================================================
-- QUESTION SET QUESTIONS (junction table, migration 20260307)
-- =============================================================================
CREATE TABLE IF NOT EXISTS question_set_questions (
    id SERIAL PRIMARY KEY,
    question_set_id INTEGER NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    position INTEGER,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(question_set_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_qsq_set_id ON question_set_questions(question_set_id);
CREATE INDEX IF NOT EXISTS idx_qsq_question_id ON question_set_questions(question_id);

-- =============================================================================
-- GAME SESSIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS game_sessions (
    id SERIAL PRIMARY KEY,
    lobby_id INTEGER REFERENCES lobbies(id) ON DELETE CASCADE,
    question_set_id INTEGER REFERENCES question_sets(id) ON DELETE SET NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    total_questions INTEGER NOT NULL,
    session_data JSONB DEFAULT '{}'::jsonb,
    game_mode VARCHAR(30) DEFAULT 'arcade'
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_lobby_id ON game_sessions(lobby_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_started_at ON game_sessions(started_at);

-- =============================================================================
-- PLAYER RESULTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS player_results (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES game_sessions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(50) NOT NULL,
    character_name VARCHAR(50),
    final_score INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    total_questions INTEGER NOT NULL,
    max_multiplier INTEGER DEFAULT 1 CHECK (max_multiplier BETWEEN 1 AND 5),
    completion_time INTEGER,
    answer_details JSONB DEFAULT '[]'::jsonb,
    -- Experience tracking (migration 000003)
    experience_gained INTEGER DEFAULT 0,
    level_before INTEGER DEFAULT 1,
    level_after INTEGER DEFAULT 1,
    level_up_occurred BOOLEAN DEFAULT false,
    auth_user_id INTEGER,
    mode_data JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_player_results_session_id ON player_results(session_id);
CREATE INDEX IF NOT EXISTS idx_player_results_user_id ON player_results(user_id);
CREATE INDEX IF NOT EXISTS idx_player_results_experience_gained ON player_results(experience_gained DESC);
CREATE INDEX IF NOT EXISTS idx_player_results_level_up ON player_results(level_up_occurred) WHERE level_up_occurred = true;
CREATE INDEX IF NOT EXISTS player_results_auth_user_id_idx ON player_results(auth_user_id);

-- =============================================================================
-- HALL OF FAME TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS hall_of_fame (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    character_name VARCHAR(50),
    score INTEGER NOT NULL CHECK (score >= 0),
    accuracy DECIMAL(5,2) NOT NULL CHECK (accuracy BETWEEN 0 AND 100),
    max_multiplier INTEGER NOT NULL CHECK (max_multiplier BETWEEN 1 AND 5),
    question_set_name VARCHAR(100) NOT NULL,
    question_set_id INTEGER REFERENCES question_sets(id) ON DELETE CASCADE,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_id INTEGER REFERENCES game_sessions(id) ON DELETE CASCADE,
    experience_gained INTEGER DEFAULT 0,
    level_achieved INTEGER DEFAULT 1,
    total_experience INTEGER DEFAULT 0,
    auth_user_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_hall_of_fame_question_set_id ON hall_of_fame(question_set_id);
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_score_desc ON hall_of_fame(score DESC);
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_completed_at ON hall_of_fame(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_username ON hall_of_fame(username);
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_experience_gained ON hall_of_fame(experience_gained DESC);
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_level_achieved ON hall_of_fame(level_achieved DESC);
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_total_experience ON hall_of_fame(total_experience DESC);
CREATE INDEX IF NOT EXISTS hall_of_fame_auth_user_id_idx ON hall_of_fame(auth_user_id);

-- =============================================================================
-- OAUTH GAME PROFILES (migration 20250102)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_game_profiles (
    auth_user_id INTEGER PRIMARY KEY,
    selected_character VARCHAR(50) DEFAULT 'student',
    character_level INTEGER DEFAULT 1 NOT NULL,
    experience_points INTEGER DEFAULT 0 NOT NULL,
    preferences JSONB DEFAULT '{"language": "en", "theme": "light"}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    needs_perk_redraft BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS user_game_profiles_level_idx ON user_game_profiles(character_level);
CREATE INDEX IF NOT EXISTS user_game_profiles_character_idx ON user_game_profiles(selected_character);

-- =============================================================================
-- USER MIGRATION MAPPING (migration 20250102)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_migration_mapping (
    old_l2p_user_id INTEGER PRIMARY KEY,
    auth_user_id INTEGER NOT NULL,
    migration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    migration_strategy VARCHAR(50) NOT NULL,
    UNIQUE(auth_user_id)
);

CREATE INDEX IF NOT EXISTS user_migration_mapping_auth_id_idx ON user_migration_mapping(auth_user_id);

-- =============================================================================
-- PERKS TABLE (final state: draft-based, 40 gameplay perks)
-- =============================================================================
CREATE TABLE IF NOT EXISTS perks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    level_required INTEGER DEFAULT 0,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    config_schema JSONB,
    asset_data JSONB,
    effect_type VARCHAR(50),
    effect_config JSONB DEFAULT '{}',
    tier INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_perks_category ON perks(category);
CREATE INDEX IF NOT EXISTS idx_perks_tier ON perks(tier);
CREATE INDEX IF NOT EXISTS idx_perks_effect_type ON perks(effect_type);
CREATE INDEX IF NOT EXISTS idx_perks_level_required ON perks(level_required);

-- =============================================================================
-- USER PERKS TABLE (legacy, kept for reference)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_perks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    perk_id INTEGER NOT NULL REFERENCES perks(id) ON DELETE CASCADE,
    is_unlocked BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT false,
    configuration JSONB DEFAULT '{}',
    unlocked_at TIMESTAMP,
    activated_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    auth_user_id INTEGER,
    UNIQUE(user_id, perk_id)
);

CREATE INDEX IF NOT EXISTS idx_user_perks_user_id ON user_perks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_perks_perk_id ON user_perks(perk_id);

-- =============================================================================
-- USER PERK DRAFTS TABLE (current system, migration 20260204)
-- =============================================================================
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

-- =============================================================================
-- HEALTH CHECK TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS health_check (
    id SERIAL PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'OK',
    last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO health_check (status) VALUES ('OK') ON CONFLICT DO NOTHING;

-- =============================================================================
-- SCHEMA MIGRATIONS TRACKING
-- =============================================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- VIEWS
-- =============================================================================

CREATE OR REPLACE VIEW question_set_leaderboards AS
SELECT
    qs.id as question_set_id,
    qs.name as question_set_name,
    qs.category as question_set_category,
    qs.difficulty as question_set_difficulty,
    hof.username,
    hof.character_name,
    hof.score,
    hof.accuracy,
    hof.max_multiplier,
    hof.experience_gained,
    hof.level_achieved,
    hof.total_experience,
    hof.completed_at,
    ROW_NUMBER() OVER (
        PARTITION BY qs.id
        ORDER BY hof.score DESC, hof.accuracy DESC, hof.completed_at ASC
    ) as rank
FROM hall_of_fame hof
JOIN question_sets qs ON hof.question_set_id = qs.id
WHERE qs.is_active = true
ORDER BY qs.name, rank;

CREATE OR REPLACE VIEW overall_leaderboard AS
SELECT
    username,
    character_name,
    SUM(score) as total_score,
    AVG(accuracy) as avg_accuracy,
    MAX(max_multiplier) as best_multiplier,
    SUM(experience_gained) as total_experience_gained,
    MAX(level_achieved) as highest_level,
    COUNT(*) as games_played,
    MAX(completed_at) as last_game
FROM hall_of_fame
GROUP BY username, character_name
ORDER BY total_score DESC, avg_accuracy DESC;

CREATE OR REPLACE VIEW experience_leaderboard AS
SELECT
    username,
    character_name,
    SUM(experience_gained) as total_experience,
    MAX(level_achieved) as current_level,
    COUNT(*) as games_played,
    AVG(experience_gained) as avg_experience_per_game,
    MAX(completed_at) as last_game
FROM hall_of_fame
GROUP BY username, character_name
ORDER BY total_experience DESC, current_level DESC;

-- =============================================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================================

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
    RETURN QUERY SELECT * FROM user_game_profiles WHERE user_game_profiles.auth_user_id = p_auth_user_id;
    IF NOT FOUND THEN
        INSERT INTO user_game_profiles (auth_user_id) VALUES (p_auth_user_id) ON CONFLICT DO NOTHING;
        RETURN QUERY SELECT * FROM user_game_profiles WHERE user_game_profiles.auth_user_id = p_auth_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_game_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_game_profiles_updated_at ON user_game_profiles;
CREATE TRIGGER user_game_profiles_updated_at
    BEFORE UPDATE ON user_game_profiles
    FOR EACH ROW EXECUTE FUNCTION update_game_profile_timestamp();

-- =============================================================================
-- SEED DATA: 40 Gameplay Perks
-- =============================================================================
INSERT INTO perks (name, category, type, effect_type, effect_config, tier, level_required, title, description, is_active) VALUES
-- TIME PERKS (8)
('time_cushion', 'time', 'gameplay', 'bonus_seconds', '{"bonusSeconds": 3}', 1, 1, 'Time Cushion', '+3 bonus seconds effective time per question', true),
('slow_burn', 'time', 'gameplay', 'timer_speed', '{"timerSpeedMultiplier": 0.92}', 1, 6, 'Slow Burn', 'Timer runs 8% slower for score calculation', true),
('early_bird', 'time', 'gameplay', 'speed_threshold', '{"speedThresholdSeconds": 10, "speedBonusPoints": 25}', 1, 11, 'Early Bird', '+25 bonus points if you answer within 10 seconds', true),
('time_warp', 'time', 'gameplay', 'bonus_seconds', '{"bonusSeconds": 5}', 2, 16, 'Time Warp', '+5 bonus seconds effective time per question', true),
('zen_mode', 'time', 'gameplay', 'timer_speed', '{"timerSpeedMultiplier": 0.85}', 2, 21, 'Zen Mode', 'Timer runs 15% slower for score calculation', true),
('flash_answer', 'time', 'gameplay', 'speed_threshold', '{"speedThresholdSeconds": 5, "speedBonusPoints": 50}', 2, 26, 'Flash Answer', '+50 bonus points if you answer within 5 seconds', true),
('time_lord', 'time', 'gameplay', 'bonus_seconds', '{"bonusSeconds": 8}', 3, 31, 'Time Lord', '+8 bonus seconds effective time per question', true),
('temporal_anchor', 'time', 'gameplay', 'timer_speed', '{"timerSpeedMultiplier": 0.78}', 3, 36, 'Temporal Anchor', 'Timer runs 22% slower for score calculation', true),
-- INFO PERKS (8)
('category_reveal', 'info', 'gameplay', 'show_category', '{"showCategory": true}', 1, 2, 'Category Reveal', 'See the question category before answering', true),
('difficulty_sense', 'info', 'gameplay', 'show_difficulty', '{"showDifficulty": true}', 1, 7, 'Difficulty Sense', 'See the question difficulty rating', true),
('answer_stats', 'info', 'gameplay', 'show_answer_stats', '{"showAnswerStats": true}', 1, 32, 'Answer Statistics', 'See how other players answered after each question', true),
('fifty_fifty', 'info', 'gameplay', 'eliminate_wrong', '{"eliminateCount": 1, "usesPerGame": 3}', 1, 12, 'Fifty-Fifty Lite', 'Eliminate 1 wrong answer, 3 uses per game', true),
('knowledge_map', 'info', 'gameplay', 'show_category', '{"showCategory": true, "showDifficulty": true}', 2, 17, 'Knowledge Map', 'See both category and difficulty for each question', true),
('hint_master', 'info', 'gameplay', 'show_hint', '{"showHint": true, "usesPerGame": 2}', 2, 22, 'Hint Master', 'Get a subtle hint for 2 questions per game', true),
('double_eliminate', 'info', 'gameplay', 'eliminate_wrong', '{"eliminateCount": 2, "usesPerGame": 2}', 2, 27, 'Double Eliminate', 'Eliminate 2 wrong answers, 2 uses per game', true),
('oracle_vision', 'info', 'gameplay', 'eliminate_wrong', '{"eliminateCount": 2, "usesPerGame": 4}', 3, 37, 'Oracle Vision', 'Eliminate 2 wrong answers, 4 uses per game', true),
-- SCORING PERKS (8)
('score_boost', 'scoring', 'gameplay', 'base_score_multiplier', '{"baseScoreMultiplier": 1.1}', 1, 3, 'Score Boost', '+10% base score on all correct answers', true),
('speed_demon', 'scoring', 'gameplay', 'speed_bonus_multiplier', '{"speedBonusMultiplier": 1.25}', 1, 8, 'Speed Demon', '+25% bonus on the time component of score', true),
('streak_master', 'scoring', 'gameplay', 'max_streak_multiplier', '{"maxStreakMultiplier": 6}', 1, 13, 'Streak Master', 'Maximum streak multiplier increased to 6x (from 5x)', true),
('combo_builder', 'scoring', 'gameplay', 'streak_growth', '{"streakGrowthRate": 1.5}', 2, 18, 'Combo Builder', 'Streak multiplier increases 50% faster', true),
('perfectionist', 'scoring', 'gameplay', 'perfect_bonus', '{"perfectGameBonus": 500}', 2, 23, 'Perfectionist', '+500 bonus points for a perfect game (all correct)', true),
('closer', 'scoring', 'gameplay', 'closer_bonus', '{"closerBonusPercentage": 0.15, "lastQuestionsCount": 3}', 2, 28, 'The Closer', '+15% score on the last 3 questions', true),
('mega_streak', 'scoring', 'gameplay', 'max_streak_multiplier', '{"maxStreakMultiplier": 7, "streakGrowthRate": 1.25}', 3, 33, 'Mega Streak', 'Max multiplier 7x and streak grows 25% faster', true),
('grand_scorer', 'scoring', 'gameplay', 'base_score_multiplier', '{"baseScoreMultiplier": 1.2}', 3, 38, 'Grand Scorer', '+20% base score on all correct answers', true),
-- RECOVERY PERKS (8)
('safety_net', 'recovery', 'gameplay', 'free_wrong_answers', '{"freeWrongAnswers": 1}', 1, 4, 'Safety Net', '1 wrong answer per game that does not reset your streak', true),
('partial_credit', 'recovery', 'gameplay', 'partial_credit', '{"partialCreditRate": 0.25}', 1, 9, 'Partial Credit', 'Earn 25% of possible points even on wrong answers', true),
('bounce_back', 'recovery', 'gameplay', 'bounce_back', '{"bounceBackBonus": 15}', 1, 14, 'Bounce Back', '+15 bonus points on the first correct answer after a wrong one', true),
('resilient', 'recovery', 'gameplay', 'base_multiplier', '{"baseMultiplier": 1.5}', 2, 19, 'Resilient', 'After streak reset, multiplier starts at 1.5x instead of 1x', true),
('double_safety', 'recovery', 'gameplay', 'free_wrong_answers', '{"freeWrongAnswers": 2}', 2, 24, 'Double Safety', '2 wrong answers per game without streak reset', true),
('comeback_king', 'recovery', 'gameplay', 'comeback', '{"comebackThreshold": 0.5, "comebackMultiplier": 1.3}', 2, 29, 'Comeback King', 'If below 50% accuracy midgame, +30% score on remaining questions', true),
('iron_will', 'recovery', 'gameplay', 'free_wrong_answers', '{"freeWrongAnswers": 3, "partialCreditRate": 0.1}', 3, 34, 'Iron Will', '3 free wrong answers + 10% partial credit on others', true),
('phoenix', 'recovery', 'gameplay', 'phoenix', '{"phoenixThreshold": 3, "phoenixMultiplier": 2.0}', 3, 39, 'Phoenix', 'After 3 wrong answers in a row, next correct answer scores 2x', true),
-- XP PERKS (8)
('xp_boost_light', 'xp', 'gameplay', 'xp_multiplier', '{"xpMultiplier": 1.1}', 1, 5, 'XP Boost I', '+10% XP earned from games', true),
('study_bonus', 'xp', 'gameplay', 'study_bonus', '{"studyBonusRate": 0.05}', 1, 10, 'Study Bonus', '+5% XP for each unique question set played', true),
('completion_reward', 'xp', 'gameplay', 'completion_bonus', '{"completionBonus": 50}', 1, 15, 'Completion Reward', '+50 flat XP for finishing any game', true),
('streak_xp', 'xp', 'gameplay', 'streak_xp', '{"streakXpPerStreak": 10, "maxStreakXp": 100}', 1, 30, 'Streak XP', '+10 XP per streak maintained, up to +100 per game', true),
('xp_boost_medium', 'xp', 'gameplay', 'xp_multiplier', '{"xpMultiplier": 1.2}', 2, 20, 'XP Boost II', '+20% XP earned from games', true),
('accuracy_xp', 'xp', 'gameplay', 'accuracy_xp', '{"accuracyThreshold": 0.8, "accuracyXpBonus": 100}', 2, 25, 'Accuracy Bonus', '+100 XP if game accuracy is above 80%', true),
('xp_boost_major', 'xp', 'gameplay', 'xp_multiplier', '{"xpMultiplier": 1.35}', 3, 35, 'XP Boost III', '+35% XP earned from games', true),
('mastery_xp', 'xp', 'gameplay', 'mastery_xp', '{"masteryXpBonus": 200, "perfectRequired": true}', 3, 40, 'Mastery XP', '+200 XP for a perfect game', true)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- SEED DATA: Sample question sets
-- =============================================================================
INSERT INTO question_sets (name, description, category, difficulty, is_active) VALUES
    ('General Knowledge', 'Basic general knowledge questions', 'general', 'medium', true),
    ('Science & Technology', 'Questions about science and technology', 'science', 'medium', true),
    ('History & Geography', 'Historical and geographical questions', 'history', 'medium', true)
ON CONFLICT DO NOTHING;
