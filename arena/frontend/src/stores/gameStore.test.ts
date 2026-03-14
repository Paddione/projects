import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from './gameStore';

const initialSettings = {
    maxPlayers: 4 as const,
    bestOf: 1 as const,
    shrinkingZone: false,
    shrinkInterval: 30,
    itemSpawns: true,
    itemSpawnInterval: 60,
};

describe('gameStore', () => {
    beforeEach(() => {
        useGameStore.setState({
            lobbyCode: null,
            isInLobby: false,
            isHost: false,
            players: [],
            settings: { ...initialSettings },
            matchId: null,
            isInMatch: false,
            isSpectating: false,
            spectatedPlayerId: null,
            currentRound: 1,
            roundScores: {},
            playerId: null,
            username: '',
            hp: 2,
            hasArmor: false,
            isAlive: true,
            kills: 0,
            deaths: 0,
            weaponType: 'pistol',
            killfeed: [],
            announcement: null,
        });
    });

    describe('Lobby actions', () => {
        it('setLobby sets lobby code, isInLobby, and isHost', () => {
            useGameStore.getState().setLobby('ABC123', true);
            const s = useGameStore.getState();
            expect(s.lobbyCode).toBe('ABC123');
            expect(s.isInLobby).toBe(true);
            expect(s.isHost).toBe(true);
        });

        it('leaveLobby resets lobby and match state', () => {
            useGameStore.getState().setLobby('ABC123', true);
            useGameStore.getState().setMatch('match-1');
            useGameStore.getState().setPlayers([{
                id: '1', username: 'Alice', character: 'student',
                characterLevel: 1, isReady: true, isHost: true, isConnected: true,
            }]);

            useGameStore.getState().leaveLobby();
            const s = useGameStore.getState();
            expect(s.lobbyCode).toBeNull();
            expect(s.isInLobby).toBe(false);
            expect(s.isHost).toBe(false);
            expect(s.players).toEqual([]);
            expect(s.matchId).toBeNull();
            expect(s.isInMatch).toBe(false);
        });

        it('setPlayers updates player list', () => {
            const players = [
                { id: '1', username: 'Alice', character: 'student', characterLevel: 1, isReady: false, isHost: true, isConnected: true },
                { id: '2', username: 'Bob', character: 'rogue', characterLevel: 2, isReady: true, isHost: false, isConnected: true },
            ];
            useGameStore.getState().setPlayers(players);
            expect(useGameStore.getState().players).toEqual(players);
        });

        it('setSettings merges partial settings', () => {
            useGameStore.getState().setSettings({ bestOf: 5, shrinkingZone: true });
            const s = useGameStore.getState();
            expect(s.settings.bestOf).toBe(5);
            expect(s.settings.shrinkingZone).toBe(true);
            expect(s.settings.maxPlayers).toBe(4); // unchanged
            expect(s.settings.itemSpawns).toBe(true); // unchanged
        });
    });

    describe('Match actions', () => {
        it('setMatch sets matchId, resets combat state', () => {
            useGameStore.setState({ kills: 5, deaths: 3, hp: 1, hasArmor: true, isAlive: false });
            useGameStore.getState().setMatch('match-42');
            const s = useGameStore.getState();
            expect(s.matchId).toBe('match-42');
            expect(s.isInMatch).toBe(true);
            expect(s.isSpectating).toBe(false);
            expect(s.kills).toBe(0);
            expect(s.deaths).toBe(0);
            expect(s.hp).toBe(2);
            expect(s.hasArmor).toBe(false);
            expect(s.isAlive).toBe(true);
        });

        it('endMatch clears matchId and isInMatch', () => {
            useGameStore.getState().setMatch('match-42');
            useGameStore.getState().endMatch();
            const s = useGameStore.getState();
            expect(s.matchId).toBeNull();
            expect(s.isInMatch).toBe(false);
        });
    });

    describe('Player state actions', () => {
        it('setPlayerState partially updates player combat state', () => {
            useGameStore.getState().setPlayerState({ hp: 1, kills: 3 });
            const s = useGameStore.getState();
            expect(s.hp).toBe(1);
            expect(s.kills).toBe(3);
            expect(s.hasArmor).toBe(false); // unchanged
            expect(s.isAlive).toBe(true);   // unchanged
        });

        it('setPlayer sets playerId and username', () => {
            useGameStore.getState().setPlayer('42', 'Alice');
            const s = useGameStore.getState();
            expect(s.playerId).toBe('42');
            expect(s.username).toBe('Alice');
        });
    });

    describe('Spectator actions', () => {
        it('setSpectating toggles spectating mode', () => {
            useGameStore.getState().setSpectating(true);
            expect(useGameStore.getState().isSpectating).toBe(true);
        });

        it('setSpectatedPlayer sets target player ID', () => {
            useGameStore.getState().setSpectatedPlayer('p2');
            expect(useGameStore.getState().spectatedPlayerId).toBe('p2');
        });

        it('setSpectatedPlayer accepts null to clear', () => {
            useGameStore.getState().setSpectatedPlayer('p2');
            useGameStore.getState().setSpectatedPlayer(null);
            expect(useGameStore.getState().spectatedPlayerId).toBeNull();
        });
    });

    describe('UI actions', () => {
        it('addKillfeed prepends entry with timestamp', () => {
            vi.spyOn(Date, 'now').mockReturnValue(1000);
            useGameStore.getState().addKillfeed({ killer: 'Alice', victim: 'Bob', weapon: 'pistol' });
            const feed = useGameStore.getState().killfeed;
            expect(feed).toHaveLength(1);
            expect(feed[0]).toEqual({ killer: 'Alice', victim: 'Bob', weapon: 'pistol', timestamp: 1000 });
            vi.restoreAllMocks();
        });

        it('addKillfeed caps at 8 entries', () => {
            for (let i = 0; i < 10; i++) {
                useGameStore.getState().addKillfeed({ killer: `K${i}`, victim: `V${i}`, weapon: 'pistol' });
            }
            expect(useGameStore.getState().killfeed).toHaveLength(8);
            // Most recent first
            expect(useGameStore.getState().killfeed[0].killer).toBe('K9');
        });

        it('setAnnouncement sets and clears announcement', () => {
            useGameStore.getState().setAnnouncement('Round 2!');
            expect(useGameStore.getState().announcement).toBe('Round 2!');
            useGameStore.getState().setAnnouncement(null);
            expect(useGameStore.getState().announcement).toBeNull();
        });

        it('setRound updates currentRound', () => {
            useGameStore.getState().setRound(3);
            expect(useGameStore.getState().currentRound).toBe(3);
        });

        it('setRoundScores updates roundScores', () => {
            const scores = { p1: 2, p2: 1 };
            useGameStore.getState().setRoundScores(scores);
            expect(useGameStore.getState().roundScores).toEqual(scores);
        });
    });
});
