import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

export class DatabaseService {
    private static instance: DatabaseService;
    private pool: pg.Pool;

    private constructor() {
        this.pool = new Pool({
            connectionString: config.database.url,
            max: config.database.poolSize,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        this.pool.on('error', (err) => {
            console.error('Unexpected database pool error:', err);
        });
    }

    static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    getPool(): pg.Pool {
        return this.pool;
    }

    async query(text: string, params?: unknown[]): Promise<pg.QueryResult> {
        const start = Date.now();
        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            if (duration > 1000) {
                console.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
            }
            return result;
        } catch (error) {
            console.error('Database query error:', { text: text.substring(0, 100), error });
            throw error;
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.pool.query('SELECT 1');
            return true;
        } catch {
            return false;
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
    }
}
