import React from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from './ThemeProvider'
import { apiService } from '../services/apiService'
import styles from '../styles/App.module.css'
import { useAudio } from '../hooks/useAudio'

export const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme()
  const currentUser = apiService.getCurrentUser()
  const isAdmin = !!currentUser?.isAdmin
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

  return (
    <header className={styles.header} role="banner">
      <div className={styles.headerContent}>
        <a href="/" className={styles.logo}>
          Learn2Play Quiz
        </a>
        
        <nav className={`${styles.flex} ${styles.gapMd} ${styles.itemsCenter}`} role="navigation">
          <a href="/" className={`${styles.button} ${styles.buttonOutline}`} data-testid="home-page" onClick={handleMenuSelect}>
            Home
          </a>
          <a href="/profile" className={`${styles.button} ${styles.buttonOutline}`} data-testid="profile-link" onClick={handleMenuSelect}>
            Profile
          </a>
          <a href="/question-sets" className={`${styles.button} ${styles.buttonOutline}`} onClick={handleMenuSelect}>
            Question Sets
          </a>
          {isAdmin && (
            <Link to="/admin" className={`${styles.button} ${styles.buttonOutline}`} data-testid="admin-dashboard-link" onClick={handleMenuSelect}>
              Admin
            </Link>
          )}
        </nav>
        
        <div className={`${styles.flex} ${styles.gapMd} ${styles.itemsCenter}`} data-testid="user-menu">
          {/* Volume/Mute Controls */}
          <div className={`${styles.flex} ${styles.itemsCenter} ${styles.gapSm}`} style={{ minWidth: 180 }}>
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
              style={{ width: 100 }}
            />
          </div>

          
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`${styles.button} ${styles.buttonOutline}`}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            data-testid="theme-toggle"
            onClickCapture={handleMenuSelect}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className={`${styles.button} ${styles.buttonOutline}`}
            title="Logout"
            data-testid="logout-button"
            onClickCapture={handleMenuCancel}
          >
            🚪
          </button>
        </div>
      </div>
    </header>
  )
} 
