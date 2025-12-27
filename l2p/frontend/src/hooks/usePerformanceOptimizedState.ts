import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { performanceOptimizer } from '../services/performanceOptimizer'

interface PerformanceOptimizedStateOptions {
  debounceDelay?: number
  throttleDelay?: number
  debounceKey?: string
  throttleKey?: string
  priority?: 'debounce' | 'throttle' | 'none'
}

export function usePerformanceOptimizedState<T>(
  initialState: T,
  options: PerformanceOptimizedStateOptions = {}
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(initialState)

  const {
    debounceDelay = 300,
    throttleDelay = 100,
    debounceKey = 'default',
    throttleKey = 'default',
    priority,
  } = options

  // Derive effective priority from provided options when not explicitly set
  const effectivePriority: 'debounce' | 'throttle' | 'none' = useMemo(() => {
    if (priority) return priority
    // Only consider options explicitly provided by caller
    const hasThrottle = Object.prototype.hasOwnProperty.call(options, 'throttleDelay') ||
      Object.prototype.hasOwnProperty.call(options, 'throttleKey')
    const hasDebounce = Object.prototype.hasOwnProperty.call(options, 'debounceDelay') ||
      Object.prototype.hasOwnProperty.call(options, 'debounceKey')
    if (hasThrottle && !hasDebounce) return 'throttle'
    if (hasDebounce && !hasThrottle) return 'debounce'
    // Prefer debounce when both are present unless explicitly overridden
    if (hasThrottle && hasDebounce) return 'debounce'
    return 'none'
  }, [priority, options, debounceDelay, throttleDelay, debounceKey, throttleKey])

  const debouncedFnRef = useRef<((value: T | ((prev: T) => T)) => void) | null>(null)
  const throttledFnRef = useRef<((value: T | ((prev: T) => T)) => void) | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const resolveNext = useCallback((value: T | ((prev: T) => T)) => (
    typeof value === 'function' ? (value as (prev: T) => T)(state) : value
  ), [state])

  // Initialize debounced function using performance optimizer
  useEffect(() => {
    if (effectivePriority === 'debounce') {
      debouncedFnRef.current = performanceOptimizer.debounce(
        debounceKey,
        (value: T | ((prev: T) => T)) => {
          setState(resolveNext(value))
        },
        debounceDelay
      )
    } else {
      debouncedFnRef.current = null
    }
  }, [debounceDelay, debounceKey, effectivePriority, resolveNext])

  // Initialize throttled function using performance optimizer
  useEffect(() => {
    if (effectivePriority === 'throttle') {
      throttledFnRef.current = performanceOptimizer.throttle(
        throttleKey,
        (value: T | ((prev: T) => T)) => {
          setState(resolveNext(value))
        },
        throttleDelay
      )
    } else {
      throttledFnRef.current = null
    }
  }, [throttleDelay, throttleKey, effectivePriority, resolveNext])

  const updateState = useCallback((value: T | ((prev: T) => T)) => {
    if (effectivePriority === 'debounce' && debouncedFnRef.current) {
      debouncedFnRef.current(value)
    } else if (effectivePriority === 'throttle' && throttledFnRef.current) {
      throttledFnRef.current(value)
    } else {
      setState(resolveNext(value))
    }
  }, [effectivePriority, resolveNext])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return [state, updateState]
}

// Simple debounced state hook
export function useDebouncedState<T>(
  initialState: T,
  delay: number = 300
): [T, (value: T) => void] {
  return usePerformanceOptimizedState(initialState, {
    debounceDelay: delay,
    debounceKey: 'debounced-state',
    priority: 'debounce'
  })
}

// Simple throttled state hook
export function useThrottledState<T>(
  initialState: T,
  delay: number = 100
): [T, (value: T) => void] {
  return usePerformanceOptimizedState(initialState, {
    throttleDelay: delay,
    priority: 'throttle'
  })
}

// Memoized value hook
export function useMemoizedValue<T>(
  computeValue: () => T,
  dependencies: React.DependencyList,
  equalityFn?: (prev: T, next: T) => boolean
): T {
  // Keep track of the previous computed value to support custom equality checks
  const prevValueRef = useRef<T | undefined>(undefined)
  const hasInitRef = useRef(false)

  const value = useMemo(() => {
    const next = computeValue()

    if (!hasInitRef.current) {
      // First computation
      hasInitRef.current = true
      prevValueRef.current = next
      return next
    }

    const prev = prevValueRef.current as T
    const areEqual = equalityFn ? equalityFn(prev, next) : false
    if (areEqual) {
      // Reuse previous value reference if considered equal
      return prev
    }
    // Update the cached value when different
    prevValueRef.current = next
    return next
    // dependencies array ensures recomputation semantics match React expectations
  }, [...dependencies, computeValue, equalityFn])

  return value
}
