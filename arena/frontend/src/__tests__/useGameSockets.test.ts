import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameSockets } from '../hooks/useGameSockets';
import { getSocket } from '../services/apiService';

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};

vi.mock('../services/apiService', () => ({
  getSocket: vi.fn(),
}));

vi.mock('../services/SoundService', () => ({
  SoundService: {
    playSFX: vi.fn(),
    playMusic: vi.fn(),
    stopMusic: vi.fn(),
    playSting: vi.fn(),
  },
}));

vi.mock('../stores/gameStore', () => ({
  useGameStore: vi.fn(() => ({
    setPlayerState: vi.fn(),
    addKillfeed: vi.fn(),
    setAnnouncement: vi.fn(),
    setRound: vi.fn(),
    setRoundScores: vi.fn(),
    setSpectating: vi.fn(),
    setSpectatedPlayer: vi.fn(),
    endMatch: vi.fn(),
  })),
}));

describe('useGameSockets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSocket).mockReturnValue(mockSocket as any);
  });

  it('registers all 11 socket event listeners on mount', () => {
    renderHook(() => useGameSockets({
      playerId: 'p1',
      navigate: vi.fn(),
      gameStateRef: { current: null },
      activeEmotesRef: { current: new Map() },
    }));

    const registeredEvents = mockSocket.on.mock.calls.map((c: any) => c[0]);
    expect(registeredEvents).toContain('game-state');
    expect(registeredEvents).toContain('player-killed');
    expect(registeredEvents).toContain('player-hit');
    expect(registeredEvents).toContain('item-spawned');
    expect(registeredEvents).toContain('item-collected');
    expect(registeredEvents).toContain('round-end');
    expect(registeredEvents).toContain('round-start');
    expect(registeredEvents).toContain('zone-shrink');
    expect(registeredEvents).toContain('match-end');
    expect(registeredEvents).toContain('spectate-start');
    expect(registeredEvents).toContain('player-emote');
  });

  it('cleans up all listeners on unmount', () => {
    const { unmount } = renderHook(() => useGameSockets({
      playerId: 'p1',
      navigate: vi.fn(),
      gameStateRef: { current: null },
      activeEmotesRef: { current: new Map() },
    }));

    unmount();
    const removedEvents = mockSocket.off.mock.calls.map((c: any) => c[0]);
    expect(removedEvents).toContain('game-state');
    expect(removedEvents).toContain('player-hit');
    expect(removedEvents).toContain('zone-shrink');
  });
});
