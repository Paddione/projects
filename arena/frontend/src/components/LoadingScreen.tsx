/**
 * LoadingScreen — Displayed while assets preload.
 * Shows a progress bar and status message.
 */

import { useEffect, useState } from 'react';
import { AssetService } from '../services/AssetService';
import { SoundService } from '../services/SoundService';

interface LoadingScreenProps {
    onLoaded: () => void;
}

export default function LoadingScreen({ onLoaded }: LoadingScreenProps) {
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('Loading sprites...');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadAssets() {
            try {
                // Phase 1: Load sprite atlases (70% of progress)
                setStatus('Loading sprites...');
                await AssetService.loadAll((p) => {
                    if (!cancelled) setProgress(p * 0.7);
                });

                if (cancelled) return;

                // Phase 2: Load audio (30% of progress)
                setStatus('Loading audio...');
                setProgress(0.7);
                await SoundService.loadAll();

                if (cancelled) return;

                setProgress(1);
                setStatus('Ready!');

                // Brief delay to show "Ready!" before transitioning
                setTimeout(() => {
                    if (!cancelled) onLoaded();
                }, 300);
            } catch (err) {
                console.error('[LoadingScreen] Asset loading failed:', err);
                if (!cancelled) {
                    setError('Failed to load assets. Continuing without sprites...');
                    // Still allow game to proceed (falls back to Graphics rendering)
                    setTimeout(() => {
                        if (!cancelled) onLoaded();
                    }, 2000);
                }
            }
        }

        loadAssets();
        return () => { cancelled = true; };
    }, [onLoaded]);

    const percent = Math.round(progress * 100);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0a0b1a',
            color: '#e0e0e0',
            fontFamily: 'Outfit, sans-serif',
            zIndex: 9999,
        }}>
            {/* Title */}
            <h1 style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                color: '#818cf8',
                marginBottom: '2rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
            }}>
                ARENA
            </h1>

            {/* Progress bar container */}
            <div style={{
                width: '300px',
                height: '6px',
                borderRadius: '3px',
                backgroundColor: '#1e1f3a',
                overflow: 'hidden',
                marginBottom: '1rem',
            }}>
                {/* Progress fill */}
                <div style={{
                    width: `${percent}%`,
                    height: '100%',
                    borderRadius: '3px',
                    backgroundColor: '#6366f1',
                    transition: 'width 0.3s ease',
                }} />
            </div>

            {/* Status text */}
            <p style={{
                fontSize: '0.875rem',
                color: '#666',
            }}>
                {error || status} {!error && `${percent}%`}
            </p>
        </div>
    );
}
