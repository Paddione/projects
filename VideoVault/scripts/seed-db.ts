import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { videos, directoryRoots, tags } from '../shared/schema';
import { randomUUID } from 'crypto';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
const envPath = path.resolve(__dirname, '../env/.env-app.local');
dotenv.config({ path: envPath });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
}

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures/library');
// 1x1 pixel black JPEG base64
const PLACEHOLDER_JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');

const SAMPLE_CATEGORIES = {
    age: ['18-25', '26-35', '36-50'],
    physical: ['Slim', 'Athletic', 'Curvy'],
    ethnicity: ['Asian', 'Black', 'Latina', 'White'],
    relationship: ['Couple', 'Solo', 'Group'],
    acts: ['Oral', 'Anal', 'Vaginal'],
    setting: ['Indoor', 'Outdoor', 'Studio'],
    quality: ['HD', '4K', 'SD'],
    performer: ['Alice', 'Bob', 'Charlie', 'Dana', 'Eve', 'Frank']
};

function getRandomItem(arr: string[]) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomSubset(arr: string[], max = 3) {
    const count = Math.floor(Math.random() * max) + 1;
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

async function seed() {
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    const db = drizzle(client);

    console.log('Cleaning database...');
    await db.delete(videos);
    await db.delete(directoryRoots);
    await db.delete(tags);

    console.log('Creating fixtures directory...');
    await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
    await fs.mkdir(FIXTURES_DIR, { recursive: true });

    const rootKey = 'fixtures-root';
    await db.insert(directoryRoots).values({
        rootKey,
        name: 'Fixtures Library',
        directories: [FIXTURES_DIR],
    });

    console.log('Generating 1000 video entries...');
    const videoEntries = [];

    for (let i = 1; i <= 1000; i++) {
        const id = randomUUID();
        const filename = `Video_${String(i).padStart(4, '0')}.mp4`;
        const filePath = path.join(FIXTURES_DIR, filename);

        // Create empty file
        await fs.writeFile(filePath, '');

        // Create thumbnail
        const thumbsDir = path.join(FIXTURES_DIR, 'Thumbnails');
        await fs.mkdir(thumbsDir, { recursive: true });
        const thumbPath = path.join(thumbsDir, `${filename.replace('.mp4', '')}-thumb.jpg`);
        await fs.writeFile(thumbPath, PLACEHOLDER_JPG);

        const duration = Math.floor(Math.random() * 3600) + 60; // 1 min to 1 hour
        const size = Math.floor(Math.random() * 1024 * 1024 * 1024) + 1024 * 1024; // 1MB to 1GB

        const categories: any = {};
        for (const [key, values] of Object.entries(SAMPLE_CATEGORIES)) {
            categories[key] = getRandomSubset(values);
        }

        videoEntries.push({
            id,
            filename,
            displayName: filename,
            path: filePath,
            size,
            lastModified: new Date(),
            metadata: {
                duration,
                width: 1920,
                height: 1080,
                bitrate: 5000,
                codec: 'h264',
                fps: 30,
                aspectRatio: '16:9'
            },
            categories,
            customCategories: {},
            rootKey,
            hashFast: randomUUID(), // fake hash
            hashPerceptual: randomUUID(), // fake hash
        });

        if (i % 100 === 0) console.log(`Generated ${i} entries...`);
    }

    console.log('Inserting into database...');
    // Insert in chunks to avoid query size limits
    const chunkSize = 100;
    for (let i = 0; i < videoEntries.length; i += chunkSize) {
        await db.insert(videos).values(videoEntries.slice(i, i + chunkSize));
    }

    console.log('Seeding complete!');
    await client.end();
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
