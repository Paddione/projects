-- UP MIGRATION
-- Add is_admin flag to users and seed initial admin user Patrick

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Ensure admin user exists
DO $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM users WHERE email = 'patrick@korczewski.de') INTO v_exists;
    IF NOT v_exists THEN
        INSERT INTO users (username, email, password_hash, email_verified, selected_character, character_level, experience_points, is_active, is_admin)
        VALUES ('Patrick', 'patrick@korczewski.de', '$2b$12$8cdIGPdl6/dAZ7kfDTUSwOA85c9ZQJwhbf0GVrk2OTbxh6IyyZ9ra', true, 'professor', 1, 0, true, true);
    ELSE
        UPDATE users SET is_admin = true WHERE email = 'patrick@korczewski.de';
    END IF;
END
$$;

-- DOWN MIGRATION
-- Remove is_admin flag (note: user record remains)
ALTER TABLE users 
DROP COLUMN IF EXISTS is_admin;

