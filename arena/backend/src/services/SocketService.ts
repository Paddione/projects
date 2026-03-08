import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { LobbyService } from './LobbyService.js';
import { GameService } from './GameService.js';
import type {
    ClientToServerEvents,
    ServerToClientEvents,
    ArenaPlayer,
    SerializedGameState,
    MapItem,
    ShrinkingZone,
    MatchResult,
} from '../types/game.js';
import { config } from '../config/index.js';

interface ConnectedPlayer {
    socketId: string;
    playerId: string;
    lobbyCode: string | null;
    matchId: string | null;
}

export class SocketService {
    private io: SocketIOServer;
    private lobbyService: LobbyService;
    private gameService: GameService;
    private connectedPlayers: Map<string, ConnectedPlayer> = new Map(); // socketId -> player info
    private playerToSocket: Map<string, string> = new Map(); // playerId -> socketId

    constructor(httpServer: HTTPServer) {
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: config.cors.origin,
                methods: ['GET', 'POST'],
                credentials: true,
            },
            pingTimeout: 10000,
            pingInterval: 5000,
        });

        this.lobbyService = new LobbyService();
        this.gameService = new GameService(config.game.tickRate);

        // Register game callbacks
        this.gameService.setCallbacks({
            onStateUpdate: (matchId: string, state: SerializedGameState) => this.broadcastToMatch(matchId, 'game-state', state),
            onPlayerHit: (matchId: string, data: unknown) => this.broadcastToMatch(matchId, 'player-hit', data),
            onPlayerKilled: (matchId: string, data: unknown) => this.broadcastToMatch(matchId, 'player-killed', data),
            onItemSpawned: (matchId: string, data: unknown) => this.broadcastToMatch(matchId, 'item-spawned', data),
            onItemCollected: (matchId: string, data: unknown) => this.broadcastToMatch(matchId, 'item-collected', data),
            onRoundEnd: (matchId: string, data: unknown) => this.broadcastToMatch(matchId, 'round-end', data),
            onMatchEnd: (matchId: string, data: { winnerId: string; results: MatchResult[] }) => this.handleMatchEnd(matchId, data),
            onZoneShrink: (matchId: string, data: unknown) => this.broadcastToMatch(matchId, 'zone-shrink', data),
            onCoverDestroyed: (matchId: string, data: unknown) => this.broadcastToMatch(matchId, 'cover-destroyed', data),
        });

        this.setupEventHandlers();

        console.log('SocketService initialized');
    }

    private setupEventHandlers(): void {
        this.io.on('connection', (socket: Socket) => {
            console.log(`Socket connected: ${socket.id}`);

            socket.emit('connected', { message: 'Connected to Arena server' });

            // -- Lobby Events --

            socket.on('join-lobby', async (data) => {
                try {
                    const lobby = await this.lobbyService.joinLobby({
                        lobbyCode: data.lobbyCode,
                        player: data.player,
                    });

                    this.connectedPlayers.set(socket.id, {
                        socketId: socket.id,
                        playerId: data.player.id,
                        lobbyCode: data.lobbyCode,
                        matchId: null,
                    });
                    this.playerToSocket.set(data.player.id, socket.id);

                    socket.join(`lobby:${data.lobbyCode}`);
                    socket.emit('join-success', { lobby, playerId: data.player.id });
                    this.io.to(`lobby:${data.lobbyCode}`).emit('lobby-updated', lobby);
                } catch (error) {
                    socket.emit('join-error', { message: (error as Error).message });
                }
            });

            socket.on('leave-lobby', async (data) => {
                try {
                    const lobby = await this.lobbyService.leaveLobby(data.lobbyCode, data.playerId);
                    socket.leave(`lobby:${data.lobbyCode}`);

                    const playerInfo = this.connectedPlayers.get(socket.id);
                    if (playerInfo) {
                        playerInfo.lobbyCode = null;
                    }

                    socket.emit('leave-success');

                    if (lobby) {
                        this.io.to(`lobby:${data.lobbyCode}`).emit('lobby-updated', lobby);
                    } else {
                        // Host left, lobby deleted
                        this.io.to(`lobby:${data.lobbyCode}`).emit('lobby-deleted', { lobbyCode: data.lobbyCode });
                    }
                } catch (error) {
                    socket.emit('leave-error', { message: (error as Error).message });
                }
            });

            socket.on('player-ready', async (data) => {
                try {
                    const lobby = await this.lobbyService.updatePlayerReady(
                        data.lobbyCode,
                        data.playerId,
                        data.isReady
                    );
                    this.io.to(`lobby:${data.lobbyCode}`).emit('lobby-updated', lobby);
                } catch (error) {
                    socket.emit('ready-error', { message: (error as Error).message });
                }
            });

            socket.on('update-settings', async (data) => {
                try {
                    const lobby = await this.lobbyService.updateSettings(
                        data.lobbyCode,
                        data.hostId,
                        data.settings
                    );
                    this.io.to(`lobby:${data.lobbyCode}`).emit('lobby-updated', lobby);
                } catch (error) {
                    socket.emit('start-game-error', { message: (error as Error).message });
                }
            });

            socket.on('start-game', async (data) => {
                try {
                    const lobby = await this.lobbyService.startGame(data.lobbyCode, data.hostId);

                    // Start the match
                    const matchId = this.gameService.startMatch(lobby);

                    // Move all players from lobby room to match room
                    const sockets = await this.io.in(`lobby:${data.lobbyCode}`).fetchSockets();
                    for (const s of sockets) {
                        s.join(`match:${matchId}`);
                        const pInfo = this.connectedPlayers.get(s.id);
                        if (pInfo) pInfo.matchId = matchId;
                    }

                    // Update lobby status
                    await this.lobbyService.updateLobbyStatus(data.lobbyCode, 'playing');

                    // Notify all players
                    const gameState = this.gameService.getGameState(matchId);
                    if (gameState) {
                        const spawnPositions: Record<string, { x: number; y: number; corner: string }> = {};
                        for (const [pId, pState] of gameState.players) {
                            spawnPositions[pId] = {
                                x: pState.x,
                                y: pState.y,
                                corner: 'assigned',
                            };
                        }

                        this.io.to(`match:${matchId}`).emit('game-starting', { countdown: 3 });

                        setTimeout(() => {
                            this.io.to(`match:${matchId}`).emit('round-start', {
                                roundNumber: 1,
                                spawnPositions,
                            });
                        }, 3000);
                    }
                } catch (error) {
                    socket.emit('start-game-error', { message: (error as Error).message });
                }
            });

            // -- Game Events --

            socket.on('player-input', (data) => {
                const playerInfo = this.connectedPlayers.get(socket.id);
                if (!playerInfo) return;

                this.gameService.processInput(data.matchId, playerInfo.playerId, data.input);
            });

            socket.on('pickup-item', (data) => {
                // Handled through player-input with pickup flag
            });

            socket.on('spectate-player', (data) => {
                const playerInfo = this.connectedPlayers.get(socket.id);
                if (!playerInfo) return;

                socket.emit('spectate-start', { targetPlayerId: data.targetPlayerId });
            });

            socket.on('ping', () => {
                socket.emit('pong' as any);
            });

            // -- Disconnect --

            socket.on('disconnect', async () => {
                const playerInfo = this.connectedPlayers.get(socket.id);
                if (!playerInfo) return;

                console.log(`Socket disconnected: ${socket.id} (player: ${playerInfo.playerId})`);

                // Leave lobby if in one
                if (playerInfo.lobbyCode) {
                    try {
                        const lobby = await this.lobbyService.leaveLobby(
                            playerInfo.lobbyCode,
                            playerInfo.playerId
                        );
                        if (lobby) {
                            this.io.to(`lobby:${playerInfo.lobbyCode}`).emit('lobby-updated', lobby);
                        } else {
                            this.io.to(`lobby:${playerInfo.lobbyCode}`).emit('lobby-deleted', {
                                lobbyCode: playerInfo.lobbyCode,
                            });
                        }
                    } catch (error) {
                        console.error('Error handling disconnect lobby leave:', error);
                    }
                }

                this.connectedPlayers.delete(socket.id);
                this.playerToSocket.delete(playerInfo.playerId);
            });
        });
    }

    // -- Broadcast helpers --

    private broadcastToMatch(matchId: string, event: string, data: unknown): void {
        this.io.to(`match:${matchId}`).emit(event, data);
    }

    private handleMatchEnd(matchId: string, data: { winnerId: string; results: MatchResult[] }): void {
        this.io.to(`match:${matchId}`).emit('match-end', data);

        // Clean up after a delay
        setTimeout(() => {
            this.gameService.endMatch(matchId);
        }, 10000);
    }

    getIO(): SocketIOServer {
        return this.io;
    }
}
