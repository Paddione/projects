-- Add cosmetic perks for all 9 PerksManager loadout slot types
-- These are visual/QoL perks unlocked by level, separate from the 40 gameplay perks

-- ===== BADGE (type='badge') =====
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('starter_badge', 'cosmetic', 'badge', 2, 'Starter Badge', 'Bronze badge showing you''ve mastered the basics of L2P.',
 '{"color": {"type": "enum", "options": ["bronze", "silver", "gold"], "default": "bronze"}}',
 '{"badges": {"bronze": {"icon": "🥉", "class": "badge-bronze"}, "silver": {"icon": "🥈", "class": "badge-silver"}, "gold": {"icon": "🥇", "class": "badge-gold"}}}'),
('scholar_badge', 'cosmetic', 'badge', 8, 'Scholar Badge', 'Academic achievement badge for dedicated learners.',
 '{"style": {"type": "enum", "options": ["classic", "modern", "vintage"], "default": "classic"}}',
 '{"badges": {"classic": {"icon": "📚", "class": "badge-scholar-classic"}, "modern": {"icon": "🎓", "class": "badge-scholar-modern"}, "vintage": {"icon": "📜", "class": "badge-scholar-vintage"}}}'),
('quiz_master_badge', 'cosmetic', 'badge', 15, 'Quiz Master Badge', 'Elite badge for quiz champions and high scorers.',
 '{"effect": {"type": "enum", "options": ["glow", "pulse", "sparkle"], "default": "glow"}}',
 '{"badges": {"glow": {"icon": "👑", "class": "badge-master-glow"}, "pulse": {"icon": "⭐", "class": "badge-master-pulse"}, "sparkle": {"icon": "✨", "class": "badge-master-sparkle"}}}')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category, type = EXCLUDED.type, level_required = EXCLUDED.level_required,
  title = EXCLUDED.title, description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema, asset_data = EXCLUDED.asset_data, updated_at = CURRENT_TIMESTAMP;

-- ===== AVATAR (type='avatar') =====
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('custom_avatars_basic', 'cosmetic', 'avatar', 3, 'Avatar Collection I', 'Unlock additional character avatars: Scientist, Explorer, and Artist.',
 '{"selected_avatar": {"type": "enum", "options": ["scientist", "explorer", "artist"], "default": "scientist"}}',
 '{"avatars": {"scientist": {"emoji": "🔬", "name": "Scientist"}, "explorer": {"emoji": "🗺️", "name": "Explorer"}, "artist": {"emoji": "🎨", "name": "Artist"}}}'),
('custom_avatars_advanced', 'cosmetic', 'avatar', 12, 'Avatar Collection II', 'Unlock premium avatars: Detective, Chef, and Astronaut.',
 '{"selected_avatar": {"type": "enum", "options": ["detective", "chef", "astronaut"], "default": "detective"}}',
 '{"avatars": {"detective": {"emoji": "🕵️", "name": "Detective"}, "chef": {"emoji": "👨‍🍳", "name": "Chef"}, "astronaut": {"emoji": "👨‍🚀", "name": "Astronaut"}}}'),
('legendary_avatars', 'cosmetic', 'avatar', 25, 'Legendary Avatars', 'Exclusive legendary character avatars for elite players.',
 '{"selected_avatar": {"type": "enum", "options": ["wizard", "ninja", "dragon"], "default": "wizard"}}',
 '{"avatars": {"wizard": {"emoji": "🧙‍♂️", "name": "Wizard"}, "ninja": {"emoji": "🥷", "name": "Ninja"}, "dragon": {"emoji": "🐉", "name": "Dragon"}}}')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category, type = EXCLUDED.type, level_required = EXCLUDED.level_required,
  title = EXCLUDED.title, description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema, asset_data = EXCLUDED.asset_data, updated_at = CURRENT_TIMESTAMP;

-- ===== THEME (type='theme') =====
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('ui_themes_basic', 'cosmetic', 'theme', 5, 'Color Themes I', 'Personalize your interface with different color schemes.',
 '{"theme_name": {"type": "enum", "options": ["ocean", "forest", "sunset"], "default": "ocean"}}',
 '{"themes": {"ocean": {"primary": "#0ea5e9", "name": "Ocean Blue"}, "forest": {"primary": "#10b981", "name": "Forest Green"}, "sunset": {"primary": "#f59e0b", "name": "Golden Sunset"}}}'),
('ui_themes_advanced', 'cosmetic', 'theme', 18, 'Color Themes II', 'Premium themes with gradients and special effects.',
 '{"theme_name": {"type": "enum", "options": ["neon", "galaxy", "vintage"], "default": "neon"}}',
 '{"themes": {"neon": {"primary": "#a855f7", "name": "Neon Purple"}, "galaxy": {"primary": "#1e1b4b", "name": "Galaxy Dark"}, "vintage": {"primary": "#92400e", "name": "Vintage Brown"}}}')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category, type = EXCLUDED.type, level_required = EXCLUDED.level_required,
  title = EXCLUDED.title, description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema, asset_data = EXCLUDED.asset_data, updated_at = CURRENT_TIMESTAMP;

-- ===== EMOTE (type='emote') =====
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('chat_emotes_basic', 'cosmetic', 'emote', 4, 'Chat Emotes I', 'Express yourself with fun emotes in lobby chat.',
 '{"emote_set": {"type": "enum", "options": ["classic", "academic", "gaming"], "default": "classic"}}',
 '{"emotes": {"classic": ["😀", "😎", "👍", "🎉"], "academic": ["📚", "🤓", "💡", "🎓"], "gaming": ["🔥", "⚡", "🏆", "🎯"]}}'),
('chat_emotes_premium', 'cosmetic', 'emote', 17, 'Chat Emotes II', 'Animated emotes and custom reactions for social interaction.',
 '{"animated": {"type": "boolean", "default": true}, "size": {"type": "enum", "options": ["small", "medium", "large"], "default": "medium"}}',
 '{"emotes": {"animated": ["🚀", "💫", "🌟", "🎊"]}}')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category, type = EXCLUDED.type, level_required = EXCLUDED.level_required,
  title = EXCLUDED.title, description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema, asset_data = EXCLUDED.asset_data, updated_at = CURRENT_TIMESTAMP;

-- ===== HELPER (type='helper') =====
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('answer_previews', 'cosmetic', 'helper', 6, 'Answer Preview', 'Highlight selected answers before confirming submission.',
 '{"highlight_style": {"type": "enum", "options": ["border", "background", "shadow"], "default": "border"}}',
 '{"styles": {"border": {"class": "answer-preview-border"}, "background": {"class": "answer-preview-bg"}, "shadow": {"class": "answer-preview-shadow"}}}'),
('smart_hints', 'cosmetic', 'helper', 13, 'Smart Hint System', 'Contextual hints and explanations for challenging questions.',
 '{"hint_level": {"type": "enum", "options": ["subtle", "moderate", "detailed"], "default": "moderate"}}',
 '{"hints": {"subtle": {"opacity": 0.3}, "moderate": {"opacity": 0.6}, "detailed": {"opacity": 0.8}}}')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category, type = EXCLUDED.type, level_required = EXCLUDED.level_required,
  title = EXCLUDED.title, description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema, asset_data = EXCLUDED.asset_data, updated_at = CURRENT_TIMESTAMP;

-- ===== SOUND (type='sound') =====
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('sound_packs_basic', 'cosmetic', 'sound', 7, 'Sound Pack I', 'Customize game sounds with different audio themes.',
 '{"pack": {"type": "enum", "options": ["retro", "nature", "electronic"], "default": "retro"}}',
 '{"packs": {"retro": {"style": "8-bit"}, "nature": {"style": "organic"}, "electronic": {"style": "synth"}}}'),
('sound_packs_premium', 'cosmetic', 'sound', 14, 'Sound Pack II', 'Premium sound collections with dynamic music themes.',
 '{"pack": {"type": "enum", "options": ["orchestral", "synthwave", "ambient"], "default": "orchestral"}}',
 '{"packs": {"orchestral": {"style": "classical"}, "synthwave": {"style": "retro-future"}, "ambient": {"style": "zen"}}}'),
('audio_reactions', 'cosmetic', 'sound', 21, 'Audio Reactions', 'Dynamic sound responses based on performance and achievements.',
 '{"reaction_level": {"type": "enum", "options": ["subtle", "moderate", "enthusiastic"], "default": "moderate"}}',
 '{"reactions": {"streak_sounds": true, "achievement_fanfares": true}}')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category, type = EXCLUDED.type, level_required = EXCLUDED.level_required,
  title = EXCLUDED.title, description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema, asset_data = EXCLUDED.asset_data, updated_at = CURRENT_TIMESTAMP;

-- ===== DISPLAY (type='display') =====
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('quick_stats', 'cosmetic', 'display', 9, 'Performance Dashboard', 'Real-time accuracy and streak indicators during gameplay.',
 '{"position": {"type": "enum", "options": ["top-left", "top-right", "bottom-left", "bottom-right"], "default": "top-right"}}',
 '{"dashboard": {"accuracy": {"icon": "🎯"}, "streak": {"icon": "🔥"}, "speed": {"icon": "⚡"}}}'),
('enhanced_timers', 'cosmetic', 'display', 11, 'Advanced Timers', 'Customizable countdown timers with visual and audio warnings.',
 '{"visual_style": {"type": "enum", "options": ["progress", "digital", "analog"], "default": "progress"}}',
 '{"timers": {"progress": {"class": "timer-progress-bar"}, "digital": {"class": "timer-digital"}, "analog": {"class": "timer-analog"}}}'),
('focus_mode', 'cosmetic', 'display', 16, 'Focus Mode', 'Minimize distractions with a clean, focused interface.',
 '{"blur_background": {"type": "boolean", "default": true}, "zen_mode": {"type": "boolean", "default": false}}',
 '{"modes": {"zen": {"background": "minimal"}, "standard": {"background": "blur"}}}')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category, type = EXCLUDED.type, level_required = EXCLUDED.level_required,
  title = EXCLUDED.title, description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema, asset_data = EXCLUDED.asset_data, updated_at = CURRENT_TIMESTAMP;

-- ===== MULTIPLIER (type='multiplier') =====
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('experience_boost', 'cosmetic', 'multiplier', 22, 'Experience Booster', 'Earn 25% more experience points from quiz performance.',
 '{"duration": {"type": "enum", "options": ["game", "session", "unlimited"], "default": "unlimited"}}',
 '{"boost": {"rate": 0.25, "applies_to": ["quiz_completion", "correct_answers", "streaks"]}}'),
('streak_protector', 'cosmetic', 'multiplier', 24, 'Streak Guardian', 'Protect your answer streak from one wrong answer per game.',
 '{"activation": {"type": "enum", "options": ["automatic", "manual"], "default": "automatic"}}',
 '{"protection": {"uses_per_game": 1, "visual_indicator": true}}'),
('time_extension', 'cosmetic', 'multiplier', 26, 'Time Master', 'Get extra time for difficult questions when you need it most.',
 '{"extra_seconds": {"type": "range", "min": 5, "max": 15, "default": 10}}',
 '{"extension": {"bonus_time": 10, "activation_threshold": 0.3}}')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category, type = EXCLUDED.type, level_required = EXCLUDED.level_required,
  title = EXCLUDED.title, description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema, asset_data = EXCLUDED.asset_data, updated_at = CURRENT_TIMESTAMP;

-- ===== TITLE (type='title') =====
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('master_scholar', 'cosmetic', 'title', 30, 'Master Scholar', 'Prestigious title showing your dedication to learning.',
 '{"display_style": {"type": "enum", "options": ["badge", "border", "glow"], "default": "glow"}}',
 '{"title": {"text": "Master Scholar", "color": "#fbbf24", "effect": "golden-glow"}}'),
('quiz_legend', 'cosmetic', 'title', 35, 'Quiz Legend', 'Legendary status for the most dedicated quiz masters.',
 '{"aura_effect": {"type": "boolean", "default": true}}',
 '{"legend": {"aura": "legendary-glow", "color": "#a855f7"}}'),
('knowledge_keeper', 'cosmetic', 'title', 40, 'Knowledge Keeper', 'Ultimate perk with exclusive features and recognition.',
 '{"exclusive_lobby": {"type": "boolean", "default": true}}',
 '{"keeper": {"lobby_access": "vip", "special_badge": "keeper-crown"}}')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category, type = EXCLUDED.type, level_required = EXCLUDED.level_required,
  title = EXCLUDED.title, description = EXCLUDED.description,
  config_schema = EXCLUDED.config_schema, asset_data = EXCLUDED.asset_data, updated_at = CURRENT_TIMESTAMP;
