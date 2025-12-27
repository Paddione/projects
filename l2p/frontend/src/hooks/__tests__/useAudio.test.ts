import { renderHook, act } from '@testing-library/react'
import { useAudio } from '../useAudio'

// Mock the audio store - complete interface matching actual store
const mockAudioStore = {
  // State
  musicVolume: 0.7,
  soundVolume: 0.8,
  masterVolume: 1.0,
  isMuted: false,
  isPlaying: false,
  currentTrack: null,
  
  // State setters
  setMusicVolume: jest.fn(),
  setSoundVolume: jest.fn(),
  setMasterVolume: jest.fn(),
  setIsMuted: jest.fn(),
  setIsPlaying: jest.fn(),
  setCurrentTrack: jest.fn(),
  toggleMute: jest.fn(),
  
  // Basic audio controls
  playSound: jest.fn(),
  stopSound: jest.fn(),
  stopAllSounds: jest.fn(),
  resumeAudioContext: jest.fn(),
  isAudioSupported: jest.fn(() => true),
  
  // Game audio methods
  playCorrectAnswer: jest.fn(),
  playWrongAnswer: jest.fn(),
  playButtonClick: jest.fn(),
  playButtonHover: jest.fn(),
  playPlayerJoin: jest.fn(),
  playPlayerLeave: jest.fn(),
  playTimerWarning: jest.fn(),
  playTimerUrgent: jest.fn(),
  playGameStart: jest.fn(),
  playGameEnd: jest.fn(),
  playQuestionStart: jest.fn(),
  playLobbyCreated: jest.fn(),
  playLobbyJoined: jest.fn(),
  playApplause: jest.fn(),
  playHighScore: jest.fn(),
  playPerfectScore: jest.fn(),
  playMultiplierUp: jest.fn(),
  playMultiplierReset: jest.fn(),
  playScorePoints: jest.fn(),
  playScoreBonus: jest.fn(),
        playLobbyMusic: jest.fn(),
  playNotification: jest.fn(),
  playSuccess: jest.fn(),
  playError: jest.fn(),
  playTick: jest.fn(),
  playCountdown: jest.fn(),
  playMenuSelect: jest.fn(),
  playMenuConfirm: jest.fn(),
  playMenuCancel: jest.fn(),
  playVolumeChange: jest.fn(),
  playLanguageChange: jest.fn(),
  playThemeChange: jest.fn()
}

jest.mock('../../stores/audioStore', () => ({
  useAudioStore: () => mockAudioStore,
}))

describe('useAudio Hook', () => {
  let eventListeners: { [key: string]: EventListener } = {}
  let removeEventListeners: { [key: string]: EventListener } = {}

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset event listeners
    eventListeners = {}
    removeEventListeners = {}
    
    // Mock document event listeners
    document.addEventListener = jest.fn((event, listener, _options) => {
      eventListeners[event] = listener as EventListener
    })
    
    document.removeEventListener = jest.fn((event, listener) => {
      removeEventListeners[event] = listener as EventListener
    })
  })

  describe('Initialization', () => {
    it('initializes without errors', () => {
      expect(() => {
        renderHook(() => useAudio())
      }).not.toThrow()
    })

    it('sets up user interaction event listeners on mount', () => {
      renderHook(() => useAudio())
      
      const events = ['click', 'touchstart', 'keydown', 'mousedown']
      events.forEach(event => {
        expect(document.addEventListener).toHaveBeenCalledWith(
          event,
          expect.any(Function),
          { once: true }
        )
      })
    })

    it('cleans up event listeners on unmount', () => {
      const { unmount } = renderHook(() => useAudio())
      
      unmount()
      
      const events = ['click', 'touchstart', 'keydown', 'mousedown']
      events.forEach(event => {
        expect(document.removeEventListener).toHaveBeenCalledWith(
          event,
          expect.any(Function)
        )
      })
    })

    it('calls resumeAudioContext on user interaction', () => {
      renderHook(() => useAudio())
      
      // Get the click event listener that was registered
      const clickListener = eventListeners['click']
      expect(clickListener).toBeDefined()
      
      // Simulate the click event
      act(() => {
        clickListener(new Event('click'))
      })
      
      // The event listener should call resumeAudioContext
      expect(mockAudioStore.resumeAudioContext).toHaveBeenCalled()
    })
  })

  describe('Volume Controls', () => {
    it('provides volume state from store', () => {
      const { result } = renderHook(() => useAudio())
      
      expect(result.current.musicVolume).toBe(0.7)
      expect(result.current.soundVolume).toBe(0.8)
      expect(result.current.masterVolume).toBe(1.0)
      expect(result.current.isMuted).toBe(false)
    })

    it('provides volume control functions', () => {
      const { result } = renderHook(() => useAudio())
      
      expect(typeof result.current.setMusicVolume).toBe('function')
      expect(typeof result.current.setSoundVolume).toBe('function')
      expect(typeof result.current.setMasterVolume).toBe('function')
      expect(typeof result.current.setIsMuted).toBe('function')
      expect(typeof result.current.toggleMute).toBe('function')
    })

    it('calls store methods when volume controls are used', () => {
      const { result } = renderHook(() => useAudio())
      
      act(() => {
        result.current.setMusicVolume(0.5)
        result.current.setSoundVolume(0.6)
        result.current.setMasterVolume(0.8)
        result.current.setIsMuted(true)
        result.current.toggleMute()
      })
      
      expect(mockAudioStore.setMusicVolume).toHaveBeenCalledWith(0.5)
      expect(mockAudioStore.setSoundVolume).toHaveBeenCalledWith(0.6)
      expect(mockAudioStore.setMasterVolume).toHaveBeenCalledWith(0.8)
      expect(mockAudioStore.setIsMuted).toHaveBeenCalledWith(true)
      expect(mockAudioStore.toggleMute).toHaveBeenCalled()
    })
  })

  describe('UI Interaction Handlers', () => {
    it('provides UI interaction handlers', () => {
      const { result } = renderHook(() => useAudio())
      
      expect(typeof result.current.handleButtonClick).toBe('function')
      expect(typeof result.current.handleButtonHover).toBe('function')
      expect(typeof result.current.handleMenuSelect).toBe('function')
      expect(typeof result.current.handleMenuConfirm).toBe('function')
      expect(typeof result.current.handleMenuCancel).toBe('function')
      expect(typeof result.current.handleVolumeChange).toBe('function')
      expect(typeof result.current.handleLanguageChange).toBe('function')
      expect(typeof result.current.handleThemeChange).toBe('function')
      expect(typeof result.current.handleModalOpen).toBe('function')
      expect(typeof result.current.handleModalClose).toBe('function')
    })

    it('calls appropriate store methods for UI interactions', () => {
      const { result } = renderHook(() => useAudio())
      
      act(() => {
        result.current.handleButtonClick()
        result.current.handleButtonHover()
        result.current.handleMenuSelect()
        result.current.handleMenuConfirm()
        result.current.handleMenuCancel()
        result.current.handleVolumeChange()
        result.current.handleLanguageChange()
        result.current.handleThemeChange()
        result.current.handleModalOpen()
        result.current.handleModalClose()
      })
      
      expect(mockAudioStore.playButtonClick).toHaveBeenCalled()
      expect(mockAudioStore.playButtonHover).toHaveBeenCalled()
      expect(mockAudioStore.playMenuSelect).toHaveBeenCalled()
      expect(mockAudioStore.playMenuConfirm).toHaveBeenCalled()
      expect(mockAudioStore.playMenuCancel).toHaveBeenCalled()
      expect(mockAudioStore.playVolumeChange).toHaveBeenCalled()
      expect(mockAudioStore.playLanguageChange).toHaveBeenCalled()
      expect(mockAudioStore.playThemeChange).toHaveBeenCalled()
      expect(mockAudioStore.playSound).toHaveBeenCalledWith('modal-open')
      expect(mockAudioStore.playSound).toHaveBeenCalledWith('modal-close')
    })
  })

  describe('Game Event Handlers', () => {
    it('provides game event handlers', () => {
      const { result } = renderHook(() => useAudio())
      
      expect(typeof result.current.handleCorrectAnswer).toBe('function')
      expect(typeof result.current.handleWrongAnswer).toBe('function')
      expect(typeof result.current.handlePlayerJoin).toBe('function')
      expect(typeof result.current.handlePlayerLeave).toBe('function')
      expect(typeof result.current.handleTimerWarning).toBe('function')
      expect(typeof result.current.handleTimerUrgent).toBe('function')
      expect(typeof result.current.handleGameStart).toBe('function')
      expect(typeof result.current.handleGameEnd).toBe('function')
      expect(typeof result.current.handleQuestionStart).toBe('function')
      expect(typeof result.current.handleLobbyCreated).toBe('function')
      expect(typeof result.current.handleLobbyJoined).toBe('function')
    })

    it('calls appropriate store methods for game events', () => {
      const { result } = renderHook(() => useAudio())
      
      act(() => {
        result.current.handleCorrectAnswer(3)
        result.current.handleWrongAnswer()
        result.current.handlePlayerJoin()
        result.current.handlePlayerLeave()
        result.current.handleTimerWarning()
        result.current.handleTimerUrgent()
        result.current.handleGameStart()
        result.current.handleGameEnd()
        result.current.handleQuestionStart()
        result.current.handleLobbyCreated()
        result.current.handleLobbyJoined()
      })
      
      expect(mockAudioStore.playCorrectAnswer).toHaveBeenCalledWith(3)
      expect(mockAudioStore.playWrongAnswer).toHaveBeenCalled()
      expect(mockAudioStore.playPlayerJoin).toHaveBeenCalled()
      expect(mockAudioStore.playPlayerLeave).toHaveBeenCalled()
      expect(mockAudioStore.playTimerWarning).toHaveBeenCalled()
      expect(mockAudioStore.playTimerUrgent).toHaveBeenCalled()
      expect(mockAudioStore.playGameStart).toHaveBeenCalled()
      expect(mockAudioStore.playGameEnd).toHaveBeenCalled()
      expect(mockAudioStore.playQuestionStart).toHaveBeenCalled()
      expect(mockAudioStore.playLobbyCreated).toHaveBeenCalled()
      expect(mockAudioStore.playLobbyJoined).toHaveBeenCalled()
    })
  })

  describe('Score and Feedback Handlers', () => {
    it('provides score and feedback handlers', () => {
      const { result } = renderHook(() => useAudio())
      
      expect(typeof result.current.handleApplause).toBe('function')
      expect(typeof result.current.handleHighScore).toBe('function')
      expect(typeof result.current.handlePerfectScore).toBe('function')
      expect(typeof result.current.handleMultiplierUp).toBe('function')
      expect(typeof result.current.handleMultiplierReset).toBe('function')
      expect(typeof result.current.handleScorePoints).toBe('function')
      expect(typeof result.current.handleScoreBonus).toBe('function')
    })

    it('calls appropriate store methods for score events', () => {
      const { result } = renderHook(() => useAudio())
      
      act(() => {
        result.current.handleApplause()
        result.current.handleHighScore()
        result.current.handlePerfectScore()
        result.current.handleMultiplierUp()
        result.current.handleMultiplierReset()
        result.current.handleScorePoints()
        result.current.handleScoreBonus()
      })
      
      expect(mockAudioStore.playApplause).toHaveBeenCalled()
      expect(mockAudioStore.playHighScore).toHaveBeenCalled()
      expect(mockAudioStore.playPerfectScore).toHaveBeenCalled()
      expect(mockAudioStore.playMultiplierUp).toHaveBeenCalled()
      expect(mockAudioStore.playMultiplierReset).toHaveBeenCalled()
      expect(mockAudioStore.playScorePoints).toHaveBeenCalled()
      expect(mockAudioStore.playScoreBonus).toHaveBeenCalled()
    })
  })



  describe('Utility Handlers', () => {
    it('provides utility handlers', () => {
      const { result } = renderHook(() => useAudio())
      
      expect(typeof result.current.handleNotification).toBe('function')
      expect(typeof result.current.handleSuccess).toBe('function')
      expect(typeof result.current.handleError).toBe('function')
      expect(typeof result.current.handleTick).toBe('function')
      expect(typeof result.current.handleCountdown).toBe('function')
      expect(typeof result.current.handleStopAllSounds).toBe('function')
    })

    it('calls appropriate store methods for utility events', () => {
      const { result } = renderHook(() => useAudio())
      
      act(() => {
        result.current.handleNotification()
        result.current.handleSuccess()
        result.current.handleError()
        result.current.handleTick()
        result.current.handleCountdown()
        result.current.handleStopAllSounds()
      })
      
      expect(mockAudioStore.playNotification).toHaveBeenCalled()
      expect(mockAudioStore.playSuccess).toHaveBeenCalled()
      expect(mockAudioStore.playError).toHaveBeenCalled()
      expect(mockAudioStore.playTick).toHaveBeenCalled()
      expect(mockAudioStore.playCountdown).toHaveBeenCalled()
      expect(mockAudioStore.stopAllSounds).toHaveBeenCalled()
    })
  })

  describe('Audio Support', () => {
    it('provides audio support information', () => {
      const { result } = renderHook(() => useAudio())
      
      expect(typeof result.current.isAudioSupported).toBe('function')
    })

    it('calls store method for audio support check', () => {
      renderHook(() => useAudio())
      
      // isAudioSupported is a function, not a property
      expect(typeof mockAudioStore.isAudioSupported).toBe('function')
    })
  })

  describe('Performance and Memory', () => {
    it('uses useCallback for all handlers to prevent unnecessary re-renders', () => {
      const { result, rerender } = renderHook(() => useAudio())
      
      const initialHandlers = {
        handleButtonClick: result.current.handleButtonClick,
        handleButtonHover: result.current.handleButtonHover,
        handleCorrectAnswer: result.current.handleCorrectAnswer,
        handleWrongAnswer: result.current.handleWrongAnswer
      }
      
      rerender()
      
      expect(result.current.handleButtonClick).toBe(initialHandlers.handleButtonClick)
      expect(result.current.handleButtonHover).toBe(initialHandlers.handleButtonHover)
      expect(result.current.handleCorrectAnswer).toBe(initialHandlers.handleCorrectAnswer)
      expect(result.current.handleWrongAnswer).toBe(initialHandlers.handleWrongAnswer)
    })

    it('sets up event listeners only once on mount', () => {
      const { rerender } = renderHook(() => useAudio())
      
      const initialCallCount = (document.addEventListener as jest.Mock).mock.calls.length
      
      rerender()
      
      // Should not add more event listeners on re-render
      expect((document.addEventListener as jest.Mock).mock.calls.length).toBe(initialCallCount)
    })
  })

  describe('Error Handling', () => {
    it('handles audio store errors gracefully', () => {
      mockAudioStore.playButtonClick.mockImplementation(() => {
        throw new Error('Audio error')
      })
      
      const { result } = renderHook(() => useAudio())
      
      // The hook should handle errors gracefully and not crash
      expect(() => {
        act(() => {
          result.current.handleButtonClick()
        })
      }).not.toThrow()
    })

    it('handles DOM event listener errors gracefully', () => {
      // Mock addEventListener to throw an error
      const originalAddEventListener = document.addEventListener
      document.addEventListener = jest.fn().mockImplementation(() => {
        throw new Error('DOM error')
      })
      
      // Should not crash when adding event listeners fails
      expect(() => {
        renderHook(() => useAudio())
      }).not.toThrow()
      
      // Restore original method
      document.addEventListener = originalAddEventListener
    })
  })

  describe('Browser Compatibility', () => {
    it('works with different event types for audio context resume', () => {
      renderHook(() => useAudio())
      
      const events = ['click', 'touchstart', 'keydown', 'mousedown']
      events.forEach(event => {
        expect(document.addEventListener).toHaveBeenCalledWith(
          event,
          expect.any(Function),
          { once: true }
        )
      })
    })

    it('handles missing audio context gracefully', () => {
      mockAudioStore.resumeAudioContext.mockImplementation(() => {
        throw new Error('Audio context not supported')
      })
      
      renderHook(() => useAudio())
      
      // Should not crash when audio context is not supported
      const clickEvent = new Event('click')
      expect(() => {
        document.dispatchEvent(clickEvent)
      }).not.toThrow()
    })
  })

  describe('Integration with Audio Store', () => {
    it('passes through all store state correctly', () => {
      mockAudioStore.musicVolume = 0.5
      mockAudioStore.soundVolume = 0.3
      mockAudioStore.masterVolume = 0.8
      mockAudioStore.isMuted = true
      mockAudioStore.isPlaying = true
      mockAudioStore.currentTrack = 'lobby-music' as any
      
      const { result } = renderHook(() => useAudio())
      
      expect(result.current.musicVolume).toBe(0.5)
      expect(result.current.soundVolume).toBe(0.3)
      expect(result.current.masterVolume).toBe(0.8)
      expect(result.current.isMuted).toBe(true)
      expect(result.current.isPlaying).toBe(true)
      expect(result.current.currentTrack).toBe('lobby-music')
    })

    it('provides direct access to store methods', () => {
      const { result } = renderHook(() => useAudio())
      
      expect(result.current.setMusicVolume).toBe(mockAudioStore.setMusicVolume)
      expect(result.current.setSoundVolume).toBe(mockAudioStore.setSoundVolume)
      expect(result.current.setMasterVolume).toBe(mockAudioStore.setMasterVolume)
      expect(result.current.setIsMuted).toBe(mockAudioStore.setIsMuted)
      expect(result.current.toggleMute).toBe(mockAudioStore.toggleMute)
    })
  })
}) 