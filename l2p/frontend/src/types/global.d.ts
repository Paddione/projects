// Global type definitions for the Learn2Play frontend

// Jest globals - these are available in test files
declare global {
  const jest: typeof import('jest');
  const describe: typeof import('@jest/globals').describe;
  const it: typeof import('@jest/globals').it;
  const test: typeof import('@jest/globals').test;
  const expect: typeof import('@jest/globals').expect;
  const beforeAll: typeof import('@jest/globals').beforeAll;
  const beforeEach: typeof import('@jest/globals').beforeEach;
  const afterAll: typeof import('@jest/globals').afterAll;
  const afterEach: typeof import('@jest/globals').afterEach;
  
  // Node.js globals
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      VITE_API_URL?: string;
      VITE_SOCKET_URL?: string;
      VITE_TEST_MODE?: string;
      [key: string]: string | undefined;
    }
    
    interface Global {
      [key: string]: unknown;
    }
  }
  
  // Browser APIs that might not be fully typed
  interface Window {
    requestAnimationFrame: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame: (handle: number) => void;
    ResizeObserver: typeof ResizeObserver;
    IntersectionObserver: typeof IntersectionObserver;
  }

  const __IMPORT_META_ENV__: Record<string, string | boolean | undefined>;
  
  // Custom audio context types
  interface AudioContext {
    createOscillator(): OscillatorNode;
    createGain(): GainNode;
    destination: AudioDestinationNode;
    currentTime: number;
  }
  
  // Socket.io event handler types
  type SocketEventHandler<T = unknown> = (data: T) => void;
  type SocketErrorHandler = (error: Error) => void;
  
  // Performance optimization types
  type PerformanceCallback = () => void;
  type CleanupFunction = () => void;
  
  // File upload types
  interface FileWithPreview extends File {
    preview?: string;
  }
}

export {};
