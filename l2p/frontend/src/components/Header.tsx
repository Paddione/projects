import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { apiService } from '../services/apiService'
import { Icon } from './Icon'
import styles from '../styles/App.module.css'
import { useAudio } from '../hooks/useAudio'
import { useLocalization } from '../hooks/useLocalization'

export const Header: React.FC = () => {
  const currentUser = apiService.getCurrentUser()
  const isAdmin = !!currentUser?.isAdmin
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const {
    masterVolume,
    setMasterVolume,
    isMuted,
    setIsMuted,
    handleMenuSelect,
    handleMenuConfirm,
    handleMenuCancel,
    handleVolumeChange
  } = useAudio()
  const { currentLanguage, setLanguage, t, getLanguageFlag } = useLocalization()

  const toggleLanguage = () => setLanguage(currentLanguage === 'en' ? 'de' : 'en')

  // Close menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 640) setMobileMenuOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

  const handleLogout = async () => {
    const reloadPage = () => {
      try {
        window.location.reload()
      } catch {
        // Ignore reload errors in non-browser environments
      }
    }

    try {
      await apiService.logout()
      // Reload the page to trigger re-authentication
      reloadPage()
    } catch (error) {
      console.error('Logout failed:', error)
      // Clear auth anyway and reload
      apiService.clearAuth()
      reloadPage()
    }
  }

  const closeMenu = () => setMobileMenuOpen(false)

  return (
    <header className={styles.header} role="banner">
      <div className={styles.headerContent}>
        <a href="/" className={styles.logo}>
          Learn2Play Quiz
        </a>

        <button
          className={styles.mobileMenuToggle}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          <span className={`${styles.hamburger} ${mobileMenuOpen ? styles.hamburgerOpen : ''}`}>
            <span />
            <span />
            <span />
          </span>
        </button>

        <div className={`${styles.headerNav} ${mobileMenuOpen ? styles.headerNavOpen : ''}`}>
          <nav className={`${styles.flex} ${styles.gapMd} ${styles.itemsCenter} ${styles.headerNavLinks}`} role="navigation">
            <a href="/" className={`${styles.button} ${styles.buttonOutline}`} data-testid="home-page" onClick={() => { handleMenuSelect(); closeMenu() }}>
              {t('nav.home')}
            </a>
            <a href="/profile" className={`${styles.button} ${styles.buttonOutline}`} data-testid="profile-link" onClick={() => { handleMenuSelect(); closeMenu() }}>
              {t('nav.profile', 'Profile')}
            </a>
            <a href="/question-sets" className={`${styles.button} ${styles.buttonOutline}`} onClick={() => { handleMenuSelect(); closeMenu() }}>
              {t('nav.questionSets', 'Question Sets')}
            </a>
            {isAdmin && (
              <Link to="/admin" className={`${styles.button} ${styles.buttonOutline}`} data-testid="admin-dashboard-link" onClick={() => { handleMenuSelect(); closeMenu() }}>
                Admin
              </Link>
            )}
          </nav>

          <div className={`${styles.flex} ${styles.gapMd} ${styles.itemsCenter} ${styles.headerControls}`} data-testid="user-menu">
            {/* Volume/Mute Controls */}
            <div className={`${styles.flex} ${styles.itemsCenter} ${styles.gapSm} ${styles.volumeControls}`}>
              <button
                onClick={() => {
                  setIsMuted(!isMuted);
                  if (!isMuted) {
                    handleMenuCancel();
                  } else {
                    handleMenuConfirm();
                  }
                }}
                className={`${styles.button} ${styles.buttonOutline}`}
                title={isMuted ? 'Unmute' : 'Mute'}
                data-testid="mute-toggle"
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={isMuted ? 0 : masterVolume}
                onChange={(e) => { const v = parseFloat(e.target.value); setMasterVolume(v); if (isMuted && v > 0) setIsMuted(false); handleVolumeChange() }}
                onMouseUp={handleMenuConfirm}
                onTouchEnd={handleMenuConfirm}
                aria-label="Master volume"
                className={styles.volumeSlider}
              />
            </div>

            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className={`${styles.button} ${styles.buttonOutline}`}
              title={currentLanguage === 'en' ? 'Deutsch' : 'English'}
              data-testid="language-toggle"
            >
              {getLanguageFlag(currentLanguage === 'en' ? 'de' : 'en')}
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className={`${styles.button} ${styles.buttonOutline}`}
              title="Logout"
              data-testid="logout-button"
              onClickCapture={handleMenuCancel}
            >
              <Icon name="game-ui/lobby" size={20} alt="Logout" />
            </button>
          </div>
        </div>

        {mobileMenuOpen && <div className={styles.mobileBackdrop} onClick={closeMenu} />}
      </div>
    </header>
  )
}
