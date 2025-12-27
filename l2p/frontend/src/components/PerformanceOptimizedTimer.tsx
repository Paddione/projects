import React, { useEffect, useRef, useState, useCallback } from 'react'
import { performanceOptimizer } from '../services/performanceOptimizer'
import { useThrottledState } from '../hooks/usePerformanceOptimizedState'
import styles from '../styles/Timer.module.css'

interface PerformanceOptimizedTimerProps {
  duration: number
  isRunning?: boolean
  onTimeUp?: () => void
  showProgress?: boolean
  className?: string
  updateInterval?: number // How often to update the display
}

export const PerformanceOptimizedTimer: React.FC<PerformanceOptimizedTimerProps> = ({
  duration,
  isRunning = true,
  onTimeUp,
  showProgress = true,
  className = '',
  updateInterval = 100 // Update display every 100ms
}) => {
  const [timeRemaining, setTimeRemaining] = useThrottledState(duration, updateInterval)
  const [isWarning, setIsWarning] = useState(false)
  const [isCritical, setIsCritical] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  // Calculate progress percentage
  const progress = ((duration - timeRemaining) / duration) * 100

  // Throttled warning state updates
  const updateWarningStates = useCallback(
    (time: number) => {
      const throttledFn = performanceOptimizer.throttle('timer-warning-updates', (t: number) => {
        setIsWarning(t <= 10 && t > 5)
        setIsCritical(t <= 5)
      }, 200)
      throttledFn(time)
    },
    [performanceOptimizer]
  )

  // Update warning states based on time remaining
  useEffect(() => {
    updateWarningStates(timeRemaining)
  }, [timeRemaining, updateWarningStates])

  // Handle timer logic
  useEffect(() => {
    if (!isRunning) {
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
      return
    }

    // Create efficient timer using performance optimizer
    cleanupRef.current = performanceOptimizer.createEfficientTimer(
      duration,
      (remaining) => {
        setTimeRemaining(remaining)
      },
      () => {
        setTimeRemaining(0)
        if (onTimeUp) {
          onTimeUp()
        }
      }
    )

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [duration, isRunning, onTimeUp, setTimeRemaining])

  // Reset timer when duration changes
  useEffect(() => {
    setTimeRemaining(duration)
    startTimeRef.current = Date.now()
  }, [duration, setTimeRemaining])

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={`${styles.timerContainer} ${className}`}>
      <div className={styles.timerDisplay}>
        <div 
          className={`${styles.timeText} ${
            isCritical ? styles.critical : 
            isWarning ? styles.warning : ''
          }`}
          data-testid="timer-display"
        >
          {formatTime(timeRemaining)}
        </div>
        
        {showProgress && (
          <div className={styles.progressContainer}>
            <div 
              className={`${styles.progressBar} ${
                isCritical ? styles.critical : 
                isWarning ? styles.warning : ''
              }`}
              style={{ width: `${progress}%` }}
              data-testid="timer-progress"
            />
          </div>
        )}
      </div>
      
      {isRunning && (
        <div className={`${styles.statusIndicator} ${styles.running}`}>
          ●
        </div>
      )}
    </div>
  )
} 