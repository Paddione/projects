-- UP MIGRATION
-- Enable useful extensions (safe if already present)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Users search support
CREATE INDEX IF NOT EXISTS idx_users_username_trgm ON users USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin (email gin_trgm_ops);

-- Questions search support on text
CREATE INDEX IF NOT EXISTS idx_questions_text_trgm ON questions USING gin (question_text gin_trgm_ops);

-- Leaderboard composite index for ranking by set/score/completed
CREATE INDEX IF NOT EXISTS idx_hof_qsid_score_completed ON hall_of_fame(question_set_id, score DESC, completed_at ASC);

-- DOWN MIGRATION
-- Drop created indexes (extensions are left in place intentionally)
DROP INDEX IF EXISTS idx_hof_qsid_score_completed;
DROP INDEX IF EXISTS idx_questions_text_trgm;
DROP INDEX IF EXISTS idx_users_email_trgm;
DROP INDEX IF EXISTS idx_users_username_trgm;
