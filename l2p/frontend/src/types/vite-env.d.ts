/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_SOCKET_URL: string
  readonly VITE_TEST_MODE?: string
  readonly MODE: string
  readonly BASE_URL: string
  readonly PROD: boolean
  readonly DEV: boolean
  readonly SSR: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Minimal NodeJS.Process typing for environments where process is referenced
declare global {
   
  namespace NodeJS {
    interface ProcessEnv {
      VITE_API_URL?: string
      NODE_ENV?: string
    }
  }
  const process: {
    env?: NodeJS.ProcessEnv
  }
} 