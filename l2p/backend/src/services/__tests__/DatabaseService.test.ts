import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import type { PoolClient, QueryResult } from 'pg';
import type { DatabaseConfig, DatabaseService as DatabaseServiceType } from '../DatabaseService';

// Mock pg module using CommonJS-compatible Jest mocking
jest.mock('pg', () => {
  const defaultClient = {
    query: jest.fn(),
    release: jest.fn(),
    connect: jest.fn(),
    end: jest.fn()
  };

  const mockPool = {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0
  };

  return {
    Pool: jest.fn(() => mockPool),
    Client: jest.fn(() => defaultClient)
  };
});

import { Pool } from 'pg';
import { DatabaseService, DatabaseError } from '../DatabaseService';

describe('DatabaseService', () => {
  interface MockClient {
    query: jest.MockedFunction<() => Promise<{ rows: unknown[]; rowCount: number; command: string; oid: number; fields: unknown[] }>>;
    release: jest.MockedFunction<() => void>;
    on: jest.MockedFunction<(event: string, handler: () => void) => void>;
    removeListener: jest.MockedFunction<(event: string, handler: () => void) => void>;
    connect: jest.MockedFunction<() => Promise<void>>;
    end: jest.MockedFunction<() => Promise<void>>;
  }

  interface MockPool {
    connect: jest.MockedFunction<() => Promise<MockClient>>;
    query: jest.MockedFunction<() => Promise<{ rows: unknown[]; rowCount: number }>>;
    end: jest.MockedFunction<() => Promise<void>>;
    on: jest.MockedFunction<(event: string, handler: () => void) => void>;
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  }

  let mockPool: MockPool;
  let mockClient: MockClient;
  let databaseService: DatabaseServiceType;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };

    // Set test environment variables to match what the service actually uses
    process.env.DATABASE_URL = 'postgresql://l2p_user:06752fc9637d5fe896cd88b858d2cf2eff112de5cf4769e69927009f5d45d581@localhost:5432/l2p_db';
    process.env.DB_SSL = 'false';
    process.env.DB_POOL_MAX = '10';
    process.env.DB_POOL_MIN = '2';

    // Clear all mocks
    jest.clearAllMocks();

    // Create mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
      connect: jest.fn(),
      end: jest.fn()
    };

    // Setup mock pool - get the constructor mock and configure it
    const PoolMock = Pool as unknown as jest.MockedClass<any>;
    PoolMock.mockImplementation(() => {
      mockPool = {
        connect: (jest.fn() as any).mockResolvedValue(mockClient),
        query: (jest.fn() as any).mockResolvedValue({ rows: [], rowCount: 0 }),
        end: (jest.fn() as any).mockResolvedValue(undefined),
        on: (jest.fn() as any).mockImplementation(() => { }),
        totalCount: 5,
        idleCount: 3,
        waitingCount: 0
      };
      return mockPool;
    });

    // Setup mock client default behavior
    mockClient.query.mockResolvedValue({
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: []
    });

    // Reset singleton instance
    (DatabaseService as any).instance = null;

    // Get fresh instance
    databaseService = DatabaseService.getInstance();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = DatabaseService.getInstance();
      const instance2 = DatabaseService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', async () => {
      const instance1 = DatabaseService.getInstance();

      await DatabaseService.reset();

      const instance2 = DatabaseService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Configuration Parsing', () => {
    it('should parse TEST_DATABASE_URL correctly', () => {
      // Clear previous mocks and reset environment
      jest.clearAllMocks();
      process.env.NODE_ENV = 'test';
      process.env.TEST_DATABASE_URL = 'postgresql://user:pass@host:5432/dbname';

      // Reset instance to pick up new config
      (DatabaseService as any).instance = null;
      const service = DatabaseService.getInstance();

      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        host: 'host',
        port: 5432,
        database: 'dbname',
        user: 'user',
        password: 'pass'
      }));
    });

    it('should fall back to test environment defaults when TEST_DATABASE_URL is invalid', () => {
      // Clear previous mocks and reset environment
      jest.clearAllMocks();
      process.env.NODE_ENV = 'test';
      process.env.TEST_DATABASE_URL = 'invalid-url';
      process.env.TEST_DB_HOST = 'fallback-host';
      process.env.TEST_DB_PORT = '5434';
      process.env.TEST_DB_NAME = 'fallback-db';
      process.env.TEST_DB_USER = 'fallback-user';
      process.env.TEST_DB_PASSWORD = 'fallback-pass';

      // Reset instance to pick up new config
      (DatabaseService as any).instance = null;
      const service = DatabaseService.getInstance();

      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        host: 'fallback-host',
        port: 5434,
        database: 'fallback-db',
        user: 'fallback-user',
        password: 'fallback-pass'
      }));
    });

    it('should use default values when environment variables are not set', () => {
      // Clear previous mocks and reset environment
      jest.clearAllMocks();
      delete process.env.TEST_DATABASE_URL;
      delete process.env.TEST_DB_HOST;
      delete process.env.TEST_DB_PORT;
      delete process.env.TEST_DB_NAME;
      delete process.env.TEST_DB_USER;
      delete process.env.TEST_DB_PASSWORD;
      delete process.env.DATABASE_URL;
      delete process.env.DB_HOST;
      delete process.env.DB_PORT;
      delete process.env.DB_NAME;
      delete process.env.DB_USER;
      delete process.env.POSTGRES_PASSWORD;

      // Reset instance to pick up new config
      (DatabaseService as any).instance = null;
      const service = DatabaseService.getInstance();

      // Check if we're using production database for tests
      const usingProdDb = process.env.USE_PROD_DB_FOR_TESTS === 'true';

      if (usingProdDb) {
        // When using production database, expect production defaults
        expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
          host: '127.0.0.1',
          port: 5432,
          database: 'l2p_db',
          user: 'l2p_user',
          password: '06752fc9637d5fe896cd88b858d2cf2eff112de5cf4769e69927009f5d45d581'
        }));
      } else {
        // When using test database, expect test defaults (port 5433 to avoid conflict with shared-postgres)
        expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
          host: '127.0.0.1',
          port: 5433,
          database: 'l2p_db',
          user: 'l2p_user',
          password: '06752fc9637d5fe896cd88b858d2cf2eff112de5cf4769e69927009f5d45d581'
        }));
      }
    });

    it('should configure connection pool settings', () => {
      // Clear previous mocks and reset environment
      jest.clearAllMocks();
      // In test environment, it uses hardcoded pool settings
      process.env.NODE_ENV = 'test';

      // Reset instance to pick up new config
      (DatabaseService as any).instance = null;
      const service = DatabaseService.getInstance();

      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        max: 10,  // Test environment default
        min: 2,   // Test environment default
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      }));
    });
  });

  describe('Connection Management', () => {
    it('should establish connection successfully', async () => {
      mockClient.query.mockResolvedValue({ rows: [{ now: new Date() }] });

      const result = await databaseService.testConnection();

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT NOW()');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle connection failure', async () => {
      const connectionError = new Error('Connection failed');
      mockPool.connect.mockRejectedValue(connectionError);

      await expect(databaseService.testConnection()).rejects.toThrow('Connection failed');
    });

    it('should handle query failure during connection test', async () => {
      const queryError = new Error('Query failed');
      mockClient.query.mockRejectedValue(queryError);

      await expect(databaseService.testConnection()).rejects.toThrow('Query failed');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should set up event handlers on pool creation', () => {
      expect(mockPool.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('remove', expect.any(Function));
    });

    it('should handle pool connect event', () => {
      const connectHandler = mockPool.on.mock.calls.find((call: any) => call[0] === 'connect')?.[1];
      expect(connectHandler).toBeDefined();

      // Simulate connect event
      connectHandler?.(mockClient);

      expect(databaseService.isHealthy()).toBe(true);
    });

    it('should handle pool error event and attempt reconnection', (done) => {
      // Find the error handler from the on calls
      const errorHandler = mockPool.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      expect(errorHandler).toBeDefined();

      // Mock testConnection for reconnection attempt
      const testConnectionSpy = jest.spyOn(databaseService, 'testConnection').mockResolvedValue(true);

      // Simulate error event
      const error = new Error('Pool error');
      if (errorHandler) {
        errorHandler(error);
      }

      // Check that reconnection is attempted after delay (50ms in test environment)
      setTimeout(() => {
        expect(testConnectionSpy).toHaveBeenCalled();
        done();
      }, 100); // Use 100ms to account for the 50ms delay in test environment
    });
  });

  describe('Query Execution', () => {
    beforeEach(() => {
      mockClient.query.mockResolvedValue({
        rows: [{ id: 1, name: 'test' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });
    });

    it('should execute query without parameters', async () => {
      const query = 'SELECT * FROM users';

      const result = await databaseService.query(query);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(query, undefined);
      expect(mockClient.release).toHaveBeenCalled();
      expect(result.rows).toEqual([{ id: 1, name: 'test' }]);
    });

    it('should execute parameterized query', async () => {
      const query = 'SELECT * FROM users WHERE id = $1 AND name = $2';
      const params = [1, 'test'];

      const result = await databaseService.query(query, params);

      expect(mockClient.query).toHaveBeenCalledWith(query, params);
      expect(result.rows).toEqual([{ id: 1, name: 'test' }]);
    });

    it('should log slow queries', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });

      // Mock slow query (> 200ms default threshold)
      mockClient.query.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            rows: [],
            rowCount: 0,
            command: 'SELECT',
            oid: 0,
            fields: []
          }), 300) // 300ms > 200ms threshold
        )
      );

      await databaseService.query('SELECT * FROM users');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow query detected'),
        'SELECT * FROM users'
      );

      consoleSpy.mockRestore();
    });

    it('should handle PostgreSQL unique violation error', async () => {
      const pgError = {
        code: '23505',
        message: 'duplicate key value violates unique constraint'
      };
      mockClient.query.mockRejectedValue(pgError);

      await expect(databaseService.query('INSERT INTO users...')).rejects.toThrow(DatabaseError);
      await expect(databaseService.query('INSERT INTO users...')).rejects.toThrow('Duplicate entry found');
    });

    it('should handle PostgreSQL foreign key violation error', async () => {
      const pgError = {
        code: '23503',
        message: 'insert or update on table violates foreign key constraint'
      };
      mockClient.query.mockRejectedValue(pgError);

      await expect(databaseService.query('INSERT INTO users...')).rejects.toThrow(DatabaseError);
      await expect(databaseService.query('INSERT INTO users...')).rejects.toThrow('Referenced record not found');
    });

    it('should handle PostgreSQL not null violation error', async () => {
      const pgError = {
        code: '23502',
        message: 'null value in column violates not-null constraint'
      };
      mockClient.query.mockRejectedValue(pgError);

      await expect(databaseService.query('INSERT INTO users...')).rejects.toThrow(DatabaseError);
      await expect(databaseService.query('INSERT INTO users...')).rejects.toThrow('Required field is missing');
    });

    it('should handle PostgreSQL undefined table error', async () => {
      const pgError = {
        code: '42P01',
        message: 'relation "nonexistent_table" does not exist'
      };
      mockClient.query.mockRejectedValue(pgError);

      await expect(databaseService.query('SELECT * FROM nonexistent_table')).rejects.toThrow(DatabaseError);
      await expect(databaseService.query('SELECT * FROM nonexistent_table')).rejects.toThrow('Table does not exist');
    });

    it('should handle PostgreSQL undefined column error', async () => {
      const pgError = {
        code: '42703',
        message: 'column "nonexistent_column" does not exist'
      };
      mockClient.query.mockRejectedValue(pgError);

      await expect(databaseService.query('SELECT nonexistent_column FROM users')).rejects.toThrow(DatabaseError);
      await expect(databaseService.query('SELECT nonexistent_column FROM users')).rejects.toThrow('Column does not exist');
    });

    it('should handle generic database errors', async () => {
      const genericError = {
        code: '99999',
        message: 'Some other database error'
      };
      mockClient.query.mockRejectedValue(genericError);

      await expect(databaseService.query('SELECT * FROM users')).rejects.toThrow(DatabaseError);
      await expect(databaseService.query('SELECT * FROM users')).rejects.toThrow('Database operation failed');
    });

    it('should handle non-PostgreSQL errors', async () => {
      const genericError = new Error('Network error');
      mockClient.query.mockRejectedValue(genericError);

      await expect(databaseService.query('SELECT * FROM users')).rejects.toThrow('Network error');
    });

    it('should release client even when query fails', async () => {
      mockClient.query.mockRejectedValue(new Error('Query failed'));

      try {
        await databaseService.query('SELECT * FROM users');
      } catch (error) {
        // Expected to throw
      }

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error when service is closing', async () => {
      // Mock the environment to not be a test environment
      const originalNodeEnv = process.env.NODE_ENV;
      const originalTestEnvironment = process.env.TEST_ENVIRONMENT;
      const originalTestType = process.env.TEST_TYPE;
      const originalJestWorkerId = process.env.JEST_WORKER_ID;

      delete process.env.NODE_ENV;
      delete process.env.TEST_ENVIRONMENT;
      delete process.env.TEST_TYPE;
      delete process.env.JEST_WORKER_ID;

      try {
        // Set service to closing state
        (databaseService as any).isClosing = true;

        await expect(databaseService.query('SELECT * FROM users')).rejects.toThrow('Database service is closing');
      } finally {
        // Restore original environment
        process.env.NODE_ENV = originalNodeEnv;
        process.env.TEST_ENVIRONMENT = originalTestEnvironment;
        process.env.TEST_TYPE = originalTestType;
        process.env.JEST_WORKER_ID = originalJestWorkerId;
      }
    });
  });

  describe('Transaction Handling', () => {
    it('should execute transaction successfully', async () => {
      const mockCallback = jest.fn().mockResolvedValue('transaction result');

      const result = await databaseService.transaction(mockCallback);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockCallback).toHaveBeenCalledWith(mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toBe('transaction result');
    });

    it('should rollback transaction on error', async () => {
      const transactionError = new Error('Transaction failed');
      const mockCallback = jest.fn().mockRejectedValue(transactionError);

      await expect(databaseService.transaction(mockCallback)).rejects.toThrow('Transaction failed');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockCallback).toHaveBeenCalledWith(mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release client even when BEGIN fails', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('BEGIN failed'));
      const mockCallback = jest.fn();

      await expect(databaseService.transaction(mockCallback)).rejects.toThrow('BEGIN failed');

      expect(mockClient.release).toHaveBeenCalled();
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should release client even when COMMIT fails', async () => {
      const mockCallback = jest.fn().mockResolvedValue('result');
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('COMMIT failed')); // COMMIT

      await expect(databaseService.transaction(mockCallback)).rejects.toThrow('COMMIT failed');

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release client even when ROLLBACK fails', async () => {
      const transactionError = new Error('Transaction failed');
      const rollbackError = new Error('ROLLBACK failed');
      const mockCallback = jest.fn().mockRejectedValue(transactionError);

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(rollbackError); // ROLLBACK

      await expect(databaseService.transaction(mockCallback)).rejects.toThrow('Transaction failed');

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle nested transaction operations', async () => {
      const mockCallback = jest.fn().mockImplementation(async (client) => {
        await client.query('INSERT INTO users (name) VALUES ($1)', ['user1']);
        await client.query('INSERT INTO posts (title, user_id) VALUES ($1, $2)', ['post1', 1]);
        return 'nested operations complete';
      });

      const result = await databaseService.transaction(mockCallback);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('INSERT INTO users (name) VALUES ($1)', ['user1']);
      expect(mockClient.query).toHaveBeenCalledWith('INSERT INTO posts (title, user_id) VALUES ($1, $2)', ['post1', 1]);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(result).toBe('nested operations complete');
    });
  });

  describe('Connection Pooling', () => {
    it('should return pool status', async () => {
      mockPool.totalCount = 10;
      mockPool.idleCount = 5;
      mockPool.waitingCount = 2;

      const status = await databaseService.getPoolStatus();

      expect(status).toEqual({
        totalCount: 10,
        idleCount: 5,
        waitingCount: 2
      });
    });

    it('should report healthy status when connected and pool has connections', () => {
      mockPool.totalCount = 5;
      (databaseService as any).isConnected = true;

      const isHealthy = databaseService.isHealthy();

      expect(isHealthy).toBe(true);
    });

    it('should report unhealthy status when not connected', () => {
      mockPool.totalCount = 5;
      (databaseService as any).isConnected = false;

      const isHealthy = databaseService.isHealthy();

      expect(isHealthy).toBe(false);
    });

    it('should report unhealthy status when pool has no connections', () => {
      mockPool.totalCount = 0;
      (databaseService as any).isConnected = true;

      const isHealthy = databaseService.isHealthy();

      expect(isHealthy).toBe(false);
    });
  });

  describe('Error Recovery', () => {
    it('should attempt reconnection on pool error', (done) => {
      const errorHandler = mockPool.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      const testConnectionSpy = jest.spyOn(databaseService, 'testConnection').mockResolvedValue(true);

      // Simulate pool error
      const poolError = new Error('Connection lost');
      if (errorHandler) {
        errorHandler(poolError);
      }

      // Verify reconnection attempt after delay (short in test env)
      setTimeout(() => {
        expect(testConnectionSpy).toHaveBeenCalled();
        testConnectionSpy.mockRestore();
        done();
      }, 150);
    });

    it('should retry reconnection on failure', (done) => {
      const errorHandler = mockPool.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      const testConnectionSpy = jest.spyOn(databaseService, 'testConnection')
        .mockRejectedValueOnce(new Error('Reconnection failed'))
        .mockResolvedValueOnce(true);

      // Simulate pool error
      const poolError = new Error('Connection lost');
      if (errorHandler) {
        errorHandler(poolError);
      }

      // Verify retry after additional delay (short in test env)
      setTimeout(() => {
        expect(testConnectionSpy).toHaveBeenCalledTimes(2);
        testConnectionSpy.mockRestore();
        done();
      }, 400); // 50ms + 100ms + buffer
    });

    it('should handle connection pool exhaustion', async () => {
      const poolExhaustedError = new Error('Pool exhausted');
      poolExhaustedError.name = 'PoolExhaustedError';
      mockPool.connect.mockRejectedValue(poolExhaustedError);

      await expect(databaseService.query('SELECT 1')).rejects.toThrow('Pool exhausted');
    });

    it('should handle connection timeout', async () => {
      const timeoutError = new Error('Connection timeout');
      timeoutError.name = 'ConnectionTimeoutError';
      mockPool.connect.mockRejectedValue(timeoutError);

      await expect(databaseService.query('SELECT 1')).rejects.toThrow('Connection timeout');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status with details', async () => {
      mockClient.query.mockResolvedValue({ rows: [{ now: new Date() }] });
      mockPool.totalCount = 5;
      mockPool.idleCount = 3;
      mockPool.waitingCount = 1;

      const healthCheck = await databaseService.healthCheck();

      expect(healthCheck.status).toBe('healthy');
      expect(healthCheck.details.connected).toBe(true);
      expect(healthCheck.details.poolStatus).toEqual({
        totalCount: 5,
        idleCount: 3,
        waitingCount: 1
      });
      expect(healthCheck.details.responseTime).toBeGreaterThan(0);
    });

    it('should return unhealthy status on connection failure', async () => {
      mockPool.connect.mockRejectedValue(new Error('Connection failed'));

      const healthCheck = await databaseService.healthCheck();

      expect(healthCheck.status).toBe('unhealthy');
      expect(healthCheck.details.connected).toBe(false);
      expect(healthCheck.details.responseTime).toBeGreaterThan(0);
    });

    it('should measure response time accurately', async () => {
      mockClient.query.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({ rows: [{ now: new Date() }] }), 100)
        )
      );

      const healthCheck = await databaseService.healthCheck();

      expect(healthCheck.details.responseTime).toBeGreaterThanOrEqual(95);
    });
  });

  describe('Service Lifecycle', () => {
    it('should close connection pool successfully', async () => {
      await databaseService.close();

      expect(mockPool.end).toHaveBeenCalled();
      // isClosing stays true after successful close — pool is permanently dead
      expect((databaseService as any).isClosing).toBe(true);
      expect((databaseService as any).isConnected).toBe(false);
    });

    it('should handle close error gracefully', async () => {
      const closeError = new Error('Close failed');
      mockPool.end.mockRejectedValue(closeError);

      await expect(databaseService.close()).rejects.toThrow('Close failed');
      expect((databaseService as any).isClosing).toBe(false);
    });

    it('should not close multiple times simultaneously', async () => {
      const closePromise1 = databaseService.close();
      const closePromise2 = databaseService.close();

      await Promise.all([closePromise1, closePromise2]);

      expect(mockPool.end).toHaveBeenCalledTimes(1);
    });

    it('should reset singleton instance', async () => {
      const instance1 = DatabaseService.getInstance();

      await DatabaseService.reset();

      expect(mockPool.end).toHaveBeenCalled();

      const instance2 = DatabaseService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('DatabaseError Class', () => {
    it('should create DatabaseError with correct properties', () => {
      const originalError = new Error('Original error');
      const dbError = new DatabaseError('Custom message', 'CUSTOM_CODE', originalError);

      expect(dbError.name).toBe('DatabaseError');
      expect(dbError.message).toBe('Custom message');
      expect(dbError.code).toBe('CUSTOM_CODE');
      expect(dbError.originalError).toBe(originalError);
    });

    it('should create DatabaseError without original error', () => {
      const dbError = new DatabaseError('Custom message', 'CUSTOM_CODE');

      expect(dbError.name).toBe('DatabaseError');
      expect(dbError.message).toBe('Custom message');
      expect(dbError.code).toBe('CUSTOM_CODE');
      expect(dbError.originalError).toBeUndefined();
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle null query parameters', async () => {
      const query = 'SELECT * FROM users WHERE name = $1';
      const params = [null];

      await databaseService.query(query, params);

      expect(mockClient.query).toHaveBeenCalledWith(query, params);
    });

    it('should handle empty query parameters array', async () => {
      const query = 'SELECT * FROM users';
      const params: any[] = [];

      await databaseService.query(query, params);

      expect(mockClient.query).toHaveBeenCalledWith(query, params);
    });

    it('should handle very long query strings', async () => {
      const longQuery = 'SELECT * FROM users WHERE ' + 'name = $1 AND '.repeat(1000) + 'id > 0';

      await databaseService.query(longQuery, ['test']);

      expect(mockClient.query).toHaveBeenCalledWith(longQuery, ['test']);
    });

    it('should handle concurrent queries', async () => {
      const queries = Array.from({ length: 10 }, (_, i) =>
        databaseService.query(`SELECT ${i}`)
      );

      await Promise.all(queries);

      expect(mockPool.connect).toHaveBeenCalledTimes(10);
      expect(mockClient.release).toHaveBeenCalledTimes(10);
    });

    it('should handle concurrent transactions', async () => {
      const transactions = Array.from({ length: 5 }, (_, i) =>
        databaseService.transaction(async (client: any) => {
          await client.query(`INSERT INTO test VALUES (${i})`);
          return i;
        })
      );

      const results = await Promise.all(transactions);

      expect(results).toEqual([0, 1, 2, 3, 4]);
      expect(mockPool.connect).toHaveBeenCalledTimes(5);
    });
  });
});
