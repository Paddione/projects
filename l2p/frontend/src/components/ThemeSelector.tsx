import React from 'react'
import { useThemeStore, Theme } from '../stores/themeStore'
import { useAudio } from '../hooks/useAudio'
import styles from '../styles/ThemeSelector.module.css'

export const ThemeSelector: React.FC = () => {
  const { theme, setTheme, isDark } = useThemeStore()
  const { handleThemeChange, handleButtonHover } = useAudio()

  const handleThemeSelect = (selectedTheme: Theme) => {
    setTheme(selectedTheme)
    handleThemeChange()
  }

  const themes: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'auto', label: 'Auto', icon: '🔄' }
  ]

  return (
    <div className={styles.container} data-testid="theme-selector">
      <h4>Theme / Design</h4>
      <div className={styles.themeButtons}>
        {themes.map((themeOption) => (
          <button
            key={themeOption.value}
            onClick={() => handleThemeSelect(themeOption.value)}
            onMouseEnter={handleButtonHover}
            className={`${styles.themeButton} ${
              theme === themeOption.value ? styles.active : ''
            }`}
            title={themeOption.label}
          >
            <span className={styles.icon}>{themeOption.icon}</span>
            <span className={styles.label}>{themeOption.label}</span>
          </button>
        ))}
      </div>
      <div className={styles.currentTheme}>
        Current: {isDark ? 'Dark' : 'Light'} Mode
      </div>
    </div>
  )
} 