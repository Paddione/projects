export interface AnimationConfig {
  duration: number
  easing: string
  delay?: number
}

export interface FlashConfig {
  color: string
  duration: number
  intensity: number
}

export class VisualFeedbackService {
  private static instance: VisualFeedbackService
  private animationFrameId: number | null = null

  static getInstance(): VisualFeedbackService {
    if (!VisualFeedbackService.instance) {
      VisualFeedbackService.instance = new VisualFeedbackService()
    }
    return VisualFeedbackService.instance
  }

  // Flash an element with a specific color
  public flashElement(element: HTMLElement, config: FlashConfig): void {
    const originalBackground = element.style.backgroundColor
    const originalTransition = element.style.transition

    // Set up the flash animation
    element.style.transition = `background-color ${config.duration}ms ease-in-out`
    element.style.backgroundColor = config.color

    // Reset after animation
    setTimeout(() => {
      element.style.backgroundColor = originalBackground
      element.style.transition = originalTransition
    }, config.duration)
  }

  // Flash avatar for correct/incorrect answers
  public flashAvatar(avatarElement: HTMLElement, isCorrect: boolean): void {
    const config: FlashConfig = {
      color: isCorrect ? '#10b981' : '#ef4444', // Green for correct, red for incorrect
      duration: 300,
      intensity: 0.8
    }
    this.flashElement(avatarElement, config)
  }

  // Animate multiplier badge
  public animateMultiplierBadge(badgeElement: HTMLElement, multiplier: number): void {
    const originalTransform = badgeElement.style.transform
    const originalTransition = badgeElement.style.transition

    // Scale up animation
    badgeElement.style.transition = 'transform 0.2s ease-out'
    badgeElement.style.transform = 'scale(1.2)'

    // Add glow effect based on multiplier
    const glowColors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444']
    const glowColor = glowColors[Math.min(multiplier - 1, glowColors.length - 1)]
    
    badgeElement.style.boxShadow = `0 0 20px ${glowColor}`

    // Reset after animation
    setTimeout(() => {
      badgeElement.style.transform = originalTransform
      badgeElement.style.transition = originalTransition
      badgeElement.style.boxShadow = ''
    }, 200)
  }

  // Animate score points
  public animateScorePoints(scoreElement: HTMLElement, points: number): void {
    const originalTransform = scoreElement.style.transform
    const originalTransition = scoreElement.style.transition

    // Create floating points animation
    scoreElement.style.transition = 'transform 0.5s ease-out'
    scoreElement.style.transform = 'translateY(-20px) scale(1.1)'

    // Add color based on points
    if (points > 50) {
      scoreElement.style.color = '#10b981' // Green for high points
    } else if (points > 20) {
      scoreElement.style.color = '#f59e0b' // Orange for medium points
    } else {
      scoreElement.style.color = '#ef4444' // Red for low points
    }

    // Reset after animation
    setTimeout(() => {
      scoreElement.style.transform = originalTransform
      scoreElement.style.transition = originalTransition
      scoreElement.style.color = ''
    }, 500)
  }

  // Animate answer selection
  public animateAnswerSelection(answerElement: HTMLElement, isCorrect: boolean): void {
    const originalTransform = answerElement.style.transform
    const originalTransition = answerElement.style.transition
    const originalBackground = answerElement.style.backgroundColor

    // Set up animation
    answerElement.style.transition = 'all 0.3s ease-in-out'
    
    if (isCorrect) {
      answerElement.style.backgroundColor = '#10b981'
      answerElement.style.transform = 'scale(1.05)'
    } else {
      answerElement.style.backgroundColor = '#ef4444'
      answerElement.style.transform = 'scale(0.95)'
    }

    // Reset after animation
    setTimeout(() => {
      answerElement.style.transform = originalTransform
      answerElement.style.transition = originalTransition
      answerElement.style.backgroundColor = originalBackground
    }, 300)
  }

  // Animate timer warning
  public animateTimerWarning(timerElement: HTMLElement, timeLeft: number): void {
    const originalColor = timerElement.style.color
    const originalTransition = timerElement.style.transition

    // Warning colors based on time left
    let warningColor = ''
    if (timeLeft <= 10) {
      warningColor = '#ef4444' // Red for urgent
    } else if (timeLeft <= 20) {
      warningColor = '#f59e0b' // Orange for warning
    } else if (timeLeft <= 30) {
      warningColor = '#fbbf24' // Yellow for caution
    }

    if (warningColor) {
      timerElement.style.transition = 'color 0.2s ease-in-out'
      timerElement.style.color = warningColor

      // Pulse animation for urgent warnings
      if (timeLeft <= 10) {
        this.pulseElement(timerElement, 200)
      }
    }

    // Reset color after animation
    setTimeout(() => {
      timerElement.style.color = originalColor
      timerElement.style.transition = originalTransition
    }, 1000)
  }

  // Pulse animation for urgent elements
  private pulseElement(element: HTMLElement, duration: number): void {

    element.style.transition = `transform ${duration}ms ease-in-out`

    const pulse = () => {
      element.style.transform = 'scale(1.1)'
      setTimeout(() => {
        element.style.transform = 'scale(1)'
      }, duration / 2)
    }

    // Pulse twice
    pulse()
    setTimeout(pulse, duration)
  }

  // Animate auto-scroll for selected items
  public scrollToElement(element: HTMLElement, container: HTMLElement): void {
    const elementRect = element.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()

    // Check if element is outside visible area
    if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      })
    }
  }

  // Animate loading spinner
  public animateLoadingSpinner(spinnerElement: HTMLElement): void {
    spinnerElement.style.animation = 'spin 1s linear infinite'
  }

  // Stop loading spinner
  public stopLoadingSpinner(spinnerElement: HTMLElement): void {
    spinnerElement.style.animation = ''
  }

  // Animate success/error messages
  public animateMessage(messageElement: HTMLElement, type: 'success' | 'error' | 'warning'): void {
    const originalTransform = messageElement.style.transform
    const originalTransition = messageElement.style.transition

    // Slide in from top
    messageElement.style.transition = 'transform 0.3s ease-out'
    messageElement.style.transform = 'translateY(0)'

    // Add color based on type
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b'
    }
    messageElement.style.borderLeft = `4px solid ${colors[type]}`

    // Slide out after delay
    setTimeout(() => {
      messageElement.style.transform = 'translateY(-100%)'
    }, 3000)

    // Reset after animation
    setTimeout(() => {
      messageElement.style.transform = originalTransform
      messageElement.style.transition = originalTransition
      messageElement.style.borderLeft = ''
    }, 3300)
  }

  // Animate button press
  public animateButtonPress(buttonElement: HTMLElement): void {
    const originalTransform = buttonElement.style.transform
    const originalTransition = buttonElement.style.transition

    buttonElement.style.transition = 'transform 0.1s ease-out'
    buttonElement.style.transform = 'scale(0.95)'

    setTimeout(() => {
      buttonElement.style.transform = originalTransform
      buttonElement.style.transition = originalTransition
    }, 100)
  }

  // Animate modal open/close
  public animateModal(modalElement: HTMLElement, isOpening: boolean): void {
    const originalTransform = modalElement.style.transform
    const originalTransition = modalElement.style.transition
    const originalOpacity = modalElement.style.opacity

    modalElement.style.transition = 'all 0.3s ease-in-out'

    if (isOpening) {
      modalElement.style.transform = 'scale(1)'
      modalElement.style.opacity = '1'
    } else {
      modalElement.style.transform = 'scale(0.9)'
      modalElement.style.opacity = '0'
    }

    // Reset after animation
    setTimeout(() => {
      modalElement.style.transform = originalTransform
      modalElement.style.transition = originalTransition
      modalElement.style.opacity = originalOpacity
    }, 300)
  }

  // Cleanup animations
  public cleanup(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }
}

export const visualFeedbackService = VisualFeedbackService.getInstance() 