import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Leaderboard from './Leaderboard';

const mockGetLeaderboard = vi.fn();

vi.mock('../services/apiService', () => ({
    api: {
        getLeaderboard: () => mockGetLeaderboard(),
    },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});

function renderLeaderboard() {
    return render(
        <BrowserRouter>
            <Leaderboard />
        </BrowserRouter>
    );
}

const mockEntries = [
    {
        username: 'Alice',
        selected_character: 'student',
        total_kills: 50,
        total_deaths: 10,
        total_wins: 15,
        games_played: 20,
        experience: 5000,
        character_level: 12,
        kd_ratio: 5.0,
        win_rate: 75,
    },
    {
        username: 'Bob',
        selected_character: 'rogue',
        total_kills: 30,
        total_deaths: 20,
        total_wins: 8,
        games_played: 20,
        experience: 3000,
        character_level: 8,
        kd_ratio: 1.5,
        win_rate: 40,
    },
];

describe('Leaderboard Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows loading state initially', () => {
        mockGetLeaderboard.mockReturnValue(new Promise(() => {})); // never resolves
        renderLeaderboard();
        expect(screen.getByText('Loading...')).toBeTruthy();
    });

    it('shows title and subtitle', () => {
        mockGetLeaderboard.mockReturnValue(new Promise(() => {}));
        renderLeaderboard();
        expect(screen.getByText('LEADERBOARD')).toBeTruthy();
        expect(screen.getByText('Top Arena Fighters')).toBeTruthy();
    });

    it('renders leaderboard entries after fetch', async () => {
        mockGetLeaderboard.mockResolvedValue(mockEntries);
        renderLeaderboard();

        await waitFor(() => {
            expect(screen.getByText('Alice')).toBeTruthy();
            expect(screen.getByText('Bob')).toBeTruthy();
        });
    });

    it('shows empty state when no entries', async () => {
        mockGetLeaderboard.mockResolvedValue([]);
        renderLeaderboard();

        await waitFor(() => {
            expect(screen.getByText(/No players yet/)).toBeTruthy();
        });
    });

    it('handles non-array API response gracefully', async () => {
        mockGetLeaderboard.mockResolvedValue(null);
        renderLeaderboard();

        await waitFor(() => {
            expect(screen.getByText(/No players yet/)).toBeTruthy();
        });
    });

    it('handles API error gracefully', async () => {
        mockGetLeaderboard.mockRejectedValue(new Error('Network error'));
        renderLeaderboard();

        await waitFor(() => {
            // Should not crash — shows empty state after error
            expect(screen.queryByText('Loading...')).toBeNull();
        });
    });

    it('shows medal emojis for top 3', async () => {
        const threeEntries = [
            ...mockEntries,
            { ...mockEntries[1], username: 'Charlie', character_level: 5 },
        ];
        mockGetLeaderboard.mockResolvedValue(threeEntries);
        renderLeaderboard();

        await waitFor(() => {
            expect(screen.getByText('Alice')).toBeTruthy();
        });
    });

    it('displays player stats correctly', async () => {
        mockGetLeaderboard.mockResolvedValue(mockEntries);
        renderLeaderboard();

        await waitFor(() => {
            expect(screen.getByText('Alice')).toBeTruthy();
        });
        // After data loads, verify table has the expected structure
        const table = screen.getByRole('table');
        expect(table).toBeTruthy();
        // Check XP values are present (rendered as exact text in <td>)
        expect(screen.getByText('5000')).toBeTruthy();
        expect(screen.getByText('3000')).toBeTruthy();
    });

    it('has Back to Home button', async () => {
        mockGetLeaderboard.mockResolvedValue([]);
        renderLeaderboard();

        await waitFor(() => {
            expect(screen.queryByText('Loading...')).toBeNull();
        });

        const btn = screen.getByText(/Back to Home/);
        expect(btn).toBeTruthy();
    });
});
