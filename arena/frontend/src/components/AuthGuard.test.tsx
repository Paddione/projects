import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AuthGuard from './AuthGuard';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';

const mockGetMe = vi.fn();
const mockGetAuthServiceUrl = vi.fn().mockReturnValue('');

vi.mock('../services/apiService', () => ({
    api: {
        getMe: () => mockGetMe(),
        getAuthServiceUrl: () => mockGetAuthServiceUrl(),
    },
}));

describe('AuthGuard Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAuthStore.setState({
            user: null,
            isAuthenticated: false,
            isLoading: true,
        });
        useGameStore.setState({
            playerId: null,
            username: '',
        });
    });

    it('shows Authenticating... while loading', () => {
        mockGetMe.mockReturnValue(new Promise(() => {})); // never resolves
        render(
            <AuthGuard>
                <div>Protected Content</div>
            </AuthGuard>
        );
        expect(screen.getByText('Authenticating...')).toBeTruthy();
        expect(screen.queryByText('Protected Content')).toBeNull();
    });

    it('renders children after successful auth', async () => {
        const user = { userId: 42, username: 'Alice', email: 'alice@test.com', role: 'USER' };
        mockGetMe.mockResolvedValue({ user });

        render(
            <AuthGuard>
                <div>Protected Content</div>
            </AuthGuard>
        );

        await waitFor(() => {
            expect(screen.getByText('Protected Content')).toBeTruthy();
        });
    });

    it('sets both auth store and game store on success', async () => {
        const user = { userId: 42, username: 'Alice', email: 'alice@test.com', role: 'USER' };
        mockGetMe.mockResolvedValue({ user });

        render(
            <AuthGuard>
                <div>Protected</div>
            </AuthGuard>
        );

        await waitFor(() => {
            expect(useAuthStore.getState().isAuthenticated).toBe(true);
            expect(useAuthStore.getState().user).toEqual(user);
            expect(useGameStore.getState().playerId).toBe('42');
            expect(useGameStore.getState().username).toBe('Alice');
        });
    });

    it('shows redirect message on auth failure without auth service URL', async () => {
        mockGetMe.mockRejectedValue(new Error('401'));
        mockGetAuthServiceUrl.mockReturnValue('');

        render(
            <AuthGuard>
                <div>Protected</div>
            </AuthGuard>
        );

        await waitFor(() => {
            expect(screen.getByText('Redirecting to login...')).toBeTruthy();
        });
    });

    it('clears auth store on auth failure', async () => {
        mockGetMe.mockRejectedValue(new Error('401'));
        mockGetAuthServiceUrl.mockReturnValue('');

        render(
            <AuthGuard>
                <div>Protected</div>
            </AuthGuard>
        );

        await waitFor(() => {
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
            expect(useAuthStore.getState().isLoading).toBe(false);
            expect(useAuthStore.getState().user).toBeNull();
        });
    });
});
