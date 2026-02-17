-- Add active_title column to users table for title perk type
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_title VARCHAR(100);

-- Add effect_type and effect_config to cosmetic multiplier perks
-- so PerkEffectEngine can apply them during gameplay

UPDATE perks SET
  effect_type = 'xp_multiplier',
  effect_config = '{"xp_multiplier": 1.25}'::jsonb
WHERE name = 'experience_boost';

UPDATE perks SET
  effect_type = 'free_wrong_answers',
  effect_config = '{"free_wrong_answers": 1}'::jsonb
WHERE name = 'streak_protector';

UPDATE perks SET
  effect_type = 'bonus_seconds',
  effect_config = '{"bonus_seconds": 10}'::jsonb
WHERE name = 'time_extension';

-- Add effect_type for helper perks (answer_previews = show answer highlight, smart_hints = show hint)
UPDATE perks SET
  effect_type = 'answer_preview',
  effect_config = '{"show_preview": true}'::jsonb
WHERE name = 'answer_previews';

UPDATE perks SET
  effect_type = 'show_hint',
  effect_config = '{"show_hint": true, "hint_uses_per_game": 3}'::jsonb
WHERE name = 'smart_hints';

-- Add effect_type for display perks
UPDATE perks SET
  effect_type = 'quick_stats',
  effect_config = '{"show_accuracy": true, "show_streak": true, "show_speed": true}'::jsonb
WHERE name = 'quick_stats';

UPDATE perks SET
  effect_type = 'enhanced_timer',
  effect_config = '{"visual_style": "progress", "audio_warnings": true}'::jsonb
WHERE name = 'enhanced_timers';

UPDATE perks SET
  effect_type = 'focus_mode',
  effect_config = '{"blur_background": true, "zen_mode": false}'::jsonb
WHERE name = 'focus_mode';
