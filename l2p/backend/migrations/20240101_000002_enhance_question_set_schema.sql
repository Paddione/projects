-- Migration: Enhance Question Set Schema with Ownership and Privacy Settings
-- Date: 2024-01-01
-- Description: Add ownership, privacy settings, and enhanced metadata to question sets

-- Add ownership and privacy fields to question_sets table
DO $$ 
BEGIN
    -- Add owner_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_sets' AND column_name = 'owner_id') THEN
        ALTER TABLE question_sets ADD COLUMN owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    
    -- Add is_public column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_sets' AND column_name = 'is_public') THEN
        ALTER TABLE question_sets ADD COLUMN is_public BOOLEAN DEFAULT true;
    END IF;
    
    -- Add is_featured column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_sets' AND column_name = 'is_featured') THEN
        ALTER TABLE question_sets ADD COLUMN is_featured BOOLEAN DEFAULT false;
    END IF;
    
    -- Add tags column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_sets' AND column_name = 'tags') THEN
        ALTER TABLE question_sets ADD COLUMN tags JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    -- Add metadata column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_sets' AND column_name = 'metadata') THEN
        ALTER TABLE question_sets ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_sets' AND column_name = 'updated_at') THEN
        ALTER TABLE question_sets ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Add constraint for privacy settings
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_question_set_privacy') THEN
        ALTER TABLE question_sets 
        ADD CONSTRAINT chk_question_set_privacy 
        CHECK (is_public = true OR (is_public = false AND owner_id IS NOT NULL));
    END IF;
END $$;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_question_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'trigger_update_question_set_updated_at') THEN
        CREATE TRIGGER trigger_update_question_set_updated_at
            BEFORE UPDATE ON question_sets
            FOR EACH ROW
            EXECUTE FUNCTION update_question_set_updated_at();
    END IF;
END $$;

-- Add indexes for new fields
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_question_sets_owner_id') THEN
        CREATE INDEX idx_question_sets_owner_id ON question_sets(owner_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_question_sets_is_public') THEN
        CREATE INDEX idx_question_sets_is_public ON question_sets(is_public);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_question_sets_is_featured') THEN
        CREATE INDEX idx_question_sets_is_featured ON question_sets(is_featured);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_question_sets_updated_at') THEN
        CREATE INDEX idx_question_sets_updated_at ON question_sets(updated_at DESC);
    END IF;
END $$;

-- Add question set permissions table for shared access
CREATE TABLE IF NOT EXISTS question_set_permissions (
    id SERIAL PRIMARY KEY,
    question_set_id INTEGER REFERENCES question_sets(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    permission_type VARCHAR(20) NOT NULL CHECK (permission_type IN ('read', 'write', 'admin')),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(question_set_id, user_id)
);

-- Add indexes for permissions table
CREATE INDEX IF NOT EXISTS idx_question_set_permissions_question_set_id ON question_set_permissions(question_set_id);
CREATE INDEX IF NOT EXISTS idx_question_set_permissions_user_id ON question_set_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_question_set_permissions_type ON question_set_permissions(permission_type);

-- Add question set versioning table for tracking changes
CREATE TABLE IF NOT EXISTS question_set_versions (
    id SERIAL PRIMARY KEY,
    question_set_id INTEGER REFERENCES question_sets(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    changes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(question_set_id, version_number)
);

-- Add indexes for versioning table
CREATE INDEX IF NOT EXISTS idx_question_set_versions_question_set_id ON question_set_versions(question_set_id);
CREATE INDEX IF NOT EXISTS idx_question_set_versions_created_at ON question_set_versions(created_at DESC);

-- Update existing question sets to be public and owned by system
UPDATE question_sets 
SET owner_id = NULL, is_public = true, is_featured = true 
WHERE owner_id IS NULL;

-- Insert migration record
INSERT INTO schema_migrations (version, description, applied_at) 
VALUES ('20240101_000002_enhance_question_set_schema', 'Enhanced question set schema with ownership and privacy settings', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING; 