import React from 'react'
import { useLocalization } from '../hooks/useLocalization'
import { useAudio } from '../hooks/useAudio'
import styles from '../styles/LanguageSelector.module.css'

export const LanguageSelector: React.FC = () => {
  const { currentLanguage, setLanguage, getSupportedLanguages, getLanguageName, getLanguageFlag } = useLocalization()
  const { handleLanguageChange, handleButtonHover } = useAudio()

  const handleLanguageSelect = (language: string) => {
    setLanguage(language as 'en' | 'de')
    handleLanguageChange()
  }

  return (
    <div className={styles.container} data-testid="language-selector">
      <h4>Language / Sprache</h4>
      <div className={styles.languageButtons}>
        {getSupportedLanguages().map((language) => (
          <button
            key={language}
            onClick={() => handleLanguageSelect(language)}
            onMouseEnter={handleButtonHover}
            className={`${styles.languageButton} ${
              currentLanguage === language ? styles.active : ''
            }`}
            title={getLanguageName(language)}
          >
            <span className={styles.flag}>{getLanguageFlag(language)}</span>
            <span className={styles.name}>{getLanguageName(language)}</span>
          </button>
        ))}
      </div>
    </div>
  )
} 