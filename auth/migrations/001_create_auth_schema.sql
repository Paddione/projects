-- UP MIGRATION
-- Create unified authentication schema for centralized auth service

-- Create auth schema
CREATE SCHEMA IF NOT EXISTS auth;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE - Consolidated from all three projects
-- ============================================================================
CREATE TABLE auth.users (
    id SERIAL PRIMARY KEY,

    -- Core authentication
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- NULL for OAuth-only accounts
    email_verified BOOLEAN DEFAULT false NOT NULL,

    -- Profile
    name VARCHAR(255),
    avatar_url VARCHAR(500),
    timezone VARCHAR(50) DEFAULT 'UTC',

    -- Role-based access control
    role VARCHAR(20) DEFAULT 'USER' NOT NULL CHECK (role IN ('USER', 'ADMIN')),

    -- L2P-specific fields (character progression)
    selected_character VARCHAR(50) DEFAULT 'student',
    character_level INTEGER DEFAULT 1 NOT NULL,
    experience_points INTEGER DEFAULT 0 NOT NULL,

    -- User preferences
    preferences JSONB DEFAULT '{"language": "en", "theme": "light"}'::jsonb,
    notification_settings JSONB DEFAULT '{"email": true, "push": true}'::jsonb,

    -- Email verification
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP,

    -- Password reset
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,

    -- Security features
    failed_login_attempts INTEGER DEFAULT 0 NOT NULL,
    last_failed_login TIMESTAMP,
    account_locked_until TIMESTAMP,

    -- Account status
    is_active BOOLEAN DEFAULT true NOT NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login TIMESTAMP
);

-- Users table indexes
CREATE INDEX users_email_idx ON auth.users(LOWER(email));
CREATE INDEX users_username_idx ON auth.users(LOWER(username));
CREATE INDEX users_role_idx ON auth.users(role);
CREATE INDEX users_email_verified_idx ON auth.users(email_verified);
CREATE INDEX users_active_idx ON auth.users(is_active);

-- ============================================================================
-- OAUTH ACCOUNTS TABLE - Google OAuth integration
-- ============================================================================
CREATE TABLE auth.oauth_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- OAuth provider info
    provider VARCHAR(50) NOT NULL, -- 'google', etc.
    provider_account_id VARCHAR(255) NOT NULL,

    -- OAuth tokens
    access_token TEXT,
    refresh_token TEXT,
    expires_at BIGINT,
    token_type VARCHAR(50),
    scope TEXT,
    id_token TEXT,
    session_state TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Unique constraint: one account per provider
    UNIQUE(provider, provider_account_id)
);

-- OAuth accounts indexes
CREATE INDEX oauth_accounts_user_id_idx ON auth.oauth_accounts(user_id);
CREATE INDEX oauth_accounts_provider_idx ON auth.oauth_accounts(provider, provider_account_id);

-- ============================================================================
-- SESSIONS TABLE - For session-based authentication
-- ============================================================================
CREATE TABLE auth.sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires TIMESTAMP NOT NULL,

    -- Device/client information
    ip_address VARCHAR(45), -- IPv6 max length
    user_agent TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Sessions table indexes
CREATE INDEX sessions_token_idx ON auth.sessions(session_token);
CREATE INDEX sessions_user_id_idx ON auth.sessions(user_id);
CREATE INDEX sessions_expires_idx ON auth.sessions(expires);

-- ============================================================================
-- TOKEN BLACKLIST TABLE - For JWT logout
-- ============================================================================
CREATE TABLE auth.token_blacklist (
    token VARCHAR(512) PRIMARY KEY,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Token blacklist indexes
CREATE INDEX token_blacklist_expires_idx ON auth.token_blacklist(expires_at);

-- ============================================================================
-- VERIFICATION TOKENS TABLE - For email verification
-- ============================================================================
CREATE TABLE auth.verification_tokens (
    identifier VARCHAR(255) NOT NULL, -- email
    token VARCHAR(255) NOT NULL,
    expires TIMESTAMP NOT NULL,

    PRIMARY KEY (identifier, token)
);

-- ============================================================================
-- USER MIGRATION LOG TABLE - Audit trail for user migration
-- ============================================================================
CREATE TABLE auth.user_migration_log (
    id SERIAL PRIMARY KEY,
    merged_user_id INTEGER REFERENCES auth.users(id),
    source_project VARCHAR(50) NOT NULL, -- 'l2p', 'videovault', 'payment'
    source_user_id VARCHAR(255) NOT NULL,
    merge_strategy VARCHAR(50) NOT NULL, -- 'primary', 'merged', 'skipped'
    metadata JSONB,
    migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION auth.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auth.update_updated_at_column();

CREATE TRIGGER update_oauth_accounts_updated_at
    BEFORE UPDATE ON auth.oauth_accounts
    FOR EACH ROW
    EXECUTE FUNCTION auth.update_updated_at_column();

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION auth.cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM auth.token_blacklist WHERE expires_at < CURRENT_TIMESTAMP;
    DELETE FROM auth.verification_tokens WHERE expires < CURRENT_TIMESTAMP;
    DELETE FROM auth.sessions WHERE expires < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Comment on schema
COMMENT ON SCHEMA auth IS 'Centralized authentication schema for unified auth service';
COMMENT ON TABLE auth.users IS 'Consolidated user table from l2p, videovault, and payment projects';
COMMENT ON TABLE auth.oauth_accounts IS 'OAuth provider accounts (Google, etc.)';
COMMENT ON TABLE auth.sessions IS 'Session storage for session-based authentication';
COMMENT ON TABLE auth.token_blacklist IS 'Blacklisted JWT tokens for logout';
COMMENT ON TABLE auth.user_migration_log IS 'Audit trail for user data migration';
