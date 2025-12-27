-- UP MIGRATION
-- Add additional user preference fields

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{"email": true, "push": true}'::jsonb;

-- Create index for timezone queries
CREATE INDEX IF NOT EXISTS idx_users_timezone ON users(timezone);

-- Update existing users with default values
UPDATE users 
SET notification_settings = '{"email": true, "push": true}'::jsonb 
WHERE notification_settings IS NULL;

-- DOWN MIGRATION
-- Remove the added columns

ALTER TABLE users 
DROP COLUMN IF EXISTS avatar_url,
DROP COLUMN IF EXISTS timezone,
DROP COLUMN IF EXISTS notification_settings;

-- Drop the index
DROP INDEX IF EXISTS idx_users_timezone;