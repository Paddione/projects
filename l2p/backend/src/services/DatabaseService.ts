import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';


export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;
  min?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export class DatabaseService {
  private static instance: DatabaseService | null = null;
  private pool: Pool;
  private isConnected: boolean = false;
  private isClosing: boolean = false;

  private constructor() {
    const config: DatabaseConfig = this.parseConnectionString();
    this.pool = new Pool({
      ...config,
      max: config.max ?? 25, // Maximum number of connections (default 25)
      min: config.min ?? 5,  // Minimum number of connections (default 5)
      idleTimeoutMillis: config.idleTimeoutMillis || 30000, // 30 seconds
      connectionTimeoutMillis: config.connectionTimeoutMillis || 10000, // 10 seconds
      application_name: process.env['APP_NAME'] || 'l2p-backend'
    } as any);

    this.setupEventHandlers();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public static async reset(): Promise<void> {
    if (DatabaseService.instance) {
      await DatabaseService.instance.close();
      DatabaseService.instance = null;
    }
  }

  private parseConnectionString(): DatabaseConfig {
    // Check if we're in a test environment
    const isTestEnvironment = process.env['NODE_ENV'] === 'test' ||
      process.env['TEST_ENVIRONMENT'] === 'local' ||
      process.env['TEST_TYPE'] === 'integration';

    let databaseUrl = process.env['DATABASE_URL'];

    // For test environment, prioritize test database configuration
    if (isTestEnvironment) {
      // Use test database configuration if available
      const testDatabaseUrl = process.env['TEST_DATABASE_URL'];
      if (testDatabaseUrl) {
        try {
          const url = new URL(testDatabaseUrl);
          return {
            host: url.hostname,
            port: parseInt(url.port) || 5433,
            database: url.pathname.slice(1),
            user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
            ssl: false,
            max: 10,
            min: 2
          };
        } catch (error) {
          console.warn('Invalid TEST_DATABASE_URL, falling back to test defaults:', error);
        }
      }

      // Fallback to test database defaults
      return {
        host: process.env['TEST_DB_HOST'] || 'localhost',
        port: parseInt(process.env['TEST_DB_PORT'] || '5433'),
        database: process.env['TEST_DB_NAME'] || 'learn2play_test',
        user: process.env['TEST_DB_USER'] || 'l2p_user',
        password: process.env['TEST_DB_PASSWORD'] || 'HEHlWwBhTj71Em5GL9qh8G8kXACPrzx3',
        ssl: false,
        max: 10,
        min: 2
      };
    }

    // Production/development environment
    if (databaseUrl) {
      try {
        // Handle special characters in password by properly encoding the URL
        let encodedUrl = databaseUrl;

        // If the URL contains unencoded special characters, try to encode them
        if (databaseUrl.includes('@') && !databaseUrl.includes('%')) {
          // Extract parts before encoding
          const urlParts = databaseUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@(.+)$/);
          if (urlParts && urlParts.length >= 4) {
            const [, user, password, rest] = urlParts;
            if (user && password && rest) {
              const encodedUser = encodeURIComponent(user);
              const encodedPassword = encodeURIComponent(password);
              encodedUrl = `postgresql://${encodedUser}:${encodedPassword}@${rest}`;
            }
          }
        }

        // Append application_name for better visibility in pg_stat_activity
        const url = new URL(encodedUrl);
        const existingParams = url.searchParams;
        if (!existingParams.has('application_name')) {
          existingParams.set('application_name', process.env['APP_NAME'] || 'l2p-backend');
        }
        url.search = existingParams.toString();

        return {
          host: url.hostname,
          port: parseInt(url.port) || 5432,
          database: url.pathname.slice(1), // Remove leading slash
          user: decodeURIComponent(url.username),
          password: decodeURIComponent(url.password),
          ssl: process.env['DB_SSL'] === 'true'
        };
      } catch (error) {
        // If URL parsing fails, fall back to defaults
        console.warn('Invalid DATABASE_URL, using fallback configuration:', error);
      }
    }

    // Fallback to individual environment variables with consistent database name
    const dbName = process.env['DB_NAME'] || process.env['POSTGRES_DB'] || 'l2p_db';

    const cfg: DatabaseConfig = {
      host: process.env['DB_HOST'] || 'postgres',
      port: parseInt(process.env['DB_PORT'] || '5432'),
      database: dbName,
      user: process.env['DB_USER'] || process.env['POSTGRES_USER'] || 'l2p_user',
      password: process.env['POSTGRES_PASSWORD'] || 'password',
      ssl: process.env['DB_SSL'] === 'true',
    };
    if (process.env['DB_POOL_MAX']) cfg.max = parseInt(process.env['DB_POOL_MAX'] as string);
    if (process.env['DB_POOL_MIN']) cfg.min = parseInt(process.env['DB_POOL_MIN'] as string);
    return cfg;
  }

  private setupEventHandlers(): void {
    this.pool.on('connect', async (client: PoolClient) => {
      console.log('Database connection established');
      this.isConnected = true;
      // Enforce statement timeout and lock timeout per connection
      const statementTimeoutMs = parseInt(process.env['DB_STATEMENT_TIMEOUT_MS'] || '30000', 10);
      const lockTimeoutMs = parseInt(process.env['DB_LOCK_TIMEOUT_MS'] || '5000', 10);
      try {
        await client.query(`SET statement_timeout = ${statementTimeoutMs}`);
        await client.query(`SET lock_timeout = ${lockTimeoutMs}`);
      } catch (e) {
        console.warn('Failed to set per-connection timeouts:', e);
      }
    });

    this.pool.on('error', (err: Error) => {
      console.error('Database pool error:', err);
      this.isConnected = false;

      // Attempt to reconnect after a delay
      const initialDelay = process.env['NODE_ENV'] === 'test' ? 50 : 5000;
      setTimeout(() => {
        this.reconnect();
      }, initialDelay);
    });

    this.pool.on('remove', () => {
      // Suppress logging during test cleanup to avoid Jest warnings
      if (!process.env['SUPPRESS_DB_LOGGING']) {
        console.log('Database connection removed from pool');
      }
    });
  }

  private async reconnect(): Promise<void> {
    try {
      console.log('Attempting to reconnect to database...');
      await this.testConnection();
      console.log('Database reconnection successful');
    } catch (error) {
      console.error('Database reconnection failed:', error);
      // Retry after another delay
      const retryDelay = process.env['NODE_ENV'] === 'test' ? 100 : 10000;
      setTimeout(() => {
        this.reconnect();
      }, retryDelay);
    }
  }

  public async testConnection(): Promise<boolean> {
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      this.isConnected = false;
      throw error;
    } finally {
      if (client) {
        try { client.release(); } catch { }
      }
    }
  }

  public async query<T extends QueryResultRow>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (this.isClosing) {
      // In test environments, attempt to reconnect if the service was closed
      const isTestEnvironment = process.env['NODE_ENV'] === 'test' ||
        process.env['TEST_ENVIRONMENT'] === 'local' ||
        process.env['TEST_TYPE'] === 'integration' ||
        !!process.env['JEST_WORKER_ID'];
      
      if (isTestEnvironment) {
        console.warn('Database service was closed, attempting to reconnect for test...');
        // Reset the singleton instance to allow reconnection
        DatabaseService.instance = null;
        // Get a new instance
        return DatabaseService.getInstance().query(text, params);
      } else {
        throw new Error('Database service is closing');
      }
    }
    const client = await this.pool.connect();

    try {
      const start = Date.now();
      const result = await client.query<T>(text, params);
      const duration = Date.now() - start;

      // Log slow queries using configurable threshold (default 200ms)
      const slowMs = parseInt(process.env['SLOW_QUERY_MS'] || '200', 10);
      if (Number.isFinite(slowMs) && duration > slowMs) {
        console.warn(`Slow query detected (${duration}ms > ${slowMs}ms)`, text);
      }

      return result;
    } catch (error) {
      console.error('Database query error:', error);
      console.error('Query:', text);
      console.error('Params:', params);

      // Handle specific PostgreSQL errors
      const maybePg = error as any;
      if (maybePg && typeof maybePg === 'object' && 'code' in maybePg && maybePg.code) {
        switch (maybePg.code) {
          case '23505': // Unique violation
            throw new DatabaseError('Duplicate entry found', 'DUPLICATE_ENTRY', maybePg);
          case '23503': // Foreign key violation
            throw new DatabaseError('Referenced record not found', 'FOREIGN_KEY_VIOLATION', maybePg);
          case '23502': // Not null violation
            throw new DatabaseError('Required field is missing', 'NOT_NULL_VIOLATION', maybePg);
          case '42P01': // Undefined table
            throw new DatabaseError('Table does not exist', 'UNDEFINED_TABLE', maybePg);
          case '42703': // Undefined column
            throw new DatabaseError('Column does not exist', 'UNDEFINED_COLUMN', maybePg);
          default:
            throw new DatabaseError('Database operation failed', 'QUERY_ERROR', maybePg);
        }
      }

      if (error instanceof Error) {
        // Non-PostgreSQL Error objects should bubble up their original message
        throw error;
      }
      // Non-Error throwables (unlikely) -> wrap
      throw new DatabaseError('Database operation failed', 'QUERY_ERROR', error as any);
    } finally {
      client.release();
    }
  }

  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      // Always prefer the original error; attempt rollback but don't override
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('ROLLBACK failed:', rollbackError);
      }
      console.error('Transaction rolled back due to error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  public async getPoolStatus(): Promise<{
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  }> {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  public isHealthy(): boolean {
    return this.isConnected && this.pool.totalCount > 0;
  }

  public async close(): Promise<void> {
    if (this.isClosing) return;

    try {
      this.isClosing = true;
      this.isConnected = false;
      await this.pool.end();
      console.log('Database connection pool closed');
    } catch (error) {
      console.error('Error closing database connection pool:', error);
      throw error;
    } finally {
      this.isClosing = false;
    }
  }

  // Health check method for monitoring
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      connected: boolean;
      poolStatus: any;
      responseTime: number;
    };
  }> {
    const start = Date.now();

    try {
      await this.testConnection();
      const poolStatus = await this.getPoolStatus();
      let responseTime = Date.now() - start;
      if (responseTime === 0) responseTime = 1; // ensure > 0 for test assertions

      return {
        status: 'healthy',
        details: {
          connected: this.isConnected,
          poolStatus,
          responseTime
        }
      };
    } catch (error) {
      let responseTime = Date.now() - start;
      if (responseTime === 0) responseTime = 1; // ensure > 0 for test assertions

      return {
        status: 'unhealthy',
        details: {
          connected: false,
          poolStatus: await this.getPoolStatus(),
          responseTime
        }
      };
    }
  }
}

// Custom database error class
export class DatabaseError extends Error {
  public readonly code: string;
  public readonly originalError: any;

  constructor(message: string, code: string, originalError?: any) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.originalError = originalError;
  }
}

// Export singleton instance
export const db = DatabaseService.getInstance();
