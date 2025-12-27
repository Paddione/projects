-- Migration to convert multilingual JSONB fields to single-language TEXT fields
-- This migration converts the system from multilingual to German-only

-- UP MIGRATION
BEGIN;

-- Check if question_text is JSONB and needs conversion
DO $$
DECLARE
    question_text_type text;
    explanation_type text;
BEGIN
    -- Check the data type of question_text
    SELECT data_type INTO question_text_type
    FROM information_schema.columns 
    WHERE table_name = 'questions' AND column_name = 'question_text';
    
    -- Check the data type of explanation
    SELECT data_type INTO explanation_type
    FROM information_schema.columns 
    WHERE table_name = 'questions' AND column_name = 'explanation';
    
    -- Only proceed with conversion if columns are JSONB
    IF question_text_type = 'jsonb' OR explanation_type = 'jsonb' THEN
        -- Add new TEXT columns for single-language content
        IF question_text_type = 'jsonb' THEN
            ALTER TABLE questions ADD COLUMN question_text_new TEXT;
            
            -- Migrate existing JSONB data to TEXT (extract German content or fallback to English)
            UPDATE questions 
            SET question_text_new = COALESCE(
                question_text->>'de',
                question_text->>'en',
                question_text::text
            )
            WHERE question_text IS NOT NULL;
        END IF;
        
        IF explanation_type = 'jsonb' THEN
            ALTER TABLE questions ADD COLUMN explanation_new TEXT;
            
            UPDATE questions 
            SET explanation_new = COALESCE(
                explanation->>'de',
                explanation->>'en',
                explanation::text
            )
            WHERE explanation IS NOT NULL;
        END IF;
    END IF;
END $$;

-- Update answers JSONB to extract text content (only if needed)
DO $$
BEGIN
    -- Check if answers need conversion (contains objects with text sub-objects)
    IF EXISTS (
        SELECT 1 FROM questions 
        WHERE answers::text LIKE '%"text":{%' 
        LIMIT 1
    ) THEN
        UPDATE questions 
        SET answers = (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'text', COALESCE(
                        answer_item->>'text',
                        answer_item->'text'->>'de',
                        answer_item->'text'->>'en',
                        'No text'
                    ),
                    'correct', COALESCE((answer_item->>'correct')::boolean, false)
                )
            )
            FROM jsonb_array_elements(answers) AS answer_item
        )
        WHERE answers IS NOT NULL;
    END IF;
END $$;

-- Drop old JSONB columns and rename new ones (only if conversion happened)
DO $$
BEGIN
    -- Only rename columns if conversion happened
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'question_text_new') THEN
        ALTER TABLE questions DROP COLUMN question_text;
        ALTER TABLE questions RENAME COLUMN question_text_new TO question_text;
        -- Add NOT NULL constraint to question_text
        ALTER TABLE questions ALTER COLUMN question_text SET NOT NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'explanation_new') THEN
        ALTER TABLE questions DROP COLUMN explanation;
        ALTER TABLE questions RENAME COLUMN explanation_new TO explanation;
    END IF;
END $$;

-- Update any existing sample data to use simple German text
UPDATE questions 
SET question_text = 'Was ist die Hauptstadt von Frankreich?',
    explanation = 'Paris ist die Hauptstadt und größte Stadt Frankreichs.'
WHERE question_text LIKE '%capital of France%';

UPDATE questions 
SET question_text = 'Welcher Planet ist als der Rote Planet bekannt?',
    explanation = 'Mars wird aufgrund seines rötlichen Aussehens der Rote Planet genannt.'
WHERE question_text LIKE '%Red Planet%';

COMMIT;

-- DOWN MIGRATION (for rollback)
-- Note: This is a destructive migration. Rolling back will lose multilingual data.
-- 
-- BEGIN;
-- ALTER TABLE questions ADD COLUMN question_text_jsonb JSONB;
-- ALTER TABLE questions ADD COLUMN explanation_jsonb JSONB;
-- 
-- UPDATE questions 
-- SET question_text_jsonb = jsonb_build_object('de', question_text)
-- WHERE question_text IS NOT NULL;
-- 
-- UPDATE questions 
-- SET explanation_jsonb = jsonb_build_object('de', explanation)
-- WHERE explanation IS NOT NULL;
-- 
-- ALTER TABLE questions DROP COLUMN question_text;
-- ALTER TABLE questions DROP COLUMN explanation;
-- ALTER TABLE questions RENAME COLUMN question_text_jsonb TO question_text;
-- ALTER TABLE questions RENAME COLUMN explanation_jsonb TO explanation;
-- 
-- COMMIT;
