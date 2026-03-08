BEGIN;

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Seed default categories
INSERT INTO categories (name)
VALUES ('IT'), ('Language'), ('undefined')
ON CONFLICT (name) DO NOTHING;

-- 3. Backfill distinct categories from existing questions
INSERT INTO categories (name)
SELECT DISTINCT category
FROM questions
WHERE category IS NOT NULL
  AND category <> ''
  AND category NOT IN (SELECT name FROM categories)
ON CONFLICT (name) DO NOTHING;

-- 4. Add category_id FK column to questions
ALTER TABLE questions
    ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT;

-- 5. Populate category_id from existing category strings
UPDATE questions
SET category_id = c.id
FROM categories c
WHERE questions.category = c.name
  AND questions.category_id IS NULL;

-- 6. Set uncategorized questions to 'undefined'
UPDATE questions
SET category_id = (SELECT id FROM categories WHERE name = 'undefined')
WHERE category_id IS NULL;

-- 7. Drop old category VARCHAR column
ALTER TABLE questions DROP COLUMN IF EXISTS category;

-- 8. Create index on category_id
CREATE INDEX IF NOT EXISTS idx_questions_category_id ON questions(category_id);

COMMIT;
