#!/bin/bash
# Script to apply the shop and dashboard updates to the database

echo "Applying database updates for shop and dashboard..."

# Navigate to auth directory
cd /home/patrick/projects/auth

# Run the migration SQL directly using psql
# You'll need to have the DATABASE_URL environment variable set
# or modify this to use your database connection details

if [ -f .env ]; then
  source .env
fi

# Apply the migration
psql "$DATABASE_URL" -f migrations/update_shop_and_dashboard.sql

echo "Database updates applied successfully!"
echo ""
echo "Changes made:"
echo "  - Payment app URL changed to: https://shop.korczewski.de"
echo "  - VRAM Mastermind renamed to: Dashboard"
echo "  - Dashboard URL: https://dashboard.korczewski.de"
