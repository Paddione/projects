-- UP MIGRATION
-- Enable useful extensions (safe if already present)
-- pg_trgm and btree_gin are typically available to non-superusers;
-- pg_stat_statements requires superuser and is skipped gracefully.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'pg_trgm: insufficient privileges, skipping';
END $$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS btree_gin;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'btree_gin: insufficient privileges, skipping';
END $$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'pg_stat_statements: insufficient privileges, skipping';
END $$;

-- Users search support (requires pg_trgm)
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_users_username_trgm ON users USING gin (username gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin (email gin_trgm_ops);
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'pg_trgm not available, skipping trigram indexes on users';
END $$;

-- Questions search support on text (requires pg_trgm)
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_questions_text_trgm ON questions USING gin (question_text gin_trgm_ops);
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'pg_trgm not available, skipping trigram index on questions';
END $$;

-- Leaderboard composite index for ranking by set/score/completed
CREATE INDEX IF NOT EXISTS idx_hof_qsid_score_completed ON hall_of_fame(question_set_id, score DESC, completed_at ASC);

-- DOWN MIGRATION
-- Drop created indexes (extensions are left in place intentionally)
DROP INDEX IF EXISTS idx_hof_qsid_score_completed;
DROP INDEX IF EXISTS idx_questions_text_trgm;
DROP INDEX IF EXISTS idx_users_email_trgm;
DROP INDEX IF EXISTS idx_users_username_trgm;
