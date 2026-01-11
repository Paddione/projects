import React, { useState, useEffect, useRef } from 'react'
import { useAudio } from '../hooks/useAudio'
import { useLocalization } from '../hooks/useLocalization'
import { useVisualFeedback } from '../hooks/useVisualFeedback'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { LanguageSelector } from './LanguageSelector'
import { ThemeSelector } from './ThemeSelector'
import { AudioSettings } from './AudioSettings'
import styles from '../styles/SettingsModal.module.css'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLocalization()
  const { handleButtonClick, handleButtonHover, handleModalOpen, handleModalClose } = useAudio()
  const { animateModal } = useVisualFeedback()
  const [activeTab, setActiveTab] = useState<'audio' | 'language' | 'theme' | 'help'>('audio')

  // Focus trap hook handles Tab navigation and Escape key
  const focusTrapRef = useFocusTrap(isOpen, onClose)

  useEffect(() => {
    if (isOpen) {
      try {
        handleModalOpen()
      } catch {
        // Swallow audio hook errors to keep modal stable (no console output in tests)
      }
      animateModal('settings-modal', true)
    } else {
      try {
        handleModalClose()
      } catch {
        // Swallow audio hook errors silently
      }
      animateModal('settings-modal', false)
    }
  }, [isOpen, handleModalOpen, handleModalClose, animateModal])

  const handleClose = () => {
    try {
      handleButtonClick()
    } catch {
      // Swallow audio hook errors silently
    }
    onClose()
  }

  const handleTabClick = (tab: 'audio' | 'language' | 'theme' | 'help') => {
    setActiveTab(tab)
    try {
      handleButtonClick()
    } catch {
      // Swallow audio hook errors silently
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div
        className={styles.modal}
        id="settings-modal"
        ref={focusTrapRef as React.RefObject<HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        tabIndex={-1}
      >
        <div className={styles.header}>
          <h2 id="settings-modal-title">{t('settings.title')}</h2>
          <button
            className={styles.closeButton}
            onClick={handleClose}
            onMouseEnter={handleButtonHover}
            title={t('button.close')}
            aria-label={t('button.close')}
          >
            ×
          </button>
        </div>

        <div className={styles.tabs} role="tablist">
          <button
            className={`${styles.tab} ${activeTab === 'audio' ? styles.active : ''}`}
            onClick={() => handleTabClick('audio')}
            onMouseEnter={handleButtonHover}
            role="tab"
            aria-selected={activeTab === 'audio'}
            aria-controls="audio-panel"
          >
            🔊 {t('settings.audio')}
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'language' ? styles.active : ''}`}
            onClick={() => handleTabClick('language')}
            onMouseEnter={handleButtonHover}
            role="tab"
            aria-selected={activeTab === 'language'}
            aria-controls="language-panel"
          >
            🌐 {t('settings.language')}
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'theme' ? styles.active : ''}`}
            onClick={() => handleTabClick('theme')}
            onMouseEnter={handleButtonHover}
            role="tab"
            aria-selected={activeTab === 'theme'}
            aria-controls="theme-panel"
          >
            🎨 {t('settings.theme')}
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'help' ? styles.active : ''}`}
            onClick={() => handleTabClick('help')}
            onMouseEnter={handleButtonHover}
            role="tab"
            aria-selected={activeTab === 'help'}
            aria-controls="help-panel"
          >
            ❓ {t('help.title')}
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'audio' && (
            <div className={styles.tabContent} id="audio-panel" role="tabpanel" aria-labelledby="audio-tab">
              <AudioSettings />
            </div>
          )}

          {activeTab === 'language' && (
            <div className={styles.tabContent} id="language-panel" role="tabpanel" aria-labelledby="language-tab">
              <LanguageSelector />
              <div className={styles.info}>
                <p>{t('info.languageChanged')}</p>
              </div>
            </div>
          )}

          {activeTab === 'theme' && (
            <div className={styles.tabContent} id="theme-panel" role="tabpanel" aria-labelledby="theme-tab">
              <ThemeSelector />
              <div className={styles.info}>
                <p>{t('info.themeChanged')}</p>
              </div>
            </div>
          )}

          {activeTab === 'help' && (
            <div className={styles.tabContent} id="help-panel" role="tabpanel" aria-labelledby="help-tab">
              <HelpContent />
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.saveButton}
            onClick={handleClose}
            onMouseEnter={handleButtonHover}
            aria-label={t('button.save')}
          >
            {t('button.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

const HelpContent: React.FC = () => {
  const { t } = useLocalization()

  return (
    <div className={styles.helpContent}>
      <section className={styles.helpSection}>
        <h3>{t('help.howToPlay')}</h3>
        <div className={styles.helpText}>
          <p>1. Create or join a game using a unique code</p>
          <p>2. Wait for all players to be ready</p>
          <p>3. Answer questions within the time limit</p>
          <p>4. Build up your multiplier with consecutive correct answers</p>
          <p>5. Submit your score to the Hall of Fame</p>
        </div>
      </section>

      <section className={styles.helpSection}>
        <h3>{t('help.scoring')}</h3>
        <div className={styles.helpText}>
          <p>• Points = (60 - seconds elapsed) × multiplier</p>
          <p>• Multiplier increases with consecutive correct answers</p>
          <p>• Wrong answers reset multiplier to 1x</p>
          <p>• Higher multipliers = more points per correct answer</p>
        </div>
      </section>

      <section className={styles.helpSection}>
        <h3>{t('help.multipliers')}</h3>
        <div className={styles.helpText}>
          <p>• 1x: Starting multiplier</p>
          <p>• 2x: After 1 consecutive correct answer</p>
          <p>• 3x: After 2 consecutive correct answers</p>
          <p>• 4x: After 3 consecutive correct answers</p>
          <p>• 5x: After 4 consecutive correct answers (maximum)</p>
        </div>
      </section>

      <section className={styles.helpSection}>
        <h3>{t('help.audio')}</h3>
        <div className={styles.helpText}>
          <p>• Adjust music and sound effect volumes independently</p>
          <p>• Mute all audio with the master mute button</p>
          <p>• Test audio with the provided test buttons</p>
          <p>• Settings are automatically saved</p>
        </div>
      </section>

      <section className={styles.helpSection}>
        <h3>{t('help.language')}</h3>
        <div className={styles.helpText}>
          <p>• Switch between German and English</p>
          <p>• Language preference is saved automatically</p>
          <p>• All UI elements update instantly</p>
          <p>• Fallback to English for missing translations</p>
        </div>
      </section>

      <section className={styles.helpSection}>
        <h3>{t('help.contact')}</h3>
        <div className={styles.helpText}>
          <p>For support or questions:</p>
          <p>• Email: support@learn2play.com</p>
          <p>• GitHub: github.com/learn2play</p>
          <p>• Discord: discord.gg/learn2play</p>
        </div>
      </section>
    </div>
  )
} 
