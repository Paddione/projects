import { DatabaseService } from '../services/DatabaseService.js';
import { QueryResultRow } from 'pg';

export abstract class BaseRepository {
  protected db!: DatabaseService;
  protected getDb(): DatabaseService {
    if (!this.db) {
      // Allow tests to inject a mocked DatabaseService via global symbol
      const injected = (globalThis as any).__DB_SERVICE__;
      if (injected && typeof injected.query === 'function') {
        this.db = injected as DatabaseService;
        return this.db;
      }
      const DS: any = DatabaseService as any;
      try {
        if (DS && typeof DS.getInstance === 'function') {
          // Prefer singleton instance (tests mock getInstance)
          this.db = DS.getInstance();
        } else if (typeof DS === 'function') {
          // Fallback to constructing if class function without singleton
          this.db = new DS();
        } else if (DS && typeof DS.query === 'function') {
          // Directly mocked object
          this.db = DS as DatabaseService;
        }
      } catch {
        // As a final fallback, attempt to use the import as-is
        this.db = DS as DatabaseService;
      }
    }
    return this.db;
  }

  constructor() {
    // Ensure the database service is initialized for subclasses using this.db directly
    this.getDb();
  }

  protected async findById<T extends QueryResultRow>(table: string, id: number): Promise<T | null> {
    const result = await this.getDb().query<T>(
      `SELECT * FROM ${table} WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  protected async findAll<T extends QueryResultRow>(table: string, limit?: number, offset?: number): Promise<T[]> {
    let query = `SELECT * FROM ${table}`;
    const params: any[] = [];

    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }

    if (offset) {
      query += ` OFFSET $${params.length + 1}`;
      params.push(offset);
    }

    const result = await this.getDb().query<T>(query, params);
    return result.rows;
  }

  protected async create<T extends QueryResultRow>(table: string, data: Record<string, any>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data).map(value => {
      if (value instanceof Date) {
        return value; // let pg driver handle Date objects
      }
      if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
      }
      return value;
    });
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    const columns = keys.join(', ');

    const query = `
      INSERT INTO ${table} (${columns})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await this.getDb().query<T>(query, values);
    return result.rows[0]!;
  }

  protected async update<T extends QueryResultRow>(table: string, id: number, data: Record<string, any>): Promise<T | null> {
    const keys = Object.keys(data);
    const values = Object.values(data).map(value => {
      if (value instanceof Date) {
        return value; // let pg driver handle Date objects
      }
      if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
      }
      return value;
    });
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');

    const query = `
      UPDATE ${table}
      SET ${setClause}
      WHERE id = $${keys.length + 1}
      RETURNING *
    `;

    const result = await this.getDb().query<T>(query, [...values, id]);
    return result.rows[0] || null;
  }

  protected async delete(table: string, id: number): Promise<boolean> {
    const result = await this.getDb().query(
      `DELETE FROM ${table} WHERE id = $1`,
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  protected async exists(table: string, field: string, value: any): Promise<boolean> {
    const result = await this.getDb().query(
      `SELECT 1 FROM ${table} WHERE ${field} = $1 LIMIT 1`,
      [value]
    );
    return result.rows.length > 0;
  }

  protected async count(table: string, whereClause?: string, params?: any[]): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${table}`;
    
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }

    const result = await this.getDb().query<{ count: string }>(query, params);
    return parseInt(result.rows[0]!.count);
  }
}