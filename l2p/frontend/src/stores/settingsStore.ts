import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { audioManager } from '../services/audioManager'

export type Theme = 'light' | 'dark'
export type Language = 'en' | 'de'

export interface SettingsState {
  // Theme settings
  theme: Theme

  // UI settings
  autoScroll: boolean
  showAnimations: boolean

  // Actions
  setTheme: (theme: Theme) => void
  setAutoScroll: (enabled: boolean) => void
  setShowAnimations: (enabled: boolean) => void
  toggleTheme: () => void
}

const initialState = {
  theme: 'light' as Theme,
  autoScroll: true,
  showAnimations: true,
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setTheme: (theme) => {
          set({ theme });
          audioManager.playThemeChange();
        },
        setAutoScroll: (enabled) => set({ autoScroll: enabled }),
        setShowAnimations: (enabled) => set({ showAnimations: enabled }),
        toggleTheme: () => set((state) => {
          const newTheme = state.theme === 'light' ? 'dark' : 'light';
          audioManager.playThemeChange();
          return { theme: newTheme };
        }),
      }),
      {
        name: 'settings-storage',
        partialize: (state) => ({
          theme: state.theme,
          autoScroll: state.autoScroll,
          showAnimations: state.showAnimations,
        }),
      }
    ),
    {
      name: 'settings-store',
    }
  )
) 