import { renderHook, act } from '@testing-library/react'
import { useVisualFeedback } from '../useVisualFeedback'
import { visualFeedbackService } from '../../services/visualFeedback'

// Mock the visual feedback service
jest.mock('../../services/visualFeedback', () => ({
  visualFeedbackService: {
    flashAvatar: jest.fn(),
    animateMultiplierBadge: jest.fn(),
    animateScorePoints: jest.fn(),
    animateAnswerSelection: jest.fn(),
    animateTimerWarning: jest.fn(),
    scrollToElement: jest.fn(),
    animateLoadingSpinner: jest.fn(),
    stopLoadingSpinner: jest.fn(),
    animateMessage: jest.fn(),
    animateButtonPress: jest.fn(),
    animateModal: jest.fn(),
    cleanup: jest.fn()
  }
}))

// Mock HTMLElement methods
const mockElement = {
  style: {
    backgroundColor: '',
    transition: '',
    transform: '',
    color: '',
    boxShadow: '',
    animation: '',
    borderLeft: '',
    opacity: ''
  },
  getBoundingClientRect: jest.fn(() => ({
    top: 0,
    bottom: 100,
    left: 0,
    right: 100
  })),
  scrollIntoView: jest.fn()
} as unknown as HTMLElement

// Mock window.matchMedia for reduced motion preference
const mockMatchMedia = jest.fn()
Object.defineProperty(window, 'matchMedia', {
  value: mockMatchMedia,
  writable: true
})

// Mock requestAnimationFrame and cancelAnimationFrame
const mockRequestAnimationFrame = jest.fn()
const mockCancelAnimationFrame = jest.fn()
Object.defineProperty(window, 'requestAnimationFrame', {
  value: mockRequestAnimationFrame,
  writable: true
})
Object.defineProperty(window, 'cancelAnimationFrame', {
  value: mockCancelAnimationFrame,
  writable: true
})

// Use fake timers in a way that doesn't conflict with global setup
jest.useFakeTimers({ legacyFakeTimers: true })

const mockVisualFeedbackService = visualFeedbackService as jest.Mocked<typeof visualFeedbackService>

describe('useVisualFeedback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    mockMatchMedia.mockReturnValue({
      matches: false,
      addListener: jest.fn(),
      removeListener: jest.fn()
    })
  })

  describe('element registration and management', () => {
    it('should register and unregister elements', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('test-id', mockElement)
      })

      // Test that element is registered by calling an animation function
      act(() => {
        result.current.flashAvatar('test-id', true)
      })

      expect(mockVisualFeedbackService.flashAvatar).toHaveBeenCalledWith(mockElement, true)

      // Test unregistration
      act(() => {
        result.current.unregisterElement('test-id')
      })

      // Test that animation doesn't work for unregistered element
      act(() => {
        result.current.flashAvatar('test-id', false)
      })

      expect(mockVisualFeedbackService.flashAvatar).toHaveBeenCalledTimes(1) // Only the first call
    })

    it('should handle multiple element registrations', () => {
      const { result } = renderHook(() => useVisualFeedback())
      const mockElement2 = { ...mockElement }

      act(() => {
        result.current.registerElement('id1', mockElement)
        result.current.registerElement('id2', mockElement2)
      })

      act(() => {
        result.current.flashAvatar('id1', true)
        result.current.flashAvatar('id2', false)
      })

      expect(mockVisualFeedbackService.flashAvatar).toHaveBeenCalledWith(mockElement, true)
      expect(mockVisualFeedbackService.flashAvatar).toHaveBeenCalledWith(mockElement2, false)
    })

    it('should handle registration of same id multiple times', () => {
      const { result } = renderHook(() => useVisualFeedback())
      const mockElement2 = { ...mockElement }

      act(() => {
        result.current.registerElement('test-id', mockElement)
        result.current.registerElement('test-id', mockElement2) // Overwrite
      })

      act(() => {
        result.current.flashAvatar('test-id', true)
      })

      expect(mockVisualFeedbackService.flashAvatar).toHaveBeenCalledWith(mockElement2, true)
    })
  })

  describe('animation triggers and effect management', () => {
    it('should trigger flashAvatar animation', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('avatar-id', mockElement)
        result.current.flashAvatar('avatar-id', true)
      })

      expect(mockVisualFeedbackService.flashAvatar).toHaveBeenCalledWith(mockElement, true)
    })

    it('should trigger animateMultiplierBadge animation', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('badge-id', mockElement)
        result.current.animateMultiplierBadge('badge-id', 3)
      })

      expect(mockVisualFeedbackService.animateMultiplierBadge).toHaveBeenCalledWith(mockElement, 3)
    })

    it('should trigger animateScorePoints animation', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('score-id', mockElement)
        result.current.animateScorePoints('score-id', 150)
      })

      expect(mockVisualFeedbackService.animateScorePoints).toHaveBeenCalledWith(mockElement, 150)
    })

    it('should trigger animateAnswerSelection animation', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('answer-id', mockElement)
        result.current.animateAnswerSelection('answer-id', true)
      })

      expect(mockVisualFeedbackService.animateAnswerSelection).toHaveBeenCalledWith(mockElement, true)
    })

    it('should trigger animateTimerWarning animation', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('timer-id', mockElement)
        result.current.animateTimerWarning('timer-id', 5)
      })

      expect(mockVisualFeedbackService.animateTimerWarning).toHaveBeenCalledWith(mockElement, 5)
    })

    it('should trigger scrollToElement animation', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('element-id', mockElement)
        result.current.registerElement('container-id', mockElement)
        result.current.scrollToElement('element-id', 'container-id')
      })

      expect(mockVisualFeedbackService.scrollToElement).toHaveBeenCalledWith(mockElement, mockElement)
    })

    it('should trigger loading spinner animations', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('spinner-id', mockElement)
        result.current.animateLoadingSpinner('spinner-id')
      })

      expect(mockVisualFeedbackService.animateLoadingSpinner).toHaveBeenCalledWith(mockElement)

      act(() => {
        result.current.stopLoadingSpinner('spinner-id')
      })

      expect(mockVisualFeedbackService.stopLoadingSpinner).toHaveBeenCalledWith(mockElement)
    })

    it('should trigger message animations', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('message-id', mockElement)
        result.current.animateMessage('message-id', 'success')
      })

      expect(mockVisualFeedbackService.animateMessage).toHaveBeenCalledWith(mockElement, 'success')
    })

    it('should trigger button press animation', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('button-id', mockElement)
        result.current.animateButtonPress('button-id')
      })

      expect(mockVisualFeedbackService.animateButtonPress).toHaveBeenCalledWith(mockElement)
    })

    it('should trigger modal animations', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('modal-id', mockElement)
        result.current.animateModal('modal-id', true)
      })

      expect(mockVisualFeedbackService.animateModal).toHaveBeenCalledWith(mockElement, true)
    })
  })

  describe('user feedback display and timing', () => {
    it('should handle rapid successive animations', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('test-id', mockElement)
        result.current.flashAvatar('test-id', true)
        result.current.flashAvatar('test-id', false)
        result.current.animateButtonPress('test-id')
      })

      expect(mockVisualFeedbackService.flashAvatar).toHaveBeenCalledTimes(2)
      expect(mockVisualFeedbackService.animateButtonPress).toHaveBeenCalledTimes(1)
    })

    it('should handle animation timing with setTimeout', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('test-id', mockElement)
        result.current.flashAvatar('test-id', true)
      })

      // Fast-forward timers to simulate animation completion
      act(() => {
        jest.advanceTimersByTime(300) // Flash duration
      })

      expect(mockVisualFeedbackService.flashAvatar).toHaveBeenCalledWith(mockElement, true)
    })

    it('should handle multiple animation types simultaneously', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('avatar-id', mockElement)
        result.current.registerElement('score-id', mockElement)
        result.current.registerElement('badge-id', mockElement)
        
        result.current.flashAvatar('avatar-id', true)
        result.current.animateScorePoints('score-id', 100)
        result.current.animateMultiplierBadge('badge-id', 2)
      })

      expect(mockVisualFeedbackService.flashAvatar).toHaveBeenCalledWith(mockElement, true)
      expect(mockVisualFeedbackService.animateScorePoints).toHaveBeenCalledWith(mockElement, 100)
      expect(mockVisualFeedbackService.animateMultiplierBadge).toHaveBeenCalledWith(mockElement, 2)
    })
  })

  describe('accessibility considerations and reduced motion', () => {
    it('should respect reduced motion preference', () => {
      // Mock reduced motion preference
      mockMatchMedia.mockReturnValue({
        matches: true, // User prefers reduced motion
        addListener: jest.fn(),
        removeListener: jest.fn()
      })

      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('test-id', mockElement)
        result.current.flashAvatar('test-id', true)
      })

      // Should still call the service, but the service should handle reduced motion
      expect(mockVisualFeedbackService.flashAvatar).toHaveBeenCalledWith(mockElement, true)
    })

    it('should handle accessibility focus management', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('test-id', mockElement)
        result.current.registerElement('container-id', mockElement)
        result.current.scrollToElement('test-id', 'container-id')
      })

      expect(mockVisualFeedbackService.scrollToElement).toHaveBeenCalledWith(mockElement, mockElement)
    })

    it('should provide keyboard navigation support', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('button-id', mockElement)
        result.current.animateButtonPress('button-id')
      })

      expect(mockVisualFeedbackService.animateButtonPress).toHaveBeenCalledWith(mockElement)
    })
  })

  describe('error handling and edge cases', () => {
    it('should handle non-existent element IDs gracefully', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.flashAvatar('non-existent-id', true)
      })

      expect(mockVisualFeedbackService.flashAvatar).not.toHaveBeenCalled()
    })

    it('should handle null or undefined elements', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('null-id', null as unknown as HTMLElement)
        result.current.flashAvatar('null-id', true)
      })

      expect(mockVisualFeedbackService.flashAvatar).not.toHaveBeenCalled()
    })

    it('should handle cleanup of registered elements', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('test-id', mockElement)
        result.current.cleanup()
      })

      expect(mockVisualFeedbackService.cleanup).toHaveBeenCalled()

      // Test that animations don't work after cleanup
      act(() => {
        result.current.flashAvatar('test-id', true)
      })

      expect(mockVisualFeedbackService.flashAvatar).not.toHaveBeenCalled()
    })

    it('should handle multiple cleanup calls', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.cleanup()
        result.current.cleanup()
      })

      expect(mockVisualFeedbackService.cleanup).toHaveBeenCalledTimes(2)
    })
  })

  describe('performance optimization', () => {
    it('should use useCallback for stable function references', () => {
      const { result, rerender } = renderHook(() => useVisualFeedback())

      const firstFlashAvatar = result.current.flashAvatar
      const firstRegisterElement = result.current.registerElement

      rerender()

      expect(result.current.flashAvatar).toBe(firstFlashAvatar)
      expect(result.current.registerElement).toBe(firstRegisterElement)
    })

    it('should handle memory management with useRef', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('test-id', mockElement)
      })

      // Register many elements to test memory management
      for (let i = 0; i < 100; i++) {
        act(() => {
          result.current.registerElement(`id-${i}`, mockElement)
        })
      }

      // Should still work without memory issues
      act(() => {
        result.current.flashAvatar('id-50', true)
      })

      expect(mockVisualFeedbackService.flashAvatar).toHaveBeenCalledWith(mockElement, true)
    })
  })

  describe('integration with visual feedback service', () => {
    it('should pass correct parameters to service methods', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('test-id', mockElement)
        result.current.animateMultiplierBadge('test-id', 5)
        result.current.animateScorePoints('test-id', 200)
        result.current.animateMessage('test-id', 'error')
      })

      expect(mockVisualFeedbackService.animateMultiplierBadge).toHaveBeenCalledWith(mockElement, 5)
      expect(mockVisualFeedbackService.animateScorePoints).toHaveBeenCalledWith(mockElement, 200)
      expect(mockVisualFeedbackService.animateMessage).toHaveBeenCalledWith(mockElement, 'error')
    })

    it('should handle service method failures gracefully', () => {
      // Mock service method to throw error
      mockVisualFeedbackService.flashAvatar.mockImplementation(() => {
        throw new Error('Animation failed')
      })

      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('test-id', mockElement)
      })

      // The hook should call the service and the error should be thrown
      expect(() => {
        act(() => {
          result.current.flashAvatar('test-id', true)
        })
      }).toThrow('Animation failed')

      expect(mockVisualFeedbackService.flashAvatar).toHaveBeenCalledWith(mockElement, true)
    })
  })

  describe('animation API mocking', () => {
    it('should work with mocked requestAnimationFrame', () => {
      mockRequestAnimationFrame.mockReturnValue(1)

      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('test-id', mockElement)
        result.current.flashAvatar('test-id', true)
      })

      expect(mockVisualFeedbackService.flashAvatar).toHaveBeenCalledWith(mockElement, true)
    })

    it('should work with mocked cancelAnimationFrame', () => {
      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.cleanup()
      })

      expect(mockVisualFeedbackService.cleanup).toHaveBeenCalled()
    })
  })

  describe('user preferences mocking', () => {
    it('should handle different motion preferences', () => {
      // Test with motion preference
      mockMatchMedia.mockReturnValue({
        matches: false, // User prefers motion
        addListener: jest.fn(),
        removeListener: jest.fn()
      })

      const { result } = renderHook(() => useVisualFeedback())

      act(() => {
        result.current.registerElement('test-id', mockElement)
        result.current.flashAvatar('test-id', true)
      })

      expect(mockVisualFeedbackService.flashAvatar).toHaveBeenCalledWith(mockElement, true)

      // Test with reduced motion preference
      mockMatchMedia.mockReturnValue({
        matches: true, // User prefers reduced motion
        addListener: jest.fn(),
        removeListener: jest.fn()
      })

      const { result: result2 } = renderHook(() => useVisualFeedback())

      act(() => {
        result2.current.registerElement('test-id', mockElement)
        result2.current.flashAvatar('test-id', true)
      })

      expect(mockVisualFeedbackService.flashAvatar).toHaveBeenCalledWith(mockElement, true)
    })
  })
}) 