-- Minimal test-specific database initialization script
-- Real schema is managed by migrations in the backend service

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

-- Note: Privileges will be granted by the backend or manually if needed
-- Since tables don't exist yet, we can't grant privileges on them here.
-- The MigrationService or the backend startup should handle this if necessary,
-- or we can grant on the schema.

GRANT ALL PRIVILEGES ON SCHEMA public TO test_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO test_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO test_user;
GRANT USAGE ON SCHEMA public TO test_user;