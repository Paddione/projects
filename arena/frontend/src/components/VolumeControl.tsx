import { useState, useEffect, useRef, useCallback } from 'react';
import { SoundService } from '../services/SoundService';

export function VolumeControl() {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(SoundService.isMuted);
  const [volumes, setVolumes] = useState(SoundService.getVolumes);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popup on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [open]);

  const handleMute = useCallback(() => {
    const nowMuted = SoundService.toggleMute();
    setMuted(nowMuted);
  }, []);

  const handleVolume = useCallback((key: 'master' | 'sfx' | 'music', value: number) => {
    if (key === 'master') SoundService.setMasterVolume(value);
    else if (key === 'sfx') SoundService.setSFXVolume(value);
    else SoundService.setMusicVolume(value);
    setVolumes(SoundService.getVolumes());
  }, []);

  const icon = muted ? '🔇' : volumes.master < 0.3 ? '🔈' : '🔊';

  const sliders: { key: 'master' | 'sfx' | 'music'; label: string }[] = [
    { key: 'master', label: 'Master' },
    { key: 'sfx', label: 'SFX' },
    { key: 'music', label: 'Music' },
  ];

  return (
    <div ref={containerRef} className="volume-control">
      <button onClick={() => setOpen(!open)} className="hud-icon-btn">
        {icon}
      </button>

      {open && (
        <div className="volume-popup">
          <button onClick={handleMute} className="volume-mute-btn">
            {muted ? '🔇 Unmute' : '🔊 Mute'}
          </button>

          {sliders.map(({ key, label }) => (
            <label key={key} className="volume-slider-row">
              <span className="volume-label">{label}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volumes[key] * 100)}
                onChange={(e) => handleVolume(key, parseInt(e.target.value) / 100)}
                className="volume-slider"
              />
              <span className="volume-value">{Math.round(volumes[key] * 100)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
