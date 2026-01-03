#!/bin/bash
# Setup test database with all migrations

set -e

DB_HOST="${TEST_DB_HOST:-localhost}"
DB_PORT="${TEST_DB_PORT:-5432}"
DB_NAME="${TEST_DB_NAME:-l2p_test_db}"
DB_USER="${TEST_DB_USER:-postgres}"
DB_PASSWORD="${TEST_DB_PASSWORD:-8e7fa0310da975b357f74fea410b4be78c5735051115e27ef1a125c3724be8fb}"

echo "Setting up test database: $DB_NAME"

# Apply migrations in order
for migration in $(ls -1 migrations/*.sql | sort); do
  echo "Applying migration: $(basename $migration)"
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration" > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "✓ $(basename $migration) applied successfully"
  else
    echo "✗ $(basename $migration) failed"
    exit 1
  fi
done

echo "✅ Test database setup complete!"
