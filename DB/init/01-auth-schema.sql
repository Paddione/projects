-- =============================================================================
-- AUTH DATABASE - Complete Schema (Final State)
-- =============================================================================
-- Consolidated from migrations 001-006.
-- Run against: auth_db as auth_user (or postgres superuser)
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create auth schema
CREATE SCHEMA IF NOT EXISTS auth;
COMMENT ON SCHEMA auth IS 'Centralized authentication schema for unified auth service';

-- =============================================================================
-- USERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    email_verified BOOLEAN DEFAULT false NOT NULL,
    name VARCHAR(255),
    avatar_url VARCHAR(500),
    timezone VARCHAR(50) DEFAULT 'UTC',
    role VARCHAR(20) DEFAULT 'USER' NOT NULL CHECK (role IN ('USER', 'ADMIN')),
    selected_character VARCHAR(50) DEFAULT 'student',
    character_level INTEGER DEFAULT 1 NOT NULL,
    experience_points INTEGER DEFAULT 0 NOT NULL,
    preferences JSONB DEFAULT '{"language": "en", "theme": "light"}'::jsonb,
    notification_settings JSONB DEFAULT '{"email": true, "push": true}'::jsonb,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0 NOT NULL,
    last_failed_login TIMESTAMP,
    account_locked_until TIMESTAMP,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login TIMESTAMP
);

CREATE INDEX IF NOT EXISTS users_email_idx ON auth.users(LOWER(email));
CREATE INDEX IF NOT EXISTS users_username_idx ON auth.users(LOWER(username));
CREATE INDEX IF NOT EXISTS users_role_idx ON auth.users(role);
CREATE INDEX IF NOT EXISTS users_email_verified_idx ON auth.users(email_verified);
CREATE INDEX IF NOT EXISTS users_active_idx ON auth.users(is_active);

-- =============================================================================
-- OAUTH ACCOUNTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth.oauth_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at BIGINT,
    token_type VARCHAR(50),
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS oauth_accounts_user_id_idx ON auth.oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS oauth_accounts_provider_idx ON auth.oauth_accounts(provider, provider_account_id);

-- =============================================================================
-- SESSIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth.sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_token_idx ON auth.sessions(session_token);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON auth.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON auth.sessions(expires);

-- =============================================================================
-- TOKEN BLACKLIST TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth.token_blacklist (
    token VARCHAR(512) PRIMARY KEY,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS token_blacklist_expires_idx ON auth.token_blacklist(expires_at);

-- =============================================================================
-- VERIFICATION TOKENS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth.verification_tokens (
    identifier VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires TIMESTAMP NOT NULL,
    PRIMARY KEY (identifier, token)
);

-- =============================================================================
-- USER MIGRATION LOG TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth.user_migration_log (
    id SERIAL PRIMARY KEY,
    merged_user_id INTEGER REFERENCES auth.users(id),
    source_project VARCHAR(50) NOT NULL,
    source_user_id VARCHAR(255) NOT NULL,
    merge_strategy VARCHAR(50) NOT NULL,
    metadata JSONB,
    migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =============================================================================
-- APPS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth.apps (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    url VARCHAR(500) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS apps_key_idx ON auth.apps(key);
CREATE INDEX IF NOT EXISTS apps_active_idx ON auth.apps(is_active);

-- =============================================================================
-- USER APP ACCESS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth.user_app_access (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    app_id INTEGER NOT NULL REFERENCES auth.apps(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE (user_id, app_id)
);

CREATE INDEX IF NOT EXISTS user_app_access_user_id_idx ON auth.user_app_access(user_id);
CREATE INDEX IF NOT EXISTS user_app_access_app_id_idx ON auth.user_app_access(app_id);

-- =============================================================================
-- OAUTH CLIENTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth.oauth_clients (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL UNIQUE,
    client_secret VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    redirect_uris JSONB NOT NULL,
    grant_types JSONB DEFAULT '["authorization_code", "refresh_token"]'::jsonb,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS oauth_clients_client_id_idx ON auth.oauth_clients(client_id);
CREATE INDEX IF NOT EXISTS oauth_clients_active_idx ON auth.oauth_clients(is_active);

-- =============================================================================
-- OAUTH AUTHORIZATION CODES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth.oauth_authorization_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(255) NOT NULL UNIQUE,
    client_id VARCHAR(255) NOT NULL REFERENCES auth.oauth_clients(client_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    scope VARCHAR(255) DEFAULT 'openid profile email',
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS oauth_codes_code_idx ON auth.oauth_authorization_codes(code);
CREATE INDEX IF NOT EXISTS oauth_codes_expires_idx ON auth.oauth_authorization_codes(expires_at);
CREATE INDEX IF NOT EXISTS oauth_codes_client_id_idx ON auth.oauth_authorization_codes(client_id);
CREATE INDEX IF NOT EXISTS oauth_codes_user_id_idx ON auth.oauth_authorization_codes(user_id);

-- =============================================================================
-- ACCESS REQUESTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth.access_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    app_id INTEGER NOT NULL REFERENCES auth.apps(id) ON DELETE CASCADE,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
    admin_response TEXT,
    reviewed_by INTEGER REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_requests_user_id ON auth.access_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_app_id ON auth.access_requests(app_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON auth.access_requests(status);

-- =============================================================================
-- PROFILES TABLE (Cross-game)
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth.profiles (
    user_id INTEGER PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(50),
    selected_character VARCHAR(50) NOT NULL DEFAULT 'student',
    selected_gender VARCHAR(10) NOT NULL DEFAULT 'male',
    selected_power_up VARCHAR(50),
    respect_balance INTEGER NOT NULL DEFAULT 0,
    xp_total INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INVENTORY TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth.inventory (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id VARCHAR(100) NOT NULL,
    item_type VARCHAR(20) NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acquisition_source VARCHAR(30) NOT NULL,
    CONSTRAINT idx_inventory_user_item UNIQUE (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON auth.inventory(user_id);

-- =============================================================================
-- LOADOUTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth.loadouts (
    user_id INTEGER PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    equipped_skin VARCHAR(100),
    equipped_emote_1 VARCHAR(100),
    equipped_emote_2 VARCHAR(100),
    equipped_emote_3 VARCHAR(100),
    equipped_emote_4 VARCHAR(100),
    equipped_title VARCHAR(100),
    equipped_border VARCHAR(100),
    equipped_power_up VARCHAR(50),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SHOP CATALOG TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth.shop_catalog (
    item_id VARCHAR(100) PRIMARY KEY,
    item_type VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    respect_cost INTEGER NOT NULL,
    unlock_level INTEGER,
    gender VARCHAR(10),
    character VARCHAR(50),
    preview_asset_url VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

-- =============================================================================
-- TRANSACTIONS TABLE (Economy audit)
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth.transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'respect',
    amount INTEGER NOT NULL,
    item_id VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON auth.transactions(user_id);

-- =============================================================================
-- MATCH ESCROW TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth.match_escrow (
    id SERIAL PRIMARY KEY,
    token VARCHAR(64) UNIQUE NOT NULL,
    player_ids INTEGER[] NOT NULL,
    escrowed_xp JSONB NOT NULL,
    match_config JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ
);

-- =============================================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION auth.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION auth.update_updated_at_column();

CREATE TRIGGER update_oauth_accounts_updated_at
    BEFORE UPDATE ON auth.oauth_accounts
    FOR EACH ROW EXECUTE FUNCTION auth.update_updated_at_column();

CREATE TRIGGER update_apps_updated_at
    BEFORE UPDATE ON auth.apps
    FOR EACH ROW EXECUTE FUNCTION auth.update_updated_at_column();

CREATE OR REPLACE FUNCTION auth.cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM auth.token_blacklist WHERE expires_at < CURRENT_TIMESTAMP;
    DELETE FROM auth.verification_tokens WHERE expires < CURRENT_TIMESTAMP;
    DELETE FROM auth.sessions WHERE expires < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auth.cleanup_expired_oauth_codes()
RETURNS void AS $$
BEGIN
    DELETE FROM auth.oauth_authorization_codes WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SEED DATA: App catalog
-- =============================================================================
INSERT INTO auth.apps (key, name, description, url) VALUES
    ('l2p', 'Learn2Play', 'Multiplayer quiz platform', 'https://l2p.korczewski.de'),
    ('videovault', 'VideoVault', 'Video manager', 'https://videovault.korczewski.de'),
    ('shop', 'Shop', 'Payments and wallet dashboard', 'https://shop.korczewski.de'),
    ('arena', 'Arena', 'Top-down battle royale', 'https://arena.korczewski.de')
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    url = EXCLUDED.url;

-- Link L2P app to OAuth client
INSERT INTO auth.oauth_clients (client_id, client_secret, name, redirect_uris, grant_types, is_active)
VALUES (
    'l2p_client_prod',
    '$2b$12$L2PclientSecretChangeInProduction12345',
    'Learn2Play Quiz Platform',
    '["https://l2p.korczewski.de/auth/callback", "http://localhost:5173/auth/callback"]'::jsonb,
    '["authorization_code", "refresh_token"]'::jsonb,
    true
) ON CONFLICT (client_id) DO NOTHING;

UPDATE auth.apps SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{oauth_client_id}', '"l2p_client_prod"'::jsonb) WHERE key = 'l2p';

-- =============================================================================
-- SEED DATA: Shop catalog (power-ups, emotes, borders, skins)
-- =============================================================================
INSERT INTO auth.shop_catalog (item_id, item_type, name, description, respect_cost) VALUES
    ('power_shield',   'power_up', 'Shield',    'Temporary damage shield',            0),
    ('power_haste',    'power_up', 'Haste',     'Move faster for a short duration',   500),
    ('power_vampiric', 'power_up', 'Vampiric',  'Regain HP on correct answers',       1000),
    ('power_lucky',    'power_up', 'Lucky',     'Increase chance of bonus rewards',   750),
    ('power_fury',     'power_up', 'Fury',      'Double damage on next strike',       1500),
    ('emote_wave',      'emote', 'Wave',      'Give a friendly wave',           0),
    ('emote_gg',        'emote', 'GG',        'Good game salute',               0),
    ('emote_thumbsup',  'emote', 'Thumbs Up', 'Show your approval',             250),
    ('emote_clap',      'emote', 'Clap',      'Applaud your opponent',          250),
    ('emote_shrug',     'emote', 'Shrug',     'Express indifference',           500),
    ('emote_taunt',     'emote', 'Taunt',     'Provoke your opponent',          500),
    ('emote_dance',     'emote', 'Dance',     'Bust a move',                    750),
    ('emote_facepalm',  'emote', 'Facepalm',  'Express disappointment',         750),
    ('border_default',  'border', 'Default',  'The standard frame',             0),
    ('border_bronze',   'border', 'Bronze',   'A bronze-tier frame',            300),
    ('border_silver',   'border', 'Silver',   'A silver-tier frame',            750),
    ('border_gold',     'border', 'Gold',     'A gold-tier frame',              1500),
    ('border_diamond',  'border', 'Diamond',  'An elite diamond frame',         3000),
    ('border_flame',    'border', 'Flame',    'A fiery prestige frame',         2000),
    ('avatar_scientist', 'skin', 'Scientist Avatar', 'Methodical researcher with lab coat and goggles.', 0),
    ('avatar_explorer',  'skin', 'Explorer Avatar',  'Adventure seeker with safari hat and compass.',    0),
    ('avatar_artist',    'skin', 'Artist Avatar',    'Creative thinker with beret and palette.',         0),
    ('avatar_detective', 'skin', 'Detective Avatar', 'Sharp observer with magnifying glass and coat.',   0),
    ('avatar_chef',      'skin', 'Chef Avatar',      'Recipe for success with chef hat and apron.',      0),
    ('avatar_astronaut', 'skin', 'Astronaut Avatar', 'Shoots for the stars in space helmet and suit.',   0),
    ('avatar_wizard',    'skin', 'Wizard Avatar',    'Master of knowledge with pointy hat and staff.',   0),
    ('avatar_ninja',     'skin', 'Ninja Avatar',     'Silent but deadly accurate -- masked and stealthy.',0),
    ('avatar_dragon',    'skin', 'Dragon Avatar',    'Mythical quiz beast in fearsome dragon form.',     0)
ON CONFLICT (item_id) DO NOTHING;

-- =============================================================================
-- TABLE COMMENTS
-- =============================================================================
COMMENT ON TABLE auth.users IS 'Consolidated user table from l2p, videovault, and payment projects';
COMMENT ON TABLE auth.oauth_accounts IS 'OAuth provider accounts (Google, etc.)';
COMMENT ON TABLE auth.sessions IS 'Session storage for session-based authentication';
COMMENT ON TABLE auth.token_blacklist IS 'Blacklisted JWT tokens for logout';
COMMENT ON TABLE auth.user_migration_log IS 'Audit trail for user data migration';
