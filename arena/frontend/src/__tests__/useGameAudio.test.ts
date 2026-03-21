import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameAudio } from '../hooks/useGameAudio';
import { SoundService } from '../services/SoundService';

vi.mock('../services/SoundService', () => ({
  SoundService: {
    playSFX: vi.fn(),
    playMusic: vi.fn(),
    stopMusic: vi.fn(),
  },
}));

describe('useGameAudio', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it('does not start battle music on mount (round-start event handles it)', () => {
    renderHook(() => useGameAudio({
      mouseRef: { current: { down: false, rightDown: false } },
      keysRef: { current: new Set() },
    }));
    expect(SoundService.playMusic).not.toHaveBeenCalled();
  });

  it('stops music on unmount', () => {
    const { unmount } = renderHook(() => useGameAudio({
      mouseRef: { current: { down: false, rightDown: false } },
      keysRef: { current: new Set() },
    }));
    unmount();
    expect(SoundService.stopMusic).toHaveBeenCalled();
  });

  it('plays gunshot SFX when mouse is down', () => {
    const mouseRef = { current: { down: true, rightDown: false } };
    renderHook(() => useGameAudio({
      mouseRef,
      keysRef: { current: new Set() },
    }));
    vi.advanceTimersByTime(300);
    expect(SoundService.playSFX).toHaveBeenCalledWith('gunshot', { volume: 0.35 });
  });
});
