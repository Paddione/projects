import { renderHook, act } from '@testing-library/react'
import { useAudio } from '../useAudio'

// Mock the audio store with enhanced functionality
const createMockAudioStore = () => ({
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
})

const mockAudioStore = createMockAudioStore()

jest.mock('../../stores/audioStore', () => ({
  useAudioStore: () => mockAudioStore,
}))

describe('Enhanced useAudio Hook Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset mock implementations
    Object.keys(mockAudioStore).forEach(key => {
      const prop = mockAudioStore[key as keyof typeof mockAudioStore]
      if (typeof prop === 'function' && 'mockReset' in prop) {
        prop.mockReset()
      }
    })
    
    // Reset state values
    mockAudioStore.musicVolume = 0.7
    mockAudioStore.soundVolume = 0.8
    mockAudioStore.masterVolume = 1.0
    mockAudioStore.isMuted = false
    mockAudioStore.isPlaying = false
    mockAudioStore.currentTrack = null
    mockAudioStore.isAudioSupported.mockReturnValue(true)
  })

  describe('Edge Cases', () => {
    it('handles extreme volume values', () => {
      const { result } = renderHook(() => useAudio())
      
      act(() => {
        result.current.setMusicVolume(-10)
      })
      expect(mockAudioStore.setMusicVolume).toHaveBeenCalledWith(-10)
      
      act(() => {
        result.current.setMusicVolume(100)
      })
      expect(mockAudioStore.setMusicVolume).toHaveBeenCalledWith(100)
      
      act(() => {
        result.current.setSoundVolume(Number.POSITIVE_INFINITY)
      })
      expect(mockAudioStore.setSoundVolume).toHaveBeenCalledWith(Number.POSITIVE_INFINITY)
    })

    it('handles rapid successive calls', () => {
      const { result } = renderHook(() => useAudio())
      
      // Rapid button clicks
      for (let i = 0; i < 100; i++) {
        act(() => {
          result.current.handleButtonClick()
        })
      }
      
      expect(mockAudioStore.playButtonClick).toHaveBeenCalledTimes(100)
    })

    it('handles streak edge cases for correct answers', () => {
      const { result } = renderHook(() => useAudio())
      
      // Test extreme streak values
      const extremeStreaks = [0, -1, 999, Number.MAX_SAFE_INTEGER, Number.NEGATIVE_INFINITY]
      
      extremeStreaks.forEach(streak => {
        act(() => {
          result.current.handleCorrectAnswer(streak)
        })
        expect(mockAudioStore.playCorrectAnswer).toHaveBeenCalledWith(streak)
      })
    })


  })

  describe('Error Scenarios', () => {
    it('handles audio system not supported', () => {
      mockAudioStore.isAudioSupported.mockReturnValue(false)
      
      const { result } = renderHook(() => useAudio())
      
      // Should still provide all methods without throwing
      expect(result.current.handleButtonClick).toBeDefined()
      expect(result.current.setMusicVolume).toBeDefined()
      expect(result.current.isAudioSupported()).toBe(false)
    })

    it('handles audio context resumption failures', () => {
      mockAudioStore.resumeAudioContext.mockImplementation(() => {
        throw new Error('Audio context failed to resume')
      })
      
      // Should not throw error during hook initialization
      expect(() => renderHook(() => useAudio())).not.toThrow()
    })

         it('handles volume setter failures', () => {
       mockAudioStore.setMusicVolume.mockImplementation(() => {
         throw new Error('Volume setting failed')
       })
       
       const { result } = renderHook(() => useAudio())
       
       // Since the hook directly calls the store method, it will throw
       // This tests that errors are properly propagated
       expect(() => {
         act(() => {
           result.current.setMusicVolume(0.5)
         })
       }).toThrow('Volume setting failed')
     })

     it('handles audio method failures gracefully', () => {
       mockAudioStore.playButtonClick.mockImplementation(() => {
         throw new Error('Audio playback failed')
       })
       
       const { result } = renderHook(() => useAudio())
       
             // Since the hook now catches errors gracefully, it should not throw
      // This tests that errors are properly handled
      expect(() => {
        act(() => {
          result.current.handleButtonClick()
        })
      }).not.toThrow()
      
      // Verify the error was logged (we can't easily test console.warn in Jest)
      expect(mockAudioStore.playButtonClick).toHaveBeenCalled()
     })
  })

  describe('State Management', () => {
    it('reflects audio store state changes', () => {
      const { result, rerender } = renderHook(() => useAudio())
      
      // Initial state
      expect(result.current.musicVolume).toBe(0.7)
      expect(result.current.isMuted).toBe(false)
      
      // Simulate state changes
      mockAudioStore.musicVolume = 0.5
      mockAudioStore.isMuted = true
      
      rerender()
      
      expect(result.current.musicVolume).toBe(0.5)
      expect(result.current.isMuted).toBe(true)
    })

    it('handles all volume types correctly', () => {
      const { result } = renderHook(() => useAudio())
      
      // Test all volume setters
      act(() => {
        result.current.setMusicVolume(0.3)
        result.current.setSoundVolume(0.4)
        result.current.setMasterVolume(0.5)
      })
      
      expect(mockAudioStore.setMusicVolume).toHaveBeenCalledWith(0.3)
      expect(mockAudioStore.setSoundVolume).toHaveBeenCalledWith(0.4)
      expect(mockAudioStore.setMasterVolume).toHaveBeenCalledWith(0.5)
    })

    it('handles mute state correctly', () => {
      const { result } = renderHook(() => useAudio())
      
      act(() => {
        result.current.toggleMute()
      })
      
      expect(mockAudioStore.toggleMute).toHaveBeenCalledTimes(1)
      
      act(() => {
        result.current.setIsMuted(true)
      })
      
      expect(mockAudioStore.setIsMuted).toHaveBeenCalledWith(true)
    })
  })

  describe('Complete Audio Event Coverage', () => {
    it('handles all UI interaction sounds', () => {
      const { result } = renderHook(() => useAudio())
      
      const uiMethods = [
        'handleButtonClick',
        'handleButtonHover',
        'handleMenuSelect',
        'handleMenuConfirm',
        'handleMenuCancel',
        'handleVolumeChange',
        'handleLanguageChange',
        'handleThemeChange',
        'handleModalOpen',
        'handleModalClose'
      ]
      
             uiMethods.forEach(method => {
         act(() => {
           const fn = result.current[method as keyof typeof result.current] as () => void
           fn()
         })
       })
      
      // Verify all corresponding store methods were called
      expect(mockAudioStore.playButtonClick).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playButtonHover).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playMenuSelect).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playMenuConfirm).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playMenuCancel).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playVolumeChange).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playLanguageChange).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playThemeChange).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playSound).toHaveBeenCalledWith('modal-open')
      expect(mockAudioStore.playSound).toHaveBeenCalledWith('modal-close')
    })

    it('handles all game event sounds', () => {
      const { result } = renderHook(() => useAudio())
      
      act(() => {
        result.current.handleGameStart()
        result.current.handleGameEnd()
        result.current.handleQuestionStart()
        result.current.handleCorrectAnswer(3)
        result.current.handleWrongAnswer()
        result.current.handlePlayerJoin()
        result.current.handlePlayerLeave()
        result.current.handleTimerWarning()
        result.current.handleTimerUrgent()
      })
      
      expect(mockAudioStore.playGameStart).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playGameEnd).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playQuestionStart).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playCorrectAnswer).toHaveBeenCalledWith(3)
      expect(mockAudioStore.playWrongAnswer).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playPlayerJoin).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playPlayerLeave).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playTimerWarning).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playTimerUrgent).toHaveBeenCalledTimes(1)
    })

    it('handles all scoring and achievement sounds', () => {
      const { result } = renderHook(() => useAudio())
      
      act(() => {
        result.current.handleMultiplierUp()
        result.current.handleMultiplierReset()
        result.current.handleScorePoints()
        result.current.handleScoreBonus()
        result.current.handleApplause()
        result.current.handleHighScore()
        result.current.handlePerfectScore()
      })
      
      expect(mockAudioStore.playMultiplierUp).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playMultiplierReset).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playScorePoints).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playScoreBonus).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playApplause).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playHighScore).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playPerfectScore).toHaveBeenCalledTimes(1)
    })

    it('handles all utility sounds', () => {
      const { result } = renderHook(() => useAudio())
      
      act(() => {
        result.current.handleNotification()
        result.current.handleSuccess()
        result.current.handleError()
        result.current.handleTick()
        result.current.handleCountdown()
        result.current.handleStopAllSounds()
      })
      
      expect(mockAudioStore.playNotification).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playSuccess).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playError).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playTick).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playCountdown).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.stopAllSounds).toHaveBeenCalledTimes(1)
    })
  })

  describe('Performance and Memory', () => {
    it('does not create new callbacks on every render', () => {
      const { result, rerender } = renderHook(() => useAudio())
      
      const firstRenderCallbacks = {
        handleButtonClick: result.current.handleButtonClick,
        handleCorrectAnswer: result.current.handleCorrectAnswer,
        setMusicVolume: result.current.setMusicVolume,
        toggleMute: result.current.toggleMute
      }
      
      // Re-render multiple times
      for (let i = 0; i < 5; i++) {
        rerender()
      }
      
      // Callbacks should remain the same
      expect(result.current.handleButtonClick).toBe(firstRenderCallbacks.handleButtonClick)
      expect(result.current.handleCorrectAnswer).toBe(firstRenderCallbacks.handleCorrectAnswer)
      expect(result.current.setMusicVolume).toBe(firstRenderCallbacks.setMusicVolume)
      expect(result.current.toggleMute).toBe(firstRenderCallbacks.toggleMute)
    })

    it('handles event listener cleanup properly', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener')
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener')
      
      const { unmount } = renderHook(() => useAudio())
      
      // Verify event listeners were added
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function), { once: true })
      expect(addEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function), { once: true })
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), { once: true })
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function), { once: true })
      
      unmount()
      
      // Verify event listeners were removed
      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function))
      
      addEventListenerSpy.mockRestore()
      removeEventListenerSpy.mockRestore()
    })
  })

  describe('User Interaction Handling', () => {
    it('resumes audio context on user interaction', () => {
      renderHook(() => useAudio())
      
      // Simulate user interactions
      const events = ['click', 'touchstart', 'keydown', 'mousedown']
      
      events.forEach(eventType => {
        const event = new Event(eventType)
        document.dispatchEvent(event)
      })
      
      // Should have called resumeAudioContext for each event
      expect(mockAudioStore.resumeAudioContext).toHaveBeenCalledTimes(events.length)
    })

    it('handles multiple hook instances correctly', () => {
      const { result: result1 } = renderHook(() => useAudio())
      const { result: result2 } = renderHook(() => useAudio())
      
      // Both hooks should work independently
      act(() => {
        result1.current.handleButtonClick()
        result2.current.handleButtonHover()
      })
      
      expect(mockAudioStore.playButtonClick).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playButtonHover).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility and Compatibility', () => {
    it('provides accessible audio state information', () => {
      const { result } = renderHook(() => useAudio())
      
      // Should expose all necessary state for accessibility
      expect(typeof result.current.musicVolume).toBe('number')
      expect(typeof result.current.soundVolume).toBe('number')
      expect(typeof result.current.masterVolume).toBe('number')
      expect(typeof result.current.isMuted).toBe('boolean')
      expect(typeof result.current.isPlaying).toBe('boolean')
      expect(typeof result.current.isAudioSupported).toBe('function')
    })

    it('gracefully handles browser compatibility issues', () => {
      // Simulate browser without audio support
      mockAudioStore.isAudioSupported.mockReturnValue(false)
      
      const { result } = renderHook(() => useAudio())
      
      // Should still provide all functionality
      expect(result.current.isAudioSupported()).toBe(false)
      
      // Methods should still be callable without errors
      act(() => {
        result.current.handleButtonClick()
        result.current.setMusicVolume(0.5)
        result.current.toggleMute()
      })
      
      expect(mockAudioStore.playButtonClick).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.setMusicVolume).toHaveBeenCalledWith(0.5)
      expect(mockAudioStore.toggleMute).toHaveBeenCalledTimes(1)
    })
  })
}) 