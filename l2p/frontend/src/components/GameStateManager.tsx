import React, { useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../stores/gameStore'
import { socketService } from '../services/socketService'
import { navigationService } from '../services/navigationService'

export const GameStateManager: React.FC = () => {
  const initialized = useRef(false)
  const { lobbyCode, gameStarted, gameEnded } = useGameStore()

  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    const currentPath = window.location.pathname
    
    // Warn user if they're in a game/lobby
    if (currentPath.includes('/game/') || currentPath.includes('/lobby/')) {
      const message = 'Are you sure you want to leave? This will remove you from the lobby.'
      event.preventDefault()
      event.returnValue = message
      return message
    }
    return undefined // Explicit return for other paths
  }, [])

  const initializeServices = useCallback(async () => {
    try {
      // Initialize WebSocket connection
      const socketUrl = (typeof window !== 'undefined' && (window as { ENV?: { VITE_SOCKET_URL?: string } }).ENV?.VITE_SOCKET_URL)
      if (socketUrl) {
        socketService.connect(socketUrl)
      }

      // Validate current route
      await navigationService.validateCurrentRoute()

      // Listen for beforeunload to handle page refresh/close
      window.addEventListener('beforeunload', handleBeforeUnload)
      
    } catch (error) {
      console.error('Failed to initialize services:', error)
    }
  }, [handleBeforeUnload])

  const cleanupServices = useCallback(() => {
    // Disconnect WebSocket
    socketService.disconnect()
    
    // Cleanup navigation service
    navigationService.destroy()
    
    // Remove event listeners
    window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [handleBeforeUnload])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Initialize services
    initializeServices()

    // Cleanup on unmount
    return () => {
      cleanupServices()
    }
  }, [initializeServices, cleanupServices])

  // Handle game state changes for navigation
  useEffect(() => {
    navigationService.handleGameStateChange()
  }, [gameStarted, gameEnded, lobbyCode])

  // Validate route on lobby/game state changes
  useEffect(() => {
    const validateRoute = async () => {
      await navigationService.validateCurrentRoute()
    }
    
    if (lobbyCode) {
      validateRoute()
    }
  }, [lobbyCode])

  // This component doesn't render anything visible
  return null
} 