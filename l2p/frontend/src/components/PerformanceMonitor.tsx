import React, { useEffect, useState } from 'react'
import { performanceOptimizer } from '../services/performanceOptimizer'
import styles from '../styles/PerformanceMonitor.module.css'

interface PerformanceMetrics {
  currentFPS: number
  pollingInterval: number
  activeConnections: number
  throttledFunctions: number
}

export const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    currentFPS: 60,
    pollingInterval: 5000,
    activeConnections: 0,
    throttledFunctions: 0
  })
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const updateMetrics = () => {
      const currentMetrics = performanceOptimizer.getPerformanceMetrics()
      setMetrics(currentMetrics)
    }

    // Update metrics every second
    const interval = setInterval(updateMetrics, 1000)
    updateMetrics() // Initial update

    return () => clearInterval(interval)
  }, [])

  // Toggle visibility with Ctrl+Shift+P
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'P') {
        setIsVisible(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  if (!isVisible) {
    return null
  }

  const getFPSColor = (fps: number) => {
    if (fps >= 55) return styles.good
    if (fps >= 30) return styles.warning
    return styles.critical
  }

  const getPollingColor = (interval: number) => {
    if (interval <= 5000) return styles.good
    if (interval <= 15000) return styles.warning
    return styles.critical
  }

  return (
    <div className={styles.monitor}>
      <div className={styles.header}>
        <h3>Performance Monitor</h3>
        <button 
          className={styles.closeButton}
          onClick={() => setIsVisible(false)}
        >
          ×
        </button>
      </div>
      
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.label}>FPS:</span>
          <span className={`${styles.value} ${getFPSColor(metrics.currentFPS)}`}>
            {metrics.currentFPS}
          </span>
        </div>
        
        <div className={styles.metric}>
          <span className={styles.label}>Polling:</span>
          <span className={`${styles.value} ${getPollingColor(metrics.pollingInterval)}`}>
            {Math.round(metrics.pollingInterval / 1000)}s
          </span>
        </div>
        
        <div className={styles.metric}>
          <span className={styles.label}>Connections:</span>
          <span className={styles.value}>
            {metrics.activeConnections}
          </span>
        </div>
        
        <div className={styles.metric}>
          <span className={styles.label}>Throttled:</span>
          <span className={styles.value}>
            {metrics.throttledFunctions}
          </span>
        </div>
      </div>
      
      <div className={styles.help}>
        Press Ctrl+Shift+P to toggle
      </div>
    </div>
  )
} 