import { useEffect, useCallback } from 'react'
import { useAudioStore } from '../stores/audioStore'

export const useAudio = () => {
  const audioStore = useAudioStore()

  // Resume audio context on user interaction
  useEffect(() => {
    const handleUserInteraction = () => {
      try {
        audioStore.resumeAudioContext()
      } catch (error) {
        console.warn('Failed to resume audio context:', error)
      }
    }

    // Add event listeners for user interactions
    const events = ['click', 'touchstart', 'keydown', 'mousedown']
    events.forEach(event => {
      try {
        document.addEventListener(event, handleUserInteraction, { once: true })
      } catch (error) {
        console.warn(`Failed to add event listener for ${event}:`, error)
      }
    })

    return () => {
      events.forEach(event => {
        try {
          document.removeEventListener(event, handleUserInteraction)
        } catch (error) {
          console.warn(`Failed to remove event listener for ${event}:`, error)
        }
      })
    }
  }, [audioStore])

  // Audio event handlers with automatic button click sound
  const handleButtonClick = useCallback(() => {
    try {
      audioStore.playButtonClick()
    } catch (error) {
      console.warn('Failed to play button click sound:', error)
    }
  }, [audioStore])

  const handleButtonHover = useCallback(() => {
    try {
      audioStore.playButtonHover()
    } catch (error) {
      console.warn('Failed to play button hover sound:', error)
    }
  }, [audioStore])

  const handleMenuSelect = useCallback(() => {
    try {
      audioStore.playMenuSelect()
    } catch (error) {
      console.warn('Failed to play menu select sound:', error)
    }
  }, [audioStore])

  const handleMenuConfirm = useCallback(() => {
    try {
      audioStore.playMenuConfirm()
    } catch (error) {
      console.warn('Failed to play menu confirm sound:', error)
    }
  }, [audioStore])

  const handleMenuCancel = useCallback(() => {
    try {
      audioStore.playMenuCancel()
    } catch (error) {
      console.warn('Failed to play menu cancel sound:', error)
    }
  }, [audioStore])

  const handleVolumeChange = useCallback(() => {
    try {
      audioStore.playVolumeChange()
    } catch (error) {
      console.warn('Failed to play volume change sound:', error)
    }
  }, [audioStore])

  const handleLanguageChange = useCallback(() => {
    try {
      audioStore.playLanguageChange()
    } catch (error) {
      console.warn('Failed to play language change sound:', error)
    }
  }, [audioStore])

  const handleThemeChange = useCallback(() => {
    try {
      audioStore.playThemeChange()
    } catch (error) {
      console.warn('Failed to play theme change sound:', error)
    }
  }, [audioStore])

  const handleModalOpen = useCallback(() => {
    try {
      audioStore.playSound('modal-open')
    } catch (error) {
      console.warn('Failed to play modal open sound:', error)
    }
  }, [audioStore])

  const handleModalClose = useCallback(() => {
    try {
      audioStore.playSound('modal-close')
    } catch (error) {
      console.warn('Failed to play modal close sound:', error)
    }
  }, [audioStore])

  // Game-specific audio handlers
  const handleCorrectAnswer = useCallback((streak: number) => {
    try {
      audioStore.playCorrectAnswer(streak)
    } catch (error) {
      console.warn('Failed to play correct answer sound:', error)
    }
  }, [audioStore])

  const handleWrongAnswer = useCallback(() => {
    try {
      audioStore.playWrongAnswer()
    } catch (error) {
      console.warn('Failed to play wrong answer sound:', error)
    }
  }, [audioStore])

  const handlePlayerJoin = useCallback(() => {
    try {
      audioStore.playPlayerJoin()
    } catch (error) {
      console.warn('Failed to play player join sound:', error)
    }
  }, [audioStore])

  const handlePlayerLeave = useCallback(() => {
    try {
      audioStore.playPlayerLeave()
    } catch (error) {
      console.warn('Failed to play player leave sound:', error)
    }
  }, [audioStore])

  const handleTimerWarning = useCallback(() => {
    try {
      audioStore.playTimerWarning()
    } catch (error) {
      console.warn('Failed to play timer warning sound:', error)
    }
  }, [audioStore])

  const handleTimerUrgent = useCallback(() => {
    try {
      audioStore.playTimerUrgent()
    } catch (error) {
      console.warn('Failed to play timer urgent sound:', error)
    }
  }, [audioStore])

  const handleGameStart = useCallback(() => {
    try {
      audioStore.playGameStart()
    } catch (error) {
      console.warn('Failed to play game start sound:', error)
    }
  }, [audioStore])

  const handleGameEnd = useCallback(() => {
    try {
      audioStore.playGameEnd()
    } catch (error) {
      console.warn('Failed to play game end sound:', error)
    }
  }, [audioStore])

  const handleQuestionStart = useCallback(() => {
    try {
      audioStore.playQuestionStart()
    } catch (error) {
      console.warn('Failed to play question start sound:', error)
    }
  }, [audioStore])

  const handleLobbyCreated = useCallback(() => {
    try {
      audioStore.playLobbyCreated()
    } catch (error) {
      console.warn('Failed to play lobby created sound:', error)
    }
  }, [audioStore])

  const handleLobbyJoined = useCallback(() => {
    try {
      audioStore.playLobbyJoined()
    } catch (error) {
      console.warn('Failed to play lobby joined sound:', error)
    }
  }, [audioStore])

  const handleApplause = useCallback(() => {
    try {
      audioStore.playApplause()
    } catch (error) {
      console.warn('Failed to play applause sound:', error)
    }
  }, [audioStore])

  const handleHighScore = useCallback(() => {
    try {
      audioStore.playHighScore()
    } catch (error) {
      console.warn('Failed to play high score sound:', error)
    }
  }, [audioStore])

  const handlePerfectScore = useCallback(() => {
    try {
      audioStore.playPerfectScore()
    } catch (error) {
      console.warn('Failed to play perfect score sound:', error)
    }
  }, [audioStore])

  const handleMultiplierUp = useCallback(() => {
    try {
      audioStore.playMultiplierUp()
    } catch (error) {
      console.warn('Failed to play multiplier up sound:', error)
    }
  }, [audioStore])

  const handleMultiplierReset = useCallback(() => {
    try {
      audioStore.playMultiplierReset()
    } catch (error) {
      console.warn('Failed to play multiplier reset sound:', error)
    }
  }, [audioStore])

  const handleScorePoints = useCallback(() => {
    try {
      audioStore.playScorePoints()
    } catch (error) {
      console.warn('Failed to play score points sound:', error)
    }
  }, [audioStore])

  const handleScoreBonus = useCallback(() => {
    try {
      audioStore.playScoreBonus()
    } catch (error) {
      console.warn('Failed to play score bonus sound:', error)
    }
  }, [audioStore])

  const handleLobbyMusic = useCallback((loop: boolean = true) => {
    try {
      audioStore.playLobbyMusic(loop)
    } catch (error) {
      console.warn('Failed to play lobby music:', error)
    }
  }, [audioStore])

  const handleNotification = useCallback(() => {
    try {
      audioStore.playNotification()
    } catch (error) {
      console.warn('Failed to play notification sound:', error)
    }
  }, [audioStore])

  const handleSuccess = useCallback(() => {
    try {
      audioStore.playSuccess()
    } catch (error) {
      console.warn('Failed to play success sound:', error)
    }
  }, [audioStore])

  const handleError = useCallback(() => {
    try {
      audioStore.playError()
    } catch (error) {
      console.warn('Failed to play error sound:', error)
    }
  }, [audioStore])

  const handleTick = useCallback(() => {
    try {
      audioStore.playTick()
    } catch (error) {
      console.warn('Failed to play tick sound:', error)
    }
  }, [audioStore])

  const handleCountdown = useCallback(() => {
    try {
      audioStore.playCountdown()
    } catch (error) {
      console.warn('Failed to play countdown sound:', error)
    }
  }, [audioStore])

  const handleStopAllSounds = useCallback(() => {
    try {
      audioStore.stopAllSounds()
    } catch (error) {
      console.warn('Failed to stop all sounds:', error)
    }
  }, [audioStore])

  return {
    // Volume and settings
    musicVolume: audioStore.musicVolume,
    soundVolume: audioStore.soundVolume,
    masterVolume: audioStore.masterVolume,
    isMuted: audioStore.isMuted,
    isPlaying: audioStore.isPlaying,
    currentTrack: audioStore.currentTrack,
    
    // Volume controls
    setMusicVolume: audioStore.setMusicVolume,
    setSoundVolume: audioStore.setSoundVolume,
    setMasterVolume: audioStore.setMasterVolume,
    setIsMuted: audioStore.setIsMuted,
    toggleMute: audioStore.toggleMute,
    
    // UI interaction handlers
    handleButtonClick,
    handleButtonHover,
    handleMenuSelect,
    handleMenuConfirm,
    handleMenuCancel,
    handleVolumeChange,
    handleLanguageChange,
    handleThemeChange,
    handleModalOpen,
    handleModalClose,
    
    // Game event handlers
    handleCorrectAnswer,
    handleWrongAnswer,
    handlePlayerJoin,
    handlePlayerLeave,
    handleTimerWarning,
    handleTimerUrgent,
    handleGameStart,
    handleGameEnd,
    handleQuestionStart,
    handleLobbyCreated,
    handleLobbyJoined,
    handleApplause,
    handleHighScore,
    handlePerfectScore,
    handleMultiplierUp,
    handleMultiplierReset,
    handleScorePoints,
    handleScoreBonus,
    handleLobbyMusic,
    handleNotification,
    handleSuccess,
    handleError,
    handleTick,
    handleCountdown,
    handleStopAllSounds,
    
    // Utility
    isAudioSupported: audioStore.isAudioSupported,
  }
} 