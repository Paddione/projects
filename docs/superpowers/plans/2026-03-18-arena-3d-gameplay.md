# Arena 3D Gameplay — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Arena 3D renderer (`Game3D.tsx`) a fully playable replacement for the 2D renderer — with input handling, HUD, sound, all socket events, emotes, and touch controls.

**Architecture:** Game3D.tsx is currently a rendering-only viewport (251 lines). The 2D Game.tsx (1,383 lines) handles input, HUD, sound, emotes, and 11 socket events. Rather than duplicating all that logic, we extract shared concerns (input, HUD, sound hooks) into reusable modules that both renderers consume. Game3D gains a React HUD overlay on top of the Three.js canvas, reuses the same socket event handlers, and plugs into the same input→socket pipeline.

**Tech Stack:** React 18, Three.js 0.170, Socket.io, Howler.js (SoundService), shared-3d package

**Spec:** Gap analysis from 2026-03-18 review session

---

## File Structure

```
arena/frontend/src/
├── hooks/
│   ├── useGameInput.ts          # CREATE: Keyboard + mouse + touch input → socket emission
│   ├── useGameSockets.ts        # CREATE: All 11 socket event listeners + sound triggers
│   └── useGameAudio.ts          # CREATE: Music lifecycle + shooting SFX detection loop
├── components/
│   ├── GameHUD.tsx              # CREATE: HUD overlay (health, killfeed, weapon, round, spectator)
│   ├── Game3D.tsx               # MODIFY: Add HUD, input hooks, audio hooks
│   └── Game.tsx                 # MODIFY: Replace inline logic with shared hooks (parity refactor)
├── services/
│   └── SoundService.ts          # READ ONLY (no changes needed)
└── stores/
    └── gameStore.ts             # READ ONLY (no changes needed)
```

**Design principle:** Extract, don't duplicate. Each hook is self-contained with clear inputs/outputs. Game.tsx and Game3D.tsx both call the same hooks, ensuring feature parity by construction.

---

## Chunk 1: Shared Hooks (Input + Sockets + Audio)

### Task 1: Extract `useGameSockets` hook

All 11 socket event listeners + SoundService calls extracted from Game.tsx lines 1014-1130.

**Files:**
- Create: `arena/frontend/src/hooks/useGameSockets.ts`
- Test: `arena/frontend/src/__tests__/useGameSockets.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// arena/frontend/src/__tests__/useGameSockets.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameSockets } from '../hooks/useGameSockets';

// Mock dependencies
vi.mock('../services/apiService', () => ({
  getSocket: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  })),
}));

vi.mock('../services/SoundService', () => ({
  SoundService: {
    playSFX: vi.fn(),
    playMusic: vi.fn(),
    stopMusic: vi.fn(),
    playSting: vi.fn(),
  },
}));

describe('useGameSockets', () => {
  it('registers all 11 socket event listeners on mount', () => {
    const { getSocket } = require('../services/apiService');
    const mockSocket = getSocket();

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
    const { getSocket } = require('../services/apiService');
    const mockSocket = getSocket();

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd arena/frontend && npx vitest run src/__tests__/useGameSockets.test.ts`
Expected: FAIL — module `../hooks/useGameSockets` not found

- [ ] **Step 3: Write the `useGameSockets` hook**

```typescript
// arena/frontend/src/hooks/useGameSockets.ts
import { useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { getSocket } from '../services/apiService';
import { SoundService } from '../services/SoundService';
import type { MutableRefObject } from 'react';
import type { NavigateFunction } from 'react-router-dom';

interface UseGameSocketsOptions {
  playerId: string | null;
  navigate: NavigateFunction;
  gameStateRef: MutableRefObject<any>;
  activeEmotesRef: MutableRefObject<Map<string, { emoteId: string; expiresAt: number }>>;
}

export function useGameSockets({
  playerId,
  navigate,
  gameStateRef,
  activeEmotesRef,
}: UseGameSocketsOptions) {
  const {
    setPlayerState, addKillfeed, setAnnouncement, setRound, setRoundScores,
    setSpectating, setSpectatedPlayer, endMatch,
  } = useGameStore();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('game-state', (state: any) => {
      gameStateRef.current = state;
      const me = state.players?.find((p: any) => p.id === playerId);
      if (me) {
        setPlayerState({
          hp: me.hp,
          hasArmor: me.hasArmor,
          isAlive: me.isAlive,
          kills: me.kills,
          deaths: me.deaths,
          weaponType: me.weapon?.type || 'pistol',
        });
      }
    });

    socket.on('player-killed', (data: any) => {
      const state = gameStateRef.current;
      const killer = state?.players?.find((p: any) => p.id === data.killerId);
      const victim = state?.players?.find((p: any) => p.id === data.victimId);
      addKillfeed({
        killer: data.killerName || killer?.username || data.killerId,
        victim: data.victimName || victim?.username || data.victimId,
        weapon: data.weapon,
      });
      SoundService.playSFX('player_death');
      if (data.weapon === 'melee') SoundService.playSFX('melee_hit');
    });

    socket.on('player-hit', () => {
      SoundService.playSFX('player_hit');
    });

    socket.on('item-spawned', (data: any) => {
      setAnnouncement(data.announcement);
      setTimeout(() => setAnnouncement(null), 3000);
    });

    socket.on('item-collected', (data: any) => {
      if (data.type === 'health') SoundService.playSFX('health_pickup');
      else if (data.type === 'armor') SoundService.playSFX('armor_pickup');
    });

    socket.on('round-end', (data: any) => {
      setRoundScores(data.scores);
      const state = gameStateRef.current;
      const winner = state?.players?.find((p: any) => p.id === data.winnerId);
      setAnnouncement(`🏆 ${winner?.username || 'Unknown'} wins Round ${data.roundNumber}!`);
      SoundService.playSFX('round_end');
      setTimeout(() => setAnnouncement(null), 4000);
    });

    socket.on('round-start', (data: any) => {
      setRound(data.roundNumber);
      setAnnouncement(`Round ${data.roundNumber} — FIGHT!`);
      SoundService.playSFX('round_start');
      SoundService.playMusic('battle', { loop: true, volume: 0.5 });
      setTimeout(() => setAnnouncement(null), 2000);
    });

    socket.on('zone-shrink', () => {
      SoundService.playSFX('zone_warning');
    });

    socket.on('match-end', (data: any) => {
      const winner = data.results?.find((r: any) => r.placement === 1);
      const isWinner = winner?.playerId === playerId;
      setAnnouncement(`🎉 ${winner?.username || 'Unknown'} wins the match!`);
      SoundService.stopMusic(500);
      setTimeout(() => SoundService.playSting(isWinner ? 'victory' : 'defeat'), 600);
      setTimeout(() => {
        endMatch();
        navigate(data.dbMatchId ? `/results/${data.dbMatchId}` : '/');
      }, 8000);
    });

    socket.on('spectate-start', (data: any) => {
      setSpectating(true);
      setSpectatedPlayer(data.targetPlayerId);
    });

    socket.on('player-emote', (data: { playerId: string; emoteId: string }) => {
      activeEmotesRef.current.set(data.playerId, {
        emoteId: data.emoteId,
        expiresAt: Date.now() + 2000,
      });
    });

    return () => {
      socket.off('game-state');
      socket.off('player-killed');
      socket.off('player-hit');
      socket.off('item-spawned');
      socket.off('item-collected');
      socket.off('round-end');
      socket.off('round-start');
      socket.off('zone-shrink');
      socket.off('match-end');
      socket.off('spectate-start');
      socket.off('player-emote');
    };
  }, [playerId]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd arena/frontend && npx vitest run src/__tests__/useGameSockets.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add arena/frontend/src/hooks/useGameSockets.ts arena/frontend/src/__tests__/useGameSockets.test.ts
git commit -m "feat(arena): extract useGameSockets hook from Game.tsx"
```

---

### Task 2: Extract `useGameInput` hook

Keyboard + mouse + touch input handling extracted from Game.tsx lines 112-340. Emits `player-input` every 50ms and `emote` on hotkey.

**Files:**
- Create: `arena/frontend/src/hooks/useGameInput.ts`
- Test: `arena/frontend/src/__tests__/useGameInput.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// arena/frontend/src/__tests__/useGameInput.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameInput } from '../hooks/useGameInput';

vi.mock('../services/apiService', () => ({
  getSocket: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  })),
}));

describe('useGameInput', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('emits player-input to socket at 50ms intervals', () => {
    const { getSocket } = require('../services/apiService');
    const mockSocket = getSocket();

    renderHook(() => useGameInput({
      matchId: 'm1',
      playerId: 'p1',
      containerRef: { current: document.createElement('div') },
      gameStateRef: { current: { players: [{ id: 'p1', x: 100, y: 100 }] } },
    }));

    vi.advanceTimersByTime(100); // 2 intervals
    const emitCalls = mockSocket.emit.mock.calls.filter((c: any) => c[0] === 'player-input');
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
    // Should not throw — interval and listeners removed
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd arena/frontend && npx vitest run src/__tests__/useGameInput.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the `useGameInput` hook**

```typescript
// arena/frontend/src/hooks/useGameInput.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '../services/apiService';
import { getKeybinds } from '../components/KeybindSettings';
import type { MutableRefObject, RefObject } from 'react';

const JOYSTICK_RADIUS = 50;

interface UseGameInputOptions {
  matchId: string | undefined;
  playerId: string | null;
  containerRef: RefObject<HTMLDivElement | null>;
  gameStateRef: MutableRefObject<any>;
}

export interface InputState {
  keysRef: MutableRefObject<Set<string>>;
  mouseRef: MutableRefObject<{ x: number; y: number; down: boolean; rightDown: boolean }>;
  leftPuck: { x: number; y: number };
  rightPuck: { x: number; y: number };
  sprintOn: boolean;
  meleeOn: boolean;
  isTouchDevice: boolean;
  weaponCycleRef: MutableRefObject<number>;
  leftStickRef: MutableRefObject<any>;
  rightStickRef: MutableRefObject<any>;
  sprintActiveRef: MutableRefObject<boolean>;
  meleeActiveRef: MutableRefObject<boolean>;
  setLeftPuck: (v: { x: number; y: number }) => void;
  setRightPuck: (v: { x: number; y: number }) => void;
  setSprintOn: (v: boolean) => void;
  setMeleeOn: (v: boolean) => void;
  handleEmote: (emoteId: string) => void;
}

export function useGameInput({
  matchId,
  playerId,
  containerRef,
  gameStateRef,
}: UseGameInputOptions): InputState {
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef({ x: 0, y: 0, down: false, rightDown: false });
  const weaponCycleRef = useRef(0);
  const leftStickRef = useRef({ active: false, startX: 0, startY: 0, dx: 0, dy: 0, touchId: -1 });
  const rightStickRef = useRef({ active: false, startX: 0, startY: 0, dx: 0, dy: 0, touchId: -1, firing: false });
  const sprintActiveRef = useRef(false);
  const meleeActiveRef = useRef(false);

  const [leftPuck, setLeftPuck] = useState({ x: 0, y: 0 });
  const [rightPuck, setRightPuck] = useState({ x: 0, y: 0 });
  const [sprintOn, setSprintOn] = useState(false);
  const [meleeOn, setMeleeOn] = useState(false);

  const handleEmote = useCallback((emoteId: string) => {
    const socket = getSocket();
    socket.emit('emote', { emoteId });
  }, []);

  // Keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key.toLowerCase() === 'q') weaponCycleRef.current = 1;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Mouse listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) mouseRef.current.down = true;
      if (e.button === 2) mouseRef.current.rightDown = true;
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseRef.current.down = false;
      if (e.button === 2) mouseRef.current.rightDown = false;
    };
    const handleContextMenu = (e: Event) => e.preventDefault();
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      weaponCycleRef.current = e.deltaY > 0 ? 1 : -1;
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [containerRef]);

  // Touch listeners
  useEffect(() => {
    if (!isTouchDevice) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const halfW = window.innerWidth / 2;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const target = t.target as HTMLElement;
        if (target.closest('.touch-action-buttons')) continue;

        if (t.clientX < halfW && !leftStickRef.current.active) {
          leftStickRef.current = { active: true, startX: t.clientX, startY: t.clientY, dx: 0, dy: 0, touchId: t.identifier };
        } else if (t.clientX >= halfW && !rightStickRef.current.active) {
          rightStickRef.current = { active: true, startX: t.clientX, startY: t.clientY, dx: 0, dy: 0, touchId: t.identifier, firing: false };
          mouseRef.current.down = true;
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const ls = leftStickRef.current;
        const rs = rightStickRef.current;
        if (ls.active && t.identifier === ls.touchId) {
          const rawDx = t.clientX - ls.startX;
          const rawDy = t.clientY - ls.startY;
          const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
          const clamp = Math.min(dist, JOYSTICK_RADIUS);
          ls.dx = dist > 0 ? (rawDx / dist) * clamp : 0;
          ls.dy = dist > 0 ? (rawDy / dist) * clamp : 0;
          setLeftPuck({ x: ls.dx, y: ls.dy });
        }
        if (rs.active && t.identifier === rs.touchId) {
          const rawDx = t.clientX - rs.startX;
          const rawDy = t.clientY - rs.startY;
          const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
          const clamp = Math.min(dist, JOYSTICK_RADIUS);
          rs.dx = dist > 0 ? (rawDx / dist) * clamp : 0;
          rs.dy = dist > 0 ? (rawDy / dist) * clamp : 0;
          setRightPuck({ x: rs.dx, y: rs.dy });
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (leftStickRef.current.active && t.identifier === leftStickRef.current.touchId) {
          leftStickRef.current = { active: false, startX: 0, startY: 0, dx: 0, dy: 0, touchId: -1 };
          setLeftPuck({ x: 0, y: 0 });
        }
        if (rightStickRef.current.active && t.identifier === rightStickRef.current.touchId) {
          rightStickRef.current = { active: false, startX: 0, startY: 0, dx: 0, dy: 0, touchId: -1, firing: false };
          mouseRef.current.down = false;
          setRightPuck({ x: 0, y: 0 });
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isTouchDevice]);

  // Input emission loop (50ms interval)
  useEffect(() => {
    const socket = getSocket();
    if (!matchId || !playerId) return;

    const inputLoop = setInterval(() => {
      let mx = 0, my = 0;

      if (isTouchDevice && leftStickRef.current.active) {
        const { dx, dy } = leftStickRef.current;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 4) { mx = dx / JOYSTICK_RADIUS; my = dy / JOYSTICK_RADIUS; }
      } else {
        const keys = keysRef.current;
        if (keys.has('w') || keys.has('arrowup')) my = -1;
        if (keys.has('s') || keys.has('arrowdown')) my = 1;
        if (keys.has('a') || keys.has('arrowleft')) mx = -1;
        if (keys.has('d') || keys.has('arrowright')) mx = 1;
        if (mx !== 0 && my !== 0) {
          const len = Math.sqrt(mx * mx + my * my);
          mx /= len; my /= len;
        }
      }

      let aimAngle = 0;
      if (isTouchDevice && rightStickRef.current.active) {
        const { dx, dy } = rightStickRef.current;
        if (Math.sqrt(dx * dx + dy * dy) > 4) aimAngle = Math.atan2(dy, dx);
      } else {
        const mouse = mouseRef.current;
        const state = gameStateRef.current;
        if (state) {
          const me = state.players?.find((p: any) => p.id === playerId);
          if (me) aimAngle = Math.atan2(mouse.y - window.innerHeight / 2, mouse.x - window.innerWidth / 2);
        }
      }

      const shooting = isTouchDevice ? rightStickRef.current.active : mouseRef.current.down;
      const melee = isTouchDevice ? meleeActiveRef.current : (mouseRef.current.rightDown || keysRef.current.has('e'));
      const sprint = isTouchDevice ? sprintActiveRef.current : keysRef.current.has('shift');
      const cycleWeapon = weaponCycleRef.current;
      weaponCycleRef.current = 0;

      socket.emit('player-input', {
        matchId,
        input: {
          movement: { x: mx, y: my },
          aimAngle,
          shooting,
          melee,
          sprint,
          pickup: false,
          cycleWeapon,
          timestamp: Date.now(),
        },
      });
    }, 50);

    return () => clearInterval(inputLoop);
  }, [matchId, playerId, isTouchDevice]);

  // Emote hotkeys
  useEffect(() => {
    const equippedEmotes = ['emote_wave', 'emote_gg', 'emote_thumbsup', 'emote_clap'];
    const handleEmoteKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const binds = getKeybinds();
      const key = e.key.toLowerCase();
      if (key === binds.emote1 && equippedEmotes[0]) handleEmote(equippedEmotes[0]);
      else if (key === binds.emote2 && equippedEmotes[1]) handleEmote(equippedEmotes[1]);
      else if (key === binds.emote3 && equippedEmotes[2]) handleEmote(equippedEmotes[2]);
      else if (key === binds.emote4 && equippedEmotes[3]) handleEmote(equippedEmotes[3]);
    };
    window.addEventListener('keydown', handleEmoteKey);
    return () => window.removeEventListener('keydown', handleEmoteKey);
  }, [handleEmote]);

  return {
    keysRef, mouseRef, leftPuck, rightPuck, sprintOn, meleeOn,
    isTouchDevice, weaponCycleRef,
    leftStickRef, rightStickRef, sprintActiveRef, meleeActiveRef,
    setLeftPuck, setRightPuck, setSprintOn, setMeleeOn,
    handleEmote,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd arena/frontend && npx vitest run src/__tests__/useGameInput.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add arena/frontend/src/hooks/useGameInput.ts arena/frontend/src/__tests__/useGameInput.test.ts
git commit -m "feat(arena): extract useGameInput hook with keyboard, mouse, touch, and emote support"
```

---

### Task 3: Extract `useGameAudio` hook

Music start/stop lifecycle + shooting SFX detection loop from Game.tsx lines 274, 1002, 1165-1177.

**Files:**
- Create: `arena/frontend/src/hooks/useGameAudio.ts`
- Test: `arena/frontend/src/__tests__/useGameAudio.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// arena/frontend/src/__tests__/useGameAudio.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameAudio } from '../hooks/useGameAudio';

vi.mock('../services/SoundService', () => ({
  SoundService: {
    playSFX: vi.fn(),
    playMusic: vi.fn(),
    stopMusic: vi.fn(),
  },
}));

describe('useGameAudio', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts battle music on mount', () => {
    const { SoundService } = require('../services/SoundService');
    renderHook(() => useGameAudio({
      mouseRef: { current: { down: false, rightDown: false } },
      keysRef: { current: new Set() },
    }));
    expect(SoundService.playMusic).toHaveBeenCalledWith('battle', { loop: true, volume: 0.5 });
  });

  it('stops music on unmount', () => {
    const { SoundService } = require('../services/SoundService');
    const { unmount } = renderHook(() => useGameAudio({
      mouseRef: { current: { down: false, rightDown: false } },
      keysRef: { current: new Set() },
    }));
    unmount();
    expect(SoundService.stopMusic).toHaveBeenCalled();
  });

  it('plays gunshot SFX when mouse is down', () => {
    const { SoundService } = require('../services/SoundService');
    const mouseRef = { current: { down: true, rightDown: false, x: 0, y: 0 } };
    renderHook(() => useGameAudio({
      mouseRef,
      keysRef: { current: new Set() },
    }));
    vi.advanceTimersByTime(300);
    expect(SoundService.playSFX).toHaveBeenCalledWith('gunshot', { volume: 0.6 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd arena/frontend && npx vitest run src/__tests__/useGameAudio.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the `useGameAudio` hook**

```typescript
// arena/frontend/src/hooks/useGameAudio.ts
import { useEffect } from 'react';
import { SoundService } from '../services/SoundService';
import type { MutableRefObject } from 'react';

interface UseGameAudioOptions {
  mouseRef: MutableRefObject<{ down: boolean; rightDown: boolean }>;
  keysRef: MutableRefObject<Set<string>>;
}

export function useGameAudio({ mouseRef, keysRef }: UseGameAudioOptions) {
  // Start/stop battle music
  useEffect(() => {
    SoundService.playMusic('battle', { loop: true, volume: 0.5 });
    return () => { SoundService.stopMusic(); };
  }, []);

  // Shooting/melee SFX detection
  useEffect(() => {
    const shootCheck = setInterval(() => {
      if (mouseRef.current.down) {
        SoundService.playSFX('gunshot', { volume: 0.6 });
      }
      if (mouseRef.current.rightDown || keysRef.current.has('e')) {
        SoundService.playSFX('melee_swing', { volume: 0.7 });
      }
    }, 250);
    return () => clearInterval(shootCheck);
  }, [mouseRef, keysRef]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd arena/frontend && npx vitest run src/__tests__/useGameAudio.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add arena/frontend/src/hooks/useGameAudio.ts arena/frontend/src/__tests__/useGameAudio.test.ts
git commit -m "feat(arena): extract useGameAudio hook for music lifecycle and shooting SFX"
```

---

## Chunk 2: GameHUD Component

### Task 4: Create `GameHUD` component

Extracted from Game.tsx lines 1189-1380. A pure React overlay rendering health, killfeed, weapon, round info, announcements, spectating banner, mute/scale controls, touch joysticks, and emote wheel.

**Files:**
- Create: `arena/frontend/src/components/GameHUD.tsx`
- Test: `arena/frontend/src/__tests__/GameHUD.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// arena/frontend/src/__tests__/GameHUD.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameHUD } from '../components/GameHUD';

// Mock stores/services
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
  SoundService: { toggleMute: vi.fn(() => false) },
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
    leftStickRef: { current: { active: false } },
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd arena/frontend && npx vitest run src/__tests__/GameHUD.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the `GameHUD` component**

```tsx
// arena/frontend/src/components/GameHUD.tsx
import { useState, useCallback, type MutableRefObject } from 'react';
import { useGameStore } from '../stores/gameStore';
import { SoundService } from '../services/SoundService';
import EmoteWheel from './EmoteWheel';

export const SCALE_OPTIONS = [
  { key: 'auto', label: 'Auto' },
  { key: '1', label: '1× (720p)' },
  { key: '1.5', label: '1.5× (1080p)' },
  { key: '2', label: '2× (1440p)' },
  { key: '3', label: '3× (4K)' },
] as const;

interface GameHUDProps {
  gameStateRef: MutableRefObject<any>;
  isTouchDevice: boolean;
  leftPuck: { x: number; y: number };
  rightPuck: { x: number; y: number };
  sprintOn: boolean;
  meleeOn: boolean;
  onEmote: (emoteId: string) => void;
  onMelee: (active: boolean) => void;
  onSprint: () => void;
  onWeaponCycle: () => void;
  leftStickRef: MutableRefObject<any>;
  rightStickRef: MutableRefObject<any>;
  /** Optional: only shown in 2D renderer */
  showScaleSelector?: boolean;
  scaleSetting?: string;
  onScaleChange?: (setting: string) => void;
}

const equippedEmotes: [string, string, string, string] = [
  'emote_wave', 'emote_gg', 'emote_thumbsup', 'emote_clap',
];

export function GameHUD({
  gameStateRef,
  isTouchDevice,
  leftPuck,
  rightPuck,
  sprintOn,
  meleeOn,
  onEmote,
  onMelee,
  onSprint,
  onWeaponCycle,
  leftStickRef,
  rightStickRef,
  showScaleSelector = false,
  scaleSetting,
  onScaleChange,
}: GameHUDProps) {
  const {
    playerId, hp, hasArmor, kills, deaths, weaponType,
    killfeed, announcement, currentRound,
    isSpectating, spectatedPlayerId,
  } = useGameStore();

  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = useCallback(() => {
    const nowMuted = SoundService.toggleMute();
    setIsMuted(nowMuted);
  }, []);

  return (
    <>
      <EmoteWheel equippedEmotes={equippedEmotes} onEmote={onEmote} />

      <div className="hud">
        {/* Health Display */}
        <div className="hud-health">
          {hasArmor && <div className="hp-icon armor">🛡️</div>}
          {[...Array(2)].map((_, i) => (
            <div key={i} className={`hp-icon ${i < hp ? 'full' : 'empty'}`}>
              {i < hp ? '❤️' : '💔'}
            </div>
          ))}
        </div>

        {/* Kill Feed */}
        <div className="hud-killfeed">
          {killfeed.map((entry, i) => (
            <div key={entry.timestamp + i} className="killfeed-entry">
              <span className="killer">{entry.killer}</span>
              {' '}
              {entry.weapon === 'melee' ? '🗡️' : entry.weapon === 'zone' ? '☠️' : '🔫'}
              {' '}
              <span className="victim">{entry.victim}</span>
            </div>
          ))}
        </div>

        {/* Weapon Indicator */}
        <div className="hud-weapon">
          {(() => {
            const me = gameStateRef.current?.players?.find((p: any) => p.id === playerId);
            const weapons: any[] = me?.weapons || [{ type: weaponType }];
            const activeIdx = me?.activeWeaponIndex ?? 0;
            const weaponIcons: Record<string, string> = { pistol: '🔫', machine_gun: '🔫', grenade_launcher: '💣' };
            const weaponNames: Record<string, string> = { pistol: 'Pistol', machine_gun: 'MG', grenade_launcher: 'GL' };
            return weapons.map((w: any, i: number) => (
              <div key={i} className={`weapon-slot ${i === activeIdx ? 'active' : ''}`}>
                <span className="weapon-icon">{weaponIcons[w.type] || '?'}</span>
                <span className="weapon-name">{weaponNames[w.type] || w.type}</span>
                {w.type !== 'pistol' && (
                  <span className="weapon-ammo">{w.clipAmmo}/{w.totalAmmo}</span>
                )}
              </div>
            ));
          })()}
          <div className="weapon-hint">Q / Scroll</div>
        </div>

        {/* Round Info */}
        <div className="hud-round">
          Round {currentRound} • K: {kills} D: {deaths}
        </div>

        {/* Announcement */}
        {announcement && <div className="hud-announcement">{announcement}</div>}

        {/* Top-left controls */}
        <div className="hud-top-left">
          <button onClick={toggleMute} className="hud-icon-btn">
            {isMuted ? '🔇' : '🔊'}
          </button>
          {showScaleSelector && scaleSetting && onScaleChange && (
            <div className="scale-selector">
              {SCALE_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => onScaleChange(opt.key)}
                  className={`scale-btn ${scaleSetting === opt.key ? 'active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Spectating Banner */}
        {isSpectating && (
          <div style={{
            position: 'absolute',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 24px',
            background: 'rgba(10, 11, 26, 0.85)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-full)',
            color: 'var(--color-text-secondary)',
            fontWeight: 600,
          }}>
            👀 Spectating {gameStateRef.current?.players?.find(
              (p: any) => p.id === spectatedPlayerId
            )?.username || ''}
          </div>
        )}
      </div>

      {/* Touch Controls */}
      {isTouchDevice && (
        <div className="touch-controls">
          <div className="joystick-zone left">
            <div className="joystick-ring" />
            <div
              className="joystick-puck"
              style={{ transform: `translate(calc(-50% + ${leftPuck.x}px), calc(-50% + ${leftPuck.y}px))` }}
            />
          </div>

          <div className="touch-action-buttons">
            <button
              className={`touch-btn ${meleeOn ? 'active' : ''}`}
              onTouchStart={(e) => { e.preventDefault(); onMelee(true); }}
              onTouchEnd={(e) => { e.preventDefault(); onMelee(false); }}
            >
              🗡️
            </button>
            <button
              className="touch-btn"
              onTouchStart={(e) => { e.preventDefault(); onWeaponCycle(); }}
              onTouchEnd={(e) => { e.preventDefault(); }}
            >
              🔄
            </button>
            <button
              className={`touch-btn ${sprintOn ? 'active' : ''}`}
              onTouchStart={(e) => { e.preventDefault(); onSprint(); }}
              onTouchEnd={(e) => { e.preventDefault(); }}
            >
              {sprintOn ? '⚡' : '⇧'}
            </button>
          </div>

          <div className="joystick-zone right">
            <div className="joystick-ring" />
            <div
              className="joystick-puck"
              style={{
                transform: `translate(calc(-50% + ${rightPuck.x}px), calc(-50% + ${rightPuck.y}px))`,
                background: rightStickRef.current.active ? 'rgba(239, 68, 68, 0.45)' : 'rgba(255, 255, 255, 0.22)',
                borderColor: rightStickRef.current.active ? 'rgba(239, 68, 68, 0.9)' : 'rgba(255, 255, 255, 0.5)',
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd arena/frontend && npx vitest run src/__tests__/GameHUD.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add arena/frontend/src/components/GameHUD.tsx arena/frontend/src/__tests__/GameHUD.test.tsx
git commit -m "feat(arena): create GameHUD component extracted from Game.tsx HUD overlay"
```

---

## Chunk 3: Wire Game3D with Hooks + HUD

### Task 5: Integrate hooks and HUD into Game3D

Replace the socket event handlers in Game3D with useGameSockets, add useGameInput, useGameAudio, and render GameHUD on top of the Three.js canvas.

**Files:**
- Modify: `arena/frontend/src/components/Game3D.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// arena/frontend/src/__tests__/Game3D.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock all heavy deps
vi.mock('three', () => ({
  Clock: vi.fn(() => ({ start: vi.fn(), getDelta: vi.fn(() => 0.016) })),
  Scene: vi.fn(),
  WebGLRenderer: vi.fn(() => ({
    setPixelRatio: vi.fn(), setSize: vi.fn(), render: vi.fn(), dispose: vi.fn(),
    domElement: document.createElement('canvas'), shadowMap: {},
  })),
  Group: vi.fn(() => ({ add: vi.fn() })),
}));
vi.mock('three/addons/renderers/CSS2DRenderer.js', () => ({
  CSS2DRenderer: vi.fn(() => ({
    setSize: vi.fn(), render: vi.fn(), domElement: Object.assign(document.createElement('div'), { style: {} }),
  })),
}));
vi.mock('shared-3d');
vi.mock('../services/GameRenderer3D');
vi.mock('../services/TerrainRenderer');
vi.mock('../services/PlayerRenderer');
vi.mock('../services/ProjectileRenderer');
vi.mock('../services/CoverRenderer');
vi.mock('../services/ItemRenderer');
vi.mock('../services/ZoneRenderer');
vi.mock('../services/LabelRenderer');
vi.mock('../hooks/useGameSockets', () => ({ useGameSockets: vi.fn() }));
vi.mock('../hooks/useGameInput', () => ({
  useGameInput: vi.fn(() => ({
    keysRef: { current: new Set() },
    mouseRef: { current: { down: false, rightDown: false } },
    leftPuck: { x: 0, y: 0 }, rightPuck: { x: 0, y: 0 },
    sprintOn: false, meleeOn: false, isTouchDevice: false,
    weaponCycleRef: { current: 0 },
    leftStickRef: { current: {} }, rightStickRef: { current: {} },
    sprintActiveRef: { current: false }, meleeActiveRef: { current: false },
    setLeftPuck: vi.fn(), setRightPuck: vi.fn(),
    setSprintOn: vi.fn(), setMeleeOn: vi.fn(),
    handleEmote: vi.fn(),
  })),
}));
vi.mock('../hooks/useGameAudio', () => ({ useGameAudio: vi.fn() }));
vi.mock('../stores/gameStore', () => ({
  useGameStore: vi.fn(() => ({
    playerId: 'p1', isSpectating: false, spectatedPlayerId: null, currentRound: 1,
    setPlayerState: vi.fn(), addKillfeed: vi.fn(), setAnnouncement: vi.fn(),
    setRound: vi.fn(), setRoundScores: vi.fn(), setSpectating: vi.fn(),
    setSpectatedPlayer: vi.fn(), endMatch: vi.fn(),
    hp: 2, hasArmor: false, kills: 0, deaths: 0, weaponType: 'pistol',
    killfeed: [], announcement: null,
  })),
}));

import Game3D from '../components/Game3D';

describe('Game3D', () => {
  it('renders container div and HUD', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/game/m1']}>
        <Routes>
          <Route path="/game/:matchId" element={<Game3D />} />
        </Routes>
      </MemoryRouter>
    );
    // Should have the Three.js container div
    expect(container.querySelector('div')).toBeTruthy();
    // Should have HUD class
    expect(container.querySelector('.hud')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd arena/frontend && npx vitest run src/__tests__/Game3D.test.tsx`
Expected: FAIL — `.hud` element not found (Game3D doesn't render HUD yet)

- [ ] **Step 3: Rewrite `Game3D.tsx` with hooks + HUD**

Replace the entire contents of `arena/frontend/src/components/Game3D.tsx`:

```tsx
/**
 * Game3D — Three.js isometric renderer for Arena.
 *
 * Full-featured parallel to Game.tsx: same input handling, HUD, sound, and
 * socket events via shared hooks. The `use3DRenderer` flag in gameStore
 * selects this component over Game.tsx.
 */

import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock } from 'three';
import { useGameStore } from '../stores/gameStore';
import { GameRenderer3D } from '../services/GameRenderer3D';
import { TerrainRenderer } from '../services/TerrainRenderer';
import { PlayerRenderer } from '../services/PlayerRenderer';
import { ProjectileRenderer } from '../services/ProjectileRenderer';
import { CoverRenderer } from '../services/CoverRenderer';
import { ItemRenderer } from '../services/ItemRenderer';
import { ZoneRenderer } from '../services/ZoneRenderer';
import { LabelRenderer } from '../services/LabelRenderer';
import { useGameSockets } from '../hooks/useGameSockets';
import { useGameInput } from '../hooks/useGameInput';
import { useGameAudio } from '../hooks/useGameAudio';
import { GameHUD } from './GameHUD';

export default function Game3D() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const { playerId, isSpectating, spectatedPlayerId, currentRound } = useGameStore();

  // Renderer instances (stable across renders)
  const rendererRef = useRef<GameRenderer3D | null>(null);
  const terrainRef = useRef<TerrainRenderer | null>(null);
  const playerRef = useRef<PlayerRenderer | null>(null);
  const projectileRef = useRef<ProjectileRenderer | null>(null);
  const coverRef = useRef<CoverRenderer | null>(null);
  const itemRef = useRef<ItemRenderer | null>(null);
  const zoneRef = useRef<ZoneRenderer | null>(null);
  const labelRef = useRef<LabelRenderer | null>(null);

  const gameStateRef = useRef<any>(null);
  const terrainBuiltRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const clockRef = useRef(new Clock());
  const activeEmotesRef = useRef<Map<string, { emoteId: string; expiresAt: number }>>(new Map());

  // ---- Shared hooks ----
  const input = useGameInput({ matchId, playerId, containerRef, gameStateRef });

  useGameSockets({ playerId, navigate, gameStateRef, activeEmotesRef });

  useGameAudio({ mouseRef: input.mouseRef, keysRef: input.keysRef });

  // Reset terrain when round changes (useGameSockets updates currentRound via store)
  useEffect(() => {
    terrainBuiltRef.current = false;
    terrainRef.current?.clear();
  }, [currentRound]);

  // ---- Three.js setup ----
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const r = new GameRenderer3D(container);
    rendererRef.current = r;

    terrainRef.current = new TerrainRenderer(r.terrainGroup);
    playerRef.current = new PlayerRenderer(r.playerGroup, r.characterManager);
    projectileRef.current = new ProjectileRenderer(r.projectileGroup);
    coverRef.current = new CoverRenderer(r.coverGroup);
    itemRef.current = new ItemRenderer(r.itemGroup);
    zoneRef.current = new ZoneRenderer(r.zoneGroup);
    labelRef.current = new LabelRenderer(r.playerGroup);

    const resizeObserver = new ResizeObserver(() => r.resize());
    resizeObserver.observe(container);

    clockRef.current.start();
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();
      const state = gameStateRef.current;
      if (!state) { r.render(); return; }

      // Camera follows local player (or spectated player)
      const trackId = isSpectating && spectatedPlayerId ? spectatedPlayerId : playerId;
      const me = state.players?.find((p: any) => p.id === trackId);
      if (me) r.updateCamera(me.x, me.y);

      // Build terrain once when map data is available
      if (!terrainBuiltRef.current && state.map?.tiles) {
        terrainRef.current?.build(state.map.tiles, state.map.width ?? 28, state.map.height ?? 22);
        coverRef.current?.update(state.map.coverObjects ?? []);
        terrainBuiltRef.current = true;
      }

      // Per-frame updates
      const myId = playerId;
      const players = (state.players ?? []).map((p: any) => ({ ...p, isMe: p.id === myId }));

      playerRef.current?.update(players, delta);
      projectileRef.current?.update(state.projectiles ?? []);
      itemRef.current?.update(state.items ?? [], delta);
      zoneRef.current?.update(state.zone, state.map?.width ?? 28, state.map?.height ?? 22, delta);
      labelRef.current?.update(players);

      r.render();
    };
    animate();

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
      terrainRef.current?.dispose();
      playerRef.current?.dispose();
      projectileRef.current?.dispose();
      coverRef.current?.dispose();
      itemRef.current?.dispose();
      zoneRef.current?.dispose();
      labelRef.current?.dispose();
      r.dispose();
      rendererRef.current = null;
      terrainBuiltRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', cursor: input.isTouchDevice ? 'default' : 'crosshair' }}>
      {/* Three.js Canvas */}
      <div
        ref={containerRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* HUD Overlay */}
      <GameHUD
        gameStateRef={gameStateRef}
        isTouchDevice={input.isTouchDevice}
        leftPuck={input.leftPuck}
        rightPuck={input.rightPuck}
        sprintOn={input.sprintOn}
        meleeOn={input.meleeOn}
        onEmote={input.handleEmote}
        onMelee={(active) => {
          input.meleeActiveRef.current = active;
          input.setMeleeOn(active);
        }}
        onSprint={() => {
          input.sprintActiveRef.current = !input.sprintActiveRef.current;
          input.setSprintOn(input.sprintActiveRef.current);
        }}
        onWeaponCycle={() => { input.weaponCycleRef.current = 1; }}
        leftStickRef={input.leftStickRef}
        rightStickRef={input.rightStickRef}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd arena/frontend && npx vitest run src/__tests__/Game3D.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add arena/frontend/src/components/Game3D.tsx arena/frontend/src/__tests__/Game3D.test.tsx
git commit -m "feat(arena): wire Game3D with input, sockets, audio hooks and HUD overlay"
```

---

### Task 6: Refactor Game.tsx to use shared hooks

Replace inline socket, input, and HUD code in Game.tsx with the shared hooks and GameHUD component. This is the largest change — the component shrinks from ~1,383 lines to ~500 (PixiJS render logic stays, everything else is extracted).

**Files:**
- Modify: `arena/frontend/src/components/Game.tsx`

- [ ] **Step 1: Note the existing test baseline**

Run: `cd arena/frontend && npx vitest run`
Record pass count — all existing tests must still pass after refactor.

- [ ] **Step 2: Replace imports and top-level declarations**

In `arena/frontend/src/components/Game.tsx`, replace the imports and remove extracted state. The new top section:

```tsx
import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Application, Container, Graphics, Text, TextStyle,
    Sprite, AnimatedSprite, Texture,
} from 'pixi.js';
import { useGameStore } from '../stores/gameStore';
import { AssetService, type CharacterAnimation } from '../services/AssetService';
import { SoundService } from '../services/SoundService';
import { getSocket } from '../services/apiService';
import LoadingScreen from './LoadingScreen';
import { GameHUD, SCALE_OPTIONS } from './GameHUD';
import { useGameSockets } from '../hooks/useGameSockets';
import { useGameInput } from '../hooks/useGameInput';
import { useGameAudio } from '../hooks/useGameAudio';

const TILE_SIZE = 32;
const TARGET_TILES_VISIBLE = 22;

export function computeScale(setting: string): number {
    if (setting === 'auto') {
        const targetHeight = TARGET_TILES_VISIBLE * TILE_SIZE;
        return Math.max(1, window.innerHeight / targetHeight);
    }
    return parseFloat(setting) || 1;
}

const CHARACTER_COLORS: Record<string, number> = {
    student: 0x00f2ff, student_f: 0x00f2ff,
    researcher: 0x3eff8b, researcher_f: 0x3eff8b,
    professor: 0xbc13fe, professor_f: 0xbc13fe,
    dean: 0xffd700, dean_f: 0xffd700,
    librarian: 0xff6b9d, librarian_f: 0xff6b9d,
};
```

- [ ] **Step 3: Replace the component body — state + hooks section**

Remove all inline state declarations (keysRef, mouseRef, leftStick/rightStick, leftPuck/rightPuck, sprintActive, meleeActive, weaponCycleRef, isMuted, scaleSetting) and all useCallback/useEffect blocks for input, socket events, emote hotkeys, and shooting SFX (lines 56-177 + 1014-1177). Replace with:

```tsx
export default function Game() {
    const { matchId } = useParams<{ matchId: string }>();
    const navigate = useNavigate();
    const canvasRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const gameStateRef = useRef<any>(null);
    const activeEmotesRef = useRef<Map<string, { emoteId: string; expiresAt: number }>>(new Map());

    // Track animated sprites for reuse
    const playerSpritesRef = useRef<Map<string, AnimatedSprite | Sprite>>(new Map());
    const itemSpritesRef = useRef<Map<string, AnimatedSprite | Sprite>>(new Map());
    const footstepTimerRef = useRef(0);

    const [assetsLoaded, setAssetsLoaded] = useState(false);
    const [scaleSetting, setScaleSetting] = useState<string>(
        () => localStorage.getItem('arena-scale') || 'auto'
    );
    const scaleSettingRef = useRef(scaleSetting);

    const handleScaleChange = useCallback((setting: string) => {
        scaleSettingRef.current = setting;
        setScaleSetting(setting);
        localStorage.setItem('arena-scale', setting);
    }, []);

    // Only destructure what Game.tsx itself needs (HUD reads its own store values)
    const { playerId, isSpectating, spectatedPlayerId } = useGameStore();

    const useSprites = AssetService.isLoaded;

    // ---- Shared hooks (replace 600+ lines of inline code) ----
    const input = useGameInput({ matchId, playerId, containerRef: canvasRef, gameStateRef });
    useGameSockets({ playerId, navigate, gameStateRef, activeEmotesRef });
    useGameAudio({ mouseRef: input.mouseRef, keysRef: input.keysRef });

    // Expose socket for E2E test helpers
    const socket = getSocket();
    (window as any).__arenaSocket = socket;
```

- [ ] **Step 4: Keep the PixiJS setup useEffect as-is (lines 238-1007)**

The PixiJS rendering logic (Application creation, render loop, all `render*()` functions, footstep handling) stays unchanged. The only modification is:
- Remove the `inputLoop` setInterval (lines 277-340) — now handled by `useGameInput`
- Remove `SoundService.playMusic('battle', ...)` call (line 274) — now in `useGameAudio`
- Remove `SoundService.stopMusic()` in cleanup (line 1002) — now in `useGameAudio`
- Remove all `window.addEventListener` for keyboard/mouse/touch (lines 960-1000) — now in `useGameInput`
- The render loop's access to `keysRef` and `mouseRef` for footstep audio uses `input.keysRef` and `input.mouseRef` from the hook

- [ ] **Step 5: Replace the JSX return (lines 1189-1383)**

```tsx
    const handleAssetsLoaded = useCallback(() => setAssetsLoaded(true), []);

    if (!assetsLoaded) {
        return <LoadingScreen onLoaded={handleAssetsLoaded} />;
    }

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', cursor: input.isTouchDevice ? 'default' : 'crosshair' }}>
            <div ref={canvasRef} style={{ width: '100%', height: '100%' }} />

            <GameHUD
                gameStateRef={gameStateRef}
                isTouchDevice={input.isTouchDevice}
                leftPuck={input.leftPuck}
                rightPuck={input.rightPuck}
                sprintOn={input.sprintOn}
                meleeOn={input.meleeOn}
                onEmote={input.handleEmote}
                onMelee={(active) => {
                    input.meleeActiveRef.current = active;
                    input.setMeleeOn(active);
                }}
                onSprint={() => {
                    input.sprintActiveRef.current = !input.sprintActiveRef.current;
                    input.setSprintOn(input.sprintActiveRef.current);
                }}
                onWeaponCycle={() => { input.weaponCycleRef.current = 1; }}
                leftStickRef={input.leftStickRef}
                rightStickRef={input.rightStickRef}
                showScaleSelector={true}
                scaleSetting={scaleSetting}
                onScaleChange={handleScaleChange}
            />
        </div>
    );
}
```

- [ ] **Step 6: Run all tests to verify no regressions**

Run: `cd arena/frontend && npx vitest run`
Expected: Same pass count as Step 1. If tests reference removed exports (e.g., `SCALE_OPTIONS` from Game.tsx), update imports to use `GameHUD`.

- [ ] **Step 7: Commit**

```bash
git add arena/frontend/src/components/Game.tsx
git commit -m "refactor(arena): migrate Game.tsx to shared hooks (useGameSockets, useGameInput, useGameAudio, GameHUD)"
```

---

## Chunk 4: L2P Asset Path Fix + Integration Test

### Task 7: Fix L2P asset path inconsistency

Scene components use `/assets/characters/3d/{id}.glb` but nginx serves `/assets/3d/characters/{id}.glb`.

**Files:**
- Modify: `l2p/frontend/src/components/3d/QuizCharacterScene.tsx`
- Modify: `l2p/frontend/src/components/3d/LobbyRoomScene.tsx`
- Modify: `l2p/frontend/src/components/3d/DuelArenaScene.tsx`
- Modify: `l2p/frontend/src/components/3d/PodiumScene.tsx`

- [ ] **Step 1: Search for wrong pattern**

Run: `cd l2p/frontend && grep -rn 'assets/characters/3d' src/components/3d/`
Expected: Matches in QuizCharacterScene, LobbyRoomScene, DuelArenaScene, PodiumScene

- [ ] **Step 2: Fix all occurrences**

In each file, replace `/assets/characters/3d/` with `/assets/3d/characters/`.

This aligns with:
- nginx.conf `location /assets/3d/` → `alias /mnt/pve3a/visual-library/rigged/;`
- Vite proxy rewrite `/assets/3d/\w+/(\w+)\.glb`
- CharacterSelector3D already uses `/assets/3d/characters/`

- [ ] **Step 3: Verify vite proxy matches the corrected pattern**

Check: `l2p/frontend/vite.config.ts` line 273-278 — the regex `/\/assets\/3d\/\w+\/(\w+)\.glb/` should now match all scene component URLs.

- [ ] **Step 4: Commit**

```bash
git add l2p/frontend/src/components/3d/
git commit -m "fix(l2p): align 3D model paths with nginx /assets/3d/ route"
```

---

### Task 8: Add CharacterSelector3D to L2P LobbyPage

`CharacterSelector3D` exists at `l2p/frontend/src/components/CharacterSelector3D.tsx` but is not imported by any page. `CharacterSelector` (2D) also exists but is equally orphaned. LobbyPage currently shows a 3D lobby scene (`LobbyRoomScene`) but has no character **selection** UI. This task adds the 3D character picker above the lobby scene.

**Files:**
- Modify: `l2p/frontend/src/pages/LobbyPage.tsx`

- [ ] **Step 1: Read CharacterSelector3D props interface**

Check: `l2p/frontend/src/components/CharacterSelector3D.tsx` — it expects `{ selectedCharacter: string; onSelect: (id: string) => void }`.

- [ ] **Step 2: Add CharacterSelector3D import and usage**

In `l2p/frontend/src/pages/LobbyPage.tsx`, add the import:

```tsx
import { CharacterSelector3D } from '../components/CharacterSelector3D'
import { useCharacterStore } from '../stores/characterStore'
```

Then add the selector between the lobby header and the 3D lobby scene (before line 197):

```tsx
      {/* 3D character selector */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--spacing-md)' }}>
        <CharacterSelector3D
          selectedCharacter={currentCharacter?.id ?? 'student'}
          onSelect={(characterId) => updateCharacter(characterId)}
        />
      </div>
```

Also destructure from the character store near the top of the component:

```tsx
const { currentCharacter, updateCharacter } = useCharacterStore()
```

- [ ] **Step 3: Run existing L2P tests to confirm no regressions**

Run: `cd l2p/frontend && NODE_ENV=test npx jest --passWithNoTests`
Expected: PASS (CharacterSelector3D is mocked via shared-3d mock in tests)

- [ ] **Step 4: Commit**

```bash
git add l2p/frontend/src/pages/LobbyPage.tsx
git commit -m "feat(l2p): add 3D character picker to lobby page"
```

---

## Chunk 5: Integration Verification

### Task 9: Smoke-test 3D gameplay locally

- [ ] **Step 1: Build and run Arena locally**

```bash
cd arena && npm run dev:frontend &
cd arena && npm run dev:backend &
```

- [ ] **Step 2: Enable 3D renderer**

Open browser console at `http://localhost:3002`:
```javascript
localStorage.setItem('arena_use3d', 'true');
location.reload();
```

- [ ] **Step 3: Verify HUD renders**

Check: Health hearts, round info, mute button visible on screen.

- [ ] **Step 4: Verify input works**

Check: WASD moves character, mouse aims, left-click fires, Q cycles weapon.

- [ ] **Step 5: Verify sound**

Check: Battle music plays, gunshot SFX on fire, pickup SFX on item collect.

- [ ] **Step 6: Run full test suite**

```bash
cd arena/frontend && npx vitest run
```
Expected: All tests pass

- [ ] **Step 7: Final commit (if any fixes needed)**

Stage only the specific files that were fixed during smoke testing:
```bash
git add arena/frontend/src/components/Game3D.tsx arena/frontend/src/hooks/
git commit -m "fix(arena): integration fixes for 3D gameplay"
```

---

## Summary

| Task | What | Severity Addressed |
|------|------|--------------------|
| 1 | `useGameSockets` hook (11 events + sound) | CRITICAL: Missing socket events + sound |
| 2 | `useGameInput` hook (keyboard/mouse/touch/emote) | CRITICAL: No input handling |
| 3 | `useGameAudio` hook (music + shooting SFX) | CRITICAL: Silent gameplay |
| 4 | `GameHUD` component (health/killfeed/weapon/spectator) | CRITICAL: No HUD |
| 5 | Wire Game3D with all hooks + HUD | CRITICAL: All of the above |
| 6 | Refactor Game.tsx to shared hooks | Parity: ensures both renderers stay in sync |
| 7 | Fix L2P asset paths | HIGH: Scene components 404 on model load |
| 8 | Wire CharacterSelector3D in L2P lobby | MEDIUM: 3D picker exists but unused |
| 9 | Smoke test | Verification |
