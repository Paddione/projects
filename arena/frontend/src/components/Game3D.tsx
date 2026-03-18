/**
 * Game3D — Three.js isometric renderer for Arena.
 *
 * Full-featured parallel to Game.tsx: same input handling, HUD, sound, and
 * socket events via shared hooks. The `use3DRenderer` flag in gameStore
 * selects this component over Game.tsx.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock } from 'three';
import { useGameStore } from '../stores/gameStore';
import LoadingScreen from './LoadingScreen';
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

  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const handleAssetsLoaded = useCallback(() => setAssetsLoaded(true), []);

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

  if (!assetsLoaded) {
    return <LoadingScreen onLoaded={handleAssetsLoaded} />;
  }

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
        rightStickRef={input.rightStickRef}
      />
    </div>
  );
}
