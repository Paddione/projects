import { CleanupService } from '../CleanupService.js';

describe('CleanupService', () => {
    interface MockLobbyService {
        cleanupInactiveLobbies: jest.MockedFunction<(minutes: number) => Promise<number>>;
        cleanupOldLobbies: jest.MockedFunction<(hours: number) => Promise<number>>;
    }

    let cleanupService: CleanupService;
    let mockLobbyService: MockLobbyService;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Create simple mock object
        mockLobbyService = {
            cleanupInactiveLobbies: jest.fn(),
            cleanupOldLobbies: jest.fn(),
        } as MockLobbyService;

        // Create service instance
        cleanupService = new CleanupService(mockLobbyService as any);
    });

    afterEach(() => {
        // Stop the service to clean up any running timers
        if (cleanupService) {
            cleanupService.stop();
        }
    });

    describe('constructor', () => {
        it('should create a CleanupService instance with LobbyService dependency', () => {
            expect(cleanupService).toBeInstanceOf(CleanupService);
        });
    });

    describe('start', () => {
        it('should start the cleanup service and run initial cleanup', () => {
            // Mock successful cleanup
            mockLobbyService.cleanupInactiveLobbies.mockResolvedValue(2);
            mockLobbyService.cleanupOldLobbies.mockResolvedValue(1);

            // Spy on console.log
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            cleanupService.start();

            expect(consoleSpy).toHaveBeenCalledWith('Starting cleanup service...');
            expect(consoleSpy).toHaveBeenCalledWith('Cleanup service started. Running every 5 minutes');

            consoleSpy.mockRestore();
        });

        it('should not start if already running', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            cleanupService.start();
            cleanupService.start(); // Try to start again

            expect(consoleSpy).toHaveBeenCalledWith('Cleanup service is already running');

            consoleSpy.mockRestore();
        });
    });

    describe('stop', () => {
        it('should stop the cleanup service', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            cleanupService.start();
            cleanupService.stop();

            expect(consoleSpy).toHaveBeenCalledWith('Cleanup service stopped');

            consoleSpy.mockRestore();
        });

        it('should handle stopping when not running', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            cleanupService.stop(); // Stop without starting

            expect(consoleSpy).not.toHaveBeenCalledWith('Cleanup service stopped');

            consoleSpy.mockRestore();
        });
    });

    describe('periodic cleanup', () => {
        it('should initialize cleanup service correctly', () => {
            mockLobbyService.cleanupInactiveLobbies.mockResolvedValue(0);
            mockLobbyService.cleanupOldLobbies.mockResolvedValue(0);

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            cleanupService.start();

            // Just verify that the service started successfully
            expect(consoleSpy).toHaveBeenCalledWith('Starting cleanup service...');
            expect(consoleSpy).toHaveBeenCalledWith('Cleanup service started. Running every 5 minutes');
            
            consoleSpy.mockRestore();
        });

        it('should start cleanup service successfully', () => {
            mockLobbyService.cleanupInactiveLobbies.mockResolvedValue(3);
            mockLobbyService.cleanupOldLobbies.mockResolvedValue(2);

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            cleanupService.start();

            expect(consoleSpy).toHaveBeenCalledWith('Starting cleanup service...');
            expect(consoleSpy).toHaveBeenCalledWith('Cleanup service started. Running every 5 minutes');

            consoleSpy.mockRestore();
        });

        it('should verify service can be stopped', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            cleanupService.start();
            cleanupService.stop();

            expect(consoleSpy).toHaveBeenCalledWith('Cleanup service stopped');

            consoleSpy.mockRestore();
        });
    });

    describe('error handling', () => {
        it('should handle service start and stop correctly', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            // Test starting service
            cleanupService.start();
            expect(consoleSpy).toHaveBeenCalledWith('Starting cleanup service...');

            // Test stopping service
            cleanupService.stop();
            expect(consoleSpy).toHaveBeenCalledWith('Cleanup service stopped');

            consoleSpy.mockRestore();
        });

        it('should handle multiple start calls correctly', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            cleanupService.start();
            cleanupService.start(); // Try to start again

            expect(consoleSpy).toHaveBeenCalledWith('Cleanup service is already running');

            consoleSpy.mockRestore();
        });
    });

    describe('getStatus', () => {
        it('should return correct status when not running', () => {
            const status = cleanupService.getStatus();

            expect(status.isRunning).toBe(false);
            expect(status.lastCleanup).toBeInstanceOf(Date);
            expect(status.nextCleanup).toBeUndefined();
        });

        it('should return correct status when running', () => {
            cleanupService.start();
            const status = cleanupService.getStatus();

            expect(status.isRunning).toBe(true);
            expect(status.lastCleanup).toBeInstanceOf(Date);
            expect(status.nextCleanup).toBeInstanceOf(Date);

            // nextCleanup should be approximately 5 minutes from now
            if (status.nextCleanup) {
                const timeDiff = status.nextCleanup.getTime() - Date.now();
                expect(timeDiff).toBeGreaterThan(4.5 * 60 * 1000); // At least 4.5 minutes
                expect(timeDiff).toBeLessThan(5.5 * 60 * 1000); // Less than 5.5 minutes
            }
        });
    });

    describe('cleanup timing', () => {
        it('should use correct cleanup intervals', () => {
            // Test that the service uses the expected timing constants
            const service = cleanupService as any;

            expect(service.INACTIVE_LOBBY_CLEANUP_MINUTES).toBe(10);
            expect(service.CLEANUP_INTERVAL_MS).toBe(5 * 60 * 1000);
        });
    });
});
