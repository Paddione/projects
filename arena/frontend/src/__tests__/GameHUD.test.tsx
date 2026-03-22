import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameHUD } from '../components/GameHUD';

vi.mock('../stores/gameStore', () => ({
  useGameStore: vi.fn(() => ({
    playerId: 'p1',
    hp: 2,
    hasArmor: true,
    kills: 3,
    deaths: 1,
    weaponType: 'pistol',
    killfeed: [{ killer: 'Alice', victim: 'Bob', weapon: 'pistol', timestamp: 1 }],
    announcement: null,
    currentRound: 2,
    isSpectating: false,
    spectatedPlayerId: null,
  })),
}));

vi.mock('../services/SoundService', () => ({
  SoundService: {
    toggleMute: vi.fn(() => false),
    isMuted: false,
    getVolumes: vi.fn(() => ({ master: 0.7, sfx: 0.5, music: 0.35 })),
    setMasterVolume: vi.fn(),
    setSFXVolume: vi.fn(),
    setMusicVolume: vi.fn(),
  },
}));

vi.mock('../components/EmoteWheel', () => ({
  default: () => null,
}));

describe('GameHUD', () => {
  const defaultProps = {
    gameStateRef: { current: { players: [{ id: 'p1', weapons: [{ type: 'pistol' }], activeWeaponIndex: 0 }] } },
    isTouchDevice: false,
    leftPuck: { x: 0, y: 0 },
    rightPuck: { x: 0, y: 0 },
    sprintOn: false,
    meleeOn: false,
    onEmote: vi.fn(),
    onMelee: vi.fn(),
    onSprint: vi.fn(),
    onWeaponCycle: vi.fn(),
    rightStickRef: { current: { active: false } },
  };

  it('renders health display with armor shield', () => {
    render(<GameHUD {...defaultProps} />);
    expect(screen.getByText('🛡️')).toBeTruthy();
  });

  it('renders killfeed entries', () => {
    render(<GameHUD {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('renders round info with kills and deaths', () => {
    render(<GameHUD {...defaultProps} />);
    expect(screen.getByText(/Round 2/)).toBeTruthy();
    expect(screen.getByText(/K: 3/)).toBeTruthy();
  });
});
