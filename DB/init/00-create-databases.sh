#!/bin/bash
# =============================================================================
# Create all Korczewski databases and service users
# =============================================================================
# Runs as postgres superuser. Passwords come from environment variables
# (injected from k8s secret postgres-credentials).
#
# Databases: auth_db, l2p_db, arena_db, shop_db, videovault_db
# Each database gets an isolated service user with full privileges.
# =============================================================================

set -e

echo "=== Initializing Korczewski databases ==="

# Create databases
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE auth_db;
    CREATE DATABASE l2p_db;
    CREATE DATABASE arena_db;
    CREATE DATABASE shop_db;
    CREATE DATABASE videovault_db;
EOSQL

# Create users with passwords from environment
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER auth_user WITH PASSWORD '${AUTH_DB_PASSWORD}';
    CREATE USER l2p_user WITH PASSWORD '${L2P_DB_PASSWORD}';
    CREATE USER arena_user WITH PASSWORD '${ARENA_DB_PASSWORD}';
    CREATE USER shop_user WITH PASSWORD '${SHOP_DB_PASSWORD}';
    CREATE USER videovault_user WITH PASSWORD '${VIDEOVAULT_DB_PASSWORD}';

    GRANT ALL PRIVILEGES ON DATABASE auth_db TO auth_user;
    GRANT ALL PRIVILEGES ON DATABASE l2p_db TO l2p_user;
    GRANT ALL PRIVILEGES ON DATABASE arena_db TO arena_user;
    GRANT ALL PRIVILEGES ON DATABASE shop_db TO shop_user;
    GRANT ALL PRIVILEGES ON DATABASE videovault_db TO videovault_user;
EOSQL

# Grant schema permissions for each database
for db_info in "auth_db:auth_user" "l2p_db:l2p_user" "arena_db:arena_user" "shop_db:shop_user" "videovault_db:videovault_user"; do
    db=$(echo "$db_info" | cut -d: -f1)
    user=$(echo "$db_info" | cut -d: -f2)
    echo "Granting schema permissions on $db to $user..."
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" <<-EOSQL
        GRANT ALL ON SCHEMA public TO $user;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $user;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $user;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO $user;
EOSQL
done

echo "=== Database initialization complete ==="
