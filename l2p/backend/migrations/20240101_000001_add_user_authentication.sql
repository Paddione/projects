-- UP MIGRATION
-- Add email verification and password reset functionality to users table

-- Add email verification fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS selected_character VARCHAR(50) DEFAULT 'student',
ADD COLUMN IF NOT EXISTS character_level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS experience_points INTEGER DEFAULT 0;

-- Add indexes for token lookups
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Add additional user preferences fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{"email": true, "push": true}'::jsonb;

-- Update existing users to have email verified (for backward compatibility)
UPDATE users SET email_verified = true WHERE email_verified IS NULL;

-- DOWN MIGRATION
-- Remove the added columns
ALTER TABLE users 
DROP COLUMN IF EXISTS email_verified,
DROP COLUMN IF EXISTS email_verification_token,
DROP COLUMN IF EXISTS email_verification_expires,
DROP COLUMN IF EXISTS password_reset_token,
DROP COLUMN IF EXISTS password_reset_expires,
DROP COLUMN IF EXISTS selected_character,
DROP COLUMN IF EXISTS character_level,
DROP COLUMN IF EXISTS experience_points,
DROP COLUMN IF EXISTS avatar_url,
DROP COLUMN IF EXISTS timezone,
DROP COLUMN IF EXISTS notification_settings;

-- Drop indexes
DROP INDEX IF EXISTS idx_users_email_verification_token;
DROP INDEX IF EXISTS idx_users_password_reset_token;
DROP INDEX IF EXISTS idx_users_email_verified;