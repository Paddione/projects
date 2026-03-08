import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/apiService';
import { useGameStore } from '../stores/gameStore';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading, setUser, clearAuth, setLoading } = useAuthStore();
    const setPlayer = useGameStore((s) => s.setPlayer);

    useEffect(() => {
        let cancelled = false;

        async function checkAuth() {
            setLoading(true);
            try {
                const { user } = await api.getMe();
                if (cancelled) return;
                setUser(user);
                setPlayer(String(user.userId), user.username);
            } catch {
                if (cancelled) return;
                clearAuth();
                const authUrl = api.getAuthServiceUrl();
                if (authUrl) {
                    const callbackURL = encodeURIComponent(window.location.href);
                    window.location.href = `${authUrl}/login?callbackURL=${callbackURL}`;
                }
            }
        }

        checkAuth();
        return () => { cancelled = true; };
    }, []);

    if (isLoading) {
        return (
            <div className="page">
                <p style={{ color: 'var(--color-text-muted)' }}>Authenticating...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="page">
                <p style={{ color: 'var(--color-text-muted)' }}>Redirecting to login...</p>
            </div>
        );
    }

    return <>{children}</>;
}
