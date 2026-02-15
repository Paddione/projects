-- Add answer_type column (defaults to multiple_choice for all existing questions)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS answer_type VARCHAR(20) DEFAULT 'multiple_choice'
  CHECK (answer_type IN ('multiple_choice', 'free_text'));

-- Add hint column (nullable)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS hint TEXT;
