-- Migration: Add Experience Tracking to Game Results
-- Date: 2024-01-01
-- Description: Add experience tracking to player results and enhance Hall of Fame

-- Add experience tracking to player_results table
DO $$ 
BEGIN
    -- Add experience_gained column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_results' AND column_name = 'experience_gained') THEN
        ALTER TABLE player_results ADD COLUMN experience_gained INTEGER DEFAULT 0;
    END IF;
    
    -- Add level_before column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_results' AND column_name = 'level_before') THEN
        ALTER TABLE player_results ADD COLUMN level_before INTEGER DEFAULT 1;
    END IF;
    
    -- Add level_after column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_results' AND column_name = 'level_after') THEN
        ALTER TABLE player_results ADD COLUMN level_after INTEGER DEFAULT 1;
    END IF;
    
    -- Add level_up_occurred column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_results' AND column_name = 'level_up_occurred') THEN
        ALTER TABLE player_results ADD COLUMN level_up_occurred BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Add experience tracking to hall_of_fame table
DO $$ 
BEGIN
    -- Add experience_gained column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hall_of_fame' AND column_name = 'experience_gained') THEN
        ALTER TABLE hall_of_fame ADD COLUMN experience_gained INTEGER DEFAULT 0;
    END IF;
    
    -- Add level_achieved column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hall_of_fame' AND column_name = 'level_achieved') THEN
        ALTER TABLE hall_of_fame ADD COLUMN level_achieved INTEGER DEFAULT 1;
    END IF;
    
    -- Add total_experience column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hall_of_fame' AND column_name = 'total_experience') THEN
        ALTER TABLE hall_of_fame ADD COLUMN total_experience INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add indexes for experience tracking
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_player_results_experience_gained') THEN
        CREATE INDEX idx_player_results_experience_gained ON player_results(experience_gained DESC);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_player_results_level_up') THEN
        CREATE INDEX idx_player_results_level_up ON player_results(level_up_occurred) WHERE level_up_occurred = true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_hall_of_fame_experience_gained') THEN
        CREATE INDEX idx_hall_of_fame_experience_gained ON hall_of_fame(experience_gained DESC);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_hall_of_fame_level_achieved') THEN
        CREATE INDEX idx_hall_of_fame_level_achieved ON hall_of_fame(level_achieved DESC);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_hall_of_fame_total_experience') THEN
        CREATE INDEX idx_hall_of_fame_total_experience ON hall_of_fame(total_experience DESC);
    END IF;
END;
$$;

-- Create view for question set leaderboards
CREATE OR REPLACE VIEW question_set_leaderboards AS
SELECT 
    qs.id as question_set_id,
    qs.name as question_set_name,
    qs.category as question_set_category,
    qs.difficulty as question_set_difficulty,
    hof.username,
    hof.character_name,
    hof.score,
    hof.accuracy,
    hof.max_multiplier,
    hof.experience_gained,
    hof.level_achieved,
    hof.total_experience,
    hof.completed_at,
    ROW_NUMBER() OVER (
        PARTITION BY qs.id 
        ORDER BY hof.score DESC, hof.accuracy DESC, hof.completed_at ASC
    ) as rank
FROM hall_of_fame hof
JOIN question_sets qs ON hof.question_set_id = qs.id
WHERE qs.is_active = true
ORDER BY qs.name, rank;

-- Create view for overall leaderboard
CREATE OR REPLACE VIEW overall_leaderboard AS
SELECT 
    username,
    character_name,
    SUM(score) as total_score,
    AVG(accuracy) as avg_accuracy,
    MAX(max_multiplier) as best_multiplier,
    SUM(experience_gained) as total_experience_gained,
    MAX(level_achieved) as highest_level,
    COUNT(*) as games_played,
    MAX(completed_at) as last_game
FROM hall_of_fame
GROUP BY username, character_name
ORDER BY total_score DESC, avg_accuracy DESC;

-- Create view for experience leaderboard
CREATE OR REPLACE VIEW experience_leaderboard AS
SELECT 
    username,
    character_name,
    SUM(experience_gained) as total_experience,
    MAX(level_achieved) as current_level,
    COUNT(*) as games_played,
    AVG(experience_gained) as avg_experience_per_game,
    MAX(completed_at) as last_game
FROM hall_of_fame
GROUP BY username, character_name
ORDER BY total_experience DESC, current_level DESC;

-- Update existing records to have default experience values
UPDATE player_results 
SET experience_gained = final_score, 
    level_before = 1, 
    level_after = 1, 
    level_up_occurred = false 
WHERE experience_gained IS NULL;

UPDATE hall_of_fame 
SET experience_gained = score, 
    level_achieved = 1, 
    total_experience = score 
WHERE experience_gained IS NULL;

-- Insert migration record
INSERT INTO schema_migrations (version, description, applied_at) 
VALUES ('20240101_000003_add_experience_tracking', 'Add experience tracking to game results and enhance Hall of Fame', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING; 