import dotenv from 'dotenv';

dotenv.config();

export const config = {
    port: parseInt(process.env.PORT || '3003', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    database: {
        url: process.env.DATABASE_URL || 'postgresql://arena_user:arena_pass@localhost:5432/arena_db',
        poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
    },
    auth: {
        jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
        authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:5500',
    },
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3002',
    },
    game: {
        tickRate: parseInt(process.env.GAME_TICK_RATE || '20', 10),
        defaultMaxPlayers: 4,
        defaultBestOf: 1,
        defaultItemSpawnInterval: 60,
        defaultShrinkInterval: 30,
    },
    l2p: {
        serviceUrl: process.env.L2P_SERVICE_URL || 'http://localhost:3001',
    },
};
