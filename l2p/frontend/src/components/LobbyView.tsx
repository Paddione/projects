import React, { useState } from 'react'
import { PlayerGrid } from './PlayerGrid'
import { QuestionSetSelector } from './QuestionSetSelector'
import { useGameStore } from '../stores/gameStore'
import styles from '../styles/LobbyView.module.css'
import { socketService } from '../services/socketService'
import { navigationService } from '../services/navigationService'
import { apiService } from '../services/apiService'

interface LobbyViewProps {
  className?: string
}

export const LobbyView: React.FC<LobbyViewProps> = ({ className = '' }) => {
  const [isReady, setIsReady] = useState(false)
  const [copied, setCopied] = useState(false)

  const {
    lobbyCode,
    isHost,
    players,
    error,
    questionSetInfo
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

  const readyPlayers = players.filter(p => p.isReady).length
  const totalPlayers = players.length
  const allReady = readyPlayers === totalPlayers && totalPlayers > 0
  const canStart = isHost && readyPlayers >= 1

  return (
    <div className={`${styles.lobbyView} ${className}`.trim()}>
      <div className={styles.topBar}>
        <div className={styles.codeBadge} onClick={handleCopyCode}>
          <span className={styles.codeLabel}>Lobby Code</span>
          <span className={styles.codeValue}>{lobbyCode}</span>
          <span className={styles.copyHint}>{copied ? 'Copied!' : 'Click to copy'}</span>
        </div>

        <div className={styles.statusBadge}>
          <div className={styles.readyFraction}>
            <span className={styles.readyCount}>{readyPlayers}</span>
            <span className={styles.totalCount}>/ {totalPlayers}</span>
          </div>
          <span className={styles.readyLabel}>Ready</span>
        </div>
      </div>

      <div className={styles.mainLayout}>
        <div className={styles.gameSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Challengers</h2>
            {isHost && (
              <div className={styles.hostBadge}>👑 Master of Ceremony</div>
            )}
          </div>

          <div className={styles.playersWrapper}>
            <PlayerGrid
              players={players}
              showScores={false}
              showMultipliers={true}
            />
          </div>

          <div className={styles.actionArea}>
            <button
              className={`${styles.readyToggle} ${isReady ? styles.readyActive : ''}`}
              onClick={handleReadyToggle}
            >
              {isReady ? '✓ I am Ready' : 'Get Ready'}
            </button>

            {isHost && (
              <div className={styles.hostPanel}>
                <button
                  className={`${styles.startAction} ${canStart ? styles.startEnabled : ''}`}
                  onClick={handleStartGame}
                  disabled={!canStart}
                >
                  <span className={styles.startIcon}>🎮</span>
                  <span className={styles.startText}>
                    {!allReady ? 'Start Anyway' : 'Launch Game'}
                  </span>
                </button>
                {!allReady && (
                  <p className={styles.waitingNote}>Waiting for everyone to be ready...</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={styles.settingsSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Game Configuration</h2>
            {isHost && (
              <button
                className={styles.manageLink}
                onClick={() => navigationService.navigateToQuestionSets()}
              >
                Manage Sets
              </button>
            )}
          </div>

          <QuestionSetSelector />
        </div>
      </div>

      {error && (
        <div className={styles.errorOverlay}>
          <div className={styles.errorBox}>
            <span className={styles.errorIcon}>⚠️</span>
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}