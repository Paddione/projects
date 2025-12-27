export interface PerformanceConfig {
  targetFPS: number
  pollingInterval: {
    min: number
    max: number
    current: number
  }
  throttleDelay: number
  maxWebSocketConnections: number
}

export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer
  private animationFrameId: number | null = null
  private lastFrameTime: number = 0
  private frameCount: number = 0
  private lastFPSUpdate: number = 0
  private currentFPS: number = 60
  private pollingTimer: NodeJS.Timeout | null = null
  private throttledFunctions: Map<string, NodeJS.Timeout> = new Map()
  private activeConnections: Set<string> = new Set()

  private config: PerformanceConfig = {
    targetFPS: 60,
    pollingInterval: {
      min: 3000, // 3 seconds
      max: 23000, // 23 seconds
      current: 5000 // 5 seconds default
    },
    throttleDelay: 16, // ~60 FPS
    maxWebSocketConnections: 10
  }

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer()
    }
    return PerformanceOptimizer.instance
  }

  // FPS Limiting for smooth animations
  public limitFPS(callback: (() => void) | null | undefined): void {
    const now = performance.now()
    const deltaTime = now - this.lastFrameTime
    const targetFrameTime = 1000 / this.config.targetFPS

    if (deltaTime >= targetFrameTime) {
      this.lastFrameTime = now
      this.frameCount++

      // Update FPS calculation every second
      if (now - this.lastFPSUpdate >= 1000) {
        this.currentFPS = this.frameCount
        this.frameCount = 0
        this.lastFPSUpdate = now

        // Adjust polling interval based on FPS
        this.adjustPollingInterval()
      }

      if (typeof callback === 'function') {
        try {
          callback()
        } catch {
          // Swallow errors to avoid breaking animation loop during tests
          // and keep behavior resilient.
        }
      }
    }

    this.animationFrameId = requestAnimationFrame(() => this.limitFPS(callback))
  }

  // Stop FPS limiting
  public stopFPSLimiting(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  // Adaptive polling system
  public startAdaptivePolling(callback: (() => void) | null | undefined): void {
    this.stopAdaptivePolling()

    const poll = () => {
      if (typeof callback === 'function') {
        try {
          callback()
        } catch {
          // ignore callback errors
        }
      }

      // Adjust interval based on system performance
      const adjustedInterval = this.calculateOptimalPollingInterval()
      this.config.pollingInterval.current = Math.max(
        this.config.pollingInterval.min,
        Math.min(this.config.pollingInterval.max, adjustedInterval)
      )

      this.pollingTimer = setTimeout(poll, this.config.pollingInterval.current)
    }

    poll()
  }

  public stopAdaptivePolling(): void {
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer)
      this.pollingTimer = null
    }
  }

  // Calculate optimal polling interval based on FPS and system load
  private calculateOptimalPollingInterval(): number {
    const baseInterval = this.config.pollingInterval.current

    // Adjust based on FPS performance
    if (this.currentFPS < 30) {
      // System struggling, increase polling interval
      return baseInterval * 1.5
    } else if (this.currentFPS > 55) {
      // System performing well, decrease polling interval
      return baseInterval * 0.8
    }

    return baseInterval
  }

  // Adjust polling interval based on current FPS
  private adjustPollingInterval(): void {
    if (this.currentFPS < 30) {
      // System struggling, increase interval
      this.config.pollingInterval.current = Math.min(
        this.config.pollingInterval.max,
        this.config.pollingInterval.current * 1.2
      )
    } else if (this.currentFPS > 55) {
      // System performing well, decrease interval
      this.config.pollingInterval.current = Math.max(
        this.config.pollingInterval.min,
        this.config.pollingInterval.current * 0.9
      )
    }
  }

  // Throttled function execution
  public throttle<T extends (...args: any[]) => any>(
    key: string,
    func: T,
    delay: number = this.config.throttleDelay
  ): T {
    // Support trailing-edge execution with latest arguments
    let latestArgs: Parameters<T> | null = null

    return ((...args: Parameters<T>) => {
      latestArgs = args

      if (this.throttledFunctions.has(key)) {
        // A timer is already running; we'll use latestArgs when it fires
        return
      }

      const timer = setTimeout(() => {
        const callArgs = latestArgs
        latestArgs = null
        try {
          if (callArgs) {
            func(...callArgs)
          }
        } finally {
          this.throttledFunctions.delete(key)
        }
      }, delay)

      this.throttledFunctions.set(key, timer)
    }) as T
  }

  // Debounced function execution
  public debounce<T extends (...args: any[]) => any>(
    key: string,
    func: T,
    delay: number = 300
  ): T {
    return ((...args: Parameters<T>) => {
      if (this.throttledFunctions.has(key)) {
        clearTimeout(this.throttledFunctions.get(key)!)
      }

      this.throttledFunctions.set(key, setTimeout(() => {
        func(...args)
        this.throttledFunctions.delete(key)
      }, delay))
    }) as T
  }

  // WebSocket connection management
  public canCreateConnection(connectionId: string): boolean {
    if (this.activeConnections.has(connectionId)) {
      return false
    }

    if (this.activeConnections.size >= this.config.maxWebSocketConnections) {
      return false
    }

    return true
  }

  public registerConnection(connectionId: string): void {
    this.activeConnections.add(connectionId)
  }

  public unregisterConnection(connectionId: string): void {
    this.activeConnections.delete(connectionId)
  }

  public getConnectionCount(): number {
    return this.activeConnections.size
  }

  // Efficient timer updates
  public createEfficientTimer(
    duration: number,
    onTick: (timeRemaining: number) => void,
    onComplete: () => void
  ): () => void {
    const startTime = Date.now()
    let isRunning = true
    let lastEmitted = duration
    let timeoutId: NodeJS.Timeout | null = null

    const loop = () => {
      if (!isRunning) return
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, duration - elapsed)

      // Emit roughly every 100ms as per original intent
      if (lastEmitted - remaining >= 100 || remaining === 0) {
        try {
          onTick(remaining)
        } catch {
          // ignore tick errors to keep timer alive in tests
        }
        lastEmitted = remaining
      }

      if (remaining === 0) {
        isRunning = false
        try {
          onComplete()
        } catch {
          // ignore
        }
        return
      }

      // Schedule next tick using setTimeout to play nicely with jest timer mocks
      timeoutId = setTimeout(loop, 16)
    }

    // kick off
    timeoutId = setTimeout(loop, 0)

    return () => {
      isRunning = false
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }
  }

  // Memory management
  public cleanup(): void {
    this.stopFPSLimiting()
    this.stopAdaptivePolling()

    // Clear all throttled functions
    this.throttledFunctions.forEach(timeout => clearTimeout(timeout))
    this.throttledFunctions.clear()

    // Clear active connections
    this.activeConnections.clear()
  }

  // Performance monitoring
  public getPerformanceMetrics() {
    return {
      currentFPS: this.currentFPS,
      pollingInterval: this.config.pollingInterval.current,
      activeConnections: this.activeConnections.size,
      throttledFunctions: this.throttledFunctions.size
    }
  }

  // Update configuration
  public updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }
}

export const performanceOptimizer = PerformanceOptimizer.getInstance() 