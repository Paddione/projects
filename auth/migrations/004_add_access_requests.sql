-- Migration 004: Add access_requests table
-- Adds access request system with rate limiting support

CREATE TABLE IF NOT EXISTS auth.access_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id INTEGER NOT NULL REFERENCES auth.apps(id) ON DELETE CASCADE,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  admin_response TEXT,
  reviewed_by INTEGER REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_access_requests_user_id ON auth.access_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_app_id ON auth.access_requests(app_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON auth.access_requests(status);

-- Add check constraint for valid status values
ALTER TABLE auth.access_requests
ADD CONSTRAINT access_requests_status_check
CHECK (status IN ('pending', 'approved', 'denied'));
