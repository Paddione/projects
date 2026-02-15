import React, { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { PlayerGrid } from '../components/PlayerGrid'
import { ScoreDisplay } from '../components/ScoreDisplay'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { ErrorDisplay } from '../components/ErrorBoundary'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useGameStore } from '../stores/gameStore'
import { socketService } from '../services/socketService'
import { navigationService } from '../services/navigationService'
import styles from '../styles/App.module.css'
import gameStyles from '../styles/GamePage.module.css'
import { useAudio } from '../hooks/useAudio'
import { useAuthStore } from '../stores/authStore'

export const GamePage: React.FC = () => {
  const { lobbyId } = useParams<{ lobbyId: string }>()
  const navigate = useNavigate()
  const {
    handleQuestionStart,
    handleTick,
    handleTimerWarning,
    handleTimerUrgent,
    handleCorrectAnswer,
    handleWrongAnswer,
    handleGameEnd,
    handleStopAllSounds,
  } = useAudio()

  const {
    players,
    currentQuestion,
    questionIndex,
    totalQuestions,
    timeRemaining,
    gameStarted,
    gameEnded,
    isLoading,
    error,
    setError,
    lobbyCode,
    resetPlayerAnswerStatus,
    isSyncing,
    syncCountdown,
    gameMode,
    showingHint,
    setShowingHint,
    waitingForContinue,
    setWaitingForContinue,
    practiceCorrectAnswer,
    setPracticeCorrectAnswer,
  } = useGameStore()
  const { user } = useAuthStore()

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [answerFlash, setAnswerFlash] = useState<'correct' | 'wrong' | null>(null)
  const [scoreDelta, setScoreDelta] = useState<number | null>(null)
  const [questionExpanded, setQuestionExpanded] = useState(false)
  const [questionOverflowing, setQuestionOverflowing] = useState(false)
  const [focusedAnswerIndex, setFocusedAnswerIndex] = useState<number>(0)
  const [freeTextInput, setFreeTextInput] = useState('')
  const questionRef = useRef<HTMLHeadingElement | null>(null)
  const freeTextRef = useRef<HTMLInputElement | null>(null)

  const isPractice = gameMode === 'practice'
  const isFreeText = currentQuestion?.answerType === 'free_text'

  // Derived UI state (only relevant in arcade mode)
  const totalTime = Math.max(currentQuestion?.timeLimit || 60, 1)
  const timePercent = isPractice ? 100 : Math.max(0, Math.min(100, (typeof timeRemaining === 'number' ? (timeRemaining / totalTime) * 100 : 100)))
  const timerSeverity = isPractice ? 'ok' as const : (typeof timeRemaining === 'number'
    ? (timeRemaining <= 3 ? 'urgent' : timeRemaining <= 10 ? 'warning' : 'ok')
    : 'ok') as 'ok' | 'warning' | 'urgent'
  const radius = 16
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - timePercent / 100)

  // Initialize and validate game state
  useEffect(() => {
    const initializeGame = async () => {
      if (!lobbyId) {
        setError('No lobby ID provided')
        navigate('/')
        return
      }

      // Validate that we're in a game state
      if (!gameStarted) {
        await navigationService.navigateToLobby(lobbyId)
        return
      }

      // Connect to WebSocket if not connected
      if (!socketService.isConnected()) {
        socketService.connect()
      }
    }

    // Listen for score updates from server
    const handleScoreUpdate = (data: { playerId: string; hasAnswered: boolean; isCorrect?: boolean; scoreDelta?: number; newScore?: number; newMultiplier?: number }) => {
      if (String(data.playerId) === String(user?.id)) {
        const delta = typeof data.scoreDelta === 'number' ? data.scoreDelta : undefined
        if (typeof delta === 'number' && delta > 0) {
          // Force a synchronous paint for immediate visibility (helps tests too)
          flushSync(() => setScoreDelta(delta))
        }
        setTimeout(() => setScoreDelta(null), 2000)
      }
    }

    socketService.on('answer-received', handleScoreUpdate)

    initializeGame()
    return () => {
      // Stop any ongoing loops/sounds when leaving game
      handleStopAllSounds()
      socketService.off('answer-received', handleScoreUpdate)
    }
  }, [lobbyId, gameStarted, navigate, user?.id, handleStopAllSounds, setError])

  // Reset per-round UI when question changes
  useEffect(() => {
    setSelectedAnswer(null)
    setHasAnswered(false)
    setAnswerFlash(null)
    setScoreDelta(null)
    setQuestionExpanded(false)
    setFocusedAnswerIndex(0)
    setFreeTextInput('')
    resetPlayerAnswerStatus()
  }, [questionIndex, resetPlayerAnswerStatus])

  // Auto-focus free-text input on question change
  useEffect(() => {
    if (isFreeText && freeTextRef.current && !hasAnswered) {
      freeTextRef.current.focus()
    }
  }, [currentQuestion?.id, isFreeText, hasAnswered])

  // Play sound on new question
  useEffect(() => {
    if (currentQuestion) {
      handleQuestionStart()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id])

  // Tick/warning sounds based on time remaining (only in arcade mode)
  useEffect(() => {
    if (isPractice) return
    if (typeof timeRemaining !== 'number') return
    if (timeRemaining <= 0) return
    if (timeRemaining <= 3) {
      handleTimerUrgent()
    } else if (timeRemaining <= 10 && timeRemaining % 5 === 0) {
      handleTimerWarning()
    } else if (timeRemaining % 10 === 0) {
      handleTick()
    }
  }, [timeRemaining, handleTick, handleTimerUrgent, handleTimerWarning, isPractice])

  // Detect question text overflow to decide showing toggle
  useEffect(() => {
    const checkOverflow = () => {
      const el = questionRef.current
      if (!el) return
      const isOverflowing = el.scrollHeight > el.clientHeight + 1 // tolerance
      setQuestionOverflowing(isOverflowing)
    }
    checkOverflow()
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [currentQuestion?.text, questionExpanded])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (hasAnswered || !currentQuestion || (!isPractice && timeRemaining === 0)) return
    if (isFreeText) return // free-text uses its own input handler

    const answerCount = currentQuestion.answers.length

    // Arrow key navigation
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setFocusedAnswerIndex(prev => (prev - 1 + answerCount) % answerCount)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      setFocusedAnswerIndex(prev => (prev + 1) % answerCount)
    }
    // Number key shortcuts (1-4)
    else if (['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault()
      const answerIndex = parseInt(e.key) - 1
      if (answerIndex < answerCount) {
        handleAnswerClick(answerIndex)
      }
    }
    // Enter or Space to submit focused answer
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleAnswerClick(focusedAnswerIndex)
    }
  }

  const handleAnswerClick = async (answerIndex: number) => {
    if (hasAnswered || !currentQuestion) return

    try {
      setSelectedAnswer(answerIndex)
      setHasAnswered(true)

      // Submit answer via WebSocket
      socketService.submitAnswer(answerIndex)

      // Provide immediate visual feedback (server will provide authoritative confirmation)
      const isCorrect = answerIndex === currentQuestion.correctAnswer
      setAnswerFlash(isCorrect ? 'correct' : 'wrong')

      // Defer authoritative audio feedback to server event (answer-received)

      // Keep blinking state until next question; reset happens on question change
    } catch (error) {
      console.error('Failed to submit answer:', error)
      setError('Failed to submit answer')
      setHasAnswered(false)
      setSelectedAnswer(null)
      setAnswerFlash(null)
    }
  }

  const handleFreeTextSubmit = () => {
    if (hasAnswered || !currentQuestion || !freeTextInput.trim()) return

    try {
      setHasAnswered(true)
      socketService.submitFreeTextAnswer(freeTextInput.trim())
    } catch (error) {
      console.error('Failed to submit free-text answer:', error)
      setError('Failed to submit answer')
      setHasAnswered(false)
    }
  }

  const handlePracticeContinue = () => {
    setWaitingForContinue(false)
    setShowingHint(false)
    setPracticeCorrectAnswer(null)
    socketService.practiceContinue()
  }

  const handleLeaveLobby = async () => {
    if (lobbyCode) {
      await navigationService.leaveLobby(lobbyCode)
    } else {
      navigate('/')
    }
  }

  // Show loading spinner while initializing
  if (isLoading || (!currentQuestion && !isSyncing)) {
    return (
      <div className={styles.container}>
        <LoadingSpinner />
        <p>Loading game...</p>
      </div>
    )
  }

  // Show syncing overlay
  if (isSyncing) {
    return (
      <div className={styles.container}>
        <div className={`${styles.card} ${gameStyles.syncCard}`}>
          <h2 className={gameStyles.syncTitle}>Get Ready!</h2>
          <div className={gameStyles.syncCountdown} data-testid="sync-countdown">
            {syncCountdown}
          </div>
          <p className={gameStyles.syncMessage}>Das Spiel startet in Kürze...</p>
          <LoadingSpinner />
        </div>

        <div style={{ marginTop: 'var(--spacing-xl)', width: '100%', maxWidth: '800px' }}>
          <h3 className={gameStyles.syncMessage} style={{ textAlign: 'center', marginBottom: 'var(--spacing-md)' }}>
            Spieler im Game
          </h3>
          <PlayerGrid players={players} />
        </div>
      </div>
    )
  }

  // Show error if game ended or not started
  if (gameEnded) {
    // Play game end cue
    handleGameEnd()
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h2>Game Ended</h2>
          <p>The game has ended. Redirecting to results...</p>
          <LoadingSpinner />
        </div>
      </div>
    )
  }

  if (!gameStarted) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h2>Game Not Started</h2>
          <p>Waiting for game to start...</p>
          <button onClick={handleLeaveLobby} className={styles.button}>
            Back to Lobby
          </button>
        </div>
      </div>
    )
  }

  if (!players || players.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h2>Waiting for players...</h2>
          <LoadingSpinner />
        </div>
      </div>
    )
  }

  // currentQuestion is guaranteed non-null by early return above
  const question = currentQuestion!
  const currentPlayer = players.find(p => (user?.id ? String(p.id) === String(user.id) : false)) || players.find(p => p.isHost) || players[0]!
  const { score, multiplier, correctAnswers } = currentPlayer

  // Build global rankings by score (desc), 0-based rank index
  const globalSorted = [...players].sort((a, b) => b.score - a.score)
  const rankings: Record<string, number> = {}
  globalSorted.forEach((p, idx) => { rankings[p.id] = idx })

  // Show all players including current player on plates, excluding current player from plates only if displaying 3+ players
  const playersForPlates = players.length <= 2 ? players : players.filter(p => p.id !== currentPlayer.id)
  const sortedPlayersForPlates = playersForPlates.sort((a, b) => b.score - a.score).slice(0, 2)

  return (
    <div className={`${styles.container} ${gameStyles.fullHeight}`}>
      {/* Error Display */}
      <ErrorDisplay
        error={error}
        onClear={() => setError(null)}
        onRetry={() => window.location.reload()}
      />

      {/* Top Bar */}
      <div className={`${gameStyles.topBar}`}>
        <div className={gameStyles.topBarLeft}>
          <h2 className={gameStyles.compactTitle}>
            Frage <span data-testid="question-number">{questionIndex + 1}</span> / <span data-testid="total-questions">{totalQuestions}</span>
            {isPractice && <span className={gameStyles.practiceModeBadge}>Practice</span>}
          </h2>
          <div className={gameStyles.metaRow}>
            {/* Radial countdown indicator — hidden in practice mode */}
            {!isPractice && (
              <div
                className={`${gameStyles.radialTimer} ${timerSeverity === 'warning' ? gameStyles.radialWarn : timerSeverity === 'urgent' ? gameStyles.radialUrgent : gameStyles.radialOk}`}
                aria-hidden
                title="Time remaining"
              >
                <svg className={gameStyles.radialSvg} viewBox="0 0 40 40">
                  <circle className={gameStyles.radialTrack} cx="20" cy="20" r={radius} />
                  <circle
                    className={gameStyles.radialProgress}
                    cx="20"
                    cy="20"
                    r={radius}
                    style={{ strokeDasharray: circumference, strokeDashoffset: dashOffset }}
                  />
                </svg>
              </div>
            )}
            {!isPractice && typeof timeRemaining === 'number' && (
              <span
                className={`${gameStyles.timer} ${timerSeverity === 'warning' ? gameStyles.timerWarning : ''} ${timerSeverity === 'urgent' ? gameStyles.timerUrgent : ''}`}
                data-testid="timer"
                aria-live="polite"
              >
                {timeRemaining}s
              </span>
            )}
            <button
              onClick={handleLeaveLobby}
              className={`${styles.button} ${styles.buttonOutline} ${gameStyles.leaveBtn}`}
            >
              Verlassen
            </button>
          </div>
        </div>
        <ConnectionStatus />
      </div>

      {/* Mobile Stats Bar — visible only at <=768px via CSS */}
      {!isPractice && (
        <div className={gameStyles.mobileStatsBar}>
          <ScoreDisplay
            score={score}
            multiplier={multiplier}
            correctAnswers={correctAnswers}
            compact
          />
          {scoreDelta !== null && (
            <span style={{ color: 'var(--cv-success)', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'var(--cv-font-mono)' }}>+{scoreDelta}</span>
          )}
          <div className={gameStyles.mobileStatsDivider} />
          <PlayerGrid
            players={sortedPlayersForPlates}
            rankings={rankings}
            maxPlayers={2}
            compact
          />
        </div>
      )}

      {/* Main Layout */}
      <div className={gameStyles.layout}>
        {/* Left Pane: Question + Answers */}
        <section
          className={`${gameStyles.leftPane} ${gameStyles.questionBg}`}
          aria-labelledby="question-heading"
        >
          <div className={`${styles.card} ${gameStyles.questionCard}`} data-testid="question-container">
            {/* Time progress bar — hidden in practice mode */}
            {!isPractice && (
              <div className={gameStyles.progressContainer} aria-hidden>
                <div
                  className={`${gameStyles.progressBar} ${timePercent > 50 ? gameStyles.progressOk : timePercent > 20 ? gameStyles.progressWarn : gameStyles.progressUrgent}`}
                  style={{ width: `${timePercent}%` }}
                />
              </div>
            )}

            <div className={gameStyles.questionInner} key={question.id}>
              <h3
                id="question-heading"
                ref={questionRef}
                className={`${gameStyles.questionText} ${questionExpanded ? gameStyles.questionExpanded : ''}`}
                data-testid="question-text"
              >
                {question.text || `Frage ${questionIndex + 1} wird geladen...`}
              </h3>
              {questionOverflowing && (
                <div className={gameStyles.showMoreRow}>
                  <button
                    type="button"
                    className={gameStyles.showMoreBtn}
                    aria-expanded={questionExpanded}
                    aria-controls="question-heading"
                    onClick={() => setQuestionExpanded(v => !v)}
                    data-testid="question-toggle"
                  >
                    {questionExpanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
                  </button>
                </div>
              )}

              {/* Hint button (practice mode only, before answering) */}
              {isPractice && question.hint && !showingHint && !hasAnswered && !waitingForContinue && (
                <button
                  className={gameStyles.hintButton}
                  onClick={() => setShowingHint(true)}
                  data-testid="hint-button"
                >
                  Hinweis anzeigen
                </button>
              )}

              {/* Hint display */}
              {showingHint && question.hint && (
                <div className={gameStyles.hintBox} data-testid="hint-box">
                  <span className={gameStyles.hintLabel}>Hinweis</span>
                  {question.hint}
                </div>
              )}

              {/* Multiple choice answers */}
              {!isFreeText && (
                <div
                  className={gameStyles.answersGrid}
                  onKeyDown={handleKeyDown}
                  tabIndex={0}
                  role="radiogroup"
                  aria-label="Answer options"
                >
                  {question.answers.map((answer, index) => {
                    const isSelected = selectedAnswer === index
                    const isFocused = focusedAnswerIndex === index && !hasAnswered
                    const isCorrectAnswer = typeof question.correctAnswer === 'number' && question.correctAnswer === index
                    const showCorrectBlink = !!answerFlash && ((answerFlash === 'correct' && isSelected) || (answerFlash === 'wrong' && isCorrectAnswer))
                    const showWrongBlink = !!answerFlash && answerFlash === 'wrong' && isSelected

                    return (
                      <button
                        key={index}
                        data-testid={`answer-option-${index}`}
                        className={`
                        ${styles.button}
                        ${gameStyles.answerButton}
                        ${gameStyles.answerEnter}
                        ${isSelected && !answerFlash ? gameStyles.answerSelected : ''}
                        ${isFocused ? gameStyles.answerFocused : ''}
                        ${showCorrectBlink ? gameStyles.answerCorrectBlink : ''}
                        ${showWrongBlink ? gameStyles.answerWrongBlink : ''}
                      `}
                        onClick={() => handleAnswerClick(index)}
                        disabled={hasAnswered || (!isPractice && timeRemaining === 0)}
                        style={{ animationDelay: `${index * 60}ms` }}
                        aria-checked={isSelected}
                        role="radio"
                      >
                        <span className={gameStyles.answerLabel}>{String.fromCharCode(65 + index)}.</span>
                        <span className={gameStyles.answerText}>{answer}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Free-text answer input */}
              {isFreeText && !waitingForContinue && (
                <div className={gameStyles.freeTextArea} data-testid="free-text-area">
                  <input
                    ref={freeTextRef}
                    type="text"
                    className={gameStyles.freeTextInput}
                    placeholder="Antwort eingeben..."
                    value={freeTextInput}
                    onChange={(e) => setFreeTextInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleFreeTextSubmit()
                      }
                    }}
                    disabled={hasAnswered}
                    autoFocus
                    data-testid="free-text-input"
                  />
                  <button
                    className={gameStyles.freeTextSubmit}
                    onClick={handleFreeTextSubmit}
                    disabled={hasAnswered || !freeTextInput.trim()}
                    data-testid="free-text-submit"
                  >
                    Antworten
                  </button>
                </div>
              )}

              {/* Practice mode: wrong answer feedback */}
              {waitingForContinue && (
                <div className={gameStyles.practiceWrongFeedback} data-testid="practice-feedback">
                  <div className={gameStyles.practiceCorrectReveal}>
                    <span className={gameStyles.hintLabel}>Richtige Antwort</span>
                    {practiceCorrectAnswer}
                  </div>
                  {showingHint && question.hint && (
                    <div className={gameStyles.practiceHint}>
                      <span className={gameStyles.hintLabel}>Hinweis</span>
                      {question.hint}
                    </div>
                  )}
                  <button
                    className={gameStyles.continueButton}
                    onClick={handlePracticeContinue}
                    data-testid="practice-continue"
                  >
                    Weiter
                  </button>
                </div>
              )}

              {hasAnswered && !waitingForContinue && (
                <div className={gameStyles.submittedNote} data-testid="answer-feedback">
                  Antwort gesendet! Warten auf andere Spieler...
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Pane: Score + Players (hidden in practice mode) */}
        {!isPractice && (
          <aside className={gameStyles.rightPane} aria-label="Spielerübersicht">
            <div className={gameStyles.scoreBlock} data-testid="current-score">
              <ScoreDisplay
                score={score}
                multiplier={multiplier}
                correctAnswers={correctAnswers}
              />
              {scoreDelta !== null && (
                <div className={`${gameStyles.scoreDelta} ${scoreDelta ? gameStyles.scoreDeltaShow : ''}`}>+{scoreDelta}</div>
              )}
            </div>
            <div className={`${styles.card} ${gameStyles.playersCard}`}>
              <PlayerGrid
                players={sortedPlayersForPlates}
                rankings={rankings}
                maxPlayers={2}
                showScores={true}
                showMultipliers={true}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
