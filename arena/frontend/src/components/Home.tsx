import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/apiService';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import KeybindSettings from './KeybindSettings';

export default function Home() {
    const navigate = useNavigate();
    const setLobby = useGameStore((s) => s.setLobby);
    const user = useAuthStore((s) => s.user);

    const [joinCode, setJoinCode] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [lobbies, setLobbies] = useState<any[]>([]);
    const [loadingLobbies, setLoadingLobbies] = useState(false);
    const [keybindOpen, setKeybindOpen] = useState(false);

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

    // Fetch active lobbies on mount and every 10 seconds
    useEffect(() => {
        const fetchLobbies = async () => {
            try {
                setLoadingLobbies(true);
                const data = await api.getActiveLobbies();
                setLobbies(Array.isArray(data) ? data : (data as any).lobbies || []);
            } catch (err) {
                console.error('Failed to fetch lobbies:', err);
                setLobbies([]);
            } finally {
                setLoadingLobbies(false);
            }
        };

        fetchLobbies();
        const interval = setInterval(fetchLobbies, 10000);
        return () => clearInterval(interval);
    }, []);

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

                <button
                    className="btn btn-ghost"
                    onClick={() => navigate('/leaderboard')}
                    style={{ width: '100%' }}
                >
                    View Leaderboard
                </button>

                <button
                    className="btn btn-ghost"
                    onClick={() => navigate('/loadout')}
                    style={{ width: '100%' }}
                >
                    Loadout &amp; Store
                </button>

                <button
                    className="btn btn-ghost"
                    onClick={() => setKeybindOpen(true)}
                    style={{ width: '100%' }}
                >
                    Keybind Settings
                </button>

                {/* Open Lobbies Section */}
                <div style={{
                    marginTop: 'var(--space-lg)',
                    paddingTop: 'var(--space-md)',
                    borderTop: '1px solid var(--color-border)',
                }}>
                    <h2 style={{
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--color-text-secondary)',
                        marginBottom: 'var(--space-md)',
                    }}>
                        Open Lobbies
                    </h2>

                    {loadingLobbies && (
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                            Loading lobbies...
                        </p>
                    )}

                    {!loadingLobbies && lobbies.length === 0 && (
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                            No open lobbies
                        </p>
                    )}

                    {!loadingLobbies && lobbies.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            {lobbies
                                .filter((lobby: any) => {
                                    const playerCount = Array.isArray(lobby.players) ? lobby.players.length : 0;
                                    return playerCount < (lobby.maxPlayers || 4);
                                })
                                .map((lobby: any) => {
                                    const playerCount = Array.isArray(lobby.players) ? lobby.players.length : 0;
                                    const maxPlayers = lobby.maxPlayers || 4;
                                    return (
                                        <div
                                            key={lobby.code}
                                            style={{
                                                padding: 'var(--space-sm) var(--space-md)',
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: 'var(--radius-md)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                gap: 'var(--space-md)',
                                            }}
                                        >
                                            <div style={{ flex: 1 }}>
                                                <div style={{
                                                    fontFamily: 'var(--font-mono)',
                                                    fontWeight: 600,
                                                    letterSpacing: '0.1em',
                                                    marginBottom: '4px',
                                                }}>
                                                    {lobby.code}
                                                </div>
                                                <div style={{
                                                    fontSize: '0.85rem',
                                                    color: 'var(--color-text-secondary)',
                                                }}>
                                                    {playerCount}/{maxPlayers} players • Best of {lobby.bestOf || 1}
                                                </div>
                                            </div>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => {
                                                    setLobby(lobby.code, false);
                                                    navigate(`/lobby/${lobby.code}`);
                                                }}
                                            >
                                                Join
                                            </button>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>
            </div>

            <KeybindSettings isOpen={keybindOpen} onClose={() => setKeybindOpen(false)} />
        </div>
    );
}
