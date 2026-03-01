-- Deactivate audio perks (keep rows for data integrity, just mark inactive)
-- Audio is now a default feature, not perk-gated
UPDATE perks SET is_active = false WHERE name IN ('sound_packs_basic', 'sound_packs_premium', 'audio_reactions');
