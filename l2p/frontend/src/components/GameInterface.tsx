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

const QUESTION_SET_OPTIONS = [
  { value: 'general', label: 'General Knowledge' },
  { value: 'science', label: 'Science & Nature' },
  { value: 'history', label: 'World History' },
  { value: 'gaming', label: 'Gaming & Esports' },
]

const QUESTION_COUNT_OPTIONS = ['3', '5', '10', '15']

export const GameInterface: React.FC<GameInterfaceProps> = ({ className = '' }) => {
  const [lobbyCode, setLobbyCode] = useState('')
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false)
  const [isJoinPanelOpen, setIsJoinPanelOpen] = useState(false)
  const [selectedQuestionCount, setSelectedQuestionCount] = useState<string>('5')
  const [selectedQuestionSet, setSelectedQuestionSet] = useState<string>('general')
  const [isPrivateLobby, setIsPrivateLobby] = useState(false)
  const [lobbyStatus, setLobbyStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const { handleMenuSelect, handleMenuConfirm, handleMenuCancel, handleButtonHover } = useAudio()
  
  const { 
    setLobbyCode: setGameLobbyCode, 
    setIsHost, 
    setLoading, 
    setError,
    error,
    isLoading
  } = useGameStore()
  
  const handleCreatePanelToggle = () => {
    setLobbyStatus(null)
    setIsCreatePanelOpen(prev => !prev)
    handleMenuSelect()
  }

  const handleJoinPanelToggle = () => {
    setLobbyStatus(null)
    setIsJoinPanelOpen(prev => !prev)
    handleMenuSelect()
  }

  const handleConfirmCreateLobby = async () => {
    // Check authentication
    if (!apiService.isAuthenticated()) {
      setError('You must be logged in to create a lobby')
      setLobbyStatus({ type: 'error', message: 'You must be logged in to create a lobby' })
      handleMenuCancel()
      return
    }

    setLoading(true)
    setError(null)
    setLobbyStatus(null)
    
    try {
      // Connect to WebSocket if not already connected
      if (!socketService.isConnected()) {
        socketService.connect()
      }

      // Create lobby via API and WebSocket
      const response = await socketService.createLobby(
        { 
          questionCount: Number(selectedQuestionCount),
          questionSetKey: selectedQuestionSet,
          isPrivate: isPrivateLobby
        }
      )

      if (response && response.success && response.data) {
        const lobbyCode = response.data.code
        setGameLobbyCode(lobbyCode)
        setIsHost(true)
        
        // Navigate to lobby
        await navigationService.navigateToLobby(lobbyCode)
        setLobbyStatus({ type: 'success', message: `Lobby ${lobbyCode} created successfully` })
        setIsCreatePanelOpen(false)
        handleMenuConfirm()
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create lobby'
      setError(errorMessage)
      setLobbyStatus({ type: 'error', message: errorMessage })
      handleMenuCancel()
    } finally {
      setLoading(false)
    }
  }

  const handleJoinLobby = async () => {
    if (!lobbyCode.trim() || lobbyCode.length !== 6) {
      setError('Please enter a valid 6-character lobby code')
      setLobbyStatus({ type: 'error', message: 'Please enter a valid 6-character lobby code' })
      handleMenuCancel()
      return
    }

    // Check authentication
    if (!apiService.isAuthenticated()) {
      setError('You must be logged in to join a lobby')
      setLobbyStatus({ type: 'error', message: 'You must be logged in to join a lobby' })
      handleMenuCancel()
      return
    }

    setLoading(true)
    setError(null)
    setLobbyStatus(null)
    
    try {
      // Connect to WebSocket if not already connected
      if (!socketService.isConnected()) {
        socketService.connect()
      }

      // Join lobby via API and WebSocket
      const response = await socketService.joinLobby(
        lobbyCode.toUpperCase().trim()
      )

      if (response && response.success && response.data) {
        const lobbyCode = response.data.code
        setGameLobbyCode(lobbyCode)
        setIsHost(false)
        
        // Navigate to lobby
        await navigationService.navigateToLobby(lobbyCode)
        setLobbyStatus({ type: 'success', message: `Joined lobby ${lobbyCode}` })
        setIsJoinPanelOpen(false)
        handleMenuConfirm()
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join lobby'
      setError(errorMessage)
      setLobbyStatus({ type: 'error', message: errorMessage })
      handleMenuCancel()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${styles.gameInterface} ${className}`.trim()}>
      <div className={styles.header}>
        <h1 className={styles.title}>Learn2Play Quiz</h1>
        <p className={styles.subtitle}>Create or join a multiplayer quiz game</p>
      </div>

      {/* Error Display */}
      <ErrorDisplay 
        error={error} 
        onClear={() => setError(null)}
      />

      <div className={styles.content}>
        {/* Create Lobby Section */}
        <div className={styles.section}>
          <h2>Create New Game</h2>
          
          <button
            className={`${styles.button} ${styles.primary}`}
            onClick={handleCreatePanelToggle}
            data-testid="create-lobby-button"
            onMouseEnter={handleButtonHover}
            onMouseDown={handleMenuSelect}
          >
            {isCreatePanelOpen ? 'Hide Options' : 'Create Lobby'}
          </button>

          {isCreatePanelOpen && (
            <div className={styles.lobbySettings} data-testid="lobby-settings">
              <div className={styles.inputGroup}>
                <label htmlFor="questionCount">Question Count</label>
                <select
                  id="questionCount"
                  className={styles.select}
                  value={selectedQuestionCount}
                  onChange={(e) => setSelectedQuestionCount(e.target.value)}
                  data-testid="question-count-select"
                >
                  {QUESTION_COUNT_OPTIONS.map(option => (
                    <option key={option} value={option}>
                      {option} Questions
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="questionSet">Question Set</label>
                <select
                  id="questionSet"
                  className={styles.select}
                  value={selectedQuestionSet}
                  onChange={(e) => setSelectedQuestionSet(e.target.value)}
                  data-testid="question-set-select"
                >
                  {QUESTION_SET_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={isPrivateLobby}
                  onChange={(e) => setIsPrivateLobby(e.target.checked)}
                  data-testid="private-lobby-checkbox"
                />
                <span>Private lobby (invite only)</span>
              </label>

              <button
                className={`${styles.button} ${styles.primary}`}
                onClick={handleConfirmCreateLobby}
                data-testid="confirm-create-lobby"
                disabled={isLoading}
                onMouseEnter={handleButtonHover}
                onMouseDown={handleMenuSelect}
              >
                {isLoading ? 'Creating...' : 'Confirm Lobby Setup'}
              </button>
            </div>
          )}
        </div>

        {/* Join Lobby Section */}
        <div className={styles.section}>
          <h2>Join Existing Game</h2>

          <button
            className={`${styles.button} ${styles.secondary}`}
            onClick={handleJoinPanelToggle}
            data-testid="join-lobby-button"
            onMouseEnter={handleButtonHover}
            onMouseDown={handleMenuSelect}
          >
            {isJoinPanelOpen ? 'Hide Join Options' : 'Join Lobby'}
          </button>

          {isJoinPanelOpen && (
            <div className={styles.joinSettings}>
              <div className={styles.inputGroup}>
                <label htmlFor="lobbyCode">Lobby Code</label>
                <input
                  id="lobbyCode"
                  type="text"
                  value={lobbyCode}
                  onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className={styles.input}
                  data-testid="lobby-code-input"
                  onFocus={handleMenuSelect}
                />
              </div>
              
              <button
                className={`${styles.button} ${styles.secondary}`}
                onClick={handleJoinLobby}
                disabled={!lobbyCode.trim() || isLoading}
                data-testid="join-lobby-confirm"
                onMouseEnter={handleButtonHover}
                onMouseDown={handleMenuSelect}
              >
                {isLoading ? 'Joining...' : 'Confirm & Join'}
              </button>
            </div>
          )}
        </div>

      </div>

      {lobbyStatus?.type === 'success' && (
        <div className={styles.statusMessage} data-testid="lobby-success">
          {lobbyStatus.message}
        </div>
      )}

      {lobbyStatus?.type === 'error' && (
        <div className={`${styles.statusMessage} ${styles.errorMessage}`} data-testid="lobby-error">
          {lobbyStatus.message}
        </div>
      )}
    </div>
  )
} 
