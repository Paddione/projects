import { jest } from '@jest/globals';
import { QueryResultRow } from 'pg';

// Create a mock implementation of BaseRepository
class MockBaseRepository {
  protected db: { query: (...args: unknown[]) => Promise<unknown> };
  
  constructor() {
    this.db = {
      query: jest.fn() as unknown as (...args: unknown[]) => Promise<unknown>
    };
  }

  // Mock protected methods as public for testing
  async findById(_table: string, _id: number): Promise<QueryResultRow | null> {
    return null;
  }

  async findAll(_table: string, _limit?: number, _offset?: number): Promise<QueryResultRow[]> {
    return [];
  }

  async create(_table: string, _data: Record<string, unknown>): Promise<QueryResultRow> {
    return {} as QueryResultRow;
  }

  async update(_table: string, _id: number, _data: Record<string, unknown>): Promise<QueryResultRow | null> {
    return null;
  }

  async delete(_table: string, _id: number): Promise<boolean> {
    return false;
  }

  async exists(_table: string, _field: string, _value: unknown): Promise<boolean> {
    return false;
  }

  async count(_table: string, _whereClause?: string, _params?: unknown[]): Promise<number> {
    return 0;
  }
}

// Create a factory function to create mock instances
export function createMockBaseRepository() {
  const mockInstance = new MockBaseRepository();
  
  // Create a proxy to track method calls
  const handler: ProxyHandler<MockBaseRepository> = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof value === 'function') {
        const fn = value as (...args: unknown[]) => unknown;
        return jest.fn(fn.bind(target));
      }
      return value;
    }
  };

  return new Proxy(mockInstance, handler);
}

// Mock the actual BaseRepository module
const mockBaseRepository = createMockBaseRepository();

export default mockBaseRepository;
