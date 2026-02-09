#!/bin/bash
# Script to reset the database container and volume
# Run this after ensuring your host disk has free space and Docker Desktop is running cleanly.

echo "Stopping containers..."
docker stop shop-db-1 || true

echo "Removing container (force)..."
docker rm -f shop-db-1 || true

echo "Removing volume..."
docker volume rm shop_db_data || true

echo "Starting db container..."
# Using the same config as compose.yaml
docker run -d \
  --name shop-db-1 \
  -p 5432:5432 \
  -e POSTGRES_USER=shop_user \
  -e POSTGRES_PASSWORD=ZknuT3kvngLBKjxpQu6lOW7GYba4xZoN \
  -e POSTGRES_DB=shop_db \
  -v shop_db_data:/var/lib/postgresql/data \
  postgres:15-alpine

echo "Waiting for DB to start..."
sleep 5

echo "Running migrations..."
# This will recreate the schema
npx prisma migrate dev --name init

echo "Database fixed and reset!"
