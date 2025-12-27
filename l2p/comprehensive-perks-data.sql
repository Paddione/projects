-- Comprehensive L2P Perks System Data
-- This file contains all the perks suggested in the original implementation plan

-- Clear existing perks data first (optional)
-- DELETE FROM user_perks;
-- DELETE FROM perks;

-- ===========================================
-- COSMETIC PERKS - Visual Customization
-- ===========================================

-- Level 3: Profile Badges - Show off achievements
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('starter_badge', 'cosmetic', 'badge', 3, 'Starter Badge', 'Bronze badge showing you''ve mastered the basics of L2P.', 
 '{"color": {"type": "enum", "options": ["bronze", "silver", "gold"], "default": "bronze"}, "position": {"type": "enum", "options": ["top-left", "top-right", "bottom-left", "bottom-right"], "default": "top-right"}}',
 '{"badges": {"bronze": {"icon": "🥉", "class": "badge-bronze"}, "silver": {"icon": "🥈", "class": "badge-silver"}, "gold": {"icon": "🥇", "class": "badge-gold"}}}'),

('scholar_badge', 'cosmetic', 'badge', 8, 'Scholar Badge', 'Academic achievement badge for dedicated learners.', 
 '{"style": {"type": "enum", "options": ["classic", "modern", "vintage"], "default": "classic"}}',
 '{"badges": {"classic": {"icon": "📚", "class": "badge-scholar-classic"}, "modern": {"icon": "🎓", "class": "badge-scholar-modern"}, "vintage": {"icon": "📜", "class": "badge-scholar-vintage"}}}'),

('quiz_master_badge', 'cosmetic', 'badge', 15, 'Quiz Master Badge', 'Elite badge for quiz champions and high scorers.', 
 '{"effect": {"type": "enum", "options": ["glow", "pulse", "sparkle", "static"], "default": "glow"}}',
 '{"badges": {"glow": {"icon": "👑", "class": "badge-master-glow"}, "pulse": {"icon": "⭐", "class": "badge-master-pulse"}, "sparkle": {"icon": "✨", "class": "badge-master-sparkle"}, "static": {"icon": "🏆", "class": "badge-master-static"}}}');

-- Level 5: Custom Character Avatars
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('custom_avatars_basic', 'cosmetic', 'avatar', 5, 'Avatar Collection I', 'Unlock additional character avatars: Scientist, Explorer, and Artist.', 
 '{"selected_avatar": {"type": "enum", "options": ["scientist", "explorer", "artist"], "default": "scientist"}}',
 '{"avatars": {"scientist": {"emoji": "🔬", "name": "Scientist", "description": "Methodical researcher"}, "explorer": {"emoji": "🗺️", "name": "Explorer", "description": "Adventure seeker"}, "artist": {"emoji": "🎨", "name": "Artist", "description": "Creative thinker"}}}'),

('custom_avatars_advanced', 'cosmetic', 'avatar', 12, 'Avatar Collection II', 'Unlock premium avatars: Detective, Chef, and Astronaut.', 
 '{"selected_avatar": {"type": "enum", "options": ["detective", "chef", "astronaut"], "default": "detective"}}',
 '{"avatars": {"detective": {"emoji": "🕵️", "name": "Detective", "description": "Sharp observer"}, "chef": {"emoji": "👨‍🍳", "name": "Chef", "description": "Recipe for success"}, "astronaut": {"emoji": "👨‍🚀", "name": "Astronaut", "description": "Shoots for the stars"}}}'),

('legendary_avatars', 'cosmetic', 'avatar', 25, 'Legendary Avatars', 'Exclusive legendary character avatars for elite players.', 
 '{"selected_avatar": {"type": "enum", "options": ["wizard", "ninja", "dragon"], "default": "wizard"}, "animation": {"type": "boolean", "default": true}}',
 '{"avatars": {"wizard": {"emoji": "🧙‍♂️", "name": "Wizard", "description": "Master of knowledge"}, "ninja": {"emoji": "🥷", "name": "Ninja", "description": "Silent but deadly accurate"}, "dragon": {"emoji": "🐉", "name": "Dragon", "description": "Mythical quiz beast"}}}');

-- Level 7: Answer Animations
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('answer_effects_basic', 'cosmetic', 'animation', 7, 'Answer Effects I', 'Add visual flair when selecting answers with basic animations.', 
 '{"effect_type": {"type": "enum", "options": ["bounce", "glow", "pulse"], "default": "bounce"}, "intensity": {"type": "range", "min": 1, "max": 3, "default": 2}}',
 '{"animations": {"bounce": {"class": "answer-bounce", "duration": "0.3s"}, "glow": {"class": "answer-glow", "duration": "0.5s"}, "pulse": {"class": "answer-pulse", "duration": "0.4s"}}}'),

('answer_effects_advanced', 'cosmetic', 'animation', 14, 'Answer Effects II', 'Advanced answer animations with particle effects.', 
 '{"effect_type": {"type": "enum", "options": ["sparkle", "ripple", "zoom"], "default": "sparkle"}, "color": {"type": "color", "default": "#4ade80"}}',
 '{"animations": {"sparkle": {"class": "answer-sparkle", "particles": true}, "ripple": {"class": "answer-ripple", "wave": true}, "zoom": {"class": "answer-zoom", "transform": true}}}');

-- Level 10: UI Themes
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('ui_themes_basic', 'cosmetic', 'theme', 10, 'Color Themes I', 'Personalize your interface with different color schemes.', 
 '{"theme_name": {"type": "enum", "options": ["ocean", "forest", "sunset"], "default": "ocean"}}',
 '{"themes": {"ocean": {"primary": "#0ea5e9", "secondary": "#0284c7", "accent": "#38bdf8", "name": "Ocean Blue"}, "forest": {"primary": "#10b981", "secondary": "#059669", "accent": "#34d399", "name": "Forest Green"}, "sunset": {"primary": "#f59e0b", "secondary": "#d97706", "accent": "#fbbf24", "name": "Golden Sunset"}}}'),

('ui_themes_advanced', 'cosmetic', 'theme', 18, 'Color Themes II', 'Premium themes with gradients and special effects.', 
 '{"theme_name": {"type": "enum", "options": ["neon", "galaxy", "vintage"], "default": "neon"}, "effects": {"type": "boolean", "default": true}}',
 '{"themes": {"neon": {"primary": "#a855f7", "secondary": "#9333ea", "accent": "#c084fc", "name": "Neon Purple", "gradient": true}, "galaxy": {"primary": "#1e1b4b", "secondary": "#312e81", "accent": "#6366f1", "name": "Galaxy Dark", "stars": true}, "vintage": {"primary": "#92400e", "secondary": "#78350f", "accent": "#d97706", "name": "Vintage Brown", "texture": true}}}');

-- Level 12: Victory Celebrations
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('victory_effects_basic', 'cosmetic', 'effect', 12, 'Victory Celebrations I', 'Special particle effects when you answer correctly.', 
 '{"effect_type": {"type": "enum", "options": ["confetti", "fireworks", "stars"], "default": "confetti"}, "duration": {"type": "range", "min": 1, "max": 4, "default": 2}}',
 '{"effects": {"confetti": {"particles": "confetti", "colors": ["#ff6b6b", "#4ecdc4", "#45b7d1"]}, "fireworks": {"particles": "burst", "colors": ["#ffd93d", "#ff6b6b", "#6bcf7f"]}, "stars": {"particles": "twinkle", "colors": ["#f7dc6f", "#bb8fce", "#85c1e9"]}}}'),

('victory_effects_premium', 'cosmetic', 'effect', 20, 'Victory Celebrations II', 'Epic victory effects with sound integration.', 
 '{"effect_type": {"type": "enum", "options": ["lightning", "rainbow", "magic"], "default": "lightning"}, "sound": {"type": "boolean", "default": true}, "screen_shake": {"type": "boolean", "default": false}}',
 '{"effects": {"lightning": {"particles": "electric", "sound": "zap.mp3"}, "rainbow": {"particles": "cascade", "sound": "chime.mp3"}, "magic": {"particles": "sparkles", "sound": "magic.mp3"}}}');

-- ===========================================
-- QUALITY OF LIFE PERKS - Gameplay Enhancement
-- ===========================================

-- Level 6: Answer Previews
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('answer_previews', 'qol', 'helper', 6, 'Answer Preview', 'Highlight selected answers before confirming submission.', 
 '{"highlight_style": {"type": "enum", "options": ["border", "background", "shadow"], "default": "border"}, "delay": {"type": "range", "min": 0.2, "max": 1.0, "default": 0.5}}',
 '{"styles": {"border": {"class": "answer-preview-border"}, "background": {"class": "answer-preview-bg"}, "shadow": {"class": "answer-preview-shadow"}}}');

-- Level 9: Quick Stats
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('quick_stats', 'qol', 'display', 9, 'Performance Dashboard', 'Real-time accuracy and streak indicators during gameplay.', 
 '{"position": {"type": "enum", "options": ["top-left", "top-right", "bottom-left", "bottom-right"], "default": "top-right"}, "metrics": {"type": "multiselect", "options": ["accuracy", "streak", "speed", "score"], "default": ["accuracy", "streak"]}}',
 '{"dashboard": {"accuracy": {"icon": "🎯", "format": "percentage"}, "streak": {"icon": "🔥", "format": "number"}, "speed": {"icon": "⚡", "format": "time"}, "score": {"icon": "⭐", "format": "points"}}}');

-- Level 11: Enhanced Timers
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('enhanced_timers', 'qol', 'timer', 11, 'Advanced Timers', 'Customizable countdown timers with visual and audio warnings.', 
 '{"warning_time": {"type": "range", "min": 3, "max": 10, "default": 5}, "visual_style": {"type": "enum", "options": ["progress", "digital", "analog"], "default": "progress"}, "audio_warnings": {"type": "boolean", "default": true}}',
 '{"timers": {"progress": {"class": "timer-progress-bar"}, "digital": {"class": "timer-digital"}, "analog": {"class": "timer-analog"}}}');

-- Level 13: Smart Hints
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('smart_hints', 'qol', 'helper', 13, 'Smart Hint System', 'Contextual hints and explanations for challenging questions.', 
 '{"hint_level": {"type": "enum", "options": ["subtle", "moderate", "detailed"], "default": "moderate"}, "auto_show": {"type": "boolean", "default": false}, "hint_delay": {"type": "range", "min": 5, "max": 15, "default": 10}}',
 '{"hints": {"subtle": {"opacity": 0.3, "text": "minimal"}, "moderate": {"opacity": 0.6, "text": "helpful"}, "detailed": {"opacity": 0.8, "text": "comprehensive"}}}');

-- Level 16: Focus Mode
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('focus_mode', 'qol', 'interface', 16, 'Focus Mode', 'Minimize distractions with a clean, focused interface.', 
 '{"blur_background": {"type": "boolean", "default": true}, "hide_ui": {"type": "multiselect", "options": ["chat", "players", "timer", "score"], "default": ["chat"]}, "zen_mode": {"type": "boolean", "default": false}}',
 '{"modes": {"zen": {"background": "minimal", "ui": "hidden"}, "standard": {"background": "blur", "ui": "simplified"}}}');

-- ===========================================
-- SOCIAL PERKS - Multiplayer Enhancement
-- ===========================================

-- Level 4: Chat Emotes
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('chat_emotes_basic', 'social', 'emote', 4, 'Chat Emotes I', 'Express yourself with fun emotes in lobby chat.', 
 '{"emote_set": {"type": "enum", "options": ["classic", "academic", "gaming"], "default": "classic"}}',
 '{"emotes": {"classic": {"😀": "happy", "😎": "cool", "👍": "thumbs-up", "🎉": "celebrate"}, "academic": {"📚": "studying", "🤓": "nerd", "💡": "idea", "🎓": "graduate"}, "gaming": {"🔥": "fire", "⚡": "lightning", "🏆": "trophy", "🎯": "target"}}}'),

('chat_emotes_premium', 'social', 'emote', 17, 'Chat Emotes II', 'Animated emotes and custom reactions for social interaction.', 
 '{"animated": {"type": "boolean", "default": true}, "size": {"type": "enum", "options": ["small", "medium", "large"], "default": "medium"}}',
 '{"emotes": {"animated": {"🚀": "rocket", "💫": "shooting-star", "🌟": "sparkle", "🎊": "party"}}}');

-- Level 8: Player Status
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('player_status', 'social', 'status', 8, 'Player Status Indicators', 'Show your current mood or status to other players.', 
 '{"status": {"type": "enum", "options": ["focused", "relaxed", "competitive", "learning"], "default": "focused"}, "visibility": {"type": "enum", "options": ["everyone", "friends", "lobby"], "default": "lobby"}}',
 '{"statuses": {"focused": {"icon": "🎯", "color": "#ef4444"}, "relaxed": {"icon": "😊", "color": "#22c55e"}, "competitive": {"icon": "🔥", "color": "#f59e0b"}, "learning": {"icon": "📚", "color": "#3b82f6"}}}');

-- Level 19: Team Formation
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('team_formation', 'social', 'team', 19, 'Team Builder', 'Create and manage teams for collaborative learning sessions.', 
 '{"team_size": {"type": "range", "min": 2, "max": 6, "default": 4}, "privacy": {"type": "enum", "options": ["public", "friends", "invite-only"], "default": "public"}}',
 '{"features": {"invite": true, "chat": true, "stats": true, "leaderboard": true}}');

-- ===========================================
-- AUDIO PERKS - Sound Customization
-- ===========================================

-- Level 5: Sound Packs
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('sound_packs_basic', 'audio', 'sound', 5, 'Sound Pack I', 'Customize game sounds with different audio themes.', 
 '{"pack": {"type": "enum", "options": ["retro", "nature", "electronic"], "default": "retro"}, "volume": {"type": "range", "min": 0.1, "max": 1.0, "default": 0.7}}',
 '{"packs": {"retro": {"correct": "beep-success.mp3", "wrong": "beep-error.mp3", "tick": "tick-retro.mp3"}, "nature": {"correct": "bird-chirp.mp3", "wrong": "thunder.mp3", "tick": "water-drop.mp3"}, "electronic": {"correct": "synth-up.mp3", "wrong": "synth-down.mp3", "tick": "blip.mp3"}}}'),

('sound_packs_premium', 'audio', 'sound', 14, 'Sound Pack II', 'Premium sound collections with dynamic music themes.', 
 '{"pack": {"type": "enum", "options": ["orchestral", "synthwave", "ambient"], "default": "orchestral"}, "dynamic_music": {"type": "boolean", "default": true}}',
 '{"packs": {"orchestral": {"theme": "classical-mix.mp3", "victory": "fanfare.mp3"}, "synthwave": {"theme": "neon-beats.mp3", "victory": "synth-win.mp3"}, "ambient": {"theme": "zen-flow.mp3", "victory": "peaceful-chime.mp3"}}}');

-- Level 21: Audio Reactions
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('audio_reactions', 'audio', 'reaction', 21, 'Audio Reactions', 'Dynamic sound responses based on performance and achievements.', 
 '{"reaction_level": {"type": "enum", "options": ["subtle", "moderate", "enthusiastic"], "default": "moderate"}, "streak_sounds": {"type": "boolean", "default": true}, "achievement_fanfares": {"type": "boolean", "default": true}}',
 '{"reactions": {"streak": {"3": "streak-3.mp3", "5": "streak-5.mp3", "10": "streak-10.mp3"}, "achievements": {"levelup": "levelup.mp3", "perfect": "perfect-score.mp3", "comeback": "comeback.mp3"}}}');

-- ===========================================
-- BOOSTER PERKS - Performance Enhancement
-- ===========================================

-- Level 22: Experience Multiplier
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('experience_boost', 'booster', 'multiplier', 22, 'Experience Booster', 'Earn 25% more experience points from quiz performance.', 
 '{"multiplier": {"type": "fixed", "value": 1.25}, "duration": {"type": "enum", "options": ["game", "session", "unlimited"], "default": "unlimited"}}',
 '{"boost": {"rate": 0.25, "applies_to": ["quiz_completion", "correct_answers", "streaks"]}}'),

('streak_protector', 'booster', 'protection', 24, 'Streak Guardian', 'Protect your answer streak from one wrong answer per game.', 
 '{"protection_count": {"type": "fixed", "value": 1}, "activation": {"type": "enum", "options": ["automatic", "manual"], "default": "automatic"}}',
 '{"protection": {"uses_per_game": 1, "visual_indicator": true, "sound_effect": "shield.mp3"}}'),

('time_extension', 'booster', 'timer', 26, 'Time Master', 'Get extra time for difficult questions when you need it most.', 
 '{"extra_seconds": {"type": "range", "min": 5, "max": 15, "default": 10}, "uses_per_game": {"type": "range", "min": 1, "max": 3, "default": 2}}',
 '{"extension": {"bonus_time": 10, "activation_threshold": 0.3, "cooldown": 2}}');

-- ===========================================
-- ACHIEVEMENT PERKS - Special Unlocks
-- ===========================================

-- Level 30: Master Scholar
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('master_scholar', 'achievement', 'title', 30, 'Master Scholar Title', 'Prestigious title showing your dedication to learning.', 
 '{"display_style": {"type": "enum", "options": ["badge", "border", "glow"], "default": "glow"}, "title_text": {"type": "fixed", "value": "Master Scholar"}}',
 '{"title": {"text": "Master Scholar", "color": "#fbbf24", "effect": "golden-glow"}}'),

('quiz_legend', 'achievement', 'title', 35, 'Quiz Legend Status', 'Legendary status for the most dedicated quiz masters.', 
 '{"aura_effect": {"type": "boolean", "default": true}, "special_entrance": {"type": "boolean", "default": true}}',
 '{"legend": {"aura": "legendary-glow", "entrance": "grand-entrance.mp3", "color": "#a855f7"}}'),

('knowledge_keeper', 'achievement', 'special', 40, 'Knowledge Keeper', 'Ultimate perk with exclusive features and recognition.', 
 '{"exclusive_lobby": {"type": "boolean", "default": true}, "mentor_mode": {"type": "boolean", "default": true}}',
 '{"keeper": {"lobby_access": "vip", "mentor_tools": true, "special_badge": "keeper-crown", "custom_title": true}}');

-- Add conflict resolution
ON CONFLICT (name) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema,
  asset_data = EXCLUDED.asset_data,
  level_required = EXCLUDED.level_required,
  updated_at = CURRENT_TIMESTAMP;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_perks_level_required ON perks(level_required);
CREATE INDEX IF NOT EXISTS idx_perks_category ON perks(category);
CREATE INDEX IF NOT EXISTS idx_perks_type ON perks(type);
CREATE INDEX IF NOT EXISTS idx_user_perks_user_unlocked ON user_perks(user_id, is_unlocked);
CREATE INDEX IF NOT EXISTS idx_user_perks_user_active ON user_perks(user_id, is_active);