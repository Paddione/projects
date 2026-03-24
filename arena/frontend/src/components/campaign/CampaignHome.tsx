/**
 * CampaignHome — Campaign start/continue screen.
 *
 * Shows character selection and lets the player start a new campaign
 * or continue an existing one. Loads progress from the REST API and
 * emits socket events to start/continue sessions.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/apiService';
import { getSocket } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';

const CHARACTERS = [
  { id: 'student', name: 'Student', color: '#4fc3f7' },
  { id: 'researcher', name: 'Researcher', color: '#81c784' },
  { id: 'professor', name: 'Professor', color: '#ffb74d' },
  { id: 'dean', name: 'Dean', color: '#e57373' },
  { id: 'librarian', name: 'Librarian', color: '#ba68c8' },
] as const;

interface CampaignProgress {
  id: number;
  auth_user_id: number;
  character_id: string;
  current_map_id: string;
  spawn_x: number;
  spawn_y: number;
  hp: number;
  respect: number;
  english_level: string;
  quests: Array<{
    quest_id: string;
    status: string;
    progress: Record<string, number>;
    respect_earned: number;
  }>;
}

export default function CampaignHome() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [selectedCharacter, setSelectedCharacter] = useState('student');
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  // Load existing campaign progress
  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      try {
        const data = await api.campaign.getProgress();
        if (!cancelled) {
          setProgress(data as CampaignProgress | null);
          if (data && (data as CampaignProgress).character_id) {
            setSelectedCharacter((data as CampaignProgress).character_id);
          }
        }
      } catch (err) {
        console.error('Failed to load campaign progress:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProgress();
    return () => { cancelled = true; };
  }, []);

  const handleStart = useCallback(() => {
    setStarting(true);
    setError('');
    const socket = getSocket();

    const onStarted = (data: { sessionId: string }) => {
      socket.off('campaign-session-started', onStarted);
      socket.off('campaign-error', onError);
      navigate(`/campaign/play/${data.sessionId}`);
    };

    const onError = (data: { message: string }) => {
      socket.off('campaign-session-started', onStarted);
      socket.off('campaign-error', onError);
      setError(data.message);
      setStarting(false);
    };

    socket.on('campaign-session-started', onStarted);
    socket.on('campaign-error', onError);
    socket.emit('campaign-start', { characterId: selectedCharacter });
  }, [selectedCharacter, navigate]);

  const handleContinue = useCallback(() => {
    setStarting(true);
    setError('');
    const socket = getSocket();

    const onStarted = (data: { sessionId: string }) => {
      socket.off('campaign-session-started', onStarted);
      socket.off('campaign-error', onError);
      navigate(`/campaign/play/${data.sessionId}`);
    };

    const onError = (data: { message: string }) => {
      socket.off('campaign-session-started', onStarted);
      socket.off('campaign-error', onError);
      setError(data.message);
      setStarting(false);
    };

    socket.on('campaign-session-started', onStarted);
    socket.on('campaign-error', onError);
    socket.emit('campaign-continue');
  }, [navigate]);

  return (
    <div className="page">
      <h1 className="page-title">WORLD CAMPAIGN</h1>
      <p className="page-subtitle">Explore, Learn, Conquer</p>

      {user && (
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
          Playing as <strong>{user.username}</strong>
        </p>
      )}

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
        width: '100%',
        maxWidth: '420px',
      }}>
        {error && (
          <p style={{ color: 'var(--color-danger)', fontSize: '0.9rem', textAlign: 'center' }}>
            {error}
          </p>
        )}

        {/* Character Select */}
        <div style={{ marginBottom: 'var(--space-sm)' }}>
          <h2 style={{
            fontSize: '0.9rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-sm)',
          }}>
            Choose Your Character
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 'var(--space-sm)',
          }}>
            {CHARACTERS.map((char) => (
              <button
                key={char.id}
                onClick={() => setSelectedCharacter(char.id)}
                style={{
                  padding: 'var(--space-sm)',
                  background: selectedCharacter === char.id
                    ? `${char.color}33`
                    : 'rgba(255, 255, 255, 0.05)',
                  border: selectedCharacter === char.id
                    ? `2px solid ${char.color}`
                    : '2px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {/* Placeholder avatar circle */}
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: char.color,
                  opacity: selectedCharacter === char.id ? 1 : 0.5,
                  transition: 'opacity 0.15s ease',
                }} />
                <span style={{
                  fontSize: '0.7rem',
                  color: selectedCharacter === char.id
                    ? char.color
                    : 'var(--color-text-muted)',
                  fontWeight: selectedCharacter === char.id ? 600 : 400,
                }}>
                  {char.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <button
          className="btn btn-primary btn-lg"
          onClick={handleStart}
          disabled={starting || loading}
          style={{ width: '100%' }}
        >
          {starting ? 'Starting...' : 'Start New Campaign'}
        </button>

        {progress && (
          <button
            className="btn btn-ghost btn-lg"
            onClick={handleContinue}
            disabled={starting || loading}
            style={{
              width: '100%',
              borderColor: '#00f2ff',
              color: '#00f2ff',
            }}
          >
            {starting ? 'Loading...' : 'Continue Campaign'}
          </button>
        )}

        {/* Progress Summary */}
        {progress && !loading && (
          <div style={{
            padding: 'var(--space-md)',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{
              fontSize: '0.85rem',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}>
              <span>Map: <strong style={{ color: '#fff' }}>{progress.current_map_id}</strong></span>
              <span>Respect: <strong style={{ color: '#00f2ff' }}>{progress.respect}</strong></span>
              <span>Quests: <strong style={{ color: '#fff' }}>
                {progress.quests?.filter(q => q.status === 'complete').length || 0} completed
              </strong></span>
            </div>
          </div>
        )}

        {loading && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
            Loading progress...
          </p>
        )}

        {/* Back Button */}
        <button
          className="btn btn-ghost"
          onClick={() => navigate('/')}
          style={{ width: '100%' }}
        >
          Back to Arena
        </button>
      </div>
    </div>
  );
}
