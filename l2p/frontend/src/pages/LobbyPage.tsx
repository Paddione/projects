import React, { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { LobbyView } from '../components/LobbyView'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { ErrorDisplay } from '../components/ErrorBoundary'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useGameStore } from '../stores/gameStore'
import { socketService } from '../services/socketService'
import { navigationService } from '../services/navigationService'
import { apiService } from '../services/apiService'
import styles from '../styles/App.module.css'
import { useAudio } from '../hooks/useAudio'

export const LobbyPage: React.FC = () => {
  const { lobbyId } = useParams<{ lobbyId: string }>()
  const navigate = useNavigate()
  const {
    handleLobbyMusic,
    handleGameStart,
    handleStopAllSounds,
  } = useAudio()
  
  const {
    lobbyCode,
    gameStarted,
    isLoading,
    error,
    setError,
    setLobbyCode
  } = useGameStore()

  useEffect(() => {
    const initializeLobby = async () => {
      if (!lobbyId) {
        setError('No lobby ID provided')
        navigate('/')
        return
      }

      // Set lobby code if not already set
      if (lobbyCode !== lobbyId) {
        setLobbyCode(lobbyId)
      }

      // Connect to WebSocket if not connected
      if (!socketService.isConnected()) {
        socketService.connect()
      }

      // Validate the lobby exists
      await navigationService.validateCurrentRoute()
    }

    initializeLobby()
    // Start lobby music on mount
    handleLobbyMusic(true)
    return () => {
      // Stop any sounds when leaving the lobby
      handleStopAllSounds()
    }
  }, [lobbyId, lobbyCode, navigate, setError, setLobbyCode, handleLobbyMusic, handleStopAllSounds])

  // Auto-navigate to game when it starts
  useEffect(() => {
    if (gameStarted && lobbyCode) {
      // Play game start cue and switch music
      handleGameStart()
      // Skip validation since gameStarted is set by socket event
      navigationService.navigateToGame(lobbyCode, true)
    }
  }, [gameStarted, lobbyCode, handleGameStart])

  // Recovery: poll lobby status to detect if game started but socket event was missed
  const recoveryRef = useRef(false)
  useEffect(() => {
    if (gameStarted || !lobbyId) return

    const pollInterval = setInterval(async () => {
      if (recoveryRef.current) return
      try {
        const response = await apiService.getLobby(lobbyId)
        if (response.success && response.data && response.data.status === 'playing') {
          recoveryRef.current = true
          clearInterval(pollInterval)
          console.log('Recovery: detected game started via API poll')
          useGameStore.getState().setGameStarted(true)
        }
      } catch {
        // Ignore errors during recovery polling
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [gameStarted, lobbyId])

  const handleLeaveLobby = async () => {
    if (lobbyCode) {
      await navigationService.leaveLobby(lobbyCode)
    } else {
      navigate('/')
    }
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <LoadingSpinner />
        <p>Loading lobby...</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Error Display */}
      <ErrorDisplay 
        error={error} 
        onClear={() => setError(null)}
        onRetry={() => window.location.reload()}
      />

      <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`}>
        <div>
          <h1>Game Lobby</h1>
          {lobbyCode && (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              Code: {lobbyCode}
            </p>
          )}
        </div>
        <div className={`${styles.flex} ${styles.itemsCenter} ${styles.gapMd}`}>
          <button 
            onClick={handleLeaveLobby}
            className={`${styles.button} ${styles.buttonSecondary}`}
            style={{ fontSize: '0.875rem' }}
            data-testid="leave-lobby-button"
          >
            Leave Lobby
          </button>
          <ConnectionStatus />
        </div>
      </div>
      
      <LobbyView />
    </div>
  )
} 
