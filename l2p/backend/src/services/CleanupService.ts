import { LobbyService } from './LobbyService.js';

export class CleanupService {
  private lobbyService: LobbyService;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly INACTIVE_LOBBY_CLEANUP_MINUTES = 10; // Clean up lobbies after 10 minutes
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Run cleanup every 5 minutes

  constructor(lobbyService: LobbyService) {
    this.lobbyService = lobbyService;
  }

  /**
   * Start the periodic cleanup service
   */
  start(): void {
    if (this.cleanupInterval) {
      console.log('Cleanup service is already running');
      return;
    }

    console.log('Starting cleanup service...');
    
    // Run initial cleanup immediately
    this.performCleanup();
    
    // Set up periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL_MS);

    console.log(`Cleanup service started. Running every ${this.CLEANUP_INTERVAL_MS / 1000 / 60} minutes`);
  }

  /**
   * Stop the periodic cleanup service
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('Cleanup service stopped');
    }
  }

  /**
   * Perform the cleanup operations
   */
  private async performCleanup(): Promise<void> {
    try {
      console.log('Starting scheduled cleanup...');
      
      // Clean up inactive lobbies (those that haven't started a game within 10 minutes)
      const inactiveLobbiesCleaned = await this.lobbyService.cleanupInactiveLobbies(this.INACTIVE_LOBBY_CLEANUP_MINUTES);
      
      if (inactiveLobbiesCleaned > 0) {
        console.log(`Cleaned up ${inactiveLobbiesCleaned} inactive lobbies (older than ${this.INACTIVE_LOBBY_CLEANUP_MINUTES} minutes)`);
      }

      // Clean up old ended lobbies (older than 24 hours)
      const oldLobbiesCleaned = await this.lobbyService.cleanupOldLobbies(24);
      
      if (oldLobbiesCleaned > 0) {
        console.log(`Cleaned up ${oldLobbiesCleaned} old ended lobbies (older than 24 hours)`);
      }

      if (inactiveLobbiesCleaned === 0 && oldLobbiesCleaned === 0) {
        console.log('No lobbies needed cleanup');
      }

    } catch (error) {
      console.error('Error during scheduled cleanup:', error);
    }
  }

  /**
   * Get the current status of the cleanup service
   */
  getStatus(): { isRunning: boolean; lastCleanup?: Date; nextCleanup?: Date } {
    return {
      isRunning: this.cleanupInterval !== null,
      lastCleanup: new Date(),
      ...(this.cleanupInterval ? { nextCleanup: new Date(Date.now() + this.CLEANUP_INTERVAL_MS) } : {})
    };
  }
}
