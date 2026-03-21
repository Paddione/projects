import { useState, useCallback, type MutableRefObject } from 'react';
import { useGameStore } from '../stores/gameStore';
import { SoundService } from '../services/SoundService';
import EmoteWheel from './EmoteWheel';
import { SettingsPanel } from './SettingsPanel';

export const SCALE_OPTIONS = [
  { key: 'auto', label: 'Auto' },
  { key: '1', label: '1× (720p)' },
  { key: '1.5', label: '1.5× (1080p)' },
  { key: '2', label: '2× (1440p)' },
  { key: '3', label: '3× (4K)' },
] as const;

interface GameHUDProps {
  gameStateRef: MutableRefObject<any>;
  isTouchDevice: boolean;
  leftPuck: { x: number; y: number };
  rightPuck: { x: number; y: number };
  sprintOn: boolean;
  meleeOn: boolean;
  onEmote: (emoteId: string) => void;
  onMelee: (active: boolean) => void;
  onSprint: () => void;
  onWeaponCycle: () => void;
  rightStickRef: MutableRefObject<any>;
  showScaleSelector?: boolean;
  scaleSetting?: string;
  onScaleChange?: (setting: string) => void;
}

const equippedEmotes: [string, string, string, string] = [
  'emote_wave', 'emote_gg', 'emote_thumbsup', 'emote_clap',
];

export function GameHUD({
  gameStateRef,
  isTouchDevice,
  leftPuck,
  rightPuck,
  sprintOn,
  meleeOn,
  onEmote,
  onMelee,
  onSprint,
  onWeaponCycle,
  rightStickRef,
  showScaleSelector = false,
  scaleSetting,
  onScaleChange,
}: GameHUDProps) {
  const {
    playerId, hp, hasArmor, kills, deaths, weaponType,
    killfeed, announcement, currentRound,
    isSpectating, spectatedPlayerId,
  } = useGameStore();

  const [isMuted, setIsMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const toggleMute = useCallback(() => {
    const nowMuted = SoundService.toggleMute();
    setIsMuted(nowMuted);
  }, []);

  return (
    <>
      <EmoteWheel equippedEmotes={equippedEmotes} onEmote={onEmote} />

      <div className="hud">
        {/* Health Display */}
        <div className="hud-health">
          {hasArmor && <div className="hp-icon armor">🛡️</div>}
          {[...Array(2)].map((_, i) => (
            <div key={i} className={`hp-icon ${i < hp ? 'full' : 'empty'}`}>
              {i < hp ? '❤️' : '💔'}
            </div>
          ))}
        </div>

        {/* Kill Feed */}
        <div className="hud-killfeed">
          {killfeed.map((entry, i) => (
            <div key={entry.timestamp + i} className="killfeed-entry">
              <span className="killer">{entry.killer}</span>
              {' '}
              {entry.weapon === 'melee' ? '🗡️' : entry.weapon === 'zone' ? '☠️' : '🔫'}
              {' '}
              <span className="victim">{entry.victim}</span>
            </div>
          ))}
        </div>

        {/* Weapon Indicator */}
        <div className="hud-weapon">
          {(() => {
            const me = gameStateRef.current?.players?.find((p: any) => p.id === playerId);
            const weapons: any[] = me?.weapons || [{ type: weaponType }];
            const activeIdx = me?.activeWeaponIndex ?? 0;
            const weaponIcons: Record<string, string> = { pistol: '🔫', machine_gun: '🔫', grenade_launcher: '💣' };
            const weaponNames: Record<string, string> = { pistol: 'Pistol', machine_gun: 'MG', grenade_launcher: 'GL' };
            return weapons.map((w: any, i: number) => (
              <div key={i} className={`weapon-slot ${i === activeIdx ? 'active' : ''}`}>
                <span className="weapon-icon">{weaponIcons[w.type] || '?'}</span>
                <span className="weapon-name">{weaponNames[w.type] || w.type}</span>
                {w.type !== 'pistol' && (
                  <span className="weapon-ammo">{w.clipAmmo}/{w.totalAmmo}</span>
                )}
              </div>
            ));
          })()}
          <div className="weapon-hint">Q / Scroll</div>
        </div>

        {/* Round Info */}
        <div className="hud-round">
          Round {currentRound} • K: {kills} D: {deaths}
        </div>

        {/* Announcement */}
        {announcement && <div className="hud-announcement">{announcement}</div>}

        {/* Top-left controls */}
        <div className="hud-top-left">
          <button onClick={toggleMute} className="hud-icon-btn">
            {isMuted ? '🔇' : '🔊'}
          </button>
          {showScaleSelector && scaleSetting && onScaleChange && (
            <div className="scale-selector">
              {SCALE_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => onScaleChange(opt.key)}
                  className={`scale-btn ${scaleSetting === opt.key ? 'active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Settings Gear Button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(10, 11, 26, 0.7)',
            border: '1px solid rgba(0, 242, 255, 0.3)',
            color: '#00f2ff',
            borderRadius: 4,
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: 18,
            zIndex: 10,
          }}
        >
          ⚙
        </button>
        {showSettings && (
          <div style={{ position: 'absolute', top: 36, right: 8, zIndex: 10 }}>
            <SettingsPanel onClose={() => setShowSettings(false)} />
          </div>
        )}

        {/* Spectating Banner */}
        {isSpectating && (
          <div style={{
            position: 'absolute',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 24px',
            background: 'rgba(10, 11, 26, 0.85)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-full)',
            color: 'var(--color-text-secondary)',
            fontWeight: 600,
          }}>
            👀 Spectating {gameStateRef.current?.players?.find(
              (p: any) => p.id === spectatedPlayerId
            )?.username || ''}
          </div>
        )}
      </div>

      {/* Touch Controls */}
      {isTouchDevice && (
        <div className="touch-controls">
          <div className="joystick-zone left">
            <div className="joystick-ring" />
            <div
              className="joystick-puck"
              style={{ transform: `translate(calc(-50% + ${leftPuck.x}px), calc(-50% + ${leftPuck.y}px))` }}
            />
          </div>

          <div className="touch-action-buttons">
            <button
              className={`touch-btn ${meleeOn ? 'active' : ''}`}
              onTouchStart={(e) => { e.preventDefault(); onMelee(true); }}
              onTouchEnd={(e) => { e.preventDefault(); onMelee(false); }}
            >
              🗡️
            </button>
            <button
              className="touch-btn"
              onTouchStart={(e) => { e.preventDefault(); onWeaponCycle(); }}
              onTouchEnd={(e) => { e.preventDefault(); }}
            >
              🔄
            </button>
            <button
              className={`touch-btn ${sprintOn ? 'active' : ''}`}
              onTouchStart={(e) => { e.preventDefault(); onSprint(); }}
              onTouchEnd={(e) => { e.preventDefault(); }}
            >
              {sprintOn ? '⚡' : '⇧'}
            </button>
          </div>

          <div className="joystick-zone right">
            <div className="joystick-ring" />
            <div
              className="joystick-puck"
              style={{
                transform: `translate(calc(-50% + ${rightPuck.x}px), calc(-50% + ${rightPuck.y}px))`,
                background: rightStickRef.current.active ? 'rgba(239, 68, 68, 0.45)' : 'rgba(255, 255, 255, 0.22)',
                borderColor: rightStickRef.current.active ? 'rgba(239, 68, 68, 0.9)' : 'rgba(255, 255, 255, 0.5)',
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
