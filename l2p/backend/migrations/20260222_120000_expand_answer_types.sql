-- Expand answer types and add game mode tracking
-- New answer types: true_false, estimation, ordering, matching, fill_in_blank
-- New columns: answer_metadata (questions), game_mode (game_sessions), mode_data (player_results)

-- Drop existing CHECK constraint to expand allowed answer types
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_answer_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_answer_type_check
  CHECK (answer_type IN (
    'multiple_choice', 'free_text', 'true_false',
    'estimation', 'ordering', 'matching', 'fill_in_blank'
  ));

-- Type-specific metadata (estimation config, ordering items, matching pairs, etc.)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS answer_metadata JSONB;

-- Record game mode per session for analytics
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS game_mode VARCHAR(30) DEFAULT 'arcade';

-- Per-player mode-specific data (lives lost, wagers made, duel wins, etc.)
ALTER TABLE player_results ADD COLUMN IF NOT EXISTS mode_data JSONB DEFAULT '{}'::jsonb;
