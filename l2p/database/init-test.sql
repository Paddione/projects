-- Test-specific database initialization script
-- This script is used for the test environment and uses test_user instead of l2p_user

-- ============================================================================
-- DATABASE SCHEMA
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lobbies table
CREATE TABLE IF NOT EXISTS lobbies (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    host_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'waiting',
    max_players INTEGER DEFAULT 4,
    current_players INTEGER DEFAULT 1,
    question_set_id INTEGER,
    game_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Question sets table
CREATE TABLE IF NOT EXISTS question_sets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    difficulty VARCHAR(20) DEFAULT 'medium',
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    tags JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Uploaded files table
CREATE TABLE IF NOT EXISTS uploaded_files (
    id SERIAL PRIMARY KEY,
    file_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    original_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    content TEXT,
    metadata JSONB DEFAULT '{}',
    chroma_document_id VARCHAR(255),
    processing_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update trigger for uploaded_files
CREATE OR REPLACE FUNCTION update_uploaded_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_uploaded_files_updated_at ON uploaded_files;
CREATE TRIGGER trigger_update_uploaded_files_updated_at
    BEFORE UPDATE ON uploaded_files
    FOR EACH ROW
    EXECUTE FUNCTION update_uploaded_files_updated_at();

-- Update trigger for question_sets
CREATE OR REPLACE FUNCTION update_question_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_question_set_updated_at ON question_sets;
CREATE TRIGGER trigger_update_question_set_updated_at
    BEFORE UPDATE ON question_sets
    FOR EACH ROW
    EXECUTE FUNCTION update_question_set_updated_at();

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    question_set_id INTEGER REFERENCES question_sets(id) ON DELETE CASCADE,
    question_text JSONB NOT NULL,
    answers JSONB NOT NULL,
    explanation JSONB,
    difficulty INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Question set permissions table
CREATE TABLE IF NOT EXISTS question_set_permissions (
    id SERIAL PRIMARY KEY,
    question_set_id INTEGER REFERENCES question_sets(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    permission_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(question_set_id, user_id, permission_type)
);

-- Question set versions table
CREATE TABLE IF NOT EXISTS question_set_versions (
    id SERIAL PRIMARY KEY,
    question_set_id INTEGER REFERENCES question_sets(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    changes_description TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(question_set_id, version_number)
);

-- Game sessions table
CREATE TABLE IF NOT EXISTS game_sessions (
    id SERIAL PRIMARY KEY,
    lobby_id INTEGER REFERENCES lobbies(id) ON DELETE CASCADE,
    question_set_id INTEGER REFERENCES question_sets(id) ON DELETE SET NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    settings JSONB DEFAULT '{}'
);

-- Player results table
CREATE TABLE IF NOT EXISTS player_results (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES game_sessions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    character_name VARCHAR(50),
    score INTEGER DEFAULT 0,
    accuracy DECIMAL(5,2) DEFAULT 0.00,
    questions_answered INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    experience_gained INTEGER DEFAULT 0,
    level_achieved INTEGER DEFAULT 1,
    level_up_occurred BOOLEAN DEFAULT false,
    max_multiplier DECIMAL(3,2) DEFAULT 1.00,
    total_experience INTEGER DEFAULT 0,
    game_duration INTEGER DEFAULT 0,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Hall of fame table
CREATE TABLE IF NOT EXISTS hall_of_fame (
    id SERIAL PRIMARY KEY,
    question_set_id INTEGER REFERENCES question_sets(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    character_name VARCHAR(50),
    score INTEGER NOT NULL,
    accuracy DECIMAL(5,2) NOT NULL,
    questions_answered INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    experience_gained INTEGER NOT NULL,
    level_achieved INTEGER NOT NULL,
    max_multiplier DECIMAL(3,2) NOT NULL,
    total_experience INTEGER NOT NULL,
    game_duration INTEGER NOT NULL,
    rank INTEGER,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Schema migrations table
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum VARCHAR(64)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Lobbies indexes
CREATE INDEX IF NOT EXISTS idx_lobbies_code ON lobbies(code);
CREATE INDEX IF NOT EXISTS idx_lobbies_status ON lobbies(status);
CREATE INDEX IF NOT EXISTS idx_lobbies_host_id ON lobbies(host_id);
CREATE INDEX IF NOT EXISTS idx_lobbies_created_at ON lobbies(created_at);

-- Questions indexes
CREATE INDEX IF NOT EXISTS idx_questions_set_id ON questions(question_set_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);

-- Question sets indexes
CREATE INDEX IF NOT EXISTS idx_question_sets_active ON question_sets(is_active);
CREATE INDEX IF NOT EXISTS idx_question_sets_category ON question_sets(category);
CREATE INDEX IF NOT EXISTS idx_question_sets_owner_id ON question_sets(owner_id);
CREATE INDEX IF NOT EXISTS idx_question_sets_is_public ON question_sets(is_public);
CREATE INDEX IF NOT EXISTS idx_question_sets_is_featured ON question_sets(is_featured);
CREATE INDEX IF NOT EXISTS idx_question_sets_updated_at ON question_sets(updated_at DESC);

-- Question set permissions indexes
CREATE INDEX IF NOT EXISTS idx_question_set_permissions_question_set_id ON question_set_permissions(question_set_id);
CREATE INDEX IF NOT EXISTS idx_question_set_permissions_user_id ON question_set_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_question_set_permissions_type ON question_set_permissions(permission_type);

-- Question set versions indexes
CREATE INDEX IF NOT EXISTS idx_question_set_versions_question_set_id ON question_set_versions(question_set_id);
CREATE INDEX IF NOT EXISTS idx_question_set_versions_created_at ON question_set_versions(created_at DESC);

-- Game sessions indexes
CREATE INDEX IF NOT EXISTS idx_game_sessions_lobby_id ON game_sessions(lobby_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_started_at ON game_sessions(started_at);

-- Player results indexes
CREATE INDEX IF NOT EXISTS idx_player_results_session_id ON player_results(session_id);
CREATE INDEX IF NOT EXISTS idx_player_results_user_id ON player_results(user_id);
CREATE INDEX IF NOT EXISTS idx_player_results_experience_gained ON player_results(experience_gained DESC);
CREATE INDEX IF NOT EXISTS idx_player_results_level_up ON player_results(level_up_occurred) WHERE level_up_occurred = true;

-- Hall of fame indexes
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_question_set_id ON hall_of_fame(question_set_id);
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_score_desc ON hall_of_fame(score DESC);
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_completed_at ON hall_of_fame(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_username ON hall_of_fame(username);
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_experience_gained ON hall_of_fame(experience_gained DESC);
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_level_achieved ON hall_of_fame(level_achieved DESC);
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_total_experience ON hall_of_fame(total_experience DESC);

-- Schema migrations indexes
CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);

-- Uploaded files indexes
CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_id ON uploaded_files(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_file_id ON uploaded_files(file_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_file_type ON uploaded_files(file_type);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_processing_status ON uploaded_files(processing_status);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_created_at ON uploaded_files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_chroma_document_id ON uploaded_files(chroma_document_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_metadata_gin ON uploaded_files USING GIN (metadata);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Question set leaderboards view
CREATE OR REPLACE VIEW question_set_leaderboards AS
SELECT 
    qs.name as question_set_name,
    qs.id as question_set_id,
    hof.username,
    hof.character_name,
    hof.score,
    hof.accuracy,
    hof.experience_gained,
    hof.level_achieved,
    hof.rank,
    hof.completed_at
FROM hall_of_fame hof
JOIN question_sets qs ON hof.question_set_id = qs.id
WHERE qs.is_active = true
ORDER BY qs.name, rank;

-- Overall leaderboard view
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

-- Experience leaderboard view
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

-- ============================================================================
-- INITIAL DATA SEEDING
-- ============================================================================

-- Migration tracking table will be managed by the migration service

-- Insert sample question set
INSERT INTO question_sets (name, description, category, difficulty, is_active, is_public, is_featured, tags, metadata) 
VALUES 
    ('General Knowledge', 'Basic general knowledge questions', 'general', 'medium', true, true, true, '["general", "basic"]'::jsonb, '{"question_count": 2, "avg_difficulty": 1.5}'::jsonb),
    ('Science & Technology', 'Questions about science and technology', 'science', 'medium', true, true, true, '["science", "technology"]'::jsonb, '{"question_count": 0, "avg_difficulty": 0}'::jsonb),
    ('History & Geography', 'Historical and geographical questions', 'history', 'medium', true, true, true, '["history", "geography"]'::jsonb, '{"question_count": 0, "avg_difficulty": 0}'::jsonb)
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

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Create test user role if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'test_user') THEN
    CREATE ROLE test_user WITH LOGIN PASSWORD 'test_password';
  END IF;
END
$$;

-- Grant permissions to the test user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO test_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO test_user;
GRANT USAGE ON SCHEMA public TO test_user; 