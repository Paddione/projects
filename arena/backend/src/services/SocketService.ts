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
import { authFetch, authFetchInternal } from '../config/authClient.js';

interface AuthUser {
    userId: number;
    username: string;
    email: string;
    role: string;
}

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
    private inputCounts: Map<string, { count: number; windowStart: number }> = new Map(); // socketId -> input rate tracker
    private privateMatchEscrows: Map<string, { token: string; expectedPlayerIds: string[]; escrowedXp: number }> = new Map(); // lobbyCode -> escrow info
    private readonly INPUT_LIMIT = 40; // max inputs per second
    private readonly RATE_WINDOW_MS = 1000;

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

        // Socket auth middleware — validate session cookie against auth service
        this.io.use(async (socket, next) => {
            try {
                const cookie = socket.request.headers.cookie ?? '';
                if (!cookie) {
                    return next(new Error('Authentication required'));
                }

                const res = await fetch(`${config.auth.authServiceUrl}/api/auth/verify`, {
                    headers: { cookie },
                    signal: AbortSignal.timeout(5000),
                });

                if (!res.ok) {
                    return next(new Error('Authentication failed'));
                }

                // Auth service returns user info in response headers (same as ForwardAuth)
                const userId = res.headers.get('x-auth-user-id');
                const username = res.headers.get('x-auth-user');
                const email = res.headers.get('x-auth-email');
                const role = res.headers.get('x-auth-role');

                const parsedUserId = parseInt(userId ?? '', 10);
                if (!userId || isNaN(parsedUserId)) {
                    return next(new Error('Authentication failed: no user ID'));
                }

                socket.data.user = {
                    userId: parsedUserId,
                    username: username || email?.split('@')[0] || 'player',
                    email: email || '',
                    role: role || 'USER',
                } as AuthUser;
                socket.data.cookie = cookie;

                next();
            } catch (err) {
                console.error('Socket auth error:', err);
                next(new Error('Authentication check failed'));
            }
        });

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
            onExplosion: (matchId: string, data: unknown) => this.broadcastToMatch(matchId, 'explosion', data),
            onDeathmatchSettled: (matchId: string, data: unknown) => this.broadcastToMatch(matchId, 'deathmatch-settled', data),
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
                const user = this.requireAuth(socket, 'join');
                if (!user) return;

                try {
                    // Use authenticated identity, not client-supplied
                    const playerId = String(user.userId);

                    // Fetch character/gender/powerUp from auth service profile
                    let character = data.player?.character || 'student';
                    let gender: 'male' | 'female' = 'male';
                    let powerUp: string | null = null;
                    if (socket.data.cookie) {
                        try {
                            const profileRes = await authFetch('/api/profile', {
                                headers: { cookie: socket.data.cookie },
                            });
                            if (profileRes.ok) {
                                const profile = await profileRes.json();
                                if (profile) {
                                    character = profile.selectedCharacter || profile.selected_character || character;
                                    gender = profile.selectedGender || profile.selected_gender || 'male';
                                    powerUp = profile.equippedPowerUp || profile.equipped_power_up || null;

                                    // Validate character ownership
                                    const ownedCharacterIds = (profile?.inventory || [])
                                        .filter((item: any) => item.itemType === 'character' || item.item_type === 'character')
                                        .map((item: any) => (item.itemId || item.item_id || '').replace('character_', ''));
                                    const baseCharacter = character.replace('_f', '');
                                    if (baseCharacter !== 'student' && !ownedCharacterIds.includes(baseCharacter)) {
                                        console.warn(`[SocketService] Player ${playerId} attempted unowned character ${baseCharacter}, falling back to student`);
                                        character = gender === 'female' ? 'student_f' : 'student';
                                    }
                                }
                            }
                        } catch {
                            // Auth service unreachable, use defaults/client-provided
                        }
                    }

                    const lobby = await this.lobbyService.joinLobby({
                        lobbyCode: data.lobbyCode,
                        player: {
                            id: playerId,
                            username: user.username,
                            character,
                            gender,
                            characterLevel: data.player?.characterLevel || 1,
                            isReady: false,
                            isConnected: true,
                            powerUp,
                        },
                    });

                    this.connectedPlayers.set(socket.id, {
                        socketId: socket.id,
                        playerId,
                        lobbyCode: data.lobbyCode,
                        matchId: null,
                    });
                    this.playerToSocket.set(playerId, socket.id);

                    socket.join(`lobby:${data.lobbyCode}`);
                    socket.emit('join-success', { lobby, playerId });
                    this.io.to(`lobby:${data.lobbyCode}`).emit('lobby-updated', lobby);
                } catch (error) {
                    socket.emit('join-error', { message: (error as Error).message });
                }
            });

            socket.on('leave-lobby', async (data) => {
                const user = this.requireAuth(socket, 'leave');
                if (!user) return;

                try {
                    const playerId = String(user.userId);
                    const lobby = await this.lobbyService.leaveLobby(data.lobbyCode, playerId);
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
                const user = this.requireAuth(socket, 'ready');
                if (!user) return;

                try {
                    const playerId = String(user.userId);
                    const lobby = await this.lobbyService.updatePlayerReady(
                        data.lobbyCode,
                        playerId,
                        data.isReady
                    );
                    this.io.to(`lobby:${data.lobbyCode}`).emit('lobby-updated', lobby);
                } catch (error) {
                    socket.emit('ready-error', { message: (error as Error).message });
                }
            });

            socket.on('update-settings', async (data) => {
                const user = this.requireAuth(socket, 'update-settings');
                if (!user) return;

                try {
                    // Use authenticated userId as hostId — LobbyService validates ownership
                    const lobby = await this.lobbyService.updateSettings(
                        data.lobbyCode,
                        user.userId,
                        data.settings
                    );
                    this.io.to(`lobby:${data.lobbyCode}`).emit('lobby-updated', lobby);
                } catch (error) {
                    socket.emit('update-settings-error', { message: (error as Error).message });
                }
            });

            socket.on('start-game', async (data) => {
                const user = this.requireAuth(socket, 'start-game');
                if (!user) return;

                try {
                    // Use authenticated userId — LobbyService validates host ownership
                    const lobby = await this.lobbyService.startGame(data.lobbyCode, user.userId);

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

                // Rate limiting: max 40 inputs/sec per socket
                const now = Date.now();
                let rateLimiter = this.inputCounts.get(socket.id);
                if (!rateLimiter) {
                    rateLimiter = { count: 0, windowStart: now };
                    this.inputCounts.set(socket.id, rateLimiter);
                }

                // Check if window has expired
                if (now - rateLimiter.windowStart > this.RATE_WINDOW_MS) {
                    rateLimiter.count = 0;
                    rateLimiter.windowStart = now;
                }

                rateLimiter.count++;
                if (rateLimiter.count > this.INPUT_LIMIT) {
                    console.warn(`[Anti-Cheat] Rate limit exceeded for socket ${socket.id} (${rateLimiter.count}/${this.INPUT_LIMIT} inputs)`);
                    return; // Drop the input
                }

                this.gameService.processInput(data.matchId, playerInfo.playerId, data.input);
            });

            socket.on('pickup-item', (_data) => {
                // Handled through player-input with pickup flag
            });

            socket.on('spectate-player', (data) => {
                const playerInfo = this.connectedPlayers.get(socket.id);
                if (!playerInfo) return;

                socket.emit('spectate-start', { targetPlayerId: data.targetPlayerId });
            });

            socket.on('emote', (data: { emoteId: string }) => {
                const user = this.requireAuth(socket, 'emote');
                if (!user) return;

                const VALID_EMOTES = new Set([
                    'emote_wave', 'emote_gg', 'emote_thumbsup', 'emote_clap',
                    'emote_shrug', 'emote_taunt', 'emote_dance', 'emote_facepalm',
                ]);
                if (!VALID_EMOTES.has(data.emoteId)) return;

                const playerId = String(user.userId);
                const playerInfo = this.connectedPlayers.get(socket.id);
                if (playerInfo?.matchId) {
                    // Broadcast to all players in the match room
                    socket.to(`match:${playerInfo.matchId}`).emit('player-emote', { playerId, emoteId: data.emoteId });
                } else if (playerInfo?.lobbyCode) {
                    socket.to(`lobby:${playerInfo.lobbyCode}`).emit('player-emote', { playerId, emoteId: data.emoteId });
                }
            });

            socket.on('ping', () => {
                socket.emit('pong' as any);
            });

            // -- Private Match (cross-game deathmatch via escrow token) --

            socket.on('join-private-match', async (data: { token: string }) => {
                const user = this.requireAuth(socket, 'private-match');
                if (!user) return;

                try {
                    const playerId = String(user.userId);
                    const { token } = data;

                    if (!token || typeof token !== 'string' || token.length < 8) {
                        socket.emit('private-match-error', { message: 'Invalid match token' });
                        return;
                    }

                    // Validate token with auth service escrow endpoint
                    const escrowRes = await authFetchInternal(`/api/internal/match/escrow/${encodeURIComponent(token)}`);
                    if (!escrowRes.ok) {
                        const errBody = await escrowRes.json().catch(() => ({})) as Record<string, unknown>;
                        socket.emit('private-match-error', { message: (errBody.error as string) || 'Invalid or expired match token' });
                        return;
                    }

                    const escrow = await escrowRes.json() as { playerIds: string[]; escrowedXp: number; matchConfig?: Record<string, unknown>; status: string };

                    if (escrow.status !== 'pending') {
                        socket.emit('private-match-error', { message: 'Match has already been played or cancelled' });
                        return;
                    }

                    if (!escrow.playerIds.map(String).includes(playerId)) {
                        socket.emit('private-match-error', { message: 'You are not a participant in this match' });
                        return;
                    }

                    const isSolo = escrow.matchConfig?.solo === true;
                    const escrowNpcCount = (escrow.matchConfig?.npcCount as number) || 2;

                    // Use first 6 chars of token (uppercased) as lobby code
                    const lobbyCode = token.substring(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, 'X').padEnd(6, '0');

                    // Store or retrieve escrow info for this lobby
                    if (!this.privateMatchEscrows.has(lobbyCode)) {
                        this.privateMatchEscrows.set(lobbyCode, {
                            token,
                            expectedPlayerIds: escrow.playerIds,
                            escrowedXp: escrow.escrowedXp,
                        });
                    }

                    // Join or create the private lobby
                    let character = 'student';
                    let gender: 'male' | 'female' = 'male';
                    let powerUp: string | null = null;
                    if (socket.data.cookie) {
                        try {
                            const profileRes = await authFetch('/api/profile', {
                                headers: { cookie: socket.data.cookie },
                            });
                            if (profileRes.ok) {
                                const profile = await profileRes.json();
                                if (profile) {
                                    character = profile.selectedCharacter || profile.selected_character || character;
                                    gender = profile.selectedGender || profile.selected_gender || 'male';
                                    powerUp = profile.equippedPowerUp || profile.equipped_power_up || null;

                                    // Validate character ownership
                                    const ownedCharacterIds = (profile?.inventory || [])
                                        .filter((item: any) => item.itemType === 'character' || item.item_type === 'character')
                                        .map((item: any) => (item.itemId || item.item_id || '').replace('character_', ''));
                                    const baseCharacter = character.replace('_f', '');
                                    if (baseCharacter !== 'student' && !ownedCharacterIds.includes(baseCharacter)) {
                                        console.warn(`[SocketService] Player ${playerId} attempted unowned character ${baseCharacter}, falling back to student`);
                                        character = gender === 'female' ? 'student_f' : 'student';
                                    }
                                }
                            }
                        } catch {
                            // Use defaults
                        }
                    }

                    let lobby = await this.lobbyService.getLobbyByCode(lobbyCode);

                    if (!lobby) {
                        // First player creates the lobby
                        lobby = await this.lobbyService.createLobbyWithCode(lobbyCode, {
                            hostId: user.userId,
                            username: user.username,
                            selectedCharacter: character,
                            selectedGender: gender,
                            characterLevel: 1,
                            selectedPowerUp: powerUp,
                            settings: {
                                maxPlayers: (isSolo ? 2 : escrow.playerIds.length) as 2 | 3 | 4,
                                bestOf: 1,
                                shrinkingZone: false,
                                itemSpawns: false,
                                npcEnemies: isSolo ? escrowNpcCount as 0 | 1 | 2 | 3 : 0,
                            },
                        });
                    } else {
                        // Subsequent players join the existing lobby
                        lobby = await this.lobbyService.joinLobby({
                            lobbyCode,
                            player: {
                                id: playerId,
                                username: user.username,
                                character,
                                gender,
                                characterLevel: 1,
                                isReady: false,
                                isConnected: true,
                                powerUp,
                            },
                        });
                    }

                    this.connectedPlayers.set(socket.id, {
                        socketId: socket.id,
                        playerId,
                        lobbyCode,
                        matchId: null,
                    });
                    this.playerToSocket.set(playerId, socket.id);

                    socket.join(`lobby:${lobbyCode}`);
                    socket.emit('private-match-joined', {
                        lobbyCode,
                        escrowedXp: escrow.escrowedXp,
                        playerIds: escrow.playerIds,
                    });
                    if (!lobby) { socket.emit('private-match-error', { error: 'Failed to create lobby' }); return; }
                    this.io.to(`lobby:${lobbyCode}`).emit('lobby-updated', lobby);

                    // Auto-start when all expected players have joined
                    const escrowInfo = this.privateMatchEscrows.get(lobbyCode)!;
                    const joinedIds = lobby!.players.map(p => p.id);
                    const allJoined = escrowInfo.expectedPlayerIds.every(id => joinedIds.includes(id));

                    if (isSolo || allJoined) {
                        // Mark all players ready and start
                        const updatedPlayers = lobby.players.map(p => ({ ...p, isReady: true }));
                        // Manually start the match (bypass host-only check)
                        await this.lobbyService.updateLobbyStatus(lobbyCode, 'starting');

                        const readyLobby = { ...lobby, players: updatedPlayers };
                        const matchId = this.gameService.startMatch(readyLobby, escrowInfo.token);

                        const sockets = await this.io.in(`lobby:${lobbyCode}`).fetchSockets();
                        for (const s of sockets) {
                            s.join(`match:${matchId}`);
                            const pInfo = this.connectedPlayers.get(s.id);
                            if (pInfo) pInfo.matchId = matchId;
                        }

                        await this.lobbyService.updateLobbyStatus(lobbyCode, 'playing');
                        this.privateMatchEscrows.delete(lobbyCode);

                        const gameState = this.gameService.getGameState(matchId);
                        if (gameState) {
                            const spawnPositions: Record<string, { x: number; y: number; corner: string }> = {};
                            for (const [pId, pState] of gameState.players) {
                                spawnPositions[pId] = { x: pState.x, y: pState.y, corner: 'assigned' };
                            }

                            this.io.to(`match:${matchId}`).emit('game-starting', { countdown: 3 });

                            setTimeout(() => {
                                this.io.to(`match:${matchId}`).emit('round-start', {
                                    roundNumber: 1,
                                    spawnPositions,
                                });
                            }, 3000);
                        }
                    }
                } catch (error) {
                    console.error('[PrivateMatch] Error:', error);
                    socket.emit('private-match-error', { message: (error as Error).message });
                }
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

                // If player was in an active match, check for solo forfeit
                if (playerInfo?.matchId) {
                    const game = this.gameService.getGameState(playerInfo.matchId);
                    if (game?.escrowToken) {
                        // Check if any human players remain connected
                        const remainingHumans = Array.from(game.players.keys())
                            .filter(id => id !== playerInfo.playerId && this.playerToSocket.has(id));
                        if (remainingHumans.length === 0) {
                            await this.gameService.forfeitMatch(playerInfo.matchId);
                        }
                    }
                }

                this.connectedPlayers.delete(socket.id);
                this.playerToSocket.delete(playerInfo.playerId);
                this.inputCounts.delete(socket.id);
            });
        });
    }

    // -- Auth helpers --

    private requireAuth(socket: Socket, event: string): AuthUser | null {
        const user = socket.data?.user as AuthUser | undefined;
        if (!user) {
            socket.emit(`${event}-error`, { type: 'UNAUTHORIZED', message: 'Authentication required' });
            return null;
        }
        return user;
    }

    // -- Broadcast helpers --

    private broadcastToMatch(matchId: string, event: string, data: unknown): void {
        this.io.to(`match:${matchId}`).emit(event, data);
    }

    private handleMatchEnd(matchId: string, data: { winnerId: string; results: MatchResult[]; dbMatchId?: number }): void {
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
