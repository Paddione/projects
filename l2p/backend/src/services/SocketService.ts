import { Server, Socket } from 'socket.io';
import { LobbyService } from './LobbyService.js';
import { GameService } from './GameService.js';
import { RequestLogger } from '../middleware/logging.js';

export interface SocketUser {
  id: string;
  username: string;
  character: string;
  isHost: boolean;
  lobbyCode?: string;
}

export interface SocketLobbyEvent {
  type: 'join' | 'leave' | 'ready' | 'unready' | 'start' | 'update';
  lobbyCode: string;
  player: SocketUser;
  data?: any;
}

export class SocketService {
  private io: Server;
  private lobbyService: LobbyService;
  private gameService: GameService;
  private connectedUsers: Map<string, SocketUser> = new Map();
  private rateLimiters: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(io: Server) {
    this.io = io;
    this.lobbyService = new LobbyService();
    this.gameService = new GameService(io);
    this.setupAuthenticationMiddleware();
    this.setupEventHandlers();
  }

  private setupAuthenticationMiddleware(): void {
    // Add authentication middleware for socket connections
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.['token'] || socket.handshake.headers?.authorization?.replace('Bearer ', '');

        if (!token) {
          console.log('Socket connection without token - allowing for public access');
          return next();
        }

        const authServiceUrl = process.env['AUTH_SERVICE_URL'] || 'http://localhost:5500';
        const response = await fetch(`${authServiceUrl}/api/auth/verify`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
          console.warn('Socket auth rejected by auth service:', response.status);
          return next();
        }

        const data = await response.json().catch(() => null);
        const user = data?.user;

        if (!user) {
          console.warn('Socket auth response missing user payload');
          return next();
        }

        socket.data.user = {
          id: String(user.userId),
          username: user.username,
          email: user.email
        };

        console.log('Socket authenticated for user:', user.username);
        next();
      } catch (error) {
        console.warn('Socket authentication failed:', error instanceof Error ? error.message : 'Unknown error');
        // Allow connection but without authenticated user data
        next();
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);

      // Lobby management events (rate limited)
      socket.on('join-lobby', (data: { lobbyCode: string; player: SocketUser }) => {
        if (!this.checkRateLimit(socket.id, 'join-lobby', 5, 10000)) {
          socket.emit('join-error', { type: 'RATE_LIMITED', message: 'Too many join attempts, please wait' });
          return;
        }
        this.handleJoinLobby(socket, data);
      });

      socket.on('leave-lobby', (data: { lobbyCode: string; playerId: string }) => {
        if (!this.checkRateLimit(socket.id, 'leave-lobby', 5, 10000)) {
          socket.emit('leave-error', { type: 'RATE_LIMITED', message: 'Too many requests, please wait' });
          return;
        }
        this.handleLeaveLobby(socket, data);
      });

      socket.on('player-ready', (data: { lobbyCode: string; playerId: string; isReady: boolean }) => {
        if (!this.checkRateLimit(socket.id, 'player-ready', 10, 10000)) {
          socket.emit('ready-error', { type: 'RATE_LIMITED', message: 'Too many requests, please wait' });
          return;
        }
        this.handlePlayerReady(socket, data);
      });

      socket.on('start-game', (data: { lobbyCode: string; hostId: string }) => {
        if (!this.checkRateLimit(socket.id, 'start-game', 3, 30000)) {
          socket.emit('start-game-error', { type: 'RATE_LIMITED', message: 'Too many start attempts, please wait' });
          return;
        }
        this.handleStartGame(socket, data);
      });

      // Question set management events
      socket.on('update-question-sets', (data: { lobbyCode: string; hostId: string; questionSetIds: number[]; questionCount: number }) => {
        if (!this.checkRateLimit(socket.id, 'update-question-sets', 10, 10000)) {
          socket.emit('question-sets-update-error', { type: 'RATE_LIMITED', message: 'Too many requests, please wait' });
          return;
        }
        this.handleUpdateQuestionSets(socket, data);
      });

      socket.on('get-question-set-info', (data: { lobbyCode: string }) => {
        this.handleGetQuestionSetInfo(socket, data);
      });

      // Game events (rate limited)
      socket.on('submit-answer', (data: { lobbyCode: string; playerId: string; answer: string; timeElapsed: number }) => {
        if (!this.checkRateLimit(socket.id, 'submit-answer', 5, 5000)) {
          socket.emit('answer-error', { type: 'RATE_LIMITED', message: 'Too many answer submissions, please wait' });
          return;
        }
        this.handleSubmitAnswer(socket, data);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // Connection testing
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });
    });
  }

  private handleConnection(socket: Socket): void {
    const userId = socket.data?.user?.id;
    const username = socket.data?.user?.username;

    console.log('User connected:', {
      socketId: socket.id,
      userId: userId || 'anonymous',
      username: username || 'anonymous'
    });

    RequestLogger.logSocketConnection(socket.id, 'connect');

    // Send connection confirmation with user info
    socket.emit('connected', {
      socketId: socket.id,
      timestamp: Date.now(),
      authenticated: !!userId,
      user: userId ? { id: userId, username } : null
    });
  }

  private async handleJoinLobby(socket: Socket, data: { lobbyCode: string; player: SocketUser }): Promise<void> {
    try {
      // Guard against malformed payloads before destructuring
      if (!data || typeof (data as any).lobbyCode !== 'string' || !(data as any).lobbyCode) {
        socket.emit('join-error', {
          type: 'INVALID_CODE',
          message: 'Invalid lobby code format'
        });
        return;
      }

      const { lobbyCode, player } = data;

      // Require authentication and verify identity
      const userId = this.requireAuth(socket, 'join');
      if (!userId) return;
      if (!this.verifyIdentity(socket, 'join', player?.id)) return;

      RequestLogger.logSocketEvent(socket.id, 'join-lobby', { lobbyCode, playerId: player?.id });

      // Validate lobby code format
      if (!LobbyService.isValidLobbyCode(lobbyCode)) {
        socket.emit('join-error', {
          type: 'INVALID_CODE',
          message: 'Invalid lobby code format'
        });
        return;
      }

      // Check lobby status — reject joins if game is already starting or playing
      const existingLobby = await this.lobbyService.getLobbyByCode(lobbyCode);
      if (existingLobby && (existingLobby.status === 'starting' || existingLobby.status === 'playing')) {
        socket.emit('join-error', {
          type: 'GAME_IN_PROGRESS',
          message: 'Cannot join lobby — game is already in progress'
        });
        return;
      }

      // Try to join the lobby, but handle case where player is already in lobby
      let lobby;
      let isAlreadyInLobby = false;
      try {
        lobby = await this.lobbyService.joinLobby({
          lobbyCode,
          player: {
            id: player.id,
            username: player.username,
            character: player.character,
            isReady: false,
            isConnected: true
          }
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'Player already in lobby') {
          // Player is already in lobby (likely joined via API), just get the current lobby state
          isAlreadyInLobby = true;
          lobby = await this.lobbyService.getLobbyByCode(lobbyCode);
          if (!lobby) {
            socket.emit('join-error', {
              type: 'LOBBY_NOT_FOUND',
              message: 'Lobby not found'
            });
            return;
          }
          // Update player connection status to true since they're connecting via socket
          const updatedLobby = await this.lobbyService.updatePlayerConnection(lobbyCode, player.id, true);
          if (updatedLobby) {
            lobby = updatedLobby;
          }
          // If game is active, handle reconnection (cancel grace timer, restore status)
          if (this.gameService.isGameActive(lobbyCode)) {
            await this.gameService.handlePlayerReconnect(lobbyCode, player.id);
          }
        } else {
          throw error; // Re-throw other errors
        }
      }

      if (!lobby) {
        socket.emit('join-error', {
          type: 'LOBBY_NOT_FOUND',
          message: 'Lobby not found or is full'
        });
        return;
      }

      // Join socket room
      socket.join(lobbyCode);

      // Store user information
      this.connectedUsers.set(socket.id, {
        id: player.id,
        username: player.username,
        character: player.character,
        isHost: false,
        lobbyCode
      });

      // Always broadcast lobby-updated so other players (especially the host)
      // see the new player. The two-phase join (API then socket) means the
      // player is already in the DB when the socket event arrives, but the
      // host still needs the real-time notification.
      try {
        this.io.to(lobbyCode).emit('lobby-updated', {
          lobby,
          event: 'player-joined',
          playerId: player.id
        });
      } catch (e) {
        // Log and continue; do not fail the join on broadcast error
        console.error('Broadcast join event failed:', e);
      }

      // Send confirmation to joining player
      socket.emit('join-success', {
        lobby,
        message: 'Successfully joined lobby'
      });

    } catch (error) {
      console.error('Error joining lobby:', error);
      socket.emit('join-error', {
        type: 'SERVER_ERROR',
        message: 'Failed to join lobby'
      });
    }
  }

  private async handleLeaveLobby(socket: Socket, data: { lobbyCode: string; playerId: string }): Promise<void> {
    try {
      const { lobbyCode, playerId } = data;

      // Require authentication and verify identity
      const userId = this.requireAuth(socket, 'leave');
      if (!userId) return;
      if (!this.verifyIdentity(socket, 'leave', playerId)) return;

      RequestLogger.logSocketEvent(socket.id, 'leave-lobby', { lobbyCode, playerId });

      // Leave the lobby
      const updatedLobby = await this.lobbyService.leaveLobby(lobbyCode, playerId);

      // Leave socket room
      socket.leave(lobbyCode);

      // Remove from connected users
      this.connectedUsers.delete(socket.id);

      if (updatedLobby) {
        // Regular player left - broadcast updated lobby to remaining players
        this.io.to(lobbyCode).emit('lobby-updated', {
          lobby: updatedLobby,
          event: 'player-left',
          playerId
        });
      } else {
        // Host left - lobby was deleted, notify all players
        this.io.to(lobbyCode).emit('lobby-deleted', {
          message: 'Lobby has been deleted',
          reason: 'host-left'
        });
      }

      // Send confirmation to leaving player
      socket.emit('leave-success', {
        message: 'Successfully left lobby'
      });

    } catch (error) {
      console.error('Error leaving lobby:', error);
      socket.emit('leave-error', {
        type: 'SERVER_ERROR',
        message: 'Failed to leave lobby'
      });
    }
  }

  private async handlePlayerReady(socket: Socket, data: { lobbyCode: string; playerId: string; isReady: boolean }): Promise<void> {
    try {
      const { lobbyCode, playerId, isReady } = data;

      // Require authentication and verify identity
      const userId = this.requireAuth(socket, 'ready');
      if (!userId) return;
      if (!this.verifyIdentity(socket, 'ready', playerId)) return;

      RequestLogger.logSocketEvent(socket.id, 'player-ready', { lobbyCode, playerId, isReady });

      // Update player ready state
      const updatedLobby = await this.lobbyService.updatePlayerReady(lobbyCode, playerId, isReady);

      if (updatedLobby) {
        // Broadcast to all players in the lobby
        this.io.to(lobbyCode).emit('lobby-updated', {
          lobby: updatedLobby,
          event: 'player-ready-changed',
          playerId,
          isReady
        });
      }

    } catch (error) {
      console.error('Error updating player ready state:', error);
      socket.emit('ready-error', {
        type: 'SERVER_ERROR',
        message: 'Failed to update ready state'
      });
    }
  }

  private async handleStartGame(socket: Socket, data: { lobbyCode: string; hostId: string }): Promise<void> {
    try {
      const { lobbyCode, hostId } = data;

      // Require authentication and verify identity
      const userId = this.requireAuth(socket, 'start-game');
      if (!userId) return;
      if (!this.verifyIdentity(socket, 'start-game', hostId)) return;

      RequestLogger.logSocketEvent(socket.id, 'start-game', { lobbyCode, hostId });

      // Start the game session using GameService
      const gameState = await this.gameService.startGameSession(lobbyCode, parseInt(hostId));

      const gameStartedPayload = {
        gameState,
        message: 'Game is starting...'
      };

      // Broadcast game start to all players in the socket room
      this.io.to(lobbyCode).emit('game-started', gameStartedPayload);

      // Also emit game-started directly to each known connected user for this lobby,
      // in case their socket hasn't joined the room yet (two-phase join race condition).
      // NOTE: Do NOT emit question-started here — startNextQuestion() already emits it
      // to the room after the sync countdown, which would cause duplicate events.
      for (const [socketId, user] of this.connectedUsers.entries()) {
        if (user.lobbyCode === lobbyCode) {
          this.io.to(socketId).emit('game-started', gameStartedPayload);
        }
      }

    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('start-game-error', {
        type: 'SERVER_ERROR',
        message: 'Failed to start game'
      });
    }
  }

  private async handleSubmitAnswer(socket: Socket, data: { lobbyCode: string; playerId: string; answer: string; timeElapsed: number }): Promise<void> {
    try {
      const { lobbyCode, playerId, answer, timeElapsed } = data;

      // Require authentication and verify identity
      const userId = this.requireAuth(socket, 'answer');
      if (!userId) return;
      if (!this.verifyIdentity(socket, 'answer', playerId)) return;

      RequestLogger.logSocketEvent(socket.id, 'submit-answer', { lobbyCode, playerId, answer, timeElapsed });

      // Submit answer using GameService
      await this.gameService.submitAnswer(lobbyCode, playerId, answer);

      // The GameService will handle broadcasting the answer events

    } catch (error) {
      console.error('Error submitting answer:', error);
      socket.emit('answer-error', {
        type: 'SERVER_ERROR',
        message: 'Failed to submit answer'
      });
    }
  }

  private async handleUpdateQuestionSets(socket: Socket, data: { lobbyCode: string; hostId: string; questionSetIds: number[]; questionCount: number }): Promise<void> {
    try {
      const { lobbyCode, hostId, questionSetIds, questionCount } = data;

      // Require authentication and verify identity
      const userId = this.requireAuth(socket, 'question-sets-update');
      if (!userId) return;
      if (!this.verifyIdentity(socket, 'question-sets-update', hostId)) return;

      RequestLogger.logSocketEvent(socket.id, 'update-question-sets', { lobbyCode, hostId, questionSetIds, questionCount });

      // Update question set settings
      const updatedLobby = await this.lobbyService.updateLobbyQuestionSets(
        lobbyCode,
        parseInt(hostId),
        questionSetIds,
        questionCount
      );

      // Broadcast update to all players in lobby
      this.broadcastToLobby(lobbyCode, 'question-sets-updated', {
        lobby: updatedLobby,
        updatedBy: hostId
      });

      // Send confirmation to host
      socket.emit('question-sets-update-success', {
        message: 'Question set settings updated successfully',
        lobby: updatedLobby
      });

    } catch (error) {
      console.error('Update question sets error:', error);
      socket.emit('question-sets-update-error', {
        type: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update question set settings'
      });
    }
  }

  private async handleGetQuestionSetInfo(socket: Socket, data: { lobbyCode: string }): Promise<void> {
    try {
      const { lobbyCode } = data;

      RequestLogger.logSocketEvent(socket.id, 'get-question-set-info', { lobbyCode });

      // Get question set information
      const questionSetInfo = await this.lobbyService.getLobbyQuestionSetInfo(lobbyCode);

      if (!questionSetInfo) {
        socket.emit('question-set-info-error', {
          type: 'LOBBY_NOT_FOUND',
          message: 'Lobby not found'
        });
        return;
      }

      // Send question set info to requesting user
      socket.emit('question-set-info', {
        questionSetInfo
      });

    } catch (error) {
      console.error('Get question set info error:', error);
      socket.emit('question-set-info-error', {
        type: 'FETCH_FAILED',
        message: 'Failed to retrieve question set information'
      });
    }
  }

  private handleDisconnect(socket: Socket): void {
    console.log('User disconnected:', socket.id);
    RequestLogger.logSocketConnection(socket.id, 'disconnect');

    // Get user info
    const user = this.connectedUsers.get(socket.id);

    if (user && user.lobbyCode) {
      // Update player connection status in lobby
      this.lobbyService.updatePlayerConnection(user.lobbyCode, user.id, false)
        .then(updatedLobby => {
          if (updatedLobby) {
            // Broadcast to remaining players
            this.io.to(user.lobbyCode!).emit('lobby-updated', {
              lobby: updatedLobby,
              event: 'player-disconnected',
              playerId: user.id
            });
          }
        })
        .catch(error => {
          console.error('Error updating player connection status:', error);
        });

      // Handle game disconnection if game is active
      if (this.gameService.isGameActive(user.lobbyCode)) {
        this.gameService.handlePlayerDisconnect(user.lobbyCode, user.id)
          .catch(error => {
            console.error('Error handling game disconnection:', error);
          });
      }
    }

    // Remove from connected users
    this.connectedUsers.delete(socket.id);

    // Clean up rate limit entries for this socket
    for (const key of this.rateLimiters.keys()) {
      if (key.startsWith(socket.id + ':')) {
        this.rateLimiters.delete(key);
      }
    }
  }

  /**
   * Check that the socket connection is authenticated.
   * If not, emit an error event and return null.
   * Returns the authenticated user ID on success.
   */
  private requireAuth(socket: Socket, event: string): string | null {
    const userId = socket.data?.user?.id;
    if (!userId) {
      socket.emit(`${event}-error`, {
        type: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return null;
    }
    return userId;
  }

  /**
   * Verify that the authenticated user matches the claimed identity.
   * Must be called AFTER requireAuth (assumes userId is already validated).
   * Emits an error event and returns false on mismatch.
   */
  private verifyIdentity(socket: Socket, event: string, claimedId: string): boolean {
    const authenticatedId = socket.data?.user?.id;
    if (authenticatedId !== claimedId) {
      socket.emit(`${event}-error`, {
        type: 'IDENTITY_MISMATCH',
        message: 'Authenticated user does not match claimed identity'
      });
      return false;
    }
    return true;
  }

  /**
   * Per-socket rate limiting. Returns true if the request is allowed, false if rate-limited.
   */
  private checkRateLimit(socketId: string, event: string, maxRequests: number, windowMs: number): boolean {
    const key = `${socketId}:${event}`;
    const now = Date.now();
    const limiter = this.rateLimiters.get(key);

    if (!limiter || now > limiter.resetAt) {
      this.rateLimiters.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (limiter.count >= maxRequests) {
      return false;
    }

    limiter.count++;
    return true;
  }

  // Public methods for external use
  public getConnectedUsers(): Map<string, SocketUser> {
    return new Map(this.connectedUsers);
  }

  public getUserBySocketId(socketId: string): SocketUser | undefined {
    return this.connectedUsers.get(socketId);
  }

  public broadcastToLobby(lobbyCode: string, event: string, data: any): void {
    this.io.to(lobbyCode).emit(event, data);
  }

  public emitToUser(socketId: string, event: string, data: any): void {
    this.io.to(socketId).emit(event, data);
  }

  /**
   * Graceful shutdown: clear all game timers, close socket connections.
   */
  public shutdown(): Promise<void> {
    return new Promise((resolve) => {
      console.log('Shutting down SocketService...');

      // Clean up all game timers and active games
      this.gameService.cleanup();
      console.log('Game timers and active games cleaned up');

      // Clear rate limiters
      this.rateLimiters.clear();

      // Close all socket connections
      this.io.close((err) => {
        if (err) {
          console.error('Error closing Socket.io:', err);
        } else {
          console.log('Socket.io connections closed');
        }
        resolve();
      });
    });
  }
} 
