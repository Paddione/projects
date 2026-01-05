import React, { useState } from 'react'
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
  const [isPrivateLobby] = useState(false)
  const { handleMenuSelect, handleMenuConfirm, handleMenuCancel, handleButtonHover } = useAudio()

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

  const handleConfirmCreateLobby = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
        questionCount: 10,
        isPrivate: isPrivateLobby
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
    e.stopPropagation();
    if (!lobbyCode.trim() || lobbyCode.length !== 6) {
      setError('Please enter a valid 6-character lobby code')
      handleMenuCancel()
      return
    }

    if (!apiService.isAuthenticated()) {
      setError('You must be logged in to join a lobby')
      handleMenuCancel()
      return
    }

    setLoading(true)
    setError(null)

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
            onClick={handleConfirmCreateLobby}
            onMouseEnter={handleButtonHover}
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
          </div>

          {/* Join Card */}
          <div
            className={`${styles.actionCard} ${styles.joinCard} ${isJoinPanelOpen ? styles.cardExpanded : ''}`}
            onClick={() => !isJoinPanelOpen && handleJoinPanelToggle()}
            onMouseEnter={handleButtonHover}
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
                />
                <div className={styles.buttonRow}>
                  <button
                    className={`${styles.button} ${styles.secondary}`}
                    onClick={handleJoinLobby}
                    disabled={isLoading || lobbyCode.length !== 6}
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
