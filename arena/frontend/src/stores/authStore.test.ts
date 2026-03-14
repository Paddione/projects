import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore', () => {
    beforeEach(() => {
        // Reset store to initial state
        useAuthStore.setState({
            user: null,
            isAuthenticated: false,
            isLoading: true,
        });
    });

    it('starts with no user, not authenticated, and loading', () => {
        const state = useAuthStore.getState();
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.isLoading).toBe(true);
    });

    it('setUser sets user and marks authenticated + not loading', () => {
        const user = { userId: 1, username: 'Alice', email: 'alice@test.com', role: 'USER' };
        useAuthStore.getState().setUser(user);

        const state = useAuthStore.getState();
        expect(state.user).toEqual(user);
        expect(state.isAuthenticated).toBe(true);
        expect(state.isLoading).toBe(false);
    });

    it('clearAuth resets user and marks not authenticated + not loading', () => {
        const user = { userId: 1, username: 'Alice', email: 'alice@test.com', role: 'USER' };
        useAuthStore.getState().setUser(user);
        useAuthStore.getState().clearAuth();

        const state = useAuthStore.getState();
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.isLoading).toBe(false);
    });

    it('setLoading updates loading state without affecting user', () => {
        const user = { userId: 1, username: 'Alice', email: 'alice@test.com', role: 'USER' };
        useAuthStore.getState().setUser(user);
        useAuthStore.getState().setLoading(true);

        const state = useAuthStore.getState();
        expect(state.isLoading).toBe(true);
        expect(state.user).toEqual(user);
        expect(state.isAuthenticated).toBe(true);
    });
});
