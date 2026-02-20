import React, { useState } from 'react'
import { PlayerGrid } from './PlayerGrid'
import { QuestionSetSelector } from './QuestionSetSelector'
import { useGameStore } from '../stores/gameStore'
import styles from '../styles/LobbyView.module.css'
import { socketService } from '../services/socketService'
import { navigationService } from '../services/navigationService'
import { apiService } from '../services/apiService'
import { useLocalization } from '../hooks/useLocalization'

interface LobbyViewProps {
  className?: string
}

export const LobbyView: React.FC<LobbyViewProps> = ({ className = '' }) => {
  const [isReady, setIsReady] = useState(false)
  const [copied, setCopied] = useState(false)
  const { t } = useLocalization()

  const {
    lobbyCode,
    isHost,
    players,
    error,
    questionSetInfo,
    maxPlayers,
    gameMode,
    setGameMode,
  } = useGameStore()

  const handleReadyToggle = () => {
    const next = !isReady
    setIsReady(next)
    socketService.setReady(next)
  }

  const handleStartGame = async () => {
    if (players.filter(p => p.isReady).length < 1) return

    try {
      if (questionSetInfo && questionSetInfo.selectedSets.length > 0) {
        const user = apiService.getCurrentUser()
        const hostId = String(user?.id || '')

        socketService.updateQuestionSets(
          lobbyCode!,
          hostId,
          questionSetInfo.selectedSets.map(set => set.id),
          questionSetInfo.selectedQuestionCount
        )

        setTimeout(() => {
          socketService.startGame()
        }, 200)
      } else {
        socketService.startGame()
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      socketService.startGame()
    }
  }

  const handleCopyCode = async () => {
    if (lobbyCode) {
      try {
        await navigator.clipboard.writeText(lobbyCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Copy failed', err)
      }
    }
  }

  const handleGameModeChange = (mode: 'arcade' | 'practice') => {
    if (!isHost || mode === gameMode) return
    setGameMode(mode)
    socketService.updateGameMode(mode)
  }

  const readyPlayers = players.filter(p => p.isReady).length
  const totalPlayers = players.length
  const allReady = readyPlayers === totalPlayers && totalPlayers > 0
  const canStart = isHost && readyPlayers >= 1

  return (
    <div className={`${styles.lobbyView} ${className}`.trim()}>
      <div className={styles.topBar}>
        <div className={styles.codeBadge} onClick={handleCopyCode}>
          <span className={styles.codeLabel}>{t('lobby.lobbyCode')}</span>
          <span className={styles.codeValue} data-testid="lobby-code">{lobbyCode}</span>
          <span className={styles.copyHint}>{copied ? t('lobby.copied') : t('lobby.clickToCopy')}</span>
        </div>

        <div className={styles.statusBadge}>
          <div className={styles.readyFraction}>
            <span className={styles.readyCount}>{readyPlayers}</span>
            <span className={styles.totalCount}>/ {totalPlayers}</span>
          </div>
          <span className={styles.readyLabel}>{t('game.ready')}</span>
        </div>
      </div>

      <div className={styles.mainLayout}>
        <div className={styles.gameSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('lobby.challengers')}</h2>
            {isHost && (
              <div className={styles.hostBadge} data-testid="host-indicator">{'👑 ' + t('lobby.masterOfCeremony')}</div>
            )}
          </div>

          <div className={styles.playersWrapper} data-testid="lobby-players">
            <PlayerGrid
              players={players}
              showScores={false}
              showMultipliers={true}
              data-testid="player-list"
            />
          </div>

          <div className={styles.actionArea}>
            <button
              className={`${styles.readyToggle} ${isReady ? styles.readyActive : ''}`}
              onClick={handleReadyToggle}
              data-testid="ready-toggle"
            >
              {isReady ? '✓ ' + t('lobby.iAmReady') : t('lobby.getReady')}
            </button>

            {isHost && (
              <div className={styles.hostPanel}>
                <button
                  className={`${styles.startAction} ${canStart ? styles.startEnabled : ''}`}
                  onClick={handleStartGame}
                  disabled={!canStart}
                  data-testid="start-game-button"
                >
                  <span className={styles.startIcon}>🎮</span>
                  <span className={styles.startText}>
                    {!allReady ? t('lobby.startAnyway') : t('lobby.launchGame')}
                  </span>
                </button>
                {!allReady && (
                  <p className={styles.waitingNote}>{t('lobby.waitingForReady')}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={styles.settingsSection} data-testid="lobby-settings">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('lobby.gameConfiguration')}</h2>
            {isHost && (
              <button
                className={styles.manageLink}
                onClick={() => navigationService.navigateToQuestionSets()}
              >
                {t('lobby.manageSets')}
              </button>
            )}
          </div>

          <div className={styles.gameModeSelector} data-testid="game-mode-selector">
            <h3 className={styles.sectionTitle} style={{ fontSize: '1.1rem' }}>{t('lobby.gameMode')}</h3>
            <div className={styles.gameModeButtons}>
              <button
                className={`${styles.gameModeBtn} ${gameMode === 'arcade' ? styles.gameModeActive : ''}`}
                onClick={() => handleGameModeChange('arcade')}
                disabled={!isHost}
                data-testid="game-mode-arcade"
              >
                <span>{t('lobby.arcade')}</span>
                <span className={styles.gameModeDesc}>{t('lobby.arcadeDesc')}</span>
              </button>
              <button
                className={`${styles.gameModeBtn} ${gameMode === 'practice' ? styles.gameModeActive : ''}`}
                onClick={() => handleGameModeChange('practice')}
                disabled={!isHost}
                data-testid="game-mode-practice"
              >
                <span>{t('lobby.practiceMode')}</span>
                <span className={styles.gameModeDesc}>{t('lobby.practiceDesc')}</span>
              </button>
            </div>
          </div>

          <QuestionSetSelector />
          <div style={{ display: 'none' }}>
            <span data-testid="setting-question-count">{questionSetInfo?.selectedQuestionCount ?? 0}</span>
            <span data-testid="setting-question-set">
              {questionSetInfo?.selectedSets?.map(set => set.name).join(', ') || 'None'}
            </span>
            <span data-testid="setting-private">{String(false)}</span>
            <span data-testid="setting-max-players">{maxPlayers}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className={styles.errorOverlay} data-testid="lobby-error">
          <div className={styles.errorBox}>
            <span className={styles.errorIcon}>⚠️</span>
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}
