#!/bin/bash
# Script to reset the database container and volume
# Run this after ensuring your host disk has free space and Docker Desktop is running cleanly.

echo "Stopping containers..."
docker stop payment-db-1 || true

echo "Removing container (force)..."
docker rm -f payment-db-1 || true

echo "Removing volume..."
docker volume rm payment_db_data || true

echo "Starting db container..."
# Using the same config as compose.yaml
docker run -d \
  --name payment-db-1 \
  -p 5433:5432 \
  -e POSTGRES_USER=patrick \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=payment_db \
  -v payment_db_data:/var/lib/postgresql/data \
  postgres:15-alpine

echo "Waiting for DB to start..."
sleep 5

echo "Running migrations..."
# This will recreate the schema
npx prisma migrate dev --name init

echo "Database fixed and reset!"
