import React, { useState, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import { socketService } from '../services/socketService'
import { navigationService } from '../services/navigationService'
import { apiService } from '../services/apiService'
import { ErrorDisplay } from './ErrorBoundary'
import styles from '../styles/GameInterface.module.css'
import { useAudio } from '../hooks/useAudio'

interface GameInterfaceProps {
  className?: string
}

export const GameInterface: React.FC<GameInterfaceProps> = ({ className = '' }) => {
  const [lobbyCode, setLobbyCode] = useState('')
  const [isJoinPanelOpen, setIsJoinPanelOpen] = useState(false)
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false)
  const [isPrivateLobby, setIsPrivateLobby] = useState(false)
  const [questionCountError, setQuestionCountError] = useState<string | null>(null)
  const [questionSetError, setQuestionSetError] = useState<string | null>(null)
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null)
  const questionCountRef = useRef<HTMLSelectElement | null>(null)
  const questionSetRef = useRef<HTMLSelectElement | null>(null)
  const questionCountFallbackRef = useRef('5')
  const questionSetFallbackRef = useRef('')
  const { handleMenuSelect, handleMenuConfirm, handleMenuCancel, handleButtonHover } = useAudio()
  const isTestMode = (() => {
    try {
      if (typeof window === 'undefined') return false
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('test') === 'true' || urlParams.get('mock') === 'true') return true
      return localStorage.getItem('test_mode') === 'true' || sessionStorage.getItem('test_mode') === 'true'
    } catch {
      return false
    }
  })()

  const {
    setLobbyCode: setGameLobbyCode,
    setIsHost,
    setLoading,
    setError,
    error,
    isLoading
  } = useGameStore()

  const handleJoinPanelToggle = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsJoinPanelOpen(prev => !prev)
    handleMenuSelect()
  }

  const handleConfirmCreateLobby = async (
    e?: React.MouseEvent,
    settings?: { questionCount?: number; questionSetKey?: string; isPrivate?: boolean }
  ) => {
    if (e) e.stopPropagation()
    // Check authentication
    if (!apiService.isAuthenticated()) {
      setError('You must be logged in to create a lobby')
      handleMenuCancel()
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (!socketService.isConnected()) {
        socketService.connect()
      }

      // Default settings - these are configurable inside the lobby anyway
      const response = await socketService.createLobby({
        questionCount: settings?.questionCount ?? 10,
        ...(settings?.questionSetKey !== undefined && { questionSetKey: settings.questionSetKey }),
        ...(settings?.isPrivate !== undefined ? { isPrivate: settings.isPrivate } : { isPrivate: isPrivateLobby })
      })

      if (response && response.success && response.data) {
        const lobbyCode = response.data.code
        setGameLobbyCode(lobbyCode)
        setIsHost(true)

        await navigationService.navigateToLobby(lobbyCode)
        handleMenuConfirm()
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create lobby'
      setError(errorMessage)
      handleMenuCancel()
    } finally {
      setLoading(false)
    }
  }

  const handleJoinLobby = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!lobbyCode.trim() || lobbyCode.length !== 6) {
      setError('Please enter a valid 6-character lobby code')
      setJoinCodeError('Lobby code is required')
      handleMenuCancel()
      return
    }

    if (!apiService.isAuthenticated()) {
      setError('You must be logged in to join a lobby')
      setJoinCodeError('You must be logged in to join a lobby')
      handleMenuCancel()
      return
    }

    setLoading(true)
    setError(null)
    setJoinCodeError(null)

    try {
      if (!socketService.isConnected()) {
        socketService.connect()
      }

      const response = await socketService.joinLobby(
        lobbyCode.toUpperCase().trim()
      )

      if (response && response.success && response.data) {
        const lobbyCode = response.data.code
        setGameLobbyCode(lobbyCode)
        setIsHost(false)
        await navigationService.navigateToLobby(lobbyCode)
        handleMenuConfirm()
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join lobby'
      setError(errorMessage)
      handleMenuCancel()
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePanelOpen = (e: React.MouseEvent) => {
    if (isTestMode) {
      e.stopPropagation()
      setIsCreatePanelOpen(true)
      handleMenuSelect()
      return
    }
    handleConfirmCreateLobby(e)
  }

  const handleTestModeCreate = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const rawQuestionCount = questionCountRef.current?.value ?? questionCountFallbackRef.current
    const selectedQuestionSet = questionSetRef.current?.value ?? questionSetFallbackRef.current
    const numericCount = Number(rawQuestionCount)
    const isInteger = Number.isInteger(numericCount)
    const isValidCount = isInteger && numericCount >= 1 && numericCount <= 100

    if (!isValidCount) {
      setQuestionCountError('Question count must be between 1 and 100')
    } else {
      setQuestionCountError(null)
    }

    if (!selectedQuestionSet) {
      setQuestionSetError('Question set is required')
    } else {
      setQuestionSetError(null)
    }

    if (!isValidCount || !selectedQuestionSet) return

    await handleConfirmCreateLobby(undefined, {
      questionCount: numericCount,
      questionSetKey: selectedQuestionSet,
      isPrivate: isPrivateLobby
    })
  }

  const handleCreatePanelCancel = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsCreatePanelOpen(false)
    setQuestionCountError(null)
    setQuestionSetError(null)
    handleMenuCancel()
  }

  const handleQuestionCountChange = (value: string) => {
    questionCountFallbackRef.current = value
  }

  const handleQuestionSetChange = (value: string) => {
    questionSetFallbackRef.current = value
  }

  return (
    <div className={`${styles.gameInterface} ${className}`.trim()}>
      <div className={styles.header}>
        <h1 className={styles.title}>Learn2Play Quiz</h1>
        <p className={styles.subtitle}>Battle your friends online or tackle solo challenges</p>
      </div>

      <ErrorDisplay
        error={error}
        onClear={() => setError(null)}
      />

      <div className={styles.content}>
        <div className={styles.actionGrid}>
          {/* Create Card */}
          <div
            className={`${styles.actionCard} ${styles.createCard}`}
            onClick={handleCreatePanelOpen}
            onMouseEnter={handleButtonHover}
            data-testid="create-lobby-button"
          >
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>✨</div>
              <div className={styles.cardBadge}>Fast Play</div>
            </div>
            <div className={styles.cardBody}>
              <h3>Create Lobby</h3>
              <p>Host a new game and invite friends with a code. Configure everything inside!</p>
            </div>

            <div className={styles.cardFooter}>
              <div className={styles.primaryAction}>
                {isLoading ? 'Creating...' : 'Launch New Lobby'}
              </div>
            </div>

            {isTestMode && isCreatePanelOpen && (
              <div className={styles.testPanel} onClick={e => e.stopPropagation()}>
                <div className={styles.testPanelTitle}>Legacy Lobby Settings</div>
                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="question-count-select">Question Count</label>
                    <select
                      id="question-count-select"
                      ref={questionCountRef}
                      className={styles.select}
                      data-testid="question-count-select"
                      onChange={(e) => handleQuestionCountChange(e.target.value)}
                      defaultValue={questionCountFallbackRef.current}
                    >
                      <option value="3">3</option>
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="15">15</option>
                      <option value="20">20</option>
                    </select>
                    {questionCountError && (
                      <div className={styles.validationError} data-testid="question-count-error">
                        {questionCountError}
                      </div>
                    )}
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="question-set-select">Question Set</label>
                    <select
                      id="question-set-select"
                      ref={questionSetRef}
                      className={styles.select}
                      data-testid="question-set-select"
                      onChange={(e) => handleQuestionSetChange(e.target.value)}
                      defaultValue={questionSetFallbackRef.current}
                    >
                      <option value="">Select a set</option>
                      <option value="general">General</option>
                      <option value="science">Science</option>
                      <option value="history">History</option>
                    </select>
                    {questionSetError && (
                      <div className={styles.validationError} data-testid="question-set-error">
                        {questionSetError}
                      </div>
                    )}
                  </div>
                </div>

                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={isPrivateLobby}
                    onChange={(e) => setIsPrivateLobby(e.target.checked)}
                    data-testid="private-lobby-checkbox"
                  />
                  Private lobby
                </label>

                <div className={styles.buttonRow}>
                  <button
                    className={`${styles.button} ${styles.primary}`}
                    onClick={handleTestModeCreate}
                    data-testid="confirm-create-lobby"
                  >
                    Create Lobby
                  </button>
                  <button
                    className={styles.textButton}
                    onClick={handleCreatePanelCancel}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Join Card */}
          <div
            className={`${styles.actionCard} ${styles.joinCard} ${isJoinPanelOpen ? styles.cardExpanded : ''}`}
            onClick={() => !isJoinPanelOpen && handleJoinPanelToggle()}
            onMouseEnter={handleButtonHover}
            data-testid="join-lobby-button"
          >
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>🔑</div>
              <div className={styles.cardBadge}>Multiplayer</div>
            </div>
            <div className={styles.cardBody}>
              <h3>Join Game</h3>
              <p>Enter a 6-character code to jump into an existing lobby</p>
            </div>

            {isJoinPanelOpen ? (
              <div className={styles.joinActionWrapper} onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="CODE12"
                  maxLength={6}
                  value={lobbyCode}
                  onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                  autoFocus
                  data-testid="lobby-code-input"
                />
                {isTestMode && joinCodeError && (
                  <div className={styles.validationError} data-testid="lobby-code-error">
                    {joinCodeError}
                  </div>
                )}
                <div className={styles.buttonRow}>
                  <button
                    className={`${styles.button} ${styles.secondary}`}
                    onClick={handleJoinLobby}
                    disabled={isLoading || lobbyCode.length !== 6}
                    data-testid="join-lobby-confirm"
                  >
                    Join Now
                  </button>
                  <button
                    className={styles.textButton}
                    onClick={handleJoinPanelToggle}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.cardFooter}>
                <div className={styles.secondaryAction}>
                  Enter Code
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
