-- Migration: Create perks system tables and modify users table
-- Created: 2025-09-01
-- Purpose: Add comprehensive perks system with user customization

-- Create perks registry table
CREATE TABLE IF NOT EXISTS perks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL, -- 'cosmetic', 'social', 'qol', 'audio'
    type VARCHAR(50) NOT NULL, -- 'avatar', 'badge', 'theme', 'sound'
    level_required INTEGER NOT NULL,
    title VARCHAR(100) NOT NULL, -- Display name for the perk
    description TEXT NOT NULL,
    config_schema JSONB, -- Defines what configuration options the perk has
    asset_data JSONB, -- Stores asset paths, colors, or other static data
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user perks table for unlocks and configurations
CREATE TABLE IF NOT EXISTS user_perks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    perk_id INTEGER NOT NULL REFERENCES perks(id) ON DELETE CASCADE,
    is_unlocked BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT false,
    configuration JSONB DEFAULT '{}', -- User's custom configuration for this perk
    unlocked_at TIMESTAMP,
    activated_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, perk_id)
);

-- Add perks-related fields to users table (safely check if they don't exist)
DO $$ 
BEGIN
    -- Add active_avatar if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'active_avatar') THEN
        ALTER TABLE users ADD COLUMN active_avatar VARCHAR(50) DEFAULT 'student';
    END IF;
    
    -- Add active_badge if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'active_badge') THEN
        ALTER TABLE users ADD COLUMN active_badge VARCHAR(50);
    END IF;
    
    -- Add active_theme if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'active_theme') THEN
        ALTER TABLE users ADD COLUMN active_theme VARCHAR(50) DEFAULT 'default';
    END IF;
    
    -- Add perks_config if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'perks_config') THEN
        ALTER TABLE users ADD COLUMN perks_config JSONB DEFAULT '{}';
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_perks_user_id ON user_perks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_perks_perk_id ON user_perks(perk_id);
CREATE INDEX IF NOT EXISTS idx_user_perks_unlocked ON user_perks(user_id, is_unlocked) WHERE is_unlocked = true;
CREATE INDEX IF NOT EXISTS idx_user_perks_active ON user_perks(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_perks_level ON perks(level_required);
CREATE INDEX IF NOT EXISTS idx_perks_category ON perks(category);

-- Insert initial perks data
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
-- Level 3: Profile Badges
('starter_badge', 'cosmetic', 'badge', 3, 'Starter Badge', 'Show you''ve mastered the basics with this bronze achievement badge.', 
 '{"color": {"type": "enum", "options": ["bronze", "silver", "gold"], "default": "bronze"}}',
 '{"badges": ["badge-starter-bronze", "badge-starter-silver", "badge-starter-gold"]}'),

-- Level 5: Custom Avatars
('custom_avatars', 'cosmetic', 'avatar', 5, 'Character Collection', 'Unlock additional character avatars beyond the default student.', 
 '{"selected_avatar": {"type": "enum", "options": ["student", "scientist", "explorer", "artist"], "default": "student"}}',
 '{"avatars": {"student": "avatar-student.png", "scientist": "avatar-scientist.png", "explorer": "avatar-explorer.png", "artist": "avatar-artist.png"}}'),

-- Level 8: Answer Animations
('answer_animations', 'cosmetic', 'animation', 8, 'Answer Effects', 'Custom animations when selecting answers.', 
 '{"animation_type": {"type": "enum", "options": ["bounce", "glow", "pulse", "none"], "default": "bounce"}, "intensity": {"type": "range", "min": 1, "max": 3, "default": 2}}',
 '{"animations": {"bounce": "animation-bounce", "glow": "animation-glow", "pulse": "animation-pulse"}}'),

-- Level 10: UI Themes
('ui_themes', 'cosmetic', 'theme', 10, 'Custom Themes', 'Personalize your interface with different color schemes.', 
 '{"theme_name": {"type": "enum", "options": ["default", "dark", "blue", "green", "purple"], "default": "default"}}',
 '{"themes": {"default": {"primary": "#3b82f6", "secondary": "#64748b"}, "dark": {"primary": "#1f2937", "secondary": "#4b5563"}, "blue": {"primary": "#0ea5e9", "secondary": "#0284c7"}, "green": {"primary": "#10b981", "secondary": "#059669"}, "purple": {"primary": "#8b5cf6", "secondary": "#7c3aed"}}}'),

-- Level 12: Victory Celebrations
('victory_effects', 'cosmetic', 'effect', 12, 'Victory Celebrations', 'Special particle effects when you get questions right.', 
 '{"effect_type": {"type": "enum", "options": ["confetti", "stars", "hearts", "lightning", "none"], "default": "confetti"}, "duration": {"type": "range", "min": 1, "max": 5, "default": 3}}',
 '{"effects": {"confetti": "particles-confetti", "stars": "particles-stars", "hearts": "particles-hearts", "lightning": "particles-lightning"}}')

ON CONFLICT (name) DO NOTHING;

-- Create a function to automatically unlock perks when user levels up
CREATE OR REPLACE FUNCTION check_perk_unlocks()
RETURNS TRIGGER AS $$
BEGIN
    -- If character_level increased, check for new perk unlocks
    IF TG_OP = 'UPDATE' AND OLD.character_level < NEW.character_level THEN
        -- Insert new perk unlocks for this user based on their new level
        INSERT INTO user_perks (user_id, perk_id, is_unlocked, unlocked_at)
        SELECT NEW.id, p.id, true, CURRENT_TIMESTAMP
        FROM perks p
        WHERE p.level_required <= NEW.character_level
        AND p.is_active = true
        AND NOT EXISTS (
            SELECT 1 FROM user_perks up 
            WHERE up.user_id = NEW.id AND up.perk_id = p.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically unlock perks on level up
DROP TRIGGER IF EXISTS trigger_perk_unlock ON users;
CREATE TRIGGER trigger_perk_unlock
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION check_perk_unlocks();

-- Grant necessary permissions (if using specific database users)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON perks TO l2p_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_perks TO l2p_user;
-- GRANT USAGE, SELECT ON perks_id_seq TO l2p_user;
-- GRANT USAGE, SELECT ON user_perks_id_seq TO l2p_user;