/**
 * Game3D — Three.js isometric renderer for Arena.
 *
 * This component is a parallel renderer to Game.tsx. Both coexist; the active
 * one is selected by the `use3DRenderer` feature flag in gameStore.
 *
 * It reuses the same socket events as Game.tsx (`game-state`, `player-killed`,
 * etc.) without re-registering them — it subscribes only to `game-state` for
 * scene updates and relies on Game.tsx / gameStore for HUD state mutations.
 */

import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock } from 'three';
import { useGameStore } from '../stores/gameStore';
import { getSocket } from '../services/apiService';
import { GameRenderer3D } from '../services/GameRenderer3D';
import { TerrainRenderer } from '../services/TerrainRenderer';
import { PlayerRenderer } from '../services/PlayerRenderer';
import { ProjectileRenderer } from '../services/ProjectileRenderer';
import { CoverRenderer } from '../services/CoverRenderer';
import { ItemRenderer } from '../services/ItemRenderer';
import { ZoneRenderer } from '../services/ZoneRenderer';
import { LabelRenderer } from '../services/LabelRenderer';

export default function Game3D() {
    useParams<{ matchId: string }>();
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);

    const {
        playerId,
        isSpectating,
        spectatedPlayerId,
        setPlayerState,
        addKillfeed,
        setAnnouncement,
        setRound,
        setRoundScores,
        setSpectating,
        setSpectatedPlayer,
        endMatch,
    } = useGameStore();

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

    // =========================================================================
    // SETUP
    // =========================================================================

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
        labelRef.current = new LabelRenderer(r.playerGroup); // labels attach to player group

        // Resize observer
        const resizeObserver = new ResizeObserver(() => r.resize());
        resizeObserver.observe(container);

        // Animation loop
        clockRef.current.start();
        const animate = () => {
            rafRef.current = requestAnimationFrame(animate);
            const delta = clockRef.current.getDelta();
            const state = gameStateRef.current;
            if (!state) {
                r.render();
                return;
            }

            // Camera follows local player (or spectated player)
            const trackId = isSpectating && spectatedPlayerId ? spectatedPlayerId : playerId;
            const me = state.players?.find((p: any) => p.id === trackId);
            if (me) {
                r.updateCamera(me.x, me.y);
            }

            // Build terrain once when map data is available
            if (!terrainBuiltRef.current && state.map?.tiles) {
                terrainRef.current?.build(
                    state.map.tiles,
                    state.map.width ?? 28,
                    state.map.height ?? 22,
                );
                coverRef.current?.update(state.map.coverObjects ?? []);
                terrainBuiltRef.current = true;
            }

            // Per-frame updates
            const myId = playerId;
            const players = (state.players ?? []).map((p: any) => ({
                ...p,
                isMe: p.id === myId,
            }));

            playerRef.current?.update(players, delta);
            projectileRef.current?.update(state.projectiles ?? []);
            itemRef.current?.update(state.items ?? [], delta);
            zoneRef.current?.update(
                state.zone,
                state.map?.width ?? 28,
                state.map?.height ?? 22,
                delta,
            );
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
    }, []); // mount/unmount only

    // =========================================================================
    // SOCKET EVENTS
    // =========================================================================

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
        });

        socket.on('round-end', (data: any) => {
            setRoundScores(data.scores);
            const state = gameStateRef.current;
            const winner = state?.players?.find((p: any) => p.id === data.winnerId);
            setAnnouncement(`${winner?.username || 'Unknown'} wins Round ${data.roundNumber}!`);
            setTimeout(() => setAnnouncement(null), 4000);
        });

        socket.on('round-start', (data: any) => {
            setRound(data.roundNumber);
            setAnnouncement(`Round ${data.roundNumber} — FIGHT!`);
            // Reset terrain for new round
            terrainBuiltRef.current = false;
            terrainRef.current?.clear();
            setTimeout(() => setAnnouncement(null), 2000);
        });

        socket.on('match-end', (data: any) => {
            const winner = data.results?.find((r: any) => r.placement === 1);
            setAnnouncement(`${winner?.username || 'Unknown'} wins the match!`);
            setTimeout(() => {
                endMatch();
                navigate(data.dbMatchId ? `/results/${data.dbMatchId}` : '/');
            }, 8000);
        });

        socket.on('spectate-start', (data: any) => {
            setSpectating(true);
            setSpectatedPlayer(data.targetPlayerId);
        });

        return () => {
            socket.off('game-state');
            socket.off('player-killed');
            socket.off('round-end');
            socket.off('round-start');
            socket.off('match-end');
            socket.off('spectate-start');
        };
    }, [
        playerId,
        setPlayerState,
        addKillfeed,
        setRoundScores,
        setAnnouncement,
        setRound,
        setSpectating,
        setSpectatedPlayer,
        endMatch,
        navigate,
    ]);

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                overflow: 'hidden',
            }}
        />
    );
}
