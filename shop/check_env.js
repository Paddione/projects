/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

async function main() {
    console.log('--- Checking Environment Variables ---');
    console.log('DATABASE_URL defined:', !!process.env.DATABASE_URL);
    if (process.env.DATABASE_URL) {
        const maskedUrl = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@');
        console.log('DATABASE_URL value:', maskedUrl);
    } else {
        console.error('ERROR: DATABASE_URL is missing!');
    }

    console.log('AUTH_SECRET defined:', !!process.env.AUTH_SECRET);
    if (process.env.AUTH_SECRET) {
        console.log('AUTH_SECRET length:', process.env.AUTH_SECRET.length);
    }

    console.log('AUTH_GOOGLE_ID defined:', !!process.env.AUTH_GOOGLE_ID);
    console.log('AUTH_GOOGLE_SECRET defined:', !!process.env.AUTH_GOOGLE_SECRET);


    console.log('\n--- Testing Database Connection ---');
    try {
        console.log('Attempting to search for users...');
        const userCount = await prisma.user.count();
        console.log(`Connection successful! found ${userCount} users.`);

        // Try a simple query
        const users = await prisma.user.findMany({ take: 1 });
        console.log('First user:', users[0] || 'No users found');

    } catch (e) {
        console.error('Database Connection Failed:');
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
