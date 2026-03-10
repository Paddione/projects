import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/apiService';

interface LeaderboardEntry {
    username: string;
    selected_character: string;
    total_kills: number;
    total_deaths: number;
    total_wins: number;
    games_played: number;
    experience: number;
    character_level: number;
    kd_ratio: number;
    win_rate: number;
}

export default function Leaderboard() {
    const navigate = useNavigate();
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const data = await api.getLeaderboard();
                setEntries(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Failed to fetch leaderboard:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, []);

    return (
        <div className="page">
            <h1 className="page-title">LEADERBOARD</h1>
            <p className="page-subtitle">Top Arena Fighters</p>

            <div style={{ width: '100%', maxWidth: '700px', marginTop: 'var(--space-lg)' }}>
                {loading && (
                    <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>Loading...</p>
                )}

                {!loading && entries.length === 0 && (
                    <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>
                        No players yet. Play a match to appear here!
                    </p>
                )}

                {!loading && entries.length > 0 && (
                    <table className="results-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Player</th>
                                <th>Level</th>
                                <th>W / L</th>
                                <th>Win %</th>
                                <th>K / D</th>
                                <th>K/D Ratio</th>
                                <th>XP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry, i) => (
                                <tr key={entry.username}>
                                    <td className="placement">
                                        {i === 0 && '🥇'}
                                        {i === 1 && '🥈'}
                                        {i === 2 && '🥉'}
                                        {i > 2 && `#${i + 1}`}
                                    </td>
                                    <td className="player-info">
                                        <div className="username">{entry.username}</div>
                                        <div className="character">{entry.selected_character}</div>
                                    </td>
                                    <td>{entry.character_level}</td>
                                    <td>
                                        <span className="kills">{entry.total_wins}</span>
                                        <span className="separator"> / </span>
                                        <span className="deaths">{entry.games_played - entry.total_wins}</span>
                                    </td>
                                    <td>{entry.win_rate}%</td>
                                    <td>
                                        <span className="kills">{entry.total_kills}</span>
                                        <span className="separator"> / </span>
                                        <span className="deaths">{entry.total_deaths}</span>
                                    </td>
                                    <td>{entry.kd_ratio}</td>
                                    <td className="xp">{entry.experience}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                <div className="results-buttons" style={{ marginTop: 'var(--space-lg)' }}>
                    <button className="btn-primary" onClick={() => navigate('/')}>
                        ← Back to Home
                    </button>
                </div>
            </div>
        </div>
    );
}
