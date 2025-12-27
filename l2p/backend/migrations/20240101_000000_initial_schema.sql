-- UP MIGRATION
-- Initial database schema for Learn2Play multiplayer quiz game

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USER MANAGEMENT
-- ============================================================================

-- User management table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    preferences JSONB DEFAULT '{"language": "en", "theme": "light"}'::jsonb
);

-- ============================================================================
-- LOBBY MANAGEMENT
-- ============================================================================

-- Lobby management table
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
    players JSONB DEFAULT '[]'::jsonb
);

-- ============================================================================
-- QUESTION MANAGEMENT
-- ============================================================================

-- Question sets table
CREATE TABLE IF NOT EXISTS question_sets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    difficulty VARCHAR(20) CHECK (difficulty IN ('easy', 'medium', 'hard')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Questions table with localized content
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    question_set_id INTEGER REFERENCES question_sets(id) ON DELETE CASCADE,
    question_text JSONB NOT NULL, -- {"en": "English text", "de": "German text"}
    answers JSONB NOT NULL, -- [{"text": {"en": "...", "de": "..."}, "correct": boolean}]
    explanation JSONB, -- {"en": "English explanation", "de": "German explanation"}
    difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- GAME SESSION MANAGEMENT
-- ============================================================================

-- Game sessions table
CREATE TABLE IF NOT EXISTS game_sessions (
    id SERIAL PRIMARY KEY,
    lobby_id INTEGER REFERENCES lobbies(id) ON DELETE CASCADE,
    question_set_id INTEGER REFERENCES question_sets(id) ON DELETE SET NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    total_questions INTEGER NOT NULL,
    session_data JSONB DEFAULT '{}'::jsonb
);

-- Player results table
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
    completion_time INTEGER, -- in seconds
    answer_details JSONB DEFAULT '[]'::jsonb
);

-- ============================================================================
-- HALL OF FAME LEADERBOARD
-- ============================================================================

-- Hall of Fame leaderboards table
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
    session_id INTEGER REFERENCES game_sessions(id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Lobby indexes
CREATE INDEX IF NOT EXISTS idx_lobbies_code ON lobbies(code);
CREATE INDEX IF NOT EXISTS idx_lobbies_status ON lobbies(status);
CREATE INDEX IF NOT EXISTS idx_lobbies_host_id ON lobbies(host_id);
CREATE INDEX IF NOT EXISTS idx_lobbies_created_at ON lobbies(created_at);

-- Question indexes
CREATE INDEX IF NOT EXISTS idx_questions_set_id ON questions(question_set_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_question_sets_active ON question_sets(is_active);
CREATE INDEX IF NOT EXISTS idx_question_sets_category ON question_sets(category);

-- Game session indexes
CREATE INDEX IF NOT EXISTS idx_game_sessions_lobby_id ON game_sessions(lobby_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_started_at ON game_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_player_results_session_id ON player_results(session_id);
CREATE INDEX IF NOT EXISTS idx_player_results_user_id ON player_results(user_id);

-- Hall of Fame indexes
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_question_set_id ON hall_of_fame(question_set_id);
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_score_desc ON hall_of_fame(score DESC);
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_completed_at ON hall_of_fame(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_username ON hall_of_fame(username);

-- ============================================================================
-- INITIAL DATA SEEDING
-- ============================================================================

-- Insert sample question set
INSERT INTO question_sets (name, description, category, difficulty, is_active) 
VALUES 
    ('General Knowledge', 'Basic general knowledge questions', 'general', 'medium', true),
    ('Science & Technology', 'Questions about science and technology', 'science', 'medium', true),
    ('History & Geography', 'Historical and geographical questions', 'history', 'medium', true)
ON CONFLICT DO NOTHING;

-- Insert sample questions for General Knowledge set
INSERT INTO questions (question_set_id, question_text, answers, explanation, difficulty)
SELECT 
    qs.id,
    '{"en": "What is the capital of France?", "de": "Was ist die Hauptstadt von Frankreich?"}'::jsonb,
    '[
        {"text": {"en": "Paris", "de": "Paris"}, "correct": true},
        {"text": {"en": "London", "de": "London"}, "correct": false},
        {"text": {"en": "Berlin", "de": "Berlin"}, "correct": false},
        {"text": {"en": "Madrid", "de": "Madrid"}, "correct": false}
    ]'::jsonb,
    '{"en": "Paris is the capital and largest city of France.", "de": "Paris ist die Hauptstadt und größte Stadt Frankreichs."}'::jsonb,
    1
FROM question_sets qs 
WHERE qs.name = 'General Knowledge'
ON CONFLICT DO NOTHING;

INSERT INTO questions (question_set_id, question_text, answers, explanation, difficulty)
SELECT 
    qs.id,
    '{"en": "Which planet is known as the Red Planet?", "de": "Welcher Planet ist als der Rote Planet bekannt?"}'::jsonb,
    '[
        {"text": {"en": "Mars", "de": "Mars"}, "correct": true},
        {"text": {"en": "Venus", "de": "Venus"}, "correct": false},
        {"text": {"en": "Jupiter", "de": "Jupiter"}, "correct": false},
        {"text": {"en": "Saturn", "de": "Saturn"}, "correct": false}
    ]'::jsonb,
    '{"en": "Mars is called the Red Planet due to its reddish appearance.", "de": "Mars wird aufgrund seines rötlichen Aussehens der Rote Planet genannt."}'::jsonb,
    2
FROM question_sets qs 
WHERE qs.name = 'General Knowledge'
ON CONFLICT DO NOTHING;

-- Health check table for monitoring
CREATE TABLE IF NOT EXISTS health_check (
    id SERIAL PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'OK',
    last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial health check record
INSERT INTO health_check (status) VALUES ('OK') ON CONFLICT DO NOTHING;

-- DOWN MIGRATION
-- Drop all tables in reverse order of dependencies

DROP TABLE IF EXISTS health_check;
DROP TABLE IF EXISTS hall_of_fame;
DROP TABLE IF EXISTS player_results;
DROP TABLE IF EXISTS game_sessions;
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS question_sets;
DROP TABLE IF EXISTS lobbies;
DROP TABLE IF EXISTS users;

-- Drop extension
DROP EXTENSION IF EXISTS "uuid-ossp";