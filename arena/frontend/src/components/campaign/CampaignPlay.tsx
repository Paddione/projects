/**
 * CampaignPlay — Main campaign gameplay component.
 *
 * Split into CampaignPlay (loading gate) and CampaignPlayInner (actual gameplay)
 * so that hooks and the renderer only activate after assets are preloaded.
 * Mirrors the Game3D loading-gate pattern.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getSocket } from '../../services/apiService';
import LoadingScreen from '../LoadingScreen';
import CampaignHUD from './CampaignHUD';
import DialogueOverlay from './DialogueOverlay';
import QuizOverlay from './QuizOverlay';
import MapTransitionOverlay from './MapTransitionOverlay';
import type { TransitionPhase } from './MapTransitionOverlay';
import type { DialogueLine } from './DialogueOverlay';
import type { QuizQuestionData } from './QuizOverlay';
import type { TrackedQuest } from './QuestTracker';

// ============================================================================
// Types for session state (matches SerializedCampaignState from backend)
// ============================================================================

interface CampaignPlayerState {
  id: string;
  x: number;
  y: number;
  rotation: number;
  hp: number;
  hasArmor: boolean;
  isAlive: boolean;
  character: string;
  username: string;
}

interface CampaignRuntimeNPC {
  npcId: string;
  x: number;
  y: number;
  facing: number;
  spriteId: string;
  name: string;
  iconColor: string;
  questMarker: 'available' | 'active' | 'complete' | null;
  hasNewDialogue: boolean;
}

interface SessionState {
  sessionId: string;
  mapId: string;
  map: {
    meta: { id: string; name: string; width: number; height: number; tileSize: number; isInterior: boolean };
    tiles: number[][];
    coverObjects: any[];
    doors: any[];
  };
  player: CampaignPlayerState;
  companions: CampaignPlayerState[];
  auxiliaries: CampaignPlayerState[];
  npcs: CampaignRuntimeNPC[];
  enemies: any[];
  items: any[];
  tickCount: number;
}

// ============================================================================
// Outer Loading Gate
// ============================================================================

export default function CampaignPlay() {
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const handleAssetsLoaded = useCallback(() => setAssetsLoaded(true), []);

  if (!assetsLoaded) {
    return <LoadingScreen onLoaded={handleAssetsLoaded} />;
  }

  return <CampaignPlayInner />;
}

// ============================================================================
// Inner Gameplay Component
// ============================================================================

const NPC_INTERACTION_RANGE = 2.5;
const TILE_SIZE = 32;

function CampaignPlayInner() {
  const { sessionId } = useParams<{ sessionId: string }>();

  // Core refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const sessionStateRef = useRef<SessionState | null>(null);
  const animFrameRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());

  // HUD state
  const [hp, setHp] = useState(2);
  const [maxHp] = useState(2);
  const [hasArmor, setHasArmor] = useState(false);
  const [respect, setRespect] = useState(0);
  const [nearbyNpcId, setNearbyNpcId] = useState<string | null>(null);
  const [nearbyNpcName, setNearbyNpcName] = useState<string | null>(null);
  const [activeQuests, setActiveQuests] = useState<TrackedQuest[]>([]);
  const [saveVisible, setSaveVisible] = useState(false);

  // Dialogue state
  const [dialogueActive, setDialogueActive] = useState(false);
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>([]);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [dialogueNpcId, setDialogueNpcId] = useState<string | null>(null);

  // Quiz state
  const [quizActive, setQuizActive] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionData[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);

  // Map transition state
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('idle');
  const [transitionMapName, setTransitionMapName] = useState<string | undefined>();

  // -------------------------------------------------------------------------
  // Socket Event Handlers
  // -------------------------------------------------------------------------

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !sessionId) return;

    // Main game state tick
    socket.on('campaign-state', (state: SessionState) => {
      sessionStateRef.current = state;

      // Update HUD state from player data
      if (state.player) {
        setHp(state.player.hp);
        setHasArmor(state.player.hasArmor);
      }

      // Check for nearby NPCs
      if (state.player && state.npcs) {
        let closestNpc: CampaignRuntimeNPC | null = null;
        let closestDist = Infinity;

        for (const npc of state.npcs) {
          const dx = (state.player.x - npc.x) / TILE_SIZE;
          const dy = (state.player.y - npc.y) / TILE_SIZE;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < NPC_INTERACTION_RANGE && dist < closestDist) {
            closestNpc = npc;
            closestDist = dist;
          }
        }

        setNearbyNpcId(closestNpc?.npcId ?? null);
        setNearbyNpcName(closestNpc?.name ?? null);
      }
    });

    // NPC dialogue event
    socket.on('campaign-npc-dialogue', (data: { npcId: string; lines: DialogueLine[] }) => {
      setDialogueNpcId(data.npcId);
      setDialogueLines(data.lines);
      setDialogueIndex(0);
      setDialogueActive(true);
    });

    // Quest updates
    socket.on('campaign-quest-update', (data: { quest: TrackedQuest }) => {
      setActiveQuests((prev) => {
        const existing = prev.findIndex((q) => q.questId === data.quest.questId);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = data.quest;
          return next;
        }
        return [...prev, data.quest];
      });
    });

    // Quest complete
    socket.on('campaign-quest-complete', (data: { questId: string; respectGained: number }) => {
      setActiveQuests((prev) => prev.filter((q) => q.questId !== data.questId));
      setRespect((prev) => prev + data.respectGained);
    });

    // Map change
    socket.on('campaign-map-change', (data: { targetMapId: string; spawnX: number; spawnY: number }) => {
      setTransitionMapName(data.targetMapId);
      setTransitionPhase('fade-out');
    });

    // Checkpoint saved
    socket.on('campaign-checkpoint-saved', () => {
      setSaveVisible(true);
      setTimeout(() => setSaveVisible(false), 2500);
    });

    // Quiz start
    socket.on('campaign-quiz-start', (data: { questions: QuizQuestionData[] }) => {
      setDialogueActive(false);
      setQuizQuestions(data.questions);
      setQuizIndex(0);
      setQuizActive(true);
    });

    // Session started (initial state)
    socket.on('campaign-session-started', (data: { sessionId: string; state: SessionState }) => {
      sessionStateRef.current = data.state;
    });

    // Error
    socket.on('campaign-error', (data: { message: string }) => {
      console.error('Campaign error:', data.message);
    });

    return () => {
      socket.off('campaign-state');
      socket.off('campaign-npc-dialogue');
      socket.off('campaign-quest-update');
      socket.off('campaign-quest-complete');
      socket.off('campaign-map-change');
      socket.off('campaign-checkpoint-saved');
      socket.off('campaign-quiz-start');
      socket.off('campaign-session-started');
      socket.off('campaign-error');
    };
  }, [sessionId]);

  // -------------------------------------------------------------------------
  // Input Handling
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());

      // Interact with nearby NPC
      if (e.key.toLowerCase() === 'e' && nearbyNpcId && !dialogueActive && !quizActive) {
        const socket = getSocket();
        socket.emit('campaign-interact', { sessionId, npcId: nearbyNpcId });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [sessionId, nearbyNpcId, dialogueActive, quizActive]);

  // -------------------------------------------------------------------------
  // Input Emit Loop (20 ticks/s to match server)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!sessionId) return;

    const socket = getSocket();
    const interval = setInterval(() => {
      if (dialogueActive || quizActive) return;

      const keys = keysRef.current;
      let mx = 0;
      let my = 0;
      if (keys.has('w') || keys.has('arrowup')) my -= 1;
      if (keys.has('s') || keys.has('arrowdown')) my += 1;
      if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
      if (keys.has('d') || keys.has('arrowright')) mx += 1;

      // Normalize diagonal movement
      const len = Math.sqrt(mx * mx + my * my);
      if (len > 0) {
        mx /= len;
        my /= len;
      }

      socket.emit('campaign-input', {
        sessionId,
        input: {
          movement: { x: mx, y: my },
          aimAngle: 0,
          shooting: false,
          melee: false,
          sprint: keys.has('shift'),
          interact: false,
          timestamp: Date.now(),
        },
      });
    }, 50); // 20 ticks/s

    return () => clearInterval(interval);
  }, [sessionId, dialogueActive, quizActive]);

  // -------------------------------------------------------------------------
  // Render Loop (placeholder — Three.js wiring goes here)
  // -------------------------------------------------------------------------

  useEffect(() => {
    // Placeholder render loop — draws minimal debug view on canvas
    // Full Three.js integration via GameRenderer3D, TerrainRenderer, etc.
    // will be wired in the renderers task (5h)
    const container = canvasRef.current;
    if (!container) return;

    let canvas = container.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      container.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
      }

      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, w, h);

      const state = sessionStateRef.current;
      if (!state) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for campaign state...', w / 2, h / 2);
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      // Camera offset: center on player
      const camX = w / 2 - state.player.x;
      const camY = h / 2 - state.player.y;

      ctx.save();
      ctx.translate(camX, camY);

      // Draw tiles (simple colored grid)
      const { tiles, meta } = state.map;
      const ts = meta.tileSize;
      const TILE_COLORS: Record<number, string> = {
        0: '#2d5a1e', // grass
        1: '#555',    // wall
        2: '#c4a36e', // path
        3: '#666',    // road
        4: '#4a3728', // building
        5: '#8b6914', // door
        6: '#1a4a7a', // water
        7: '#888',    // cobblestone
      };

      for (let y = 0; y < tiles.length; y++) {
        for (let x = 0; x < (tiles[y]?.length ?? 0); x++) {
          const tileType = tiles[y][x];
          ctx.fillStyle = TILE_COLORS[tileType] ?? '#333';
          ctx.fillRect(x * ts, y * ts, ts, ts);
          ctx.strokeStyle = 'rgba(0,0,0,0.15)';
          ctx.strokeRect(x * ts, y * ts, ts, ts);
        }
      }

      // Draw NPCs
      for (const npc of state.npcs) {
        ctx.fillStyle = npc.iconColor || '#ff0';
        ctx.beginPath();
        ctx.arc(npc.x, npc.y, 10, 0, Math.PI * 2);
        ctx.fill();

        // Quest marker
        if (npc.questMarker) {
          ctx.fillStyle = npc.questMarker === 'available' ? '#ffeb3b' :
                          npc.questMarker === 'active' ? '#90caf9' : '#81c784';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            npc.questMarker === 'available' ? '!' : npc.questMarker === 'active' ? '?' : '\u2713',
            npc.x, npc.y - 16
          );
        }

        // Name label
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(npc.name, npc.x, npc.y + 18);
      }

      // Draw enemies
      for (const enemy of state.enemies) {
        ctx.fillStyle = '#e53935';
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw items
      for (const item of state.items) {
        if (item.collected) continue;
        ctx.fillStyle = '#00e5ff';
        ctx.fillRect(item.x - 4, item.y - 4, 8, 8);
      }

      // Draw player
      ctx.fillStyle = '#00f2ff';
      ctx.beginPath();
      ctx.arc(state.player.x, state.player.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw companions
      for (const comp of state.companions) {
        ctx.fillStyle = '#4fc3f7';
        ctx.beginPath();
        ctx.arc(comp.x, comp.y, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Map name
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(state.map.meta.name, 12, h - 12);

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Dialogue Handlers
  // -------------------------------------------------------------------------

  const handleDialogueAdvance = useCallback(() => {
    const nextIndex = dialogueIndex + 1;
    if (nextIndex >= dialogueLines.length) {
      setDialogueActive(false);
      setDialogueNpcId(null);
      return;
    }

    // Check if current line triggers quiz
    const currentLine = dialogueLines[dialogueIndex];
    if (currentLine?.triggersQuiz) {
      // Quiz will be started by server via campaign-quiz-start event
      return;
    }

    setDialogueIndex(nextIndex);
  }, [dialogueIndex, dialogueLines]);

  const handleDialogueChoice = useCallback((choiceId: string) => {
    if (!dialogueNpcId || !sessionId) return;
    const socket = getSocket();
    socket.emit('campaign-dialogue-choice', {
      sessionId,
      npcId: dialogueNpcId,
      choiceId,
    });
  }, [dialogueNpcId, sessionId]);

  const handleDialogueClose = useCallback(() => {
    setDialogueActive(false);
    setDialogueNpcId(null);
  }, []);

  // -------------------------------------------------------------------------
  // Quiz Handlers
  // -------------------------------------------------------------------------

  const handleQuizAnswer = useCallback(() => {
    setQuizIndex((prev) => prev + 1);
  }, []);

  const handleQuizComplete = useCallback(() => {
    setQuizActive(false);
    setQuizQuestions([]);
    setQuizIndex(0);
  }, []);

  // -------------------------------------------------------------------------
  // Map Transition Handlers
  // -------------------------------------------------------------------------

  const handleTransitionPhaseComplete = useCallback((completedPhase: TransitionPhase) => {
    if (completedPhase === 'fade-out') {
      setTransitionPhase('loading');
      // Tell server we're ready to load
      const socket = getSocket();
      socket.emit('campaign-map-loaded', { sessionId, mapId: transitionMapName ?? '' });
    } else if (completedPhase === 'fade-in') {
      setTransitionPhase('idle');
      setTransitionMapName(undefined);
    }
  }, [sessionId, transitionMapName]);

  // When new map state arrives during loading phase, fade in
  useEffect(() => {
    if (transitionPhase === 'loading' && sessionStateRef.current) {
      // Small delay to allow state to settle
      const timer = setTimeout(() => {
        setTransitionPhase('fade-in');
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [transitionPhase]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#000',
      overflow: 'hidden',
    }}>
      {/* Three.js / Canvas mount point */}
      <div
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
        }}
      />

      {/* HUD Overlay */}
      <CampaignHUD
        hp={hp}
        maxHp={maxHp}
        hasArmor={hasArmor}
        nearbyNpcId={nearbyNpcId}
        nearbyNpcName={nearbyNpcName}
        activeQuests={activeQuests}
        saveVisible={saveVisible}
        respect={respect}
      />

      {/* Dialogue Overlay */}
      <DialogueOverlay
        active={dialogueActive}
        lines={dialogueLines}
        currentIndex={dialogueIndex}
        onAdvance={handleDialogueAdvance}
        onChoice={handleDialogueChoice}
        onClose={handleDialogueClose}
      />

      {/* Quiz Overlay */}
      <QuizOverlay
        active={quizActive}
        sessionId={sessionId ?? ''}
        questions={quizQuestions}
        currentIndex={quizIndex}
        onAnswer={handleQuizAnswer}
        onComplete={handleQuizComplete}
      />

      {/* Map Transition Overlay */}
      <MapTransitionOverlay
        phase={transitionPhase}
        targetMapName={transitionMapName}
        onPhaseComplete={handleTransitionPhaseComplete}
      />
    </div>
  );
}
