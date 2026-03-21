import { useEffect } from 'react';
import { SoundService } from '../services/SoundService';
import type { MutableRefObject } from 'react';

interface UseGameAudioOptions {
  mouseRef: MutableRefObject<{ down: boolean; rightDown: boolean }>;
  keysRef: MutableRefObject<Set<string>>;
}

export function useGameAudio({ mouseRef, keysRef }: UseGameAudioOptions) {
  // Stop music on unmount (music is started by round-start socket event)
  useEffect(() => {
    return () => { SoundService.stopMusic(); };
  }, []);

  // Shooting/melee SFX detection
  useEffect(() => {
    const shootCheck = setInterval(() => {
      if (mouseRef.current.down) {
        SoundService.playSFX('gunshot', { volume: 0.6 });
      }
      if (mouseRef.current.rightDown || keysRef.current.has('e')) {
        SoundService.playSFX('melee_swing', { volume: 0.7 });
      }
    }, 250);
    return () => clearInterval(shootCheck);
  }, [mouseRef, keysRef]);
}
