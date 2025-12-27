-- Migration: Simplify Question Sets Schema
-- Date: 2024-08-31
-- Description: Remove unnecessary fields and complexity from question sets

-- Remove unnecessary columns from question_sets table
DO $$ 
BEGIN
    -- Remove owner_id column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_sets' AND column_name = 'owner_id') THEN
        ALTER TABLE question_sets DROP COLUMN owner_id;
    END IF;
    
    -- Remove is_public column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_sets' AND column_name = 'is_public') THEN
        ALTER TABLE question_sets DROP COLUMN is_public;
    END IF;
    
    -- Remove is_featured column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_sets' AND column_name = 'is_featured') THEN
        ALTER TABLE question_sets DROP COLUMN is_featured;
    END IF;
    
    -- Remove tags column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_sets' AND column_name = 'tags') THEN
        ALTER TABLE question_sets DROP COLUMN tags;
    END IF;
    
    -- Remove metadata column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_sets' AND column_name = 'metadata') THEN
        ALTER TABLE question_sets DROP COLUMN metadata;
    END IF;
END $$;

-- Drop related tables that are no longer needed
DROP TABLE IF EXISTS question_set_versions;
DROP TABLE IF EXISTS question_set_permissions;

-- Drop related indexes that are no longer needed
DROP INDEX IF EXISTS idx_question_sets_owner_id;
DROP INDEX IF EXISTS idx_question_sets_is_public;
DROP INDEX IF EXISTS idx_question_sets_is_featured;

-- Drop related constraints
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_question_set_privacy') THEN
        ALTER TABLE question_sets DROP CONSTRAINT chk_question_set_privacy;
    END IF;
END $$;

-- Drop related triggers and functions
DROP TRIGGER IF EXISTS trigger_update_question_set_updated_at ON question_sets;
DROP FUNCTION IF EXISTS update_question_set_updated_at();

-- Recreate the update trigger with simpler logic
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_question_sets_updated_at
    BEFORE UPDATE ON question_sets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
