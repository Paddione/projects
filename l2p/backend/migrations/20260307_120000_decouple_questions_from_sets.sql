BEGIN;

-- 1a: Create junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS question_set_questions (
    id SERIAL PRIMARY KEY,
    question_set_id INTEGER NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    position INTEGER,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(question_set_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_qsq_set_id ON question_set_questions(question_set_id);
CREATE INDEX IF NOT EXISTS idx_qsq_question_id ON question_set_questions(question_id);

-- 1b: Add category/language columns to questions for independent filtering
ALTER TABLE questions ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'de';
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_answer_type ON questions(answer_type);

-- 2: Migrate existing relationships into junction table
INSERT INTO question_set_questions (question_set_id, question_id, position)
SELECT question_set_id, id, ROW_NUMBER() OVER (PARTITION BY question_set_id ORDER BY id)
FROM questions WHERE question_set_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3: Backfill category on questions from their set
UPDATE questions q SET category = qs.category
FROM question_sets qs WHERE q.question_set_id = qs.id AND q.category IS NULL;

-- 4: Drop the old FK column
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_question_set_id_fkey;
ALTER TABLE questions DROP COLUMN IF EXISTS question_set_id;

COMMIT;
