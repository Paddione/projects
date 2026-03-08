import { createServer } from 'http';
import app from './app.js';
import { SocketService } from './services/SocketService.js';
import { LobbyService } from './services/LobbyService.js';
import { DatabaseService } from './services/DatabaseService.js';
import { config } from './config/index.js';

async function main(): Promise<void> {
    console.log('🎮 Arena Backend starting...');
    console.log(`   Environment: ${config.nodeEnv}`);
    console.log(`   Port: ${config.port}`);

    // Verify database connection
    const db = DatabaseService.getInstance();
    const isDbHealthy = await db.healthCheck();
    if (!isDbHealthy) {
        console.error('❌ Database connection failed! Check DATABASE_URL.');
        console.log('   Continuing anyway — DB may come up later...');
    } else {
        console.log('✅ Database connected');
    }

    // Reconcile stale lobbies from any previous crash
    try {
        const lobbyService = new LobbyService();
        const cleaned = await lobbyService.reconcileStaleLobbies();
        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} stale lobbies`);
        }
    } catch (error) {
        console.warn('Could not reconcile stale lobbies:', error);
    }

    // Create HTTP server with Socket.io
    const httpServer = createServer(app);
    const _socketService = new SocketService(httpServer);

    httpServer.listen(config.port, () => {
        console.log(`\n🚀 Arena Backend running on http://localhost:${config.port}`);
        console.log(`   API:    http://localhost:${config.port}/api`);
        console.log(`   Health: http://localhost:${config.port}/api/health`);
        console.log(`   WS:     ws://localhost:${config.port}`);
        console.log('');
    });

    // Graceful shutdown
    const shutdown = async (): Promise<void> => {
        console.log('\n🛑 Shutting down Arena Backend...');
        httpServer.close();
        await db.close();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((error) => {
    console.error('Failed to start Arena Backend:', error);
    process.exit(1);
});
