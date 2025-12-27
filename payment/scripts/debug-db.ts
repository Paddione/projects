
import { db } from '@/lib/db';

async function main() {
    console.log('Attempting to connect to database...');
    try {
        await db.$connect();
        console.log('Connected to database successfully.');
        const userCount = await db.user.count();
        console.log(`User count: ${userCount}`);
        await db.$disconnect();
    } catch (error) {
        console.error('Database connection failed:', error);
        process.exit(1);
    }
}

main();
