-- Migration: Add OAuth 2.0 Authorization Code Flow Tables
-- Created: 2025-01-01
-- Description: Adds oauth_clients and oauth_authorization_codes tables for OAuth 2.0 support

-- ============================================================================
-- OAuth Clients Table
-- Stores OAuth client registrations (L2P and future applications)
-- ============================================================================
CREATE TABLE IF NOT EXISTS auth.oauth_clients (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL UNIQUE,
    client_secret VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    redirect_uris JSONB NOT NULL,  -- Array of allowed redirect URIs
    grant_types JSONB DEFAULT '["authorization_code", "refresh_token"]'::jsonb,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for oauth_clients
CREATE INDEX oauth_clients_client_id_idx ON auth.oauth_clients(client_id);
CREATE INDEX oauth_clients_active_idx ON auth.oauth_clients(is_active);

-- ============================================================================
-- OAuth Authorization Codes Table
-- Stores short-lived authorization codes (10 minutes expiry, single-use)
-- ============================================================================
CREATE TABLE IF NOT EXISTS auth.oauth_authorization_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(255) NOT NULL UNIQUE,
    client_id VARCHAR(255) NOT NULL REFERENCES auth.oauth_clients(client_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    scope VARCHAR(255) DEFAULT 'openid profile email',
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,  -- NULL if not used, prevents reuse
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for oauth_authorization_codes
CREATE INDEX oauth_codes_code_idx ON auth.oauth_authorization_codes(code);
CREATE INDEX oauth_codes_expires_idx ON auth.oauth_authorization_codes(expires_at);
CREATE INDEX oauth_codes_client_id_idx ON auth.oauth_authorization_codes(client_id);
CREATE INDEX oauth_codes_user_id_idx ON auth.oauth_authorization_codes(user_id);

-- ============================================================================
-- Seed Data: Register L2P as OAuth Client
-- ============================================================================
INSERT INTO auth.oauth_clients (client_id, client_secret, name, redirect_uris, grant_types, is_active)
VALUES (
    'l2p_client_prod',
    '$2b$12$L2PclientSecretChangeInProduction12345',  -- CHANGE THIS IN PRODUCTION
    'Learn2Play Quiz Platform',
    '["https://l2p.korczewski.de/auth/callback", "http://localhost:5173/auth/callback"]'::jsonb,
    '["authorization_code", "refresh_token"]'::jsonb,
    true
)
ON CONFLICT (client_id) DO NOTHING;

-- ============================================================================
-- Add metadata field to apps table for OAuth client linking
-- ============================================================================
ALTER TABLE auth.apps
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Link L2P app to OAuth client
UPDATE auth.apps
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{oauth_client_id}',
    '"l2p_client_prod"'::jsonb
)
WHERE key = 'l2p';

-- ============================================================================
-- Cleanup Function: Remove expired authorization codes
-- ============================================================================
CREATE OR REPLACE FUNCTION auth.cleanup_expired_oauth_codes()
RETURNS void AS $$
BEGIN
    DELETE FROM auth.oauth_authorization_codes
    WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auth.cleanup_expired_oauth_codes IS 'Removes authorization codes that expired more than 1 day ago';
