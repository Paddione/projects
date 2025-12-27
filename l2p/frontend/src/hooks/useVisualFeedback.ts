import { useCallback, useRef } from 'react'
import { visualFeedbackService } from '../services/visualFeedback'

export const useVisualFeedback = () => {
  const elementRefs = useRef<Map<string, HTMLElement>>(new Map())

  const registerElement = useCallback((id: string, element: HTMLElement) => {
    elementRefs.current.set(id, element)
  }, [])

  const unregisterElement = useCallback((id: string) => {
    elementRefs.current.delete(id)
  }, [])

  const flashAvatar = useCallback((avatarId: string, isCorrect: boolean) => {
    const element = elementRefs.current.get(avatarId)
    if (element) {
      visualFeedbackService.flashAvatar(element, isCorrect)
    }
  }, [])

  const animateMultiplierBadge = useCallback((badgeId: string, multiplier: number) => {
    const element = elementRefs.current.get(badgeId)
    if (element) {
      visualFeedbackService.animateMultiplierBadge(element, multiplier)
    }
  }, [])

  const animateScorePoints = useCallback((scoreId: string, points: number) => {
    const element = elementRefs.current.get(scoreId)
    if (element) {
      visualFeedbackService.animateScorePoints(element, points)
    }
  }, [])

  const animateAnswerSelection = useCallback((answerId: string, isCorrect: boolean) => {
    const element = elementRefs.current.get(answerId)
    if (element) {
      visualFeedbackService.animateAnswerSelection(element, isCorrect)
    }
  }, [])

  const animateTimerWarning = useCallback((timerId: string, timeLeft: number) => {
    const element = elementRefs.current.get(timerId)
    if (element) {
      visualFeedbackService.animateTimerWarning(element, timeLeft)
    }
  }, [])

  const scrollToElement = useCallback((elementId: string, containerId: string) => {
    const element = elementRefs.current.get(elementId)
    const container = elementRefs.current.get(containerId)
    if (element && container) {
      visualFeedbackService.scrollToElement(element, container)
    }
  }, [])

  const animateLoadingSpinner = useCallback((spinnerId: string) => {
    const element = elementRefs.current.get(spinnerId)
    if (element) {
      visualFeedbackService.animateLoadingSpinner(element)
    }
  }, [])

  const stopLoadingSpinner = useCallback((spinnerId: string) => {
    const element = elementRefs.current.get(spinnerId)
    if (element) {
      visualFeedbackService.stopLoadingSpinner(element)
    }
  }, [])

  const animateMessage = useCallback((messageId: string, type: 'success' | 'error' | 'warning') => {
    const element = elementRefs.current.get(messageId)
    if (element) {
      visualFeedbackService.animateMessage(element, type)
    }
  }, [])

  const animateButtonPress = useCallback((buttonId: string) => {
    const element = elementRefs.current.get(buttonId)
    if (element) {
      visualFeedbackService.animateButtonPress(element)
    }
  }, [])

  const animateModal = useCallback((modalId: string, isOpening: boolean) => {
    const element = elementRefs.current.get(modalId)
    if (element) {
      visualFeedbackService.animateModal(element, isOpening)
    }
  }, [])

  const cleanup = useCallback(() => {
    visualFeedbackService.cleanup()
    elementRefs.current.clear()
  }, [])

  return {
    registerElement,
    unregisterElement,
    flashAvatar,
    animateMultiplierBadge,
    animateScorePoints,
    animateAnswerSelection,
    animateTimerWarning,
    scrollToElement,
    animateLoadingSpinner,
    stopLoadingSpinner,
    animateMessage,
    animateButtonPress,
    animateModal,
    cleanup
  }
} 