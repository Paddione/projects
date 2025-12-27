# Database Setup and Management

This document describes the database setup, schema, and management tools for the Learn2Play multiplayer quiz game.

## Overview

The application uses PostgreSQL as the primary database with the following key features:

- **Connection Pooling**: Efficient connection management with automatic reconnection
- **Migration System**: Version-controlled schema changes with rollback support
- **Error Handling**: Comprehensive error handling with specific PostgreSQL error codes
- **Health Monitoring**: Built-in health checks and performance monitoring
- **Repository Pattern**: Clean data access layer with type safety

## Database Schema

### Core Tables

1. **users** - User account management
2. **lobbies** - Game lobby management
3. **question_sets** - Question collections
4. **questions** - Individual questions with localized content
5. **game_sessions** - Game session tracking
6. **player_results** - Player performance data
7. **hall_of_fame** - Leaderboard entries
8. **schema_migrations** - Migration tracking

### Key Features

- **Localization Support**: Questions and answers support multiple languages (EN/DE)
- **JSONB Storage**: Flexible data storage for preferences, settings, and dynamic content
- **Proper Indexing**: Optimized queries with strategic indexes
- **Referential Integrity**: Foreign key constraints maintain data consistency
- **Check Constraints**: Data validation at the database level

## Configuration

### Environment Variables

```bash
# Database connection (choose one approach)

# Option 1: Full connection string
DATABASE_URL=postgresql://user:password@host:port/database

# Option 2: Individual variables
DB_HOST=localhost
DB_PORT=5432
DB_NAME=learn2play
DB_USER=l2p_user
DB_PASSWORD=l2p_password
```

### Connection Pool Settings

The database service automatically configures connection pooling:

- **Max Connections**: 20
- **Min Connections**: 2
- **Idle Timeout**: 30 seconds
- **Connection Timeout**: 10 seconds

## Migration System

### Running Migrations

```bash
# Run all pending migrations
npm run db:migrate

# Check migration status
npm run db:status

# Validate applied migrations
npm run db validate

# Rollback last migration
npm run db:rollback

# Rollback specific migration
npm run db:rollback 20240101_000001
```

### Creating New Migrations

1. Create a new file in `backend/migrations/` with format: `YYYYMMDD_HHMMSS_description.sql`

2. Structure your migration file:

```sql
-- UP MIGRATION
-- Your schema changes here
ALTER TABLE users ADD COLUMN new_field VARCHAR(255);

-- DOWN MIGRATION
-- Rollback changes here
ALTER TABLE users DROP COLUMN new_field;
```

### Migration File Naming

- Format: `YYYYMMDD_HHMMSS_description.sql`
- Example: `20240126_143000_add_user_avatar.sql`
- Use descriptive names for the migration purpose

## Database Service Usage

### Basic Operations

```typescript
import { db } from './services/DatabaseService.js';

// Simple query
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// Transaction
await db.transaction(async (client) => {
  await client.query('INSERT INTO users ...');
  await client.query('INSERT INTO user_preferences ...');
});

// Health check
const health = await db.healthCheck();
console.log('Database status:', health.status);
```

### Repository Pattern

```typescript
import { UserRepository } from './repositories/UserRepository.js';

const userRepo = new UserRepository();

// Create user
const user = await userRepo.createUser({
  username: 'john_doe',
  email: 'john@example.com',
  password_hash: 'hashed_password'
});

// Find user
const foundUser = await userRepo.findUserById(user.id);
const userByEmail = await userRepo.findByEmail('john@example.com');

// Update user
await userRepo.updateUser(user.id, {
  preferences: { language: 'de', theme: 'dark' }
});
```

## CLI Commands

The database CLI provides convenient management commands:

```bash
# General database command
npm run db [command]

# Specific commands
npm run db:migrate    # Run migrations
npm run db:rollback   # Rollback last migration
npm run db:status     # Show migration status
npm run db:health     # Check database health

# Available commands:
npm run db migrate    # Run pending migrations
npm run db rollback   # Rollback last migration
npm run db status     # Show migration status
npm run db validate   # Validate applied migrations
npm run db health     # Check database health
npm run db test       # Test database connection
```

## Error Handling

The database service provides comprehensive error handling:

```typescript
import { DatabaseError } from './services/DatabaseService.js';

try {
  await db.query('INSERT INTO users ...');
} catch (error) {
  if (error instanceof DatabaseError) {
    switch (error.code) {
      case 'DUPLICATE_ENTRY':
        // Handle unique constraint violation
        break;
      case 'FOREIGN_KEY_VIOLATION':
        // Handle foreign key constraint violation
        break;
      case 'NOT_NULL_VIOLATION':
        // Handle required field missing
        break;
    }
  }
}
```

## Monitoring and Health Checks

### Health Check Endpoints

- `GET /health` - Overall application health including database
- `GET /health/database` - Detailed database health information
- `GET /api/database/test` - Simple database connectivity test

### Health Check Response

```json
{
  "status": "healthy",
  "details": {
    "connected": true,
    "poolStatus": {
      "totalCount": 5,
      "idleCount": 3,
      "waitingCount": 0
    },
    "responseTime": 12
  }
}
```

## Performance Considerations

### Indexes

The schema includes strategic indexes for:
- User lookups (username, email)
- Lobby operations (code, status, host)
- Question queries (set_id, difficulty)
- Leaderboard queries (score, completion time)

### Query Optimization

- Use parameterized queries to prevent SQL injection
- Leverage connection pooling for concurrent requests
- Monitor slow queries (automatically logged if > 1 second)
- Use transactions for multi-step operations

### Connection Pool Monitoring

Monitor pool status through health checks:
- `totalCount` - Total connections in pool
- `idleCount` - Available connections
- `waitingCount` - Requests waiting for connections

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check if PostgreSQL is running
   - Verify connection parameters
   - Check network connectivity

2. **Migration Failures**
   - Check migration syntax
   - Verify database permissions
   - Review migration logs

3. **Performance Issues**
   - Monitor slow query logs
   - Check connection pool status
   - Review index usage

### Debug Commands

```bash
# Test database connection
npm run db test

# Check migration status
npm run db status

# Validate migrations
npm run db validate

# Check database health
npm run db health
```

## Security Considerations

- Use parameterized queries to prevent SQL injection
- Implement proper authentication and authorization
- Use connection pooling to prevent connection exhaustion
- Regular security updates for PostgreSQL
- Monitor for suspicious query patterns
- Implement proper backup and recovery procedures

## Backup and Recovery

### Backup Commands

```bash
# Create database backup
pg_dump -h localhost -U l2p_user -d learn2play > backup.sql

# Restore from backup
psql -h localhost -U l2p_user -d learn2play < backup.sql
```

### Docker Backup

```bash
# Backup from Docker container
docker exec l2p-postgres pg_dump -U l2p_user learn2play > backup.sql

# Restore to Docker container
docker exec -i l2p-postgres psql -U l2p_user learn2play < backup.sql
```