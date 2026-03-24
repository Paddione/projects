/**
 * QuestTracker — Small HUD widget showing active quest objectives.
 *
 * Collapsible panel (persists toggle to localStorage).
 * Shows the top 3 active quests, each with title and a bullet list
 * of objectives (checkmark if complete).
 */

import { useState, useMemo, useCallback } from 'react';

export interface TrackedQuest {
  questId: string;
  title: string;
  objectives: Array<{
    id: string;
    text: string;
    requiredCount: number;
    currentCount: number;
    completed: boolean;
  }>;
}

interface QuestTrackerProps {
  quests: TrackedQuest[];
}

const STORAGE_KEY = 'campaign_quest_tracker_collapsed';

export default function QuestTracker({ quests }: QuestTrackerProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const displayQuests = useMemo(() => quests.slice(0, 3), [quests]);

  if (displayQuests.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 100,
      minWidth: 200,
      maxWidth: 280,
      background: 'rgba(0, 0, 0, 0.75)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      borderRadius: 8,
      overflow: 'hidden',
      backdropFilter: 'blur(8px)',
    }}>
      {/* Header */}
      <button
        onClick={toggleCollapsed}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: 'none',
          border: 'none',
          borderBottom: collapsed ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
          color: '#00f2ff',
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Quests</span>
        <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>
          {collapsed ? '\u25BC' : '\u25B2'}
        </span>
      </button>

      {/* Quest List */}
      {!collapsed && (
        <div style={{ padding: '8px 12px' }}>
          {displayQuests.map((quest, idx) => (
            <div key={quest.questId} style={{
              marginBottom: idx < displayQuests.length - 1 ? 10 : 0,
            }}>
              <div style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#fff',
                marginBottom: 4,
              }}>
                {quest.title}
              </div>
              {quest.objectives.map((obj) => (
                <div key={obj.id} style={{
                  fontSize: '0.72rem',
                  color: obj.completed ? 'rgba(129, 199, 132, 0.9)' : 'rgba(255, 255, 255, 0.6)',
                  paddingLeft: 8,
                  marginBottom: 2,
                  display: 'flex',
                  gap: 4,
                }}>
                  <span>{obj.completed ? '\u2713' : '\u25CB'}</span>
                  <span style={{
                    textDecoration: obj.completed ? 'line-through' : 'none',
                  }}>
                    {obj.text}
                    {obj.requiredCount > 1 && (
                      <span style={{ opacity: 0.5, marginLeft: 4 }}>
                        ({obj.currentCount}/{obj.requiredCount})
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
