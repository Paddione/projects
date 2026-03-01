import React, { useState, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import { socketService } from '../services/socketService'
import { apiService } from '../services/apiService'
import { navigationService } from '../services/navigationService'
import { ErrorDisplay } from './ErrorBoundary'
import { Icon } from './Icon'
import styles from '../styles/GameInterface.module.css'
import { useAudio } from '../hooks/useAudio'
import { useLocalization } from '../hooks/useLocalization'

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
  const { t } = useLocalization()
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
    // Check authentication via apiService (source of truth for real login state)
    if (!apiService.isAuthenticated()) {
      setError(t('home.loginRequired'))
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
      const errorMessage = err instanceof Error ? err.message : t('gameInterface.failedToCreate')
      setError(errorMessage)
      handleMenuCancel()
    } finally {
      setLoading(false)
    }
  }

  const handleJoinLobby = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!lobbyCode.trim() || lobbyCode.length !== 6) {
      setError(t('home.invalidCode'))
      setJoinCodeError(t('home.codeRequired'))
      handleMenuCancel()
      return
    }

    if (!apiService.isAuthenticated()) {
      setError(t('home.loginRequiredJoin'))
      setJoinCodeError(t('home.loginRequiredJoin'))
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
      const errorMessage = err instanceof Error ? err.message : t('gameInterface.failedToJoin')
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
      setQuestionCountError(t('gameInterface.questionCountError'))
    } else {
      setQuestionCountError(null)
    }

    if (!selectedQuestionSet) {
      setQuestionSetError(t('gameInterface.questionSetRequired'))
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
        <h1 className={styles.title}>{t('gameInterface.title')}</h1>
        <p className={styles.subtitle}>{t('home.subtitle')}</p>
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
              <div className={styles.cardIcon}><Icon name="game-ui/lobby" size={32} alt={t('home.createLobby')} /></div>
              <div className={styles.cardBadge}>{t('home.fastPlay')}</div>
            </div>
            <div className={styles.cardBody}>
              <h3>{t('home.createLobby')}</h3>
              <p>{t('home.createDescription')}</p>
            </div>

            <div className={styles.cardFooter}>
              <div className={styles.primaryAction}>
                {isLoading ? t('home.creating') : t('home.launchNewLobby')}
              </div>
            </div>

            {isTestMode && isCreatePanelOpen && (
              <div className={styles.testPanel} onClick={e => e.stopPropagation()}>
                <div className={styles.testPanelTitle}>{t('gameInterface.legacySettings')}</div>
                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="question-count-select">{t('gameInterface.questionCount')}</label>
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
                    <label htmlFor="question-set-select">{t('gameInterface.questionSet')}</label>
                    <select
                      id="question-set-select"
                      ref={questionSetRef}
                      className={styles.select}
                      data-testid="question-set-select"
                      onChange={(e) => handleQuestionSetChange(e.target.value)}
                      defaultValue={questionSetFallbackRef.current}
                    >
                      <option value="">{t('gameInterface.selectSet')}</option>
                      <option value="general">{t('gameInterface.general')}</option>
                      <option value="science">{t('gameInterface.science')}</option>
                      <option value="history">{t('gameInterface.history')}</option>
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
                  {t('gameInterface.privateLobby')}
                </label>

                <div className={styles.buttonRow}>
                  <button
                    className={`${styles.button} ${styles.primary}`}
                    onClick={handleTestModeCreate}
                    data-testid="confirm-create-lobby"
                  >
                    {t('gameInterface.createLobby')}
                  </button>
                  <button
                    className={styles.textButton}
                    onClick={handleCreatePanelCancel}
                  >
                    {t('button.cancel')}
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
              <div className={styles.cardIcon}><Icon name="game-ui/multiplayer" size={32} alt={t('home.joinGame')} /></div>
              <div className={styles.cardBadge}>{t('home.multiplayer')}</div>
            </div>
            <div className={styles.cardBody}>
              <h3>{t('home.joinGame')}</h3>
              <p>{t('home.joinDescription')}</p>
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
                    {t('home.joinNow')}
                  </button>
                  <button
                    className={styles.textButton}
                    onClick={handleJoinPanelToggle}
                  >
                    {t('button.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.cardFooter}>
                <div className={styles.secondaryAction}>
                  {t('home.enterCode')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
