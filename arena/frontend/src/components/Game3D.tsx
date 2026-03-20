/**
 * Game3D — Three.js isometric renderer for Arena.
 *
 * Full-featured parallel to Game.tsx: same input handling, HUD, sound, and
 * socket events via shared hooks. The `use3DRenderer` flag in gameStore
 * selects this component over Game.tsx.
 *
 * Split into Game3D (loading gate) and Game3DInner (actual gameplay) so that
 * hooks and the renderer only activate after assets are preloaded.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Raycaster, Vector2, Vector3, Plane } from 'three';
import { useGameStore } from '../stores/gameStore';
import LoadingScreen from './LoadingScreen';
import { GameRenderer3D, WORLD_SCALE } from '../services/GameRenderer3D';
import { VFXManager } from '../services/VFXManager';
import { ImpactEffect } from '../services/effects/ImpactEffect';
import { ExplosionEffect } from '../services/effects/ExplosionEffect';
import { MuzzleFlashEffect } from '../services/effects/MuzzleFlashEffect';
import { DeathEffect } from '../services/effects/DeathEffect';
import { TerrainRenderer } from '../services/TerrainRenderer';
import { PlayerRenderer } from '../services/PlayerRenderer';
import { ProjectileRenderer } from '../services/ProjectileRenderer';
import { CoverRenderer } from '../services/CoverRenderer';
import { ItemRenderer } from '../services/ItemRenderer';
import { ZoneRenderer } from '../services/ZoneRenderer';
import { NPCRenderer } from '../services/NPCRenderer';
import { LabelRenderer } from '../services/LabelRenderer';
import { useGameSockets } from '../hooks/useGameSockets';
import { useGameInput } from '../hooks/useGameInput';
import { useGameAudio } from '../hooks/useGameAudio';
import { GameHUD } from './GameHUD';

/**
 * Outer wrapper: shows LoadingScreen until assets are ready,
 * then mounts Game3DInner which activates all hooks and the renderer.
 */
export default function Game3D() {
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const handleAssetsLoaded = useCallback(() => setAssetsLoaded(true), []);

  if (!assetsLoaded) {
    return <LoadingScreen onLoaded={handleAssetsLoaded} />;
  }

  return <Game3DInner />;
}

/**
 * Inner component: only mounts after LoadingScreen completes.
 * All hooks and the Three.js renderer activate here.
 */
function Game3DInner() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const { playerId, currentRound } = useGameStore();

  // Renderer instances (stable across renders)
  const rendererRef = useRef<GameRenderer3D | null>(null);
  const terrainRef = useRef<TerrainRenderer | null>(null);
  const playerRef = useRef<PlayerRenderer | null>(null);
  const projectileRef = useRef<ProjectileRenderer | null>(null);
  const coverRef = useRef<CoverRenderer | null>(null);
  const itemRef = useRef<ItemRenderer | null>(null);
  const zoneRef = useRef<ZoneRenderer | null>(null);
  const npcRef = useRef<NPCRenderer | null>(null);
  const labelRef = useRef<LabelRenderer | null>(null);
  const vfxRef = useRef<VFXManager | null>(null);

  const gameStateRef = useRef<any>(null);
  const terrainBuiltRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const clockRef = useRef(new Clock());
  const activeEmotesRef = useRef<Map<string, { emoteId: string; expiresAt: number }>>(new Map());

  // Raycasting for isometric aim (reusable objects to avoid per-frame allocation)
  const worldAimAngleRef = useRef<number | null>(null);
  const raycasterRef = useRef(new Raycaster());
  const ndcRef = useRef(new Vector2());
  const intersectionRef = useRef(new Vector3());
  const groundPlane = useRef(new Plane(new Vector3(0, 1, 0), 0));

  // ---- Shared hooks (only active after assets loaded) ----
  const input = useGameInput({
    matchId, playerId, containerRef, gameStateRef,
    worldAimAngleRef,
    isoYawRad: Math.PI / 4,
  });

  useGameSockets({
    playerId, navigate, gameStateRef, activeEmotesRef,
    onExplosion: (data) => {
      const vfx = vfxRef.current;
      const r = rendererRef.current;
      if (!vfx || !r) return;
      const { wx, wz } = GameRenderer3D.toWorld(data.x, data.y);
      vfx.addEffect(new ExplosionEffect(vfx.effectGroup, { x: wx, y: 0, z: wz }, data.radius * WORLD_SCALE));
      vfx.triggerShake('explosion');
    },
    onPlayerHit: () => {
      vfxRef.current?.triggerShake('hit');
    },
  });

  useGameAudio({ mouseRef: input.mouseRef, keysRef: input.keysRef });

  // Reset terrain when round changes
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

    const vfx = new VFXManager(r.scene);
    vfxRef.current = vfx;

    terrainRef.current = new TerrainRenderer(r.terrainGroup);
    playerRef.current = new PlayerRenderer(r.playerGroup, r.characterManager, {
      onPlayerDeath: (pos, color) => {
        vfx.addEffect(new DeathEffect(vfx.effectGroup, pos, color));
      },
    });
    projectileRef.current = new ProjectileRenderer(r.projectileGroup, {
      onRemoved: (pos, type) => {
        if (type !== 'grenade') {
          vfx.addEffect(new ImpactEffect(vfx.effectGroup, pos));
        }
      },
      onCreated: (pos, angle) => {
        vfx.addEffect(new MuzzleFlashEffect(vfx.effectGroup, pos, angle));
      },
    });
    coverRef.current = new CoverRenderer(r.coverGroup);
    itemRef.current = new ItemRenderer(r.itemGroup);
    zoneRef.current = new ZoneRenderer(r.zoneGroup);
    npcRef.current = new NPCRenderer(r.npcGroup, r.characterManager);
    labelRef.current = new LabelRenderer(r.playerGroup);

    const resizeObserver = new ResizeObserver(() => r.resize());
    resizeObserver.observe(container);

    clockRef.current.start();
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();
      const state = gameStateRef.current;
      if (!state) { r.render(); return; }

      // Camera follows local player (or spectated player) — read from store to avoid stale closure
      const { isSpectating, spectatedPlayerId } = useGameStore.getState();
      const trackId = isSpectating && spectatedPlayerId ? spectatedPlayerId : playerId;
      const me = state.players?.find((p: any) => p.id === trackId);
      if (me) r.updateCamera(me.x, me.y);

      // Compute world-space aim angle via raycasting (mouse → ground plane)
      const mouse = input.mouseRef.current;
      const containerEl = containerRef.current;
      if (containerEl && me) {
        ndcRef.current.set(
          (mouse.x / containerEl.clientWidth) * 2 - 1,
          -(mouse.y / containerEl.clientHeight) * 2 + 1,
        );
        raycasterRef.current.setFromCamera(ndcRef.current, r.camera);
        const hit = raycasterRef.current.ray.intersectPlane(groundPlane.current, intersectionRef.current);
        if (hit) {
          const { wx, wz } = GameRenderer3D.toWorld(me.x, me.y);
          worldAimAngleRef.current = Math.atan2(intersectionRef.current.z - wz, intersectionRef.current.x - wx);
        }
      }

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
      npcRef.current?.update(state.npcs ?? [], delta);
      projectileRef.current?.update(state.projectiles ?? []);
      itemRef.current?.update(state.items ?? [], delta);
      zoneRef.current?.update(state.zone, state.map?.width ?? 28, state.map?.height ?? 22, delta);
      labelRef.current?.update(players);

      vfxRef.current?.update(delta);

      // Apply screen shake
      const shakeOffset = vfxRef.current?.getShakeOffset();
      if (shakeOffset) r.applyCameraShake(shakeOffset);

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
      npcRef.current?.dispose();
      labelRef.current?.dispose();
      vfxRef.current?.dispose();
      r.dispose();
      rendererRef.current = null;
      terrainBuiltRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', touchAction: 'none', cursor: input.isTouchDevice ? 'default' : 'crosshair' }}>
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
        rightStickRef={input.rightStickRef}
      />
    </div>
  );
}
