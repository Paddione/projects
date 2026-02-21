import React, { useState, useEffect } from 'react'
import { apiService } from '../services/apiService'
import { socketService } from '../services/socketService'
import { useGameStore } from '../stores/gameStore'
import { navigationService } from '../services/navigationService'
import { useLocalization } from '../hooks/useLocalization'
import styles from '../styles/LobbiesList.module.css'

interface Player {
  id: string;
  username: string;
  character: string;
  characterLevel?: number;
  isReady: boolean;
  isHost: boolean;
  score: number;
  multiplier: number;
  correctAnswers: number;
  isConnected: boolean;
  joinedAt: string;
}

interface LobbyData {
  lobbies: Lobby[];
  count: number;
}

interface Lobby {
  id: number;
  code: string;
  host_id: number;
  status: 'waiting' | 'starting' | 'active' | 'finished';
  question_count: number;
  created_at: string;
  updated_at: string;
  players: Player[];
  settings?: {
    questionSetIds: number[];
    timeLimit: number;
    allowReplay: boolean;
  };
}

export const LobbiesList: React.FC = () => {
  const [lobbies, setLobbies] = useState<Lobby[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const {
    setLobbyCode,
    setIsHost,
    setLoading,
    setError: setGameError
  } = useGameStore()
  const { t } = useLocalization()

  const isFreshLobby = (lobby: Lobby): boolean => {
    const created = new Date(lobby.created_at).getTime()
    const ageMs = Date.now() - created
    const tenMinutesMs = 10 * 60 * 1000
    return lobby.status === 'waiting' && ageMs <= tenMinutesMs
  }

  const fetchLobbies = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await apiService.get<LobbyData>('/lobbies?limit=10')
      if (response.lobbies) {
        const fresh = response.lobbies.filter(isFreshLobby)
        setLobbies(fresh)
      }
    } catch (err) {
      console.error('Failed to fetch lobbies:', err)
      setError(t('lobbies.failedToLoad'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLobbies()
    
    // Refresh lobbies every 30 seconds
    const interval = setInterval(fetchLobbies, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const handleJoinLobby = async (lobbyCode: string) => {
    if (!apiService.isAuthenticated()) {
      setGameError(t('lobbies.loginRequired'))
      return
    }

    setLoading(true)
    setGameError(null)
    
    try {
      // Connect to WebSocket if not already connected
      if (!socketService.isConnected()) {
        socketService.connect()
      }

      // Join lobby via API and WebSocket
      const response = await socketService.joinLobby(lobbyCode)

      if (response && response.success && response.data) {
        const code = response.data.code
        setLobbyCode(code)
        setIsHost(false)
        
        // Navigate to lobby
        await navigationService.navigateToLobby(code)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('lobbies.failedToJoin')
      setGameError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const formatElapsedMinutes = (dateString: string) => {
    const created = new Date(dateString).getTime()
    const now = Date.now()
    const diffMs = Math.max(0, now - created)
    const minutes = Math.floor(diffMs / 60000)
    return `${minutes} min`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return '#28a745'
      case 'starting': return '#ffc107'
      case 'active': return '#007bff'
      case 'finished': return '#6c757d'
      default: return '#6c757d'
    }
  }

  if (isLoading) {
    return (
      <div className={styles.lobbiesList}>
        <div className={styles.header}>
          <h2>{t('lobbies.title')}</h2>
        </div>
        <div className={styles.loading}>{t('lobbies.loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.lobbiesList}>
        <div className={styles.header}>
          <h2>{t('lobbies.title')}</h2>
          <button onClick={fetchLobbies} className={styles.refreshButton}>
            {t('lobbies.refresh')}
          </button>
        </div>
        <div className={styles.error}>{error}</div>
      </div>
    )
  }

  return (
    <div className={styles.lobbiesList}>
      <div className={styles.header}>
        <h2>{t('lobbies.title')}</h2>
        <button onClick={fetchLobbies} className={styles.refreshButton}>
          {t('lobbies.refresh')}
        </button>
      </div>
      
      {lobbies.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{t('lobbies.noLobbies')}</p>
          <small>{t('lobbies.noLobbiesHint')}</small>
        </div>
      ) : (
        <div className={styles.lobbiesContainer}>
          {lobbies.map((lobby) => (
            <div key={lobby.code} className={styles.lobbyCard}>
              <div className={styles.lobbyHeader}>
                <div className={styles.lobbyCode}>#{lobby.code}</div>
                <div 
                  className={styles.status}
                  style={{ backgroundColor: getStatusColor(lobby.status) }}
                >
                  {lobby.status}
                </div>
              </div>
              
              <div className={styles.lobbyInfo}>
                <div className={styles.players}>
                  <strong>{lobby.players.length === 1 ? t('lobbies.playerCount', { count: 1 }) : t('lobbies.playerCountPlural', { count: lobby.players.length })}</strong>
                  <div className={styles.playersList}>
                    {lobby.players.slice(0, 3).map((player, index) => (
                      <span key={player.id} className={styles.playerName}>
                        {player.username}
                        {player.isHost && (' ' + t('lobbies.host'))}
                        {index < Math.min(lobby.players.length, 3) - 1 && ', '}
                      </span>
                    ))}
                    {lobby.players.length > 3 && (
                      <span className={styles.moreUsers}>
                        {' ' + t('lobbies.more', { count: lobby.players.length - 3 })}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className={styles.gameInfo}>
                  <span>{t('lobbies.questionCount', { count: lobby.question_count })}</span>
                  <span className={styles.separator}>•</span>
                  <span>{formatElapsedMinutes(lobby.created_at)}</span>
                </div>
              </div>
              
              {lobby.status === 'waiting' && (
                <button 
                  className={styles.joinButton}
                  onClick={() => handleJoinLobby(lobby.code)}
                >
                  {t('lobbies.joinLobby')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
