import { create } from 'zustand';

interface GameStore {
    // Lobby state
    lobbyCode: string | null;
    isInLobby: boolean;
    isHost: boolean;
    players: Array<{
        id: string;
        username: string;
        character: string;
        characterLevel: number;
        isReady: boolean;
        isHost: boolean;
        isConnected: boolean;
    }>;
    settings: {
        maxPlayers: 2 | 3 | 4;
        bestOf: 1 | 3 | 5;
        shrinkingZone: boolean;
        shrinkInterval: number;
        itemSpawns: boolean;
        itemSpawnInterval: number;
        npcEnemies: 0 | 1 | 2 | 3;
        mapId: 'campus' | 'warehouse' | 'forest';
        mapSize: 1 | 2 | 3;
    };

    // Match state
    matchId: string | null;
    isInMatch: boolean;
    isSpectating: boolean;
    spectatedPlayerId: string | null;
    currentRound: number;
    roundScores: Record<string, number>;

    // Player state
    playerId: string | null;
    username: string;
    hp: number;
    hasArmor: boolean;
    isAlive: boolean;
    kills: number;
    deaths: number;
    weaponType: string;

    // UI state
    killfeed: Array<{ killer: string; victim: string; weapon: string; timestamp: number }>;
    announcement: string | null;

    // 3D renderer flag
    use3DRenderer: boolean;

    // Actions
    setLobby: (code: string, isHost: boolean) => void;
    leaveLobby: () => void;
    setPlayers: (players: GameStore['players']) => void;
    setSettings: (settings: Partial<GameStore['settings']>) => void;
    setMatch: (matchId: string) => void;
    endMatch: () => void;
    setPlayerState: (state: { hp?: number; hasArmor?: boolean; isAlive?: boolean; kills?: number; deaths?: number; weaponType?: string }) => void;
    setSpectating: (isSpectating: boolean) => void;
    setSpectatedPlayer: (playerId: string | null) => void;
    addKillfeed: (entry: { killer: string; victim: string; weapon: string }) => void;
    setAnnouncement: (text: string | null) => void;
    setRound: (round: number) => void;
    setRoundScores: (scores: Record<string, number>) => void;
    setPlayer: (id: string, username: string) => void;
    setUse3DRenderer: (value: boolean) => void;
}

export const useGameStore = create<GameStore>((set) => ({
    // Initial state
    lobbyCode: null,
    isInLobby: false,
    isHost: false,
    players: [],
    settings: {
        maxPlayers: 4,
        bestOf: 1,
        shrinkingZone: false,
        shrinkInterval: 30,
        itemSpawns: true,
        itemSpawnInterval: 60,
        npcEnemies: 0,
        mapId: 'campus',
        mapSize: 1,
    },

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

    use3DRenderer: localStorage.getItem('arena_use3d') === 'true',

    // Actions
    setLobby: (code, isHost) => set({ lobbyCode: code, isInLobby: true, isHost }),
    leaveLobby: () => set({
        lobbyCode: null, isInLobby: false, isHost: false, players: [],
        matchId: null, isInMatch: false,
    }),
    setPlayers: (players) => set({ players }),
    setSettings: (settings) => set((state) => ({
        settings: { ...state.settings, ...settings },
    })),
    setMatch: (matchId) => set({ matchId, isInMatch: true, isSpectating: false, kills: 0, deaths: 0, hp: 2, hasArmor: false, isAlive: true }),
    endMatch: () => set({ matchId: null, isInMatch: false }),
    setPlayerState: (state) => set((prev) => ({
        hp: state.hp ?? prev.hp,
        hasArmor: state.hasArmor ?? prev.hasArmor,
        isAlive: state.isAlive ?? prev.isAlive,
        kills: state.kills ?? prev.kills,
        deaths: state.deaths ?? prev.deaths,
        weaponType: state.weaponType ?? prev.weaponType,
    })),
    setSpectating: (isSpectating) => set({ isSpectating }),
    setSpectatedPlayer: (playerId) => set({ spectatedPlayerId: playerId }),
    addKillfeed: (entry) => set((state) => ({
        killfeed: [{ ...entry, timestamp: Date.now() }, ...state.killfeed].slice(0, 8),
    })),
    setAnnouncement: (text) => set({ announcement: text }),
    setRound: (round) => set({ currentRound: round }),
    setRoundScores: (scores) => set({ roundScores: scores }),
    setPlayer: (id, username) => set({ playerId: id, username }),
    setUse3DRenderer: (value) => {
        localStorage.setItem('arena_use3d', value ? 'true' : 'false');
        set({ use3DRenderer: value });
    },
}));
