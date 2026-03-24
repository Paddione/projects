/**
 * DialogueOverlay — NPC conversation UI.
 *
 * Renders in the bottom third of the screen as a dark semi-transparent panel.
 * Features:
 *   - Speaker name (bold, left aligned)
 *   - Dialogue text with typewriter effect (character-by-character reveal)
 *   - Choice buttons when choices are present
 *   - "Continue" / press Space to advance
 *   - When triggersQuiz is true, parent should transition to QuizOverlay
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

export interface DialogueLine {
  speaker: string;
  text: string;
  choices?: Array<{ id: string; text: string }>;
  triggersQuiz?: boolean;
}

interface DialogueOverlayProps {
  active: boolean;
  lines: DialogueLine[];
  currentIndex: number;
  onAdvance: () => void;
  onChoice: (choiceId: string) => void;
  onClose: () => void;
}

const TYPEWRITER_SPEED_MS = 25;

export default function DialogueOverlay({
  active,
  lines,
  currentIndex,
  onAdvance,
  onChoice,
  onClose,
}: DialogueOverlayProps) {
  const [revealedChars, setRevealedChars] = useState(0);
  const [fullyRevealed, setFullyRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentLine = useMemo(() => {
    if (currentIndex >= 0 && currentIndex < lines.length) {
      return lines[currentIndex];
    }
    return null;
  }, [lines, currentIndex]);

  const fullText = currentLine?.text ?? '';

  // Reset typewriter on line change
  useEffect(() => {
    setRevealedChars(0);
    setFullyRevealed(false);
  }, [currentIndex]);

  // Typewriter tick
  useEffect(() => {
    if (!active || !currentLine) return;

    if (revealedChars >= fullText.length) {
      setFullyRevealed(true);
      return;
    }

    timerRef.current = setInterval(() => {
      setRevealedChars((prev) => {
        const next = prev + 1;
        if (next >= fullText.length) {
          if (timerRef.current) clearInterval(timerRef.current);
          setFullyRevealed(true);
        }
        return next;
      });
    }, TYPEWRITER_SPEED_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [active, currentLine, fullText.length, revealedChars]);

  // Skip typewriter on click / space
  const handleContinue = useCallback(() => {
    if (!fullyRevealed) {
      // Reveal all text immediately
      setRevealedChars(fullText.length);
      setFullyRevealed(true);
      return;
    }

    // If there are choices, don't auto-advance — wait for choice selection
    if (currentLine?.choices && currentLine.choices.length > 0) {
      return;
    }

    onAdvance();
  }, [fullyRevealed, fullText.length, currentLine, onAdvance]);

  // Keyboard listener for Space / Enter / Escape
  useEffect(() => {
    if (!active) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleContinue();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [active, handleContinue, onClose]);

  if (!active || !currentLine) return null;

  const hasChoices = currentLine.choices && currentLine.choices.length > 0;

  return (
    <div
      onClick={handleContinue}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        height: '33%',
        minHeight: 160,
        maxHeight: 280,
        background: 'rgba(0, 0, 0, 0.85)',
        borderTop: '1px solid rgba(0, 242, 255, 0.2)',
        padding: '20px 28px',
        display: 'flex',
        flexDirection: 'column',
        cursor: hasChoices && fullyRevealed ? 'default' : 'pointer',
      }}
    >
      {/* Speaker Name */}
      <div style={{
        fontSize: '0.85rem',
        fontWeight: 700,
        color: '#00f2ff',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {currentLine.speaker}
      </div>

      {/* Dialogue Text */}
      <div style={{
        fontSize: '1rem',
        color: '#fff',
        lineHeight: 1.6,
        flex: 1,
        overflow: 'hidden',
      }}>
        {fullText.slice(0, revealedChars)}
        {!fullyRevealed && (
          <span style={{
            opacity: 0.5,
            animation: 'blink 0.8s infinite',
          }}>|</span>
        )}
      </div>

      {/* Choices or Continue Prompt */}
      <div style={{
        marginTop: 12,
        display: 'flex',
        gap: 'var(--space-sm)',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {fullyRevealed && hasChoices && currentLine.choices!.map((choice) => (
          <button
            key={choice.id}
            onClick={(e) => {
              e.stopPropagation();
              onChoice(choice.id);
            }}
            style={{
              padding: '8px 16px',
              background: 'rgba(0, 242, 255, 0.1)',
              border: '1px solid rgba(0, 242, 255, 0.3)',
              borderRadius: 6,
              color: '#00f2ff',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = 'rgba(0, 242, 255, 0.25)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'rgba(0, 242, 255, 0.1)';
            }}
          >
            {choice.text}
          </button>
        ))}

        {fullyRevealed && !hasChoices && (
          <span style={{
            fontSize: '0.75rem',
            color: 'rgba(255, 255, 255, 0.4)',
            fontStyle: 'italic',
          }}>
            Press Space to continue...
          </span>
        )}
      </div>
    </div>
  );
}
