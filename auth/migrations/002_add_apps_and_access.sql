-- ==========================================================================
-- APPS & USER ACCESS TABLES
-- ==========================================================================

CREATE TABLE IF NOT EXISTS auth.apps (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    url VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS auth.user_app_access (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    app_id INTEGER NOT NULL REFERENCES auth.apps(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE (user_id, app_id)
);

CREATE INDEX IF NOT EXISTS user_app_access_user_id_idx ON auth.user_app_access(user_id);
CREATE INDEX IF NOT EXISTS user_app_access_app_id_idx ON auth.user_app_access(app_id);
CREATE INDEX IF NOT EXISTS apps_key_idx ON auth.apps(key);
CREATE INDEX IF NOT EXISTS apps_active_idx ON auth.apps(is_active);

-- Trigger for apps.updated_at
CREATE TRIGGER update_apps_updated_at
    BEFORE UPDATE ON auth.apps
    FOR EACH ROW
    EXECUTE FUNCTION auth.update_updated_at_column();

-- Seed app catalog
INSERT INTO auth.apps (key, name, description, url)
VALUES
    ('l2p', 'Learn2Play', 'Multiplayer quiz platform', 'https://l2p.korczewski.de'),
    ('videovault', 'VideoVault', 'Video manager', 'https://videovault.korczewski.de'),
    ('payment', 'Payment', 'Payments and wallet dashboard', 'https://payment.korczewski.de'),
    ('vllm-dashboard', 'VRAM Mastermind', 'vLLM dashboard', 'https://vllm.korczewski.de')
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    url = EXCLUDED.url;
