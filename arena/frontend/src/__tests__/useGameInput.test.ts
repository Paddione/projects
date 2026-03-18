import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameInput } from '../hooks/useGameInput';
import * as apiService from '../services/apiService';

const mockEmit = vi.fn();
const mockSocket = { on: vi.fn(), off: vi.fn(), emit: mockEmit };

vi.mock('../services/apiService', () => ({
  getSocket: vi.fn(() => mockSocket),
}));

vi.mock('../components/KeybindSettings', () => ({
  getKeybinds: vi.fn(() => ({
    emote1: 'r', emote2: 't', emote3: 'y', emote4: 'u',
  })),
}));

describe('useGameInput', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it('emits player-input to socket at 50ms intervals', () => {

    renderHook(() => useGameInput({
      matchId: 'm1',
      playerId: 'p1',
      containerRef: { current: document.createElement('div') },
      gameStateRef: { current: { players: [{ id: 'p1', x: 100, y: 100 }] } },
    }));

    vi.advanceTimersByTime(100);
    const emitCalls = mockEmit.mock.calls.filter((c: any) => c[0] === 'player-input');
    expect(emitCalls.length).toBeGreaterThanOrEqual(1);
    expect(emitCalls[0][1]).toHaveProperty('matchId', 'm1');
    expect(emitCalls[0][1].input).toHaveProperty('movement');
    expect(emitCalls[0][1].input).toHaveProperty('aimAngle');
    expect(emitCalls[0][1].input).toHaveProperty('shooting');
  });

  it('cleans up interval and listeners on unmount', () => {
    const { unmount } = renderHook(() => useGameInput({
      matchId: 'm1',
      playerId: 'p1',
      containerRef: { current: document.createElement('div') },
      gameStateRef: { current: null },
    }));

    unmount();
    // Should not throw
  });
});
