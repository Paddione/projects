import '@testing-library/jest-dom/jest-globals'
import { configure } from '@testing-library/react'
import './test-setup'

const TEST_TIMEOUTS: Record<string, number> = {
  unit: 30_000,
  integration: 60_000,
  e2e: 120_000,
  performance: 300_000
}

const detectedTestType = process.env['TEST_TYPE'] ?? 'unit'
const configuredTimeout = Number(
  process.env['JEST_TEST_TIMEOUT'] ?? TEST_TIMEOUTS[detectedTestType] ?? TEST_TIMEOUTS['unit']
)

if (!Number.isNaN(configuredTimeout)) {
  jest.setTimeout(configuredTimeout)
}

// Only run frontend setup in browser environment
if (typeof window !== 'undefined') {
  // Initialize test environment
  let testContext;
  try {
    const { TestUtilities } = require('../../shared/test-config/dist/cjs/TestUtilities');
    const { environment } = TestUtilities.getCurrentContext();
    testContext = TestUtilities.configManager?.getEnvironmentConfig(environment);
  } catch {
    // Use fallback configuration - this is expected for unit tests
    testContext = null;
  }

  // Mock Web Audio API
  if (!window.AudioContext) {
    Object.defineProperty(window, 'AudioContext', {
      value: class MockAudioContext {
        destination: Record<string, unknown>
        state: string
        sampleRate: number

        constructor() {
          this.destination = { connect: () => { } }
          this.state = 'running'
          this.sampleRate = 44100
        }

        createGain() {
          return {
            connect: () => { },
            disconnect: () => { },
            gain: { value: 1 }
          }
        }

        createBufferSource() {
          return {
            connect: () => { },
            disconnect: () => { },
            start: () => { },
            stop: () => { },
            buffer: null
          }
        }

        decodeAudioData(_arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
          return Promise.resolve({
            duration: 1,
            length: 44100,
            numberOfChannels: 2,
            sampleRate: 44100,
            getChannelData: () => new Float32Array(44100),
            copyFromChannel: () => { },
            copyToChannel: () => { }
          } as AudioBuffer)
        }

        suspend() {
          this.state = 'suspended'
          return Promise.resolve()
        }

        resume() {
          this.state = 'running'
          return Promise.resolve()
        }

        close() {
          this.state = 'closed'
          return Promise.resolve()
        }
      },
      writable: true,
      configurable: true
    })
  }

  // Mock requestAnimationFrame
  Object.defineProperty(window, 'requestAnimationFrame', {
    value: (callback: FrameRequestCallback) => {
      return setTimeout(() => callback(performance.now()), 16)
    }
  })

  Object.defineProperty(window, 'cancelAnimationFrame', {
    value: (id: number) => {
      clearTimeout(id)
    }
  })

  // Mock performance API (writable/configurable to play nice with Jest fake timers)
  Object.defineProperty(window, 'performance', {
    value: {
      now: () => Date.now(),
      mark: () => { },
      measure: () => { },
      getEntriesByType: () => [],
      getEntriesByName: () => []
    },
    writable: true,
    configurable: true
  })

  // Mock ResizeObserver
  Object.defineProperty(window, 'ResizeObserver', {
    value: class MockResizeObserver {
      callback: ResizeObserverCallback

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }

      observe() { }
      unobserve() { }
      disconnect() { }
    }
  })

  // Mock IntersectionObserver
  Object.defineProperty(window, 'IntersectionObserver', {
    value: class MockIntersectionObserver {
      callback: IntersectionObserverCallback

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
      }

      observe() { }
      unobserve() { }
      disconnect() { }
    }
  })

  // Mock matchMedia
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => { },
        removeListener: () => { },
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: () => { }
      }),
      writable: true,
      configurable: true
    })
  }

  // Mock localStorage
  const localStorageMock = {
    getItem: () => null,
    setItem: () => { },
    removeItem: () => { },
    clear: () => { }
  }
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  })

  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: () => null,
    setItem: () => { },
    removeItem: () => { },
    clear: () => { }
  }
  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock
  })

  // Configure testing library
  configure({
    testIdAttribute: 'data-testid'
  })

  // Global test utilities
  if (!global.ResizeObserver) {
    Object.defineProperty(global, 'ResizeObserver', {
      value: window.ResizeObserver,
      writable: true,
      configurable: true
    })
  }

  if (!global.IntersectionObserver) {
    Object.defineProperty(global, 'IntersectionObserver', {
      value: window.IntersectionObserver,
      writable: true,
      configurable: true
    })
  }

  // Mock console methods to reduce noise in tests
  const originalConsoleError = console.error
  const originalConsoleWarn = console.warn

  beforeAll(() => {
    console.error = (...args: unknown[]) => {
      // Suppress known React warnings that are expected in tests
      if (
        typeof args[0] === 'string' &&
        args[0].includes('Warning: ReactDOM.render is no longer supported')
      ) {
        return
      }
      // Suppress act(...) warnings that can appear despite userEvent wrapping
      if (
        typeof args[0] === 'string' &&
        args[0].includes('An update to') &&
        args[0].includes('inside a test was not wrapped in act')
      ) {
        return
      }
      // Suppress expected DocumentProcessor test errors
      if (
        typeof args[0] === 'string' &&
        args[0].includes('Error loading processing status')
      ) {
        return
      }
      originalConsoleError.call(console, ...args)
    }

    console.warn = (...args: unknown[]) => {
      // Suppress known React warnings that are expected in tests
      if (
        typeof args[0] === 'string' &&
        (args[0].includes('Warning: componentWillReceiveProps') ||
          args[0].includes('Warning: componentWillUpdate'))
      ) {
        return
      }

      // Suppress warnings that are expected in tests
      if (
        typeof args[0] === 'string' &&
        (args[0].includes('Failed to resume audio context') ||
          args[0].includes('Failed to add event listener') ||
          args[0].includes('Failed to remove event listener') ||
          args[0].includes('Failed to play') ||
          args[0].includes('React Router Future Flag Warning') ||
          args[0].includes('v7_startTransition') ||
          args[0].includes('v7_relativeSplatPath') ||
          args[0].includes('A function to advance timers was called') ||
          args[0].includes('timers APIs are not mocked'))
      ) {
        return
      }

      originalConsoleWarn.call(console, ...args)
    }
  })

  afterAll(() => {
    console.error = originalConsoleError
    console.warn = originalConsoleWarn
  })

  // Clean up after each test
  afterEach(() => {
    // Clear mocks will be handled by Jest's clearMocks: true config
    localStorageMock.clear()
    sessionStorageMock.clear()
  })

}
