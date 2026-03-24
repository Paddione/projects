#!/bin/bash
# =============================================================================
# Seed Admin User: Paddione
# =============================================================================
# Creates the admin user (patrick@korczewski.de) across ALL service databases.
# Password: 170591pk (bcrypt hashed)
# Run after all schemas are created.
# =============================================================================

set -e

# bcrypt hash of "170591pk" (cost 12)
ADMIN_PW_HASH='$2b$12$8cdIGPdl6/dAZ7kfDTUSwOA85c9ZQJwhbf0GVrk2OTbxh6IyyZ9ra'

echo "=== Seeding admin user: Paddione ==="

# --- AUTH DB ---
echo "  [auth_db] Creating admin user..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "auth_db" <<-EOSQL
    INSERT INTO auth.users (email, username, password_hash, email_verified, role, name, selected_character, is_active)
    VALUES ('patrick@korczewski.de', 'Paddione', '${ADMIN_PW_HASH}', true, 'ADMIN', 'Patrick', 'professor', true)
    ON CONFLICT (email) DO UPDATE SET
        role = 'ADMIN',
        email_verified = true,
        is_active = true,
        username = COALESCE(NULLIF(auth.users.username, ''), 'Paddione');

    -- Grant access to all apps
    INSERT INTO auth.user_app_access (user_id, app_id)
    SELECT u.id, a.id
    FROM auth.users u, auth.apps a
    WHERE u.email = 'patrick@korczewski.de'
    ON CONFLICT (user_id, app_id) DO NOTHING;

    -- Create profile
    INSERT INTO auth.profiles (user_id, display_name, selected_character, respect_balance, xp_total, level)
    SELECT id, 'Paddione', 'professor', 10000, 5000, 40
    FROM auth.users WHERE email = 'patrick@korczewski.de'
    ON CONFLICT (user_id) DO UPDATE SET
        display_name = 'Paddione',
        respect_balance = GREATEST(auth.profiles.respect_balance, 10000);

    -- Create loadout
    INSERT INTO auth.loadouts (user_id)
    SELECT id FROM auth.users WHERE email = 'patrick@korczewski.de'
    ON CONFLICT (user_id) DO NOTHING;

    -- Grant all free items
    INSERT INTO auth.inventory (user_id, item_id, item_type, acquisition_source)
    SELECT u.id, c.item_id, c.item_type, 'admin_grant'
    FROM auth.users u
    CROSS JOIN auth.shop_catalog c
    WHERE u.email = 'patrick@korczewski.de'
    ON CONFLICT (user_id, item_id) DO NOTHING;
EOSQL

# --- L2P DB ---
echo "  [l2p_db] Creating admin user..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "l2p_db" <<-EOSQL
    INSERT INTO users (username, email, password_hash, email_verified, selected_character, character_level, experience_points, is_active, is_admin)
    VALUES ('Paddione', 'patrick@korczewski.de', '${ADMIN_PW_HASH}', true, 'professor', 40, 50000, true, true)
    ON CONFLICT (email) DO UPDATE SET
        is_admin = true,
        email_verified = true,
        is_active = true;
EOSQL

# --- ARENA DB ---
echo "  [arena_db] Creating admin player..."
# Get auth user id first (if auth_db was just seeded)
AUTH_USER_ID=$(psql -t -A --username "$POSTGRES_USER" --dbname "auth_db" \
    -c "SELECT id FROM auth.users WHERE email = 'patrick@korczewski.de' LIMIT 1")

if [ -n "$AUTH_USER_ID" ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "arena_db" <<-EOSQL
        INSERT INTO players (auth_user_id, username, selected_character, character_level, experience)
        VALUES (${AUTH_USER_ID}, 'Paddione', 'professor', 10, 5000)
        ON CONFLICT (auth_user_id) DO UPDATE SET
            username = 'Paddione';
EOSQL
else
    echo "  [arena_db] WARNING: No auth user found, skipping arena player creation"
fi

# --- SHOP DB ---
echo "  [shop_db] Creating admin user..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "shop_db" <<-EOSQL
    INSERT INTO "User" ("id", "email", "name", "passwordHash", "role", "createdAt", "updatedAt")
    VALUES (
        'admin_paddione_001',
        'patrick@korczewski.de',
        'Paddione',
        '${ADMIN_PW_HASH}',
        'ADMIN',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT ("email") DO UPDATE SET
        "role" = 'ADMIN',
        "name" = 'Paddione';

    -- Create wallet
    INSERT INTO "Wallet" ("id", "userId", "balance")
    VALUES ('wallet_paddione_001', 'admin_paddione_001', 100.00)
    ON CONFLICT ("userId") DO NOTHING;
EOSQL

# --- VIDEOVAULT DB ---
echo "  [videovault_db] Creating admin user..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "videovault_db" <<-EOSQL
    INSERT INTO users (id, username, password)
    VALUES (gen_random_uuid()::text, 'Paddione', '${ADMIN_PW_HASH}')
    ON CONFLICT (username) DO UPDATE SET
        password = '${ADMIN_PW_HASH}';
EOSQL

echo "=== Admin user seeded in all databases ==="
