import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { getSocket } from '../services/apiService';

export default function Lobby() {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const socket = getSocket();

    const {
        playerId, username, isHost, players, settings,
        setLobby, setPlayers, setSettings, leaveLobby, setMatch,
    } = useGameStore();

    const [, setIsJoined] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!code || !playerId || !username) {
            navigate('/');
            return;
        }

        // Join the lobby via socket
        socket.emit('join-lobby', {
            lobbyCode: code,
            player: {
                id: playerId,
                username,
                character: 'student',
                characterLevel: 1,
                isReady: false,
                isConnected: true,
            },
        });

        socket.on('join-success', (data: any) => {
            setIsJoined(true);
            setLobby(code, String(data.lobby.authUserId) === playerId);
            setPlayers(data.lobby.players);
            if (data.lobby.settings) setSettings(data.lobby.settings);
        });

        socket.on('join-error', (data: any) => {
            setError(data.message);
        });

        socket.on('lobby-updated', (lobby: any) => {
            setPlayers(lobby.players);
            if (lobby.settings) setSettings(lobby.settings);
        });

        socket.on('lobby-deleted', () => {
            leaveLobby();
            navigate('/');
        });

        socket.on('game-starting', (_data: any) => {
            // Show countdown then transition
        });

        socket.on('round-start', (_data: any) => {
            // Transition to game view — matchId will come from game-state
        });

        socket.on('game-state', (state: any) => {
            if (state.matchId) {
                setMatch(state.matchId);
                navigate(`/game/${state.matchId}`);
            }
        });

        return () => {
            socket.off('join-success');
            socket.off('join-error');
            socket.off('lobby-updated');
            socket.off('lobby-deleted');
            socket.off('game-starting');
            socket.off('round-start');
            socket.off('game-state');
        };
    }, [code, playerId, username]);

    const handleReady = () => {
        if (!code || !playerId) return;
        const me = players.find((p) => p.id === playerId);
        socket.emit('player-ready', {
            lobbyCode: code,
            playerId,
            isReady: !me?.isReady,
        });
    };

    const handleStart = () => {
        if (!code || !playerId) return;
        socket.emit('start-game', {
            lobbyCode: code,
            hostId: parseInt(playerId),
        });
    };

    const handleLeave = () => {
        if (!code || !playerId) return;
        socket.emit('leave-lobby', { lobbyCode: code, playerId });
        leaveLobby();
        navigate('/');
    };

    const handleSettingToggle = (key: 'shrinkingZone' | 'itemSpawns') => {
        if (!isHost || !code || !playerId) return;
        socket.emit('update-settings', {
            lobbyCode: code,
            hostId: parseInt(playerId),
            settings: { [key]: !settings[key] },
        });
    };

    const handleBestOf = (value: 1 | 3 | 5) => {
        if (!isHost || !code || !playerId) return;
        socket.emit('update-settings', {
            lobbyCode: code,
            hostId: parseInt(playerId),
            settings: { bestOf: value },
        });
    };

    const handleNpcEnemies = (value: 0 | 1 | 2 | 3) => {
        if (!isHost || !code || !playerId) return;
        socket.emit('update-settings', {
            lobbyCode: code,
            hostId: parseInt(playerId),
            settings: { npcEnemies: value },
        });
    };

    const handleMapId = (value: 'campus' | 'warehouse' | 'forest') => {
        if (!isHost || !code || !playerId) return;
        socket.emit('update-settings', {
            lobbyCode: code,
            hostId: parseInt(playerId),
            settings: { mapId: value },
        });
    };

    const handleMapSize = (value: 1 | 2 | 3) => {
        if (!isHost || !code || !playerId) return;
        socket.emit('update-settings', {
            lobbyCode: code,
            hostId: parseInt(playerId),
            settings: { mapSize: value },
        });
    };

    const MAP_OPTIONS = [
        { id: 'campus' as const, name: 'Campus Courtyard', desc: 'Balanced & symmetric' },
        { id: 'warehouse' as const, name: 'Warehouse District', desc: 'Tight corridors' },
        { id: 'forest' as const, name: 'Forest Clearing', desc: 'Open sightlines' },
    ];

    const totalParticipants = players.length + (settings.npcEnemies || 0);
    const allReady = totalParticipants >= 2 && players.every((p) => p.isReady);
    const me = players.find((p) => p.id === playerId);

    if (error) {
        return (
            <div className="page">
                <h1 className="page-title">❌ Error</h1>
                <p className="page-subtitle">{error}</p>
                <button className="btn btn-primary" onClick={() => navigate('/')}>Back Home</button>
            </div>
        );
    }

    return (
        <div className="page">
            <h1 className="page-title" style={{ fontSize: '2rem', marginBottom: 'var(--space-xs)' }}>
                LOBBY
            </h1>

            <div className="lobby-code">{code}</div>

            <p style={{ color: 'var(--color-text-muted)', margin: 'var(--space-md) 0', fontSize: '0.9rem' }}>
                Share this code with friends to play
            </p>

            {/* Player List */}
            <div className="player-list" style={{ marginBottom: 'var(--space-xl)' }}>
                {players.map((p) => (
                    <div key={p.id} className={`player-item ${p.isReady ? 'ready' : ''} ${p.isHost ? 'host' : ''}`}>
                        <div>
                            <span className="player-name">{p.username}</span>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginLeft: 'var(--space-sm)' }}>
                                Lv.{p.characterLevel}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                            {p.isHost && <span className="player-badge badge-host">HOST</span>}
                            {p.isReady && <span className="player-badge badge-ready">READY</span>}
                        </div>
                    </div>
                ))}

                {players.length < settings.maxPlayers && (
                    <div className="player-item" style={{ opacity: 0.3, borderStyle: 'dashed' }}>
                        <span className="player-name">
                            Waiting for player...{settings.npcEnemies > 0 ? ' (optional)' : ''}
                        </span>
                    </div>
                )}
            </div>

            {/* Settings (host only) */}
            {isHost && (
                <div className="settings-panel" style={{ marginBottom: 'var(--space-xl)' }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                        ⚙️ Match Settings
                    </h3>

                    <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 'var(--space-sm)' }}>
                        <span className="setting-label">Arena</span>
                        <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                            {MAP_OPTIONS.map((m) => (
                                <button
                                    key={m.id}
                                    className={`btn ${settings.mapId === m.id ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ padding: '6px 12px', fontSize: '0.8rem', flex: '1 1 auto', textAlign: 'center' }}
                                    onClick={() => handleMapId(m.id)}
                                    title={m.desc}
                                >
                                    {m.name}
                                </button>
                            ))}
                        </div>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                            {MAP_OPTIONS.find((m) => m.id === settings.mapId)?.desc}
                        </span>
                    </div>

                    <div className="setting-row">
                        <span className="setting-label">Map Size</span>
                        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                            {([1, 2, 3] as const).map((n) => (
                                <button
                                    key={n}
                                    className={`btn ${settings.mapSize === n ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                                    onClick={() => handleMapSize(n)}
                                >
                                    {n === 1 ? '1x' : n === 2 ? '2x' : '3x'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="setting-row">
                        <span className="setting-label">Best of</span>
                        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                            {([1, 3, 5] as const).map((n) => (
                                <button
                                    key={n}
                                    className={`btn ${settings.bestOf === n ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                                    onClick={() => handleBestOf(n)}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="setting-row">
                        <span className="setting-label">Shrinking Zone</span>
                        <div
                            className={`toggle ${settings.shrinkingZone ? 'active' : ''}`}
                            onClick={() => handleSettingToggle('shrinkingZone')}
                        />
                    </div>

                    <div className="setting-row">
                        <span className="setting-label">Item Spawns</span>
                        <div
                            className={`toggle ${settings.itemSpawns ? 'active' : ''}`}
                            onClick={() => handleSettingToggle('itemSpawns')}
                        />
                    </div>

                    <div className="setting-row">
                        <span className="setting-label">NPC Enemies</span>
                        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                            {([0, 1, 2, 3] as const).map((n) => (
                                <button
                                    key={n}
                                    className={`btn ${settings.npcEnemies === n ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                                    onClick={() => handleNpcEnemies(n)}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Map info for non-host players */}
            {!isHost && (
                <div style={{ marginBottom: 'var(--space-xl)', color: 'var(--color-text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
                    <span style={{ fontWeight: 600 }}>
                        {MAP_OPTIONS.find((m) => m.id === settings.mapId)?.name ?? 'Campus Courtyard'}
                    </span>
                    {settings.mapSize > 1 && <span> ({settings.mapSize}x size)</span>}
                </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                <button className="btn btn-ghost" onClick={handleLeave} id="leave-lobby-btn">
                    Leave
                </button>

                {!me?.isReady ? (
                    <button className="btn btn-primary btn-lg" onClick={handleReady} id="ready-btn">
                        ✅ Ready Up
                    </button>
                ) : (
                    <button className="btn btn-danger btn-lg" onClick={handleReady} id="unready-btn">
                        ❌ Unready
                    </button>
                )}

                {isHost && (
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={handleStart}
                        disabled={!allReady}
                        id="start-game-btn"
                        style={{
                            background: allReady
                                ? 'linear-gradient(135deg, #34d399, #10b981)'
                                : undefined
                        }}
                    >
                        🚀 Start Game
                    </button>
                )}
            </div>
        </div>
    );
}
