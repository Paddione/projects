import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/apiService';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';

export default function Home() {
    const navigate = useNavigate();
    const setLobby = useGameStore((s) => s.setLobby);
    const user = useAuthStore((s) => s.user);

    const [joinCode, setJoinCode] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = async () => {
        setIsLoading(true);
        setError('');
        try {
            const lobby: any = await api.createLobby({});
            setLobby(lobby.code, true);
            navigate(`/lobby/${lobby.code}`);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoin = () => {
        if (!joinCode.trim() || joinCode.trim().length !== 6) {
            setError('Enter a valid 6-character lobby code');
            return;
        }
        navigate(`/lobby/${joinCode.trim().toUpperCase()}`);
    };

    return (
        <div className="page">
            <h1 className="page-title">ARENA</h1>
            <p className="page-subtitle">Top-Down Battle Royale</p>

            {user && (
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
                    Playing as <strong>{user.username}</strong>
                </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', width: '100%', maxWidth: '380px' }}>
                {error && (
                    <p style={{ color: 'var(--color-danger)', fontSize: '0.9rem', textAlign: 'center' }}>
                        {error}
                    </p>
                )}

                <button
                    className="btn btn-primary btn-lg"
                    onClick={handleCreate}
                    disabled={isLoading}
                    id="create-lobby-btn"
                >
                    {isLoading ? 'Creating...' : 'Create Lobby'}
                </button>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-md)',
                    color: 'var(--color-text-muted)',
                    margin: 'var(--space-sm) 0',
                }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
                    <span style={{ fontSize: '0.85rem' }}>or join</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <input
                        className="input"
                        type="text"
                        placeholder="LOBBY CODE"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.2em', textAlign: 'center' }}
                        id="join-code-input"
                        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    />
                    <button
                        className="btn btn-ghost"
                        onClick={handleJoin}
                        id="join-lobby-btn"
                    >
                        Join
                    </button>
                </div>
            </div>
        </div>
    );
}
