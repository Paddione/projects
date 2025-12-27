-- Comprehensive L2P Perks System Data Migration
-- This migration adds all the comprehensive perks to the system

-- ===========================================
-- COSMETIC PERKS - Visual Customization
-- ===========================================

-- Level 3: Profile Badges - Show off achievements
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('starter_badge', 'cosmetic', 'badge', 3, 'Starter Badge', 'Bronze badge showing you''ve mastered the basics of L2P.', 
 '{"color": {"type": "enum", "options": ["bronze", "silver", "gold"], "default": "bronze"}, "position": {"type": "enum", "options": ["top-left", "top-right", "bottom-left", "bottom-right"], "default": "top-right"}}',
 '{"badges": {"bronze": {"icon": "🥉", "class": "badge-bronze"}, "silver": {"icon": "🥈", "class": "badge-silver"}, "gold": {"icon": "🥇", "class": "badge-gold"}}}')
ON CONFLICT (name) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema,
  asset_data = EXCLUDED.asset_data,
  level_required = EXCLUDED.level_required;

INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('scholar_badge', 'cosmetic', 'badge', 8, 'Scholar Badge', 'Academic achievement badge for dedicated learners.', 
 '{"style": {"type": "enum", "options": ["classic", "modern", "vintage"], "default": "classic"}}',
 '{"badges": {"classic": {"icon": "📚", "class": "badge-scholar-classic"}, "modern": {"icon": "🎓", "class": "badge-scholar-modern"}, "vintage": {"icon": "📜", "class": "badge-scholar-vintage"}}}')
ON CONFLICT (name) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema,
  asset_data = EXCLUDED.asset_data,
  level_required = EXCLUDED.level_required;

INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('quiz_master_badge', 'cosmetic', 'badge', 15, 'Quiz Master Badge', 'Elite badge for quiz champions and high scorers.', 
 '{"effect": {"type": "enum", "options": ["glow", "pulse", "sparkle", "static"], "default": "glow"}}',
 '{"badges": {"glow": {"icon": "👑", "class": "badge-master-glow"}, "pulse": {"icon": "⭐", "class": "badge-master-pulse"}, "sparkle": {"icon": "✨", "class": "badge-master-sparkle"}, "static": {"icon": "🏆", "class": "badge-master-static"}}}')
ON CONFLICT (name) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema,
  asset_data = EXCLUDED.asset_data,
  level_required = EXCLUDED.level_required;

-- Level 5: Custom Character Avatars
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('custom_avatars_basic', 'cosmetic', 'avatar', 5, 'Avatar Collection I', 'Unlock additional character avatars: Scientist, Explorer, and Artist.', 
 '{"selected_avatar": {"type": "enum", "options": ["scientist", "explorer", "artist"], "default": "scientist"}}',
 '{"avatars": {"scientist": {"emoji": "🔬", "name": "Scientist", "description": "Methodical researcher"}, "explorer": {"emoji": "🗺️", "name": "Explorer", "description": "Adventure seeker"}, "artist": {"emoji": "🎨", "name": "Artist", "description": "Creative thinker"}}}')
ON CONFLICT (name) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema,
  asset_data = EXCLUDED.asset_data,
  level_required = EXCLUDED.level_required;

INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('custom_avatars_advanced', 'cosmetic', 'avatar', 12, 'Avatar Collection II', 'Unlock premium avatars: Detective, Chef, and Astronaut.', 
 '{"selected_avatar": {"type": "enum", "options": ["detective", "chef", "astronaut"], "default": "detective"}}',
 '{"avatars": {"detective": {"emoji": "🕵️", "name": "Detective", "description": "Sharp observer"}, "chef": {"emoji": "👨‍🍳", "name": "Chef", "description": "Recipe for success"}, "astronaut": {"emoji": "👨‍🚀", "name": "Astronaut", "description": "Shoots for the stars"}}}')
ON CONFLICT (name) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema,
  asset_data = EXCLUDED.asset_data,
  level_required = EXCLUDED.level_required;

INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('legendary_avatars', 'cosmetic', 'avatar', 25, 'Legendary Avatars', 'Exclusive legendary character avatars for elite players.', 
 '{"selected_avatar": {"type": "enum", "options": ["wizard", "ninja", "dragon"], "default": "wizard"}, "animation": {"type": "boolean", "default": true}}',
 '{"avatars": {"wizard": {"emoji": "🧙‍♂️", "name": "Wizard", "description": "Master of knowledge"}, "ninja": {"emoji": "🥷", "name": "Ninja", "description": "Silent but deadly accurate"}, "dragon": {"emoji": "🐉", "name": "Dragon", "description": "Mythical quiz beast"}}}')
ON CONFLICT (name) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema,
  asset_data = EXCLUDED.asset_data,
  level_required = EXCLUDED.level_required;

-- Level 10: UI Themes
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('ui_themes_basic', 'cosmetic', 'theme', 10, 'Color Themes I', 'Personalize your interface with different color schemes.', 
 '{"theme_name": {"type": "enum", "options": ["ocean", "forest", "sunset"], "default": "ocean"}}',
 '{"themes": {"ocean": {"primary": "#0ea5e9", "secondary": "#0284c7", "accent": "#38bdf8", "name": "Ocean Blue"}, "forest": {"primary": "#10b981", "secondary": "#059669", "accent": "#34d399", "name": "Forest Green"}, "sunset": {"primary": "#f59e0b", "secondary": "#d97706", "accent": "#fbbf24", "name": "Golden Sunset"}}}')
ON CONFLICT (name) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema,
  asset_data = EXCLUDED.asset_data,
  level_required = EXCLUDED.level_required;

INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('ui_themes_advanced', 'cosmetic', 'theme', 18, 'Color Themes II', 'Premium themes with gradients and special effects.', 
 '{"theme_name": {"type": "enum", "options": ["neon", "galaxy", "vintage"], "default": "neon"}, "effects": {"type": "boolean", "default": true}}',
 '{"themes": {"neon": {"primary": "#a855f7", "secondary": "#9333ea", "accent": "#c084fc", "name": "Neon Purple", "gradient": true}, "galaxy": {"primary": "#1e1b4b", "secondary": "#312e81", "accent": "#6366f1", "name": "Galaxy Dark", "stars": true}, "vintage": {"primary": "#92400e", "secondary": "#78350f", "accent": "#d97706", "name": "Vintage Brown", "texture": true}}}')
ON CONFLICT (name) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema,
  asset_data = EXCLUDED.asset_data,
  level_required = EXCLUDED.level_required;

-- ===========================================
-- QUALITY OF LIFE PERKS - Gameplay Enhancement
-- ===========================================

INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('answer_previews', 'qol', 'helper', 6, 'Answer Preview', 'Highlight selected answers before confirming submission.', 
 '{"highlight_style": {"type": "enum", "options": ["border", "background", "shadow"], "default": "border"}, "delay": {"type": "range", "min": 0.2, "max": 1.0, "default": 0.5}}',
 '{"styles": {"border": {"class": "answer-preview-border"}, "background": {"class": "answer-preview-bg"}, "shadow": {"class": "answer-preview-shadow"}}}')
ON CONFLICT (name) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema,
  asset_data = EXCLUDED.asset_data,
  level_required = EXCLUDED.level_required;

INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('quick_stats', 'qol', 'display', 9, 'Performance Dashboard', 'Real-time accuracy and streak indicators during gameplay.', 
 '{"position": {"type": "enum", "options": ["top-left", "top-right", "bottom-left", "bottom-right"], "default": "top-right"}, "metrics": {"type": "multiselect", "options": ["accuracy", "streak", "speed", "score"], "default": ["accuracy", "streak"]}}',
 '{"dashboard": {"accuracy": {"icon": "🎯", "format": "percentage"}, "streak": {"icon": "🔥", "format": "number"}, "speed": {"icon": "⚡", "format": "time"}, "score": {"icon": "⭐", "format": "points"}}}')
ON CONFLICT (name) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema,
  asset_data = EXCLUDED.asset_data,
  level_required = EXCLUDED.level_required;

-- ===========================================
-- SOCIAL PERKS - Multiplayer Enhancement
-- ===========================================

INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('chat_emotes_basic', 'social', 'emote', 4, 'Chat Emotes I', 'Express yourself with fun emotes in lobby chat.', 
 '{"emote_set": {"type": "enum", "options": ["classic", "academic", "gaming"], "default": "classic"}}',
 '{"emotes": {"classic": {"😀": "happy", "😎": "cool", "👍": "thumbs-up", "🎉": "celebrate"}, "academic": {"📚": "studying", "🤓": "nerd", "💡": "idea", "🎓": "graduate"}, "gaming": {"🔥": "fire", "⚡": "lightning", "🏆": "trophy", "🎯": "target"}}}')
ON CONFLICT (name) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema,
  asset_data = EXCLUDED.asset_data,
  level_required = EXCLUDED.level_required;

-- ===========================================
-- AUDIO PERKS - Sound Customization
-- ===========================================

INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('sound_packs_basic', 'audio', 'sound', 5, 'Sound Pack I', 'Customize game sounds with different audio themes.', 
 '{"pack": {"type": "enum", "options": ["retro", "nature", "electronic"], "default": "retro"}, "volume": {"type": "range", "min": 0.1, "max": 1.0, "default": 0.7}}',
 '{"packs": {"retro": {"correct": "beep-success.mp3", "wrong": "beep-error.mp3", "tick": "tick-retro.mp3"}, "nature": {"correct": "bird-chirp.mp3", "wrong": "thunder.mp3", "tick": "water-drop.mp3"}, "electronic": {"correct": "synth-up.mp3", "wrong": "synth-down.mp3", "tick": "blip.mp3"}}}')
ON CONFLICT (name) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema,
  asset_data = EXCLUDED.asset_data,
  level_required = EXCLUDED.level_required;

-- ===========================================
-- BOOSTER PERKS - Performance Enhancement
-- ===========================================

INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('experience_boost', 'booster', 'multiplier', 22, 'Experience Booster', 'Earn 25% more experience points from quiz performance.', 
 '{"multiplier": {"type": "fixed", "value": 1.25}, "duration": {"type": "enum", "options": ["game", "session", "unlimited"], "default": "unlimited"}}',
 '{"boost": {"rate": 0.25, "applies_to": ["quiz_completion", "correct_answers", "streaks"]}}')
ON CONFLICT (name) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema,
  asset_data = EXCLUDED.asset_data,
  level_required = EXCLUDED.level_required;

-- ===========================================
-- ACHIEVEMENT PERKS - Special Unlocks
-- ===========================================

INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('master_scholar', 'achievement', 'title', 30, 'Master Scholar Title', 'Prestigious title showing your dedication to learning.', 
 '{"display_style": {"type": "enum", "options": ["badge", "border", "glow"], "default": "glow"}, "title_text": {"type": "fixed", "value": "Master Scholar"}}',
 '{"title": {"text": "Master Scholar", "color": "#fbbf24", "effect": "golden-glow"}}')
ON CONFLICT (name) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema,
  asset_data = EXCLUDED.asset_data,
  level_required = EXCLUDED.level_required;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_perks_level_required ON perks(level_required);
CREATE INDEX IF NOT EXISTS idx_perks_category ON perks(category);
CREATE INDEX IF NOT EXISTS idx_perks_type ON perks(type);
CREATE INDEX IF NOT EXISTS idx_user_perks_user_unlocked ON user_perks(user_id, is_unlocked);
CREATE INDEX IF NOT EXISTS idx_user_perks_user_active ON user_perks(user_id, is_active);