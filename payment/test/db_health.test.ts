import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

describe('Database Health Check', () => {
    let prisma: PrismaClient;

    beforeAll(() => {
        prisma = new PrismaClient();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it('should connect to the database', async () => {
        try {
            await prisma.$connect();
            expect(true).toBe(true);
        } catch (error) {
            console.error('Failed to connect to database:', error);
            throw error;
        }
    });

    it('should be able to query users (or checking table existence)', async () => {
        try {
            // Just counting users to ensure read access
            const count = await prisma.user.count();
            expect(typeof count).toBe('number');
        } catch (error) {
            console.error('Failed to query users table:', error);
            throw error;
        }
    });
});
