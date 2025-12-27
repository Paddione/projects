-- Migration: Update perks system implementation
-- Created: 2025-09-07
-- Purpose: Implement proper Bronze Badge, Scholar Badge, and Avatar Collection perks

-- Remove any test perks that might exist
DELETE FROM perks WHERE name LIKE '%test%' OR name LIKE '%Test%';

-- Update Bronze Badge (starter_badge) to have proper badge functionality
UPDATE perks 
SET 
  title = 'Bronze Badge',
  description = 'Show you''ve mastered the basics with this bronze achievement badge. Equip it to display your learning progress.',
  config_schema = '{"badge_style": {"type": "enum", "options": ["classic", "modern", "minimal"], "default": "classic"}}',
  asset_data = '{"badge_styles": {"classic": "badge-bronze-classic.png", "modern": "badge-bronze-modern.png", "minimal": "badge-bronze-minimal.png"}}'
WHERE name = 'starter_badge';

-- Add Scholar Badge as a separate badge perk at level 8
INSERT INTO perks (name, category, type, level_required, title, description, config_schema, asset_data) VALUES
('scholar_badge', 'cosmetic', 'badge', 8, 'Scholar Badge', 'Distinguished badge for dedicated learners. Equip to show your scholarly achievements.',
 '{"badge_style": {"type": "enum", "options": ["silver", "gold", "platinum"], "default": "silver"}}',
 '{"badge_styles": {"silver": "badge-scholar-silver.png", "gold": "badge-scholar-gold.png", "platinum": "badge-scholar-platinum.png"}}')
ON CONFLICT (name) DO NOTHING;

-- Update Avatar Collection to use university characters
UPDATE perks 
SET 
  title = 'Avatar Collection',
  description = 'Unlock additional university character avatars to represent yourself in the game.',
  config_schema = '{"selected_avatar": {"type": "enum", "options": ["student", "professor", "librarian", "researcher", "dean", "graduate", "lab_assistant", "teaching_assistant"], "default": "student"}}',
  asset_data = '{"avatars": {"student": "👨‍🎓", "professor": "👨‍🏫", "librarian": "👩‍💼", "researcher": "👨‍🔬", "dean": "👩‍⚖️", "graduate": "🎓", "lab_assistant": "👨‍🔬", "teaching_assistant": "👩‍🏫"}}'
WHERE name = 'custom_avatars';

-- Move answer_animations to level 12 to make room for scholar_badge at level 8
UPDATE perks 
SET level_required = 12
WHERE name = 'answer_animations';

-- Move ui_themes to level 15
UPDATE perks 
SET level_required = 15
WHERE name = 'ui_themes';

-- Move victory_effects to level 20
UPDATE perks 
SET level_required = 20
WHERE name = 'victory_effects';

-- Verify the updated perks structure
-- Expected: Bronze Badge (3), Avatar Collection (5), Scholar Badge (8), Answer Animations (12), UI Themes (15), Victory Effects (20)