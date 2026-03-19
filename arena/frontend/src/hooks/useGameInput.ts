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
  /** Pre-computed world-space aim angle (set by 3D renderer via raycasting). */
  worldAimAngleRef?: MutableRefObject<number | null>;
  /** Camera yaw in radians — rotates WASD movement to match isometric view. */
  isoYawRad?: number;
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
  worldAimAngleRef,
  isoYawRad,
}: UseGameInputOptions): InputState {
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef({ x: 0, y: 0, down: false, rightDown: false });
  const weaponCycleRef = useRef(0);
  const leftStickRef = useRef({ active: false, startX: 0, startY: 0, dx: 0, dy: 0, touchId: -1 });
  const rightStickRef = useRef({ active: false, startX: 0, startY: 0, dx: 0, dy: 0, touchId: -1, firing: false });
  const sprintActiveRef = useRef(false);
  const meleeActiveRef = useRef(false);
  /** Last valid aim angle from right stick — avoids snapping to 0 in deadzone. */
  const lastAimAngleRef = useRef(0);

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

      // Rotate movement to match isometric camera orientation
      if (isoYawRad !== undefined && (mx !== 0 || my !== 0)) {
        const c = Math.cos(-isoYawRad);
        const s = Math.sin(-isoYawRad);
        const rmx = c * mx - s * my;
        const rmy = s * mx + c * my;
        mx = rmx;
        my = rmy;
      }

      let aimAngle = 0;
      // Right stick aim threshold — must drag past deadzone before firing
      const RIGHT_STICK_DEADZONE = 8;
      let touchAiming = false;

      if (isTouchDevice && rightStickRef.current.active) {
        const { dx, dy } = rightStickRef.current;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > RIGHT_STICK_DEADZONE) {
          aimAngle = Math.atan2(dy, dx);
          // Rotate touch aim for isometric view
          if (isoYawRad !== undefined) aimAngle -= isoYawRad;
          lastAimAngleRef.current = aimAngle;
          touchAiming = true;
        } else {
          // In deadzone — use last known aim but don't fire
          aimAngle = lastAimAngleRef.current;
        }
      } else if (worldAimAngleRef?.current != null) {
        // 3D mode: use pre-computed world-space aim from raycasting
        aimAngle = worldAimAngleRef.current;
      } else {
        // 2D mode: screen-space aim (player always at screen center)
        const mouse = mouseRef.current;
        const state = gameStateRef.current;
        if (state) {
          const me = state.players?.find((p: any) => p.id === playerId);
          if (me) aimAngle = Math.atan2(mouse.y - window.innerHeight / 2, mouse.x - window.innerWidth / 2);
        }
      }

      // Touch: only fire when stick is actively displaced past deadzone
      const shooting = isTouchDevice ? touchAiming : mouseRef.current.down;
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
