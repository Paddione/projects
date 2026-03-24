/**
 * MapTransitionOverlay — Full-screen fade overlay for door transitions.
 *
 * Drives a CSS opacity transition through three phases:
 *   1. fade-out: opacity 0 -> 1 (screen goes dark)
 *   2. loading:  hold at opacity 1 (waiting for new map)
 *   3. fade-in:  opacity 1 -> 0 (reveal new map)
 *
 * Reads phase from props, drives timeouts to advance the state machine.
 */

import { useEffect, useState } from 'react';

export type TransitionPhase = 'idle' | 'fade-out' | 'loading' | 'fade-in';

interface MapTransitionOverlayProps {
  phase: TransitionPhase;
  targetMapName?: string;
  onPhaseComplete: (completedPhase: TransitionPhase) => void;
}

const FADE_DURATION_MS = 400;

export default function MapTransitionOverlay({
  phase,
  targetMapName,
  onPhaseComplete,
}: MapTransitionOverlayProps) {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (phase === 'idle') {
      setOpacity(0);
      return;
    }

    if (phase === 'fade-out') {
      // Start at 0, transition to 1
      setOpacity(0);
      requestAnimationFrame(() => {
        setOpacity(1);
      });
      const timer = setTimeout(() => {
        onPhaseComplete('fade-out');
      }, FADE_DURATION_MS);
      return () => clearTimeout(timer);
    }

    if (phase === 'loading') {
      setOpacity(1);
      // Loading phase completes when the parent signals map is ready
      // (parent calls onPhaseComplete('loading') externally)
      return;
    }

    if (phase === 'fade-in') {
      setOpacity(1);
      requestAnimationFrame(() => {
        setOpacity(0);
      });
      const timer = setTimeout(() => {
        onPhaseComplete('fade-in');
      }, FADE_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, [phase, onPhaseComplete]);

  if (phase === 'idle') return null;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 300,
      background: '#000',
      opacity,
      transition: `opacity ${FADE_DURATION_MS}ms ease`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'all',
    }}>
      {(phase === 'loading' || phase === 'fade-out') && targetMapName && (
        <p style={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '1rem',
          fontWeight: 500,
          letterSpacing: '0.05em',
        }}>
          {targetMapName}
        </p>
      )}
    </div>
  );
}
