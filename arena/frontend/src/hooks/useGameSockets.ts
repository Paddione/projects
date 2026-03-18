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
