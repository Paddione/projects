import React from 'react'
import { useThemeStore, Theme } from '../stores/themeStore'
import { useAudio } from '../hooks/useAudio'
import { useLocalization } from '../hooks/useLocalization'
import styles from '../styles/ThemeSelector.module.css'

export const ThemeSelector: React.FC = () => {
  const { theme, setTheme, isDark } = useThemeStore()
  const { handleThemeChange, handleButtonHover } = useAudio()
  const { t } = useLocalization()

  const handleThemeSelect = (selectedTheme: Theme) => {
    setTheme(selectedTheme)
    handleThemeChange()
  }

  const themes: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: t('theme.lightLabel'), icon: '☀️' },
    { value: 'dark', label: t('theme.darkLabel'), icon: '🌙' },
    { value: 'auto', label: t('theme.autoLabel'), icon: '🔄' }
  ]

  return (
    <div className={styles.container} data-testid="theme-selector">
      <h4>{t('theme.title')}</h4>
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
        {t('theme.currentMode', { mode: isDark ? t('theme.darkLabel') : t('theme.lightLabel') })}
      </div>
    </div>
  )
} 