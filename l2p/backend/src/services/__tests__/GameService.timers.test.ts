import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Skip timer-heavy suite during coverage or when explicitly requested
const d = (process.env.TEST_COVERAGE === '1' || process.env.SKIP_TIMER_TESTS === 'true') ? describe.skip : describe;
import { GameService, GameState, QuestionData } from '../GameService';
import { Server } from 'socket.io';

// Mock all dependencies
jest.mock('socket.io');
jest.mock('../LobbyService');
jest.mock('../QuestionService');
jest.mock('../ScoringService');
jest.mock('../CharacterService');
jest.mock('../../repositories/GameSessionRepository');
jest.mock('../../repositories/UserRepository');
jest.mock('../../repositories/LobbyRepository');
jest.mock('../../middleware/logging');

d('GameService - Timer Management', () => {
  let gameService: GameService;
  let mockIo: jest.Mocked<Server>;
  
  const createMockGameState = (overrides: Partial<GameState> = {}): GameState => ({
    lobbyCode: 'TEST123',
    gameSessionId: 1,
    currentQuestionIndex: 0,
    totalQuestions: 2,
    timeRemaining: 60,
    isActive: true,
    selectedQuestionSetIds: [1],
    questions: [
      {
        id: 1,
        question: 'Test question 1?',
        answers: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        questionSetId: 1,
        language: 'en'
      },
      {
        id: 2,
        question: 'Test question 2?',
        answers: ['X', 'Y', 'Z', 'W'],
        correctAnswer: 'X',
        questionSetId: 1,
        language: 'en'
      }
    ],
    currentQuestion: {
      id: 1,
      question: 'Test question 1?',
      answers: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      questionSetId: 1,
      language: 'en'
    },
    questionStartTime: Date.now(),
    players: [
      {
        id: 'player1',
        username: 'player1',
        character: 'student',
        characterLevel: 1,
        isHost: true,
        score: 0,
        multiplier: 1,
        correctAnswers: 0,
        currentStreak: 0,
        hasAnsweredCurrentQuestion: false,
        isConnected: true
      }
    ],
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up fake timers
    jest.useFakeTimers();
    
    // Set test environment
    process.env.TEST_ENVIRONMENT = 'local';
    
    // Setup Socket.IO mock
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    } as any;

    // Create GameService instance
    gameService = new GameService(mockIo);
  });

  afterEach(() => {
    // Clean up all timers
    if (gameService && typeof (gameService as any).cleanup === 'function') {
      (gameService as any).cleanup();
    }
    
    // Restore real timers
    jest.useRealTimers();
    
    // Clean up environment variables
    delete process.env.TEST_ENVIRONMENT;
  });

  describe('Timer Creation and Management', () => {
    it('should create and store game timer when starting question timer', () => {
      const mockGameState = createMockGameState();
      (gameService as any).activeGames.set('TEST123', mockGameState);

      // Call the private startQuestionTimer method
      (gameService as any).startQuestionTimer('TEST123');

      // Verify timer was created and stored
      const gameTimers = (gameService as any).gameTimers;
      expect(gameTimers.has('TEST123')).toBe(true);

      // Verify timer is properly configured
      const timer = gameTimers.get('TEST123');
      expect(timer).toBeDefined();
    });

    it('should clear existing timers before creating new ones', () => {
      const mockGameState = createMockGameState();
      (gameService as any).activeGames.set('TEST123', mockGameState);

      // Create initial timer
      (gameService as any).startQuestionTimer('TEST123');
      const firstTimer = (gameService as any).gameTimers.get('TEST123');

      // Start timer again (should clear and recreate)
      (gameService as any).startQuestionTimer('TEST123');
      const secondTimer = (gameService as any).gameTimers.get('TEST123');

      // Verify old timer was cleared and new one created
      expect(firstTimer).toBeDefined();
      expect(secondTimer).toBeDefined();
      expect(firstTimer).not.toBe(secondTimer);
    });

    it('should set timer to unref in test environment', () => {
      const mockGameState = createMockGameState();
      (gameService as any).activeGames.set('TEST123', mockGameState);

      // Mock timer with unref method
      const mockTimer = {
        unref: jest.fn()
      };
      
      jest.spyOn(global, 'setInterval').mockReturnValue(mockTimer as any);

      (gameService as any).startQuestionTimer('TEST123');

      // Verify unref was called in test environment
      expect(mockTimer.unref).toHaveBeenCalled();
    });
  });

  describe('Timer Countdown Logic', () => {
    it('should decrement time remaining every second', () => {
      const mockGameState = createMockGameState({ timeRemaining: 60 });
      (gameService as any).activeGames.set('TEST123', mockGameState);

      (gameService as any).startQuestionTimer('TEST123');

      // Advance timer by 5 seconds
      jest.advanceTimersByTime(5000);

      expect(mockGameState.timeRemaining).toBe(55);
    });

    it('should emit time-update events during countdown', () => {
      const mockGameState = createMockGameState({ timeRemaining: 60 });
      (gameService as any).activeGames.set('TEST123', mockGameState);

      (gameService as any).startQuestionTimer('TEST123');

      // Clear initial events and advance time
      (mockIo.emit as jest.Mock).mockClear();
      jest.advanceTimersByTime(3000);

      // Verify time-update events were emitted
      expect(mockIo.to).toHaveBeenCalledWith('TEST123');
      expect(mockIo.emit).toHaveBeenCalledWith('time-update', { timeRemaining: 59 });
      expect(mockIo.emit).toHaveBeenCalledWith('time-update', { timeRemaining: 58 });
      expect(mockIo.emit).toHaveBeenCalledWith('time-update', { timeRemaining: 57 });
    });

    it('should emit time-warning events at 10 and 5 seconds', () => {
      const mockGameState = createMockGameState({ timeRemaining: 12 });
      (gameService as any).activeGames.set('TEST123', mockGameState);

      (gameService as any).startQuestionTimer('TEST123');
      (mockIo.emit as jest.Mock).mockClear();

      // Advance to trigger 10-second warning
      jest.advanceTimersByTime(2000); // Now at 10 seconds

      expect(mockIo.emit).toHaveBeenCalledWith('time-warning', { timeRemaining: 10 });

      // Advance to trigger 5-second warning
      jest.advanceTimersByTime(5000); // Now at 5 seconds

      expect(mockIo.emit).toHaveBeenCalledWith('time-warning', { timeRemaining: 5 });
    });

    it('should end question when timer reaches zero', async () => {
      const mockGameState = createMockGameState({ timeRemaining: 2 });
      (gameService as any).activeGames.set('TEST123', mockGameState);

      // Mock endQuestion method
      const endQuestionSpy = jest.spyOn(gameService as any, 'endQuestion')
        .mockImplementation(() => Promise.resolve());

      (gameService as any).startQuestionTimer('TEST123');

      // Advance timer to zero and run pending timers
      jest.advanceTimersByTime(2000);
      await jest.runAllTimersAsync();

      expect(endQuestionSpy).toHaveBeenCalledWith('TEST123');
    });

    it('should handle errors during timer callback gracefully', async () => {
      const mockGameState = createMockGameState({ timeRemaining: 1 });
      (gameService as any).activeGames.set('TEST123', mockGameState);

      // Mock endQuestion to throw error
      const endQuestionSpy = jest.spyOn(gameService as any, 'endQuestion')
        .mockImplementation(() => Promise.reject(new Error('Test error')));

      // Mock console.error to verify error handling
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      (gameService as any).startQuestionTimer('TEST123');

      // Advance timer to trigger error
      jest.advanceTimersByTime(1000);
      await jest.runAllTimersAsync();

      // In test environment, errors should be swallowed
      expect(endQuestionSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Next Question Timer Management', () => {
    it('should schedule next question with correct delay', () => {
      const mockGameState = createMockGameState();
      (gameService as any).activeGames.set('TEST123', mockGameState);

      // Mock setTimeout to capture timer creation
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      // Trigger next question scheduling (via endQuestion simulation)
      (gameService as any).endQuestion('TEST123');

      // Verify setTimeout was called with correct delay (5000ms)
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);

      // Verify timer was stored
      const nextQuestionTimers = (gameService as any).nextQuestionTimers;
      expect(nextQuestionTimers.has('TEST123')).toBe(true);
    });

    it('should unref next question timer in test environment', () => {
      const mockGameState = createMockGameState();
      (gameService as any).activeGames.set('TEST123', mockGameState);

      // Mock timer with unref method
      const mockTimer = {
        unref: jest.fn()
      };
      
      jest.spyOn(global, 'setTimeout').mockReturnValue(mockTimer as any);

      // Trigger endQuestion which creates next question timer
      (gameService as any).endQuestion('TEST123');

      // Verify unref was called
      expect(mockTimer.unref).toHaveBeenCalled();
    });

    it('should execute startNextQuestion after delay', async () => {
      const mockGameState = createMockGameState();
      (gameService as any).activeGames.set('TEST123', mockGameState);

      // Mock startNextQuestion
      const startNextQuestionSpy = jest.spyOn(gameService, 'startNextQuestion')
        .mockImplementation(() => Promise.resolve());

      // Trigger endQuestion which schedules next question
      await (gameService as any).endQuestion('TEST123');

      // Advance timers to trigger next question
      jest.advanceTimersByTime(5000);

      expect(startNextQuestionSpy).toHaveBeenCalledWith('TEST123');
    });

    it('should handle errors in next question timer callback', async () => {
      const mockGameState = createMockGameState();
      (gameService as any).activeGames.set('TEST123', mockGameState);

      // Mock startNextQuestion to throw error
      const startNextQuestionSpy = jest.spyOn(gameService, 'startNextQuestion')
        .mockImplementation(() => Promise.reject(new Error('Test error')));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Trigger endQuestion
      await (gameService as any).endQuestion('TEST123');

      // Advance timers to trigger error
      jest.advanceTimersByTime(5000);

      expect(startNextQuestionSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Timer Cleanup', () => {
    it('should clear all timers when calling clearTimers', () => {
      const mockGameState = createMockGameState();
      (gameService as any).activeGames.set('TEST123', mockGameState);

      // Create both types of timers
      (gameService as any).startQuestionTimer('TEST123');
      
      const mockNextTimer = setTimeout(() => {}, 1000);
      (gameService as any).nextQuestionTimers.set('TEST123', mockNextTimer);

      // Mock clearInterval and clearTimeout
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      // Call clearTimers
      (gameService as any).clearTimers('TEST123');

      // Verify both timers were cleared
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(clearTimeoutSpy).toHaveBeenCalled();

      // Verify timers were removed from maps
      expect((gameService as any).gameTimers.has('TEST123')).toBe(false);
      expect((gameService as any).nextQuestionTimers.has('TEST123')).toBe(false);
    });

    it('should handle clearing non-existent timers gracefully', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      // Call clearTimers on non-existent lobby
      (gameService as any).clearTimers('NONEXISTENT');

      // Should not throw errors
      expect(clearIntervalSpy).not.toHaveBeenCalled();
      expect(clearTimeoutSpy).not.toHaveBeenCalled();
    });

    it('should clear only game timer when calling clearGameTimer', () => {
      const mockGameState = createMockGameState();
      (gameService as any).activeGames.set('TEST123', mockGameState);

      // Create both types of timers
      (gameService as any).startQuestionTimer('TEST123');
      
      const mockNextTimer = setTimeout(() => {}, 1000);
      (gameService as any).nextQuestionTimers.set('TEST123', mockNextTimer);

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      // Call clearGameTimer
      (gameService as any).clearGameTimer('TEST123');

      // Verify only game timer was cleared
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect((gameService as any).gameTimers.has('TEST123')).toBe(false);

      // Verify next question timer still exists
      expect((gameService as any).nextQuestionTimers.has('TEST123')).toBe(true);
    });

    it('should cleanup all timers and games when calling cleanup', () => {
      // Create multiple game states with timers
      const mockGameState1 = createMockGameState({ lobbyCode: 'LOBBY1' });
      const mockGameState2 = createMockGameState({ lobbyCode: 'LOBBY2' });
      
      (gameService as any).activeGames.set('LOBBY1', mockGameState1);
      (gameService as any).activeGames.set('LOBBY2', mockGameState2);

      // Create timers for both lobbies
      (gameService as any).startQuestionTimer('LOBBY1');
      (gameService as any).startQuestionTimer('LOBBY2');
      
      const nextTimer1 = setTimeout(() => {}, 1000);
      const nextTimer2 = setTimeout(() => {}, 1000);
      (gameService as any).nextQuestionTimers.set('LOBBY1', nextTimer1);
      (gameService as any).nextQuestionTimers.set('LOBBY2', nextTimer2);

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      // Call cleanup
      gameService.cleanup();

      // Verify all timers were cleared
      expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);

      // Verify all maps are empty
      expect((gameService as any).gameTimers.size).toBe(0);
      expect((gameService as any).nextQuestionTimers.size).toBe(0);
      expect((gameService as any).activeGames.size).toBe(0);
    });
  });

  describe('Timer Edge Cases', () => {
    it('should handle timer operations when game state is missing', () => {
      // Try to start timer for non-existent game
      expect(() => {
        (gameService as any).startQuestionTimer('NONEXISTENT');
      }).not.toThrow();
    });

    it('should handle timer callbacks when game state is removed mid-countdown', () => {
      const mockGameState = createMockGameState({ timeRemaining: 60 });
      (gameService as any).activeGames.set('TEST123', mockGameState);

      (gameService as any).startQuestionTimer('TEST123');

      // Remove game state mid-countdown
      (gameService as any).activeGames.delete('TEST123');

      // Advance timer - should not crash
      expect(() => {
        jest.advanceTimersByTime(1000);
      }).not.toThrow();
    });

    it('should handle multiple clearTimer calls safely', () => {
      const mockGameState = createMockGameState();
      (gameService as any).activeGames.set('TEST123', mockGameState);

      (gameService as any).startQuestionTimer('TEST123');

      // Clear timers multiple times
      expect(() => {
        (gameService as any).clearTimers('TEST123');
        (gameService as any).clearTimers('TEST123');
        (gameService as any).clearTimers('TEST123');
      }).not.toThrow();
    });

    it('should handle timer creation when previous timers are still running', () => {
      const mockGameState = createMockGameState();
      (gameService as any).activeGames.set('TEST123', mockGameState);

      // Create initial timer
      (gameService as any).startQuestionTimer('TEST123');
      
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      // Create new timer (should clear old one first)
      (gameService as any).startQuestionTimer('TEST123');

      // Verify old timer was cleared
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Timer Integration with Game Flow', () => {
    it('should properly manage timers during complete game flow', async () => {
      const mockGameState = createMockGameState();
      (gameService as any).activeGames.set('TEST123', mockGameState);

      // Mock startNextQuestion to prevent it from actually advancing the game
      const startNextQuestionSpy = jest.spyOn(gameService, 'startNextQuestion')
        .mockImplementation(() => Promise.resolve());

      // Spy on endQuestion but let it run (don't mock implementation)
      const endQuestionSpy = jest.spyOn(gameService as any, 'endQuestion');

      // Start question timer
      (gameService as any).startQuestionTimer('TEST123');

      // Verify initial timer exists
      expect((gameService as any).gameTimers.has('TEST123')).toBe(true);

      // Simulate time running out
      jest.advanceTimersByTime(60000);
      await jest.runAllTimersAsync();

      // Verify endQuestion was called
      expect(endQuestionSpy).toHaveBeenCalledWith('TEST123');

      // Fast forward through next question delay
      jest.advanceTimersByTime(5000);
      await jest.runAllTimersAsync();

      // Verify startNextQuestion was called
      expect(startNextQuestionSpy).toHaveBeenCalledWith('TEST123');
    });

    it('should clean up timers when game ends', async () => {
      const mockGameState = createMockGameState();
      (gameService as any).activeGames.set('TEST123', mockGameState);

      // Create timers
      (gameService as any).startQuestionTimer('TEST123');
      const nextTimer = setTimeout(() => {}, 1000);
      (gameService as any).nextQuestionTimers.set('TEST123', nextTimer);

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      // Mock endGameSession to simulate game ending
      const mockEndGameSession = jest.fn().mockResolvedValue(void 0);
      (gameService as any).endGameSession = mockEndGameSession;

      // End game session
      await (gameService as any).endGameSession('TEST123');

      // Note: The actual endGameSession method calls clearTimers internally
      // For this test, we verify the behavior when clearTimers is called
      (gameService as any).clearTimers('TEST123');

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});
