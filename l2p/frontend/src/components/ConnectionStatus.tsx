import React, { useEffect, useState } from 'react'
import { socketService } from '../services/socketService'
import { useLocalization } from '../hooks/useLocalization'
import styles from '../styles/ConnectionStatus.module.css'

interface ConnectionStatusProps {
  className?: string
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ className = '' }) => {
  const { t } = useLocalization()
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const updateStatus = () => {
      try {
        const anyService = socketService as unknown as { getConnectionStatus?: () => 'connected' | 'connecting' | 'disconnected'; isConnected?: () => boolean }
        if (typeof anyService.getConnectionStatus === 'function') {
          setStatus(anyService.getConnectionStatus())
        } else if (typeof anyService.isConnected === 'function') {
          setStatus(anyService.isConnected() ? 'connected' : 'disconnected')
        } else {
          setStatus('disconnected')
        }
      } catch {
        setStatus('disconnected')
      }
    }

    // Update status immediately
    updateStatus()

    // Set up interval to check status
    const interval = setInterval(updateStatus, 1000)

    // Listen for connection events
    const handleConnect = () => {
      setStatus('connected')
      setError(null)
    }

    const handleDisconnect = () => {
      setStatus('disconnected')
    }

    const handleConnectError = () => {
      setStatus('connecting')
      setError(t('connection.failed'))
    }

    socketService.on('connect', handleConnect)
    socketService.on('disconnect', handleDisconnect)
    socketService.on('connect_error', handleConnectError)

    return () => {
      clearInterval(interval)
      socketService.off('connect', handleConnect)
      socketService.off('disconnect', handleDisconnect)
      socketService.off('connect_error', handleConnectError)
    }
  }, [])

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return styles.connected
      case 'connecting':
        return styles.connecting
      case 'disconnected':
        return styles.disconnected
      default:
        return styles.disconnected
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return t('connection.connected')
      case 'connecting':
        return t('connection.connecting')
      case 'disconnected':
        return t('connection.disconnected')
      default:
        return t('connection.unknown')
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return '●'
      case 'connecting':
        return '⟳'
      case 'disconnected':
        return '○'
      default:
        return '○'
    }
  }

  return (
    <div className={`${styles.connectionStatus} ${className}`} data-testid="connection-status" data-status={status}>
      <div className={`${styles.statusIndicator} ${getStatusColor()}`}>
        <span className={styles.statusIcon}>{getStatusIcon()}</span>
        <span className={styles.statusText}>{getStatusText()}</span>
      </div>
      
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
    </div>
  )
} 
