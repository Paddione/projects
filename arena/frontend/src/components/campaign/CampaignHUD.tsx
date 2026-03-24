/**
 * CampaignHUD — HUD overlay on top of the campaign game canvas.
 *
 * Renders at z-index 100 over the Three.js scene:
 *   - HP display (hearts) — top-left
 *   - QuestTracker — top-right
 *   - "Press E to talk" interaction prompt — bottom-center
 *   - SaveIndicator — top-center flash
 */

import { useMemo } from 'react';
import QuestTracker from './QuestTracker';
import SaveIndicator from './SaveIndicator';
import type { TrackedQuest } from './QuestTracker';

interface CampaignHUDProps {
  hp: number;
  maxHp: number;
  hasArmor: boolean;
  nearbyNpcId: string | null;
  nearbyNpcName: string | null;
  activeQuests: TrackedQuest[];
  saveVisible: boolean;
  respect: number;
}

export default function CampaignHUD({
  hp,
  maxHp,
  hasArmor,
  nearbyNpcId,
  nearbyNpcName,
  activeQuests,
  saveVisible,
  respect,
}: CampaignHUDProps) {
  const hearts = useMemo(() => {
    const result: Array<'full' | 'empty'> = [];
    for (let i = 0; i < maxHp; i++) {
      result.push(i < hp ? 'full' : 'empty');
    }
    return result;
  }, [hp, maxHp]);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 100,
      pointerEvents: 'none',
    }}>
      {/* Top-Left: HP + Armor + Respect */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        pointerEvents: 'auto',
      }}>
        {/* Hearts */}
        <div style={{ display: 'flex', gap: 4 }}>
          {hearts.map((state, i) => (
            <span key={i} style={{
              fontSize: '1.3rem',
              lineHeight: 1,
              filter: state === 'full' ? 'none' : 'grayscale(1) opacity(0.3)',
            }}>
              {state === 'full' ? '\u2764' : '\u2764'}
            </span>
          ))}
          {hasArmor && (
            <span style={{
              fontSize: '1.2rem',
              lineHeight: 1,
              marginLeft: 4,
              color: '#4fc3f7',
            }}>
              {'\u26E8'}
            </span>
          )}
        </div>

        {/* Respect Counter */}
        <div style={{
          fontSize: '0.75rem',
          color: '#00f2ff',
          fontWeight: 600,
          letterSpacing: '0.03em',
        }}>
          {respect} Respect
        </div>
      </div>

      {/* Top-Right: Quest Tracker */}
      <div style={{ pointerEvents: 'auto' }}>
        <QuestTracker quests={activeQuests} />
      </div>

      {/* Top-Center: Save Indicator */}
      <SaveIndicator visible={saveVisible} />

      {/* Bottom-Center: Interaction Prompt */}
      {nearbyNpcId && (
        <div style={{
          position: 'absolute',
          bottom: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 20px',
          background: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(0, 242, 255, 0.3)',
          borderRadius: 8,
          color: '#fff',
          fontSize: '0.85rem',
          fontWeight: 500,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{
            padding: '2px 8px',
            background: 'rgba(0, 242, 255, 0.2)',
            borderRadius: 4,
            color: '#00f2ff',
            fontWeight: 700,
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
          }}>
            E
          </span>
          <span>
            Talk to {nearbyNpcName || 'NPC'}
          </span>
        </div>
      )}
    </div>
  );
}
