-- Register Arena in the auth service app catalog
-- Run against auth_db: psql -h <host> -U auth_user -d auth_db -f register-app.sql

INSERT INTO auth.apps (key, name, description, url)
VALUES ('arena', 'Arena', 'Top-down battle royale multiplayer game', 'https://arena.korczewski.de')
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    url = EXCLUDED.url;

-- Grant access to all existing users (arena is open to all registered users)
INSERT INTO auth.user_app_access (user_id, app_id)
SELECT u.id, a.id FROM auth.users u, auth.apps a WHERE a.key = 'arena'
ON CONFLICT DO NOTHING;
