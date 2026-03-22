import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Lobby from './Lobby';
import { useGameStore } from '../stores/gameStore';

// Mock socket
const mockEmit = vi.fn();
const mockOn = vi.fn();
const mockOff = vi.fn();

vi.mock('../services/apiService', () => ({
    getSocket: () => ({
        emit: mockEmit,
        on: mockOn,
        off: mockOff,
    }),
    api: {
        getAuthServiceUrl: () => null,
    },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});

function renderLobby(code = 'ABC123') {
    return render(
        <MemoryRouter initialEntries={[`/lobby/${code}`]}>
            <Routes>
                <Route path="/lobby/:code" element={<Lobby />} />
            </Routes>
        </MemoryRouter>
    );
}

describe('Lobby Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockNavigate.mockReset();

        useGameStore.setState({
            playerId: '42',
            username: 'Alice',
            isHost: true,
            players: [
                { id: '42', username: 'Alice', character: 'student', characterLevel: 1, isReady: false, isHost: true, isConnected: true },
            ],
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
            lobbyCode: null,
            isInLobby: false,
            matchId: null,
            isInMatch: false,
        });
    });

    it('redirects to home when playerId is missing', () => {
        useGameStore.setState({ playerId: null });
        renderLobby();
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('redirects to home when username is empty', () => {
        useGameStore.setState({ username: '' });
        renderLobby();
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('emits join-lobby on mount', () => {
        renderLobby();
        expect(mockEmit).toHaveBeenCalledWith('join-lobby', expect.objectContaining({
            lobbyCode: 'ABC123',
            player: expect.objectContaining({ id: '42', username: 'Alice' }),
        }));
    });

    it('displays lobby code', () => {
        renderLobby();
        expect(screen.getByText('ABC123')).toBeTruthy();
    });

    it('displays LOBBY title', () => {
        renderLobby();
        expect(screen.getByText('LOBBY')).toBeTruthy();
    });

    it('shows player list', () => {
        renderLobby();
        expect(screen.getByText('Alice')).toBeTruthy();
    });

    it('shows waiting for player slot when below max', () => {
        renderLobby();
        expect(screen.getByText('Waiting for player...')).toBeTruthy();
    });

    it('shows Ready Up button when player is not ready', () => {
        renderLobby();
        const readyBtn = screen.getByText(/Ready Up/);
        expect(readyBtn).toBeTruthy();
    });

    it('emits player-ready on Ready Up click', () => {
        renderLobby();
        fireEvent.click(screen.getByText(/Ready Up/));
        expect(mockEmit).toHaveBeenCalledWith('player-ready', expect.objectContaining({
            lobbyCode: 'ABC123',
            playerId: '42',
            isReady: true,
        }));
    });

    it('shows Unready button when player is ready', () => {
        useGameStore.setState({
            players: [
                { id: '42', username: 'Alice', character: 'student', characterLevel: 1, isReady: true, isHost: true, isConnected: true },
            ],
        });
        renderLobby();
        expect(screen.getByText(/Unready/)).toBeTruthy();
    });

    it('shows Start Game button for host', () => {
        renderLobby();
        expect(screen.getByText(/Start Game/)).toBeTruthy();
    });

    it('Start Game is disabled when not all players are ready', () => {
        useGameStore.setState({
            players: [
                { id: '42', username: 'Alice', character: 'student', characterLevel: 1, isReady: true, isHost: true, isConnected: true },
                { id: '2', username: 'Bob', character: 'rogue', characterLevel: 1, isReady: false, isHost: false, isConnected: true },
            ],
        });
        renderLobby();
        const btn = screen.getByText(/Start Game/);
        expect(btn.closest('button')?.disabled).toBe(true);
    });

    it('does not show Start Game button for non-host', () => {
        useGameStore.setState({ isHost: false });
        renderLobby();
        expect(screen.queryByText(/Start Game/)).toBeNull();
    });

    it('Leave button emits leave-lobby and navigates home', () => {
        renderLobby();
        fireEvent.click(screen.getByText('Leave'));
        expect(mockEmit).toHaveBeenCalledWith('leave-lobby', {
            lobbyCode: 'ABC123',
            playerId: '42',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('shows settings panel for host', () => {
        renderLobby();
        expect(screen.getByText(/Match Settings/)).toBeTruthy();
    });

    it('does not show settings panel for non-host', () => {
        useGameStore.setState({ isHost: false });
        renderLobby();
        expect(screen.queryByText(/Match Settings/)).toBeNull();
    });

    it('shows arena map selector buttons for host', () => {
        renderLobby();
        expect(screen.getByText('Campus Courtyard')).toBeTruthy();
        expect(screen.getByText('Warehouse District')).toBeTruthy();
        expect(screen.getByText('Forest Clearing')).toBeTruthy();
    });

    it('emits update-settings with mapId on map button click', () => {
        renderLobby();
        fireEvent.click(screen.getByText('Warehouse District'));
        expect(mockEmit).toHaveBeenCalledWith('update-settings', expect.objectContaining({
            lobbyCode: 'ABC123',
            settings: { mapId: 'warehouse' },
        }));
    });

    it('shows map size selector buttons for host', () => {
        renderLobby();
        expect(screen.getByText('1x')).toBeTruthy();
        expect(screen.getByText('2x')).toBeTruthy();
        expect(screen.getByText('3x')).toBeTruthy();
    });

    it('emits update-settings with mapSize on size button click', () => {
        renderLobby();
        fireEvent.click(screen.getByText('2x'));
        expect(mockEmit).toHaveBeenCalledWith('update-settings', expect.objectContaining({
            lobbyCode: 'ABC123',
            settings: { mapSize: 2 },
        }));
    });

    it('does not show map selector buttons for non-host', () => {
        useGameStore.setState({ isHost: false });
        renderLobby();
        // Non-host should NOT see the Warehouse/Forest buttons (selector)
        expect(screen.queryByText('Warehouse District')).toBeNull();
        expect(screen.queryByText('Forest Clearing')).toBeNull();
        expect(screen.queryByText('2x')).toBeNull();
    });

    it('shows map name for non-host players', () => {
        useGameStore.setState({ isHost: false });
        renderLobby();
        // Non-host sees the selected map name as info text
        expect(screen.getByText('Campus Courtyard')).toBeTruthy();
    });

    it('shows map description below selector', () => {
        renderLobby();
        expect(screen.getByText('Balanced & symmetric')).toBeTruthy();
    });

    it('registers and cleans up socket listeners', () => {
        const { unmount } = renderLobby();
        expect(mockOn).toHaveBeenCalledWith('join-success', expect.any(Function));
        expect(mockOn).toHaveBeenCalledWith('join-error', expect.any(Function));
        expect(mockOn).toHaveBeenCalledWith('lobby-updated', expect.any(Function));
        expect(mockOn).toHaveBeenCalledWith('lobby-deleted', expect.any(Function));

        unmount();
        expect(mockOff).toHaveBeenCalledWith('join-success');
        expect(mockOff).toHaveBeenCalledWith('join-error');
        expect(mockOff).toHaveBeenCalledWith('lobby-updated');
        expect(mockOff).toHaveBeenCalledWith('lobby-deleted');
    });
});
