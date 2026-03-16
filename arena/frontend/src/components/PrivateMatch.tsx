import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSocket } from '../services/apiService';
import { useGameStore } from '../stores/gameStore';

interface EscrowInfo {
    lobbyCode: string;
    escrowedXp: number;
    playerIds: string[];
}

interface SettlementResult {
    winnerId: string;
    xpAwarded: number;
    respectAwarded: number;
    losers: string[];
}

export default function PrivateMatch() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const socket = getSocket();
    const { playerId, setMatch } = useGameStore();

    const [phase, setPhase] = useState<'joining' | 'waiting' | 'settled' | 'error'>('joining');
    const [escrow, setEscrow] = useState<EscrowInfo | null>(null);
    const [settlement, setSettlement] = useState<SettlementResult | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const joinedRef = useRef(false);

    useEffect(() => {
        if (!token || joinedRef.current) return;
        joinedRef.current = true;

        socket.emit('join-private-match', { token });

        socket.on('private-match-joined', (data: EscrowInfo) => {
            setEscrow(data);
            setPhase('waiting');
        });

        socket.on('private-match-error', (data: { message: string }) => {
            setErrorMsg(data.message);
            setPhase('error');
        });

        socket.on('game-starting', () => {
            // Transition is handled via game-state event below
        });

        socket.on('game-state', (state: any) => {
            if (state.matchId && phase !== 'settled') {
                setMatch(state.matchId);
                navigate(`/game/${state.matchId}`);
            }
        });

        socket.on('deathmatch-settled', (data: SettlementResult) => {
            setSettlement(data);
            setPhase('settled');
        });

        return () => {
            socket.off('private-match-joined');
            socket.off('private-match-error');
            socket.off('game-starting');
            socket.off('game-state');
            socket.off('deathmatch-settled');
        };
    }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

    const returnToL2P = () => {
        window.location.href = 'https://l2p.korczewski.de';
    };

    if (phase === 'joining') {
        return (
            <div className="private-match">
                <div className="private-match-card">
                    <div className="spinner" />
                    <h2>Joining Deathmatch...</h2>
                    <p className="subtitle">Validating your match token</p>
                </div>
            </div>
        );
    }

    if (phase === 'error') {
        return (
            <div className="private-match">
                <div className="private-match-card error">
                    <h2>Match Error</h2>
                    <p className="error-msg">{errorMsg}</p>
                    <div className="private-match-buttons">
                        <button className="btn-secondary" onClick={returnToL2P}>
                            Return to L2P
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === 'waiting' && escrow) {
        const joined = escrow.playerIds.length;
        return (
            <div className="private-match">
                <div className="private-match-card">
                    <h2>Deathmatch Lobby</h2>
                    <div className="escrow-info">
                        <div className="escrow-stat">
                            <span className="escrow-label">Escrowed XP</span>
                            <span className="escrow-value">{escrow.escrowedXp} XP</span>
                        </div>
                        <div className="escrow-stat">
                            <span className="escrow-label">Players</span>
                            <span className="escrow-value">{joined}</span>
                        </div>
                    </div>
                    <p className="waiting-msg">Waiting for all players to connect...</p>
                    <div className="player-slots">
                        {escrow.playerIds.map((pid, i) => (
                            <div key={pid} className={`player-slot ${pid === playerId ? 'you' : ''}`}>
                                Player {i + 1} {pid === playerId ? '(You)' : ''}
                            </div>
                        ))}
                    </div>
                    <p className="auto-start-note">Match will start automatically when everyone joins.</p>
                </div>
            </div>
        );
    }

    if (phase === 'settled' && settlement) {
        const isWinner = settlement.winnerId === playerId;
        return (
            <div className="private-match">
                <div className={`private-match-card ${isWinner ? 'victory' : 'defeat'}`}>
                    <h1 className="settlement-title">
                        {isWinner ? 'Victory!' : 'Defeat'}
                    </h1>
                    <div className="settlement-rewards">
                        {isWinner && (
                            <>
                                <div className="reward-item">
                                    <span className="reward-label">XP Won</span>
                                    <span className="reward-value xp">+{settlement.xpAwarded} XP</span>
                                </div>
                                <div className="reward-item">
                                    <span className="reward-label">Respect Earned</span>
                                    <span className="reward-value respect">+{settlement.respectAwarded}</span>
                                </div>
                            </>
                        )}
                        {!isWinner && (
                            <div className="reward-item">
                                <span className="reward-label">Better luck next time!</span>
                                <span className="reward-value loss">-{settlement.xpAwarded} XP transferred to winner</span>
                            </div>
                        )}
                    </div>
                    <div className="private-match-buttons">
                        <button className="btn-primary" onClick={returnToL2P}>
                            Return to L2P
                        </button>
                        <button className="btn-secondary" onClick={() => navigate('/')}>
                            Play Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
