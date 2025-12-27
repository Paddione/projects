import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { BaseRepository } from '../BaseRepository.js';
import { DatabaseService } from '@/services/DatabaseService';
import { QueryResult, QueryResultRow } from 'pg';

// ESM-friendly: spy on the real static method

const mockDatabaseService = {
  query: jest.fn(),
  getClient: jest.fn(),
  beginTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  testConnection: jest.fn(),
  transaction: jest.fn(),
  getPoolStatus: jest.fn(),
  isHealthy: jest.fn(),
  healthCheck: jest.fn()
} as unknown as jest.Mocked<DatabaseService>;

jest.spyOn(DatabaseService, 'getInstance').mockReturnValue(mockDatabaseService as unknown as DatabaseService);

// Create a concrete implementation for testing
class TestRepository extends BaseRepository {
  async testFindById<T extends QueryResultRow>(table: string, id: number): Promise<T | null> {
    return this.findById<T>(table, id);
  }

  async testFindAll<T extends QueryResultRow>(table: string, limit?: number, offset?: number): Promise<T[]> {
    return this.findAll<T>(table, limit, offset);
  }

  async testCreate<T extends QueryResultRow>(table: string, data: Record<string, any>): Promise<T> {
    return this.create<T>(table, data);
  }

  async testUpdate<T extends QueryResultRow>(table: string, id: number, data: Record<string, any>): Promise<T | null> {
    return this.update<T>(table, id, data);
  }

  async testDelete(table: string, id: number): Promise<boolean> {
    return this.delete(table, id);
  }

  async testExists(table: string, field: string, value: any): Promise<boolean> {
    return this.exists(table, field, value);
  }

  async testCount(table: string, whereClause?: string, params?: any[]): Promise<number> {
    return this.count(table, whereClause, params);
  }
}

describe('BaseRepository', () => {
  let repository: TestRepository;

  beforeEach(() => {
    (globalThis as any).__DB_SERVICE__ = mockDatabaseService;
    repository = new TestRepository();
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete (globalThis as any).__DB_SERVICE__;
  });

  describe('findById', () => {
    it('should find entity by id successfully', async () => {
      const mockEntity = {
        id: 1,
        name: 'Test Entity',
        email: 'test@example.com',
        created_at: new Date(),
        metadata: { category: 'test', priority: 'high' }
      };

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [mockEntity],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testFindById('test_table', 1);

      expect(result).toEqual(mockEntity);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        'SELECT * FROM test_table WHERE id = $1',
        [1]
      );
    });

    it('should return null when entity not found', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testFindById('test_table', 999);

      expect(result).toBeNull();
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        'SELECT * FROM test_table WHERE id = $1',
        [999]
      );
    });
  });

  describe('findAll', () => {
    it('should find all entities without pagination', async () => {
      const entities = [
        { id: 1, name: 'Entity 1', email: 'entity1@example.com' },
        { id: 2, name: 'Entity 2', email: 'entity2@example.com' }
      ];

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: entities,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testFindAll('test_table');

      expect(result).toEqual(entities);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        'SELECT * FROM test_table',
        []
      );
    });

    it('should find entities with limit', async () => {
      const entities = [
        { id: 1, name: 'Entity 1', email: 'entity1@example.com' }
      ];

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: entities,
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testFindAll('test_table', 10);

      expect(result).toEqual(entities);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        'SELECT * FROM test_table LIMIT $1',
        [10]
      );
    });

    it('should find entities with limit and offset', async () => {
      const entities = [
        { id: 2, name: 'Entity 2', email: 'entity2@example.com' }
      ];

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: entities,
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testFindAll('test_table', 10, 10);

      expect(result).toEqual(entities);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        'SELECT * FROM test_table LIMIT $1 OFFSET $2',
        [10, 10]
      );
    });
  });

  describe('create', () => {
    it('should create entity successfully', async () => {
      const createData = {
        name: 'New Entity',
        email: 'new@example.com'
      };

      const createdEntity = { id: 1, ...createData };

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [createdEntity],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testCreate('test_table', createData);

      expect(result).toEqual(createdEntity);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_table'),
        ['New Entity', 'new@example.com']
      );
    });

    it('should handle complex data types in create', async () => {
      const createData = {
        name: 'Complex Entity',
        metadata: { category: 'test', priority: 'high' },
        settings: { theme: 'dark', notifications: true }
      };

      const createdEntity = { id: 1, ...createData };

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [createdEntity],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testCreate('test_table', createData);

      expect(result).toEqual(createdEntity);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_table'),
        ['Complex Entity', '{"category":"test","priority":"high"}', '{"theme":"dark","notifications":true}']
      );
    });

    it('should handle null values in create', async () => {
      const createData = {
        name: 'Null Entity',
        email: null,
        description: null
      };

      const createdEntity = { id: 1, ...createData };

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [createdEntity],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testCreate('test_table', createData);

      expect(result).toEqual(createdEntity);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_table'),
        ['Null Entity', null, null]
      );
    });

    it('should handle empty objects in create', async () => {
      const createData = {
        name: 'Empty Object Entity',
        empty_object: {}
      };

      const createdEntity = { id: 1, ...createData };

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [createdEntity],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testCreate('test_table', createData);

      expect(result).toEqual(createdEntity);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_table'),
        ['Empty Object Entity', '{}']
      );
    });
  });

  describe('update', () => {
    it('should update entity successfully', async () => {
      const updateData = {
        name: 'Updated Entity',
        email: 'updated@example.com'
      };

      const updatedEntity = { id: 1, ...updateData };

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [updatedEntity],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testUpdate('test_table', 1, updateData);

      expect(result).toEqual(updatedEntity);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE test_table'),
        ['Updated Entity', 'updated@example.com', 1]
      );
    });

    it('should handle complex data types in update', async () => {
      const updateData = {
        name: 'Updated Complex Entity',
        metadata: { category: 'updated', priority: 'low' }
      };

      const updatedEntity = { id: 1, ...updateData };

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [updatedEntity],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testUpdate('test_table', 1, updateData);

      expect(result).toEqual(updatedEntity);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE test_table'),
        ['Updated Complex Entity', '{"category":"updated","priority":"low"}', 1]
      );
    });

    it('should return null when entity not found for update', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'UPDATE',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testUpdate('test_table', 999, { name: 'Not Found' });

      expect(result).toBeNull();
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE test_table'),
        ['Not Found', 999]
      );
    });

    it('should handle partial updates', async () => {
      const updateData = {
        name: 'Partial Update'
      };

      const updatedEntity = { id: 1, name: 'Partial Update', email: 'test@example.com' };

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [updatedEntity],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testUpdate('test_table', 1, updateData);

      expect(result).toEqual(updatedEntity);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE test_table'),
        ['Partial Update', 1]
      );
    });
  });

  describe('delete', () => {
    it('should delete entity successfully', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: 'DELETE',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testDelete('test_table', 1);

      expect(result).toBe(true);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        'DELETE FROM test_table WHERE id = $1',
        [1]
      );
    });

    it('should return false when entity not found for deletion', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'DELETE',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testDelete('test_table', 999);

      expect(result).toBe(false);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        'DELETE FROM test_table WHERE id = $1',
        [999]
      );
    });

    it('should handle null rowCount in delete', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [],
        rowCount: null,
        command: 'DELETE',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testDelete('test_table', 1);

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true when entity exists', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ 1: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testExists('test_table', 'email', 'test@example.com');

      expect(result).toBe(true);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        'SELECT 1 FROM test_table WHERE email = $1 LIMIT 1',
        ['test@example.com']
      );
    });

    it('should return false when entity does not exist', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testExists('test_table', 'email', 'nonexistent@example.com');

      expect(result).toBe(false);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        'SELECT 1 FROM test_table WHERE email = $1 LIMIT 1',
        ['nonexistent@example.com']
      );
    });
  });

  describe('count', () => {
    it('should count all entities', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ count: '25' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testCount('test_table');

      expect(result).toBe(25);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM test_table',
        undefined
      );
    });

    it('should count entities with where clause', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ count: '10' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testCount('test_table', 'active = true');

      expect(result).toBe(10);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM test_table WHERE active = true',
        undefined
      );
    });

    it('should count entities with where clause and parameters', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ count: '5' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testCount('test_table', 'category = $1', ['test']);

      expect(result).toBe(5);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM test_table WHERE category = $1',
        ['test']
      );
    });

    it('should handle zero count', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ count: '0' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testCount('test_table');

      expect(result).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle database errors in create', async () => {
      const createData = {
        name: 'Test Entity',
        email: 'test@example.com',
        age: 25,
        is_active: true
      };

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: 1, ...createData }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testCreate('test_table', createData);

      expect(result).toEqual({ id: 1, ...createData });
    });

    it('should handle database errors in update', async () => {
      const updateData = {
        name: 'Updated Entity',
        email: 'updated@example.com',
        age: 30
      };

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: 1, ...updateData }],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testUpdate('test_table', 1, updateData);

      expect(result).toEqual({ id: 1, ...updateData });
    });

    it('should handle complex entity types', async () => {
      const mockEntity = {
        id: 1,
        name: 'Complex Entity',
        email: 'complex@example.com',
        created_at: new Date(),
        metadata: { category: 'test', priority: 'high' }
      };

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [mockEntity],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testFindById('test_table', 1);

      expect(result).toEqual(mockEntity);
    });

    it('should handle various data types in create', async () => {
      const createData = {
        string_field: 'test string',
        number_field: 42,
        boolean_field: true,
        date_field: new Date(),
        null_field: null,
        object_field: { key: 'value' },
        array_field: [1, 2, 3]
      };

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: 1, ...createData }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testCreate('test_table', createData);

      expect(result).toEqual({ id: 1, ...createData });
    });

    it('should handle empty and null values', async () => {
      const createData = {
        empty_object: {},
        empty_array: [],
        null_object: null
      };

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: 1, ...createData }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testCreate('test_table', createData);

      expect(result).toEqual({ id: 1, ...createData });
    });
  });

  describe('performance and edge cases', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `Entity ${i + 1}`
      }));

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: largeDataset,
        rowCount: 1000,
        command: 'SELECT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testFindAll('test_table');

      expect(result).toHaveLength(1000);
      expect(result[0]).toEqual({ id: 1, name: 'Entity 1' });
      expect(result[999]).toEqual({ id: 1000, name: 'Entity 1000' });
    });

    it('should handle single row results', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testFindById('test_table', 1);

      expect(result).toEqual({ id: 1 });
    });

    it('should handle delete with rowCount 1', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: 'DELETE',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testDelete('test_table', 1);

      expect(result).toBe(true);
    });

    it('should handle delete with rowCount 0', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'DELETE',
        oid: 0,
        fields: []
      } as QueryResult);

      const result = await repository.testDelete('test_table', 1);

      expect(result).toBe(false);
    });
  });
}); 