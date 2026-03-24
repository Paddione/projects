/**
 * SaveIndicator — Checkpoint saved toast notification.
 *
 * Shows "Checkpoint saved" for 2 seconds with fade-in/fade-out animation.
 * Watches campaignStore.saveIndicator for trigger events.
 */

import { useState, useEffect } from 'react';

interface SaveIndicatorProps {
  visible: boolean;
}

export default function SaveIndicator({ visible }: SaveIndicatorProps) {
  const [opacity, setOpacity] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Fade in after mount
      requestAnimationFrame(() => {
        setOpacity(1);
      });

      // Fade out after 1.5s
      const fadeTimer = setTimeout(() => {
        setOpacity(0);
      }, 1500);

      // Unmount after fade-out completes
      const unmountTimer = setTimeout(() => {
        setMounted(false);
      }, 2000);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(unmountTimer);
      };
    } else {
      setOpacity(0);
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
      padding: '8px 20px',
      background: 'rgba(0, 242, 255, 0.15)',
      border: '1px solid rgba(0, 242, 255, 0.4)',
      borderRadius: 6,
      color: '#00f2ff',
      fontSize: '0.85rem',
      fontWeight: 600,
      letterSpacing: '0.03em',
      opacity,
      transition: 'opacity 0.4s ease',
      pointerEvents: 'none',
    }}>
      Checkpoint saved
    </div>
  );
}
