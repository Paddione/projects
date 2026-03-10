import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/apiService';

interface MatchResultData {
    winnerId: string;
    results: Array<{
        playerId: string;
        username: string;
        character: string;
        kills: number;
        deaths: number;
        damageDealt: number;
        itemsCollected: number;
        roundsWon: number;
        placement: number;
        experienceGained: number;
        levelBefore?: number;
        levelAfter?: number;
    }>;
}

export default function MatchResults() {
    const { matchId } = useParams<{ matchId: string }>();
    const navigate = useNavigate();
    const [results, setResults] = useState<MatchResultData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchResults = async () => {
            try {
                if (!matchId) {
                    setError('No match ID provided');
                    return;
                }
                const data = await api.getMatchResults(parseInt(matchId));
                setResults(data as MatchResultData);
            } catch (err) {
                console.error('Failed to fetch match results:', err);
                setError('Failed to load match results');
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [matchId]);

    if (loading) {
        return (
            <div className="match-results">
                <div className="loading">Loading match results...</div>
            </div>
        );
    }

    if (error || !results) {
        return (
            <div className="match-results">
                <div className="error">{error || 'Failed to load results'}</div>
                <button onClick={() => navigate('/')}>Back to Home</button>
            </div>
        );
    }

    if (!results.results || results.results.length === 0) {
        return (
            <div className="match-results">
                <div className="error">Keine Ergebnisse verfügbar</div>
                <button onClick={() => navigate('/')}>Back to Home</button>
            </div>
        );
    }

    const winner = results.results[0];
    const isWin = winner?.placement === 1;
    const levelUpPlayers = results.results.filter((r) => (r.levelAfter ?? 1) > (r.levelBefore ?? 1));

    return (
        <div className="match-results">
            <div className={`results-container ${isWin ? 'victory' : 'defeat'}`}>
                {levelUpPlayers.length > 0 && (
                    <div className="level-up-section">
                        {levelUpPlayers.map((player) => (
                            <div key={player.playerId} className="level-up-banner">
                                <div className="level-up-content">
                                    <span className="level-emoji">⭐</span>
                                    <div className="level-text">
                                        <div className="level-up-player">{player.username}</div>
                                        <div className="level-transition">
                                            Level {player.levelBefore} → {player.levelAfter}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <h1 className="results-title">
                    {isWin ? '🏆 VICTORY' : '💀 DEFEAT'}
                </h1>

                {/* Podium */}
                <div className="podium-section">
                    {results.results.slice(0, 3).map((result) => (
                        <div key={result.playerId} className={`podium-position place-${result.placement}`}>
                            <div className="medal">
                                {result.placement === 1 && '🥇'}
                                {result.placement === 2 && '🥈'}
                                {result.placement === 3 && '🥉'}
                            </div>
                            <div className="player-name">{result.username}</div>
                            <div className="player-character">{result.character}</div>
                            <div className="player-kills">{result.kills} kills</div>
                        </div>
                    ))}
                </div>

                {/* Full Results Table */}
                <div className="results-table-section">
                    <h2>Match Stats</h2>
                    <table className="results-table">
                        <thead>
                            <tr>
                                <th>Placement</th>
                                <th>Player</th>
                                <th>Kills / Deaths</th>
                                <th>Damage</th>
                                <th>Items</th>
                                <th>Rounds Won</th>
                                <th>XP Gained</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.results.map((result) => (
                                <tr key={result.playerId} className={`placement-${result.placement}`}>
                                    <td className="placement">#{result.placement}</td>
                                    <td className="player-info">
                                        <div className="username">{result.username}</div>
                                        <div className="character">{result.character}</div>
                                    </td>
                                    <td className="kd">
                                        <span className="kills">{result.kills}</span>
                                        <span className="separator">/</span>
                                        <span className="deaths">{result.deaths}</span>
                                    </td>
                                    <td className="damage">{result.damageDealt}</td>
                                    <td className="items">{result.itemsCollected}</td>
                                    <td className="rounds">{result.roundsWon}</td>
                                    <td className="xp">+{result.experienceGained}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Action Buttons */}
                <div className="results-buttons">
                    <button className="btn-primary" onClick={() => navigate('/')}>
                        ← Back to Home
                    </button>
                    <button className="btn-secondary" onClick={() => navigate('/leaderboard')}>
                        View Leaderboard →
                    </button>
                </div>
            </div>
        </div>
    );
}
