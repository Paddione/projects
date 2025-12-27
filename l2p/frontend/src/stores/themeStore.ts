import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { audioManager } from '../services/audioManager'

export type Theme = 'light' | 'dark' | 'auto'

export interface ThemeState {
  theme: Theme
  isDark: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  getSystemTheme: () => 'light' | 'dark'
}

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const applyTheme = (theme: Theme) => {
  if (typeof window === 'undefined') return

  const root = document.documentElement
  const systemTheme = getSystemTheme()

  let actualTheme: 'light' | 'dark'

  if (theme === 'auto') {
    actualTheme = systemTheme
  } else {
    actualTheme = theme
  }

  root.setAttribute('data-theme', actualTheme)

  // Update meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]')
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', actualTheme === 'dark' ? '#0f172a' : '#ffffff')
  }
}

export const useThemeStore = create<ThemeState>()(
  devtools(
    persist(
      (set, get) => ({
        theme: 'auto',
        isDark: false,

        setTheme: (theme: Theme) => {
          set({ theme })
          applyTheme(theme)
          audioManager.playThemeChange()
          
          // Update isDark state
          const actualTheme = theme === 'auto' ? getSystemTheme() : theme
          set({ isDark: actualTheme === 'dark' })
        },
        
        toggleTheme: () => {
          const currentTheme = get().theme
          const newTheme: Theme = currentTheme === 'light' ? 'dark' : 'light'
          get().setTheme(newTheme)
          // Note: setTheme already plays the sound, so we don't need to play it again here
        },

        getSystemTheme: () => getSystemTheme(),
      }),
      {
        name: 'theme-storage',
        partialize: (state) => ({
          theme: state.theme,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            applyTheme(state.theme)
            const actualTheme = state.theme === 'auto' ? getSystemTheme() : state.theme
            state.isDark = actualTheme === 'dark'
          }
        },
      }
    ),
    {
      name: 'theme-store',
    }
  )
)

// Initialize theme on mount
if (typeof window !== 'undefined') {
  const store = useThemeStore.getState()
  applyTheme(store.theme)

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (_e) => {
    const store = useThemeStore.getState()
    if (store.theme === 'auto') {
      store.setTheme('auto') // This will re-apply with new system theme
    }
  })
} 