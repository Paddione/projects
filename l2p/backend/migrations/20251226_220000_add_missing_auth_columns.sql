-- UP MIGRATION
-- Add login tracking and security fields to users table

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMP,
ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP,
ADD COLUMN IF NOT EXISTS current_session_id VARCHAR(255);

-- DOWN MIGRATION
ALTER TABLE users 
DROP COLUMN IF EXISTS failed_login_attempts,
DROP COLUMN IF EXISTS last_failed_login,
DROP COLUMN IF EXISTS account_locked_until,
DROP COLUMN IF EXISTS current_session_id;
