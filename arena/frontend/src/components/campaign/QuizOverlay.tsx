/**
 * QuizOverlay — Inline L2P quiz rendered alongside DialogueOverlay.
 *
 * Displays questions one at a time with multiple-choice answers.
 * Shows feedback after each answer (correct/wrong) and auto-advances
 * after a timeout. Emits `campaign-quiz-answer` via socket on answer select.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSocket } from '../../services/apiService';

export interface QuizQuestionData {
  id: string;
  text: string;
  answers: Array<{ id: string; text: string }>;
  difficulty: number;
  hint?: string;
  answerType: string;
}

interface QuizOverlayProps {
  active: boolean;
  sessionId: string;
  questions: QuizQuestionData[];
  currentIndex: number;
  onAnswer: (questionId: string, answerId: string) => void;
  onComplete: () => void;
}

const FEEDBACK_DURATION_MS = 1500;

export default function QuizOverlay({
  active,
  sessionId,
  questions,
  currentIndex,
  onAnswer,
  onComplete,
}: QuizOverlayProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0);
  const [answerStartTime, setAnswerStartTime] = useState(Date.now());

  const currentQuestion = useMemo(() => {
    if (currentIndex >= 0 && currentIndex < questions.length) {
      return questions[currentIndex];
    }
    return null;
  }, [questions, currentIndex]);

  // Reset state on question change
  useEffect(() => {
    setSelectedAnswer(null);
    setFeedback(null);
    setAnswerStartTime(Date.now());
  }, [currentIndex]);

  // Listen for quiz results from server
  useEffect(() => {
    if (!active) return;

    const socket = getSocket();

    const handleResult = (data: { correct: boolean; score: number; completed: boolean }) => {
      setFeedback(data.correct ? 'correct' : 'wrong');
      setScore(data.score);

      // Auto-advance after feedback
      setTimeout(() => {
        if (data.completed) {
          onComplete();
        } else {
          onAnswer(currentQuestion?.id ?? '', selectedAnswer ?? '');
        }
      }, FEEDBACK_DURATION_MS);
    };

    socket.on('campaign-quiz-result', handleResult);
    return () => { socket.off('campaign-quiz-result', handleResult); };
  }, [active, currentQuestion, selectedAnswer, onAnswer, onComplete]);

  const handleSelect = useCallback((answerId: string) => {
    if (selectedAnswer !== null || !currentQuestion) return;

    setSelectedAnswer(answerId);
    const timeMs = Date.now() - answerStartTime;

    const socket = getSocket();
    socket.emit('campaign-quiz-answer', {
      sessionId,
      questionId: currentQuestion.id,
      answer: answerId,
      timeMs,
    });
  }, [selectedAnswer, currentQuestion, answerStartTime, sessionId]);

  if (!active || !currentQuestion) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      height: '40%',
      minHeight: 220,
      maxHeight: 360,
      background: 'rgba(0, 0, 0, 0.9)',
      borderTop: '2px solid rgba(0, 242, 255, 0.3)',
      padding: '20px 28px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header: Question counter + Score */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <span style={{
          fontSize: '0.8rem',
          fontWeight: 700,
          color: '#00f2ff',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Question {currentIndex + 1}/{questions.length}
        </span>
        <span style={{
          fontSize: '0.75rem',
          color: 'rgba(255, 255, 255, 0.5)',
        }}>
          Score: {score}
        </span>
      </div>

      {/* Question Text */}
      <div style={{
        fontSize: '1rem',
        color: '#fff',
        lineHeight: 1.5,
        marginBottom: 16,
        flex: 1,
      }}>
        {currentQuestion.text}
      </div>

      {/* Answer Buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 8,
      }}>
        {currentQuestion.answers.map((answer) => {
          let bgColor = 'rgba(255, 255, 255, 0.08)';
          let borderColor = 'rgba(255, 255, 255, 0.15)';
          let textColor = '#fff';

          if (selectedAnswer === answer.id && feedback === 'correct') {
            bgColor = 'rgba(129, 199, 132, 0.25)';
            borderColor = '#81c784';
            textColor = '#81c784';
          } else if (selectedAnswer === answer.id && feedback === 'wrong') {
            bgColor = 'rgba(229, 115, 115, 0.25)';
            borderColor = '#e57373';
            textColor = '#e57373';
          } else if (selectedAnswer === answer.id) {
            bgColor = 'rgba(0, 242, 255, 0.15)';
            borderColor = '#00f2ff';
          }

          return (
            <button
              key={answer.id}
              onClick={() => handleSelect(answer.id)}
              disabled={selectedAnswer !== null}
              style={{
                padding: '10px 14px',
                background: bgColor,
                border: `1px solid ${borderColor}`,
                borderRadius: 6,
                color: textColor,
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: selectedAnswer !== null ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'left',
                opacity: selectedAnswer !== null && selectedAnswer !== answer.id ? 0.5 : 1,
              }}
            >
              {answer.text}
            </button>
          );
        })}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div style={{
          marginTop: 10,
          textAlign: 'center',
          fontSize: '0.85rem',
          fontWeight: 700,
          color: feedback === 'correct' ? '#81c784' : '#e57373',
        }}>
          {feedback === 'correct' ? 'Correct!' : 'Wrong!'}
        </div>
      )}
    </div>
  );
}
