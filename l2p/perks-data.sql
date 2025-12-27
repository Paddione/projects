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