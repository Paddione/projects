#!/bin/bash

# Get PostgreSQL container name
POSTGRES_CONTAINER=${POSTGRES_CONTAINER:-l2p-postgres}
POSTGRES_USER=${POSTGRES_USER:-l2p_user}
POSTGRES_DB=${POSTGRES_DB:-learn2play}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running. Please start Docker and try again."
  exit 1
fi

# Check if PostgreSQL container is running
if ! docker ps | grep -q "$POSTGRES_CONTAINER"; then
  echo "PostgreSQL container '$POSTGRES_CONTAINER' is not running. Please start it first."
  exit 1
fi

echo "Clearing all lobbies from database '$POSTGRES_DB'..."

# Connect to PostgreSQL and clear lobbies
docker exec -i "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<-EOSQL
  -- Clear player answers and game sessions first to avoid foreign key violations
  DELETE FROM player_answers;
  DELETE FROM game_sessions;
  
  -- Now clear all lobbies
  DELETE FROM lobbies;
  
  -- Reset sequences if needed
  SELECT setval('lobbies_id_seq', 1, false);
  
  -- Show remaining lobbies (should be 0)
  SELECT COUNT(*) as remaining_lobbies FROM lobbies;
EOSQL

echo "All lobbies have been cleared."
