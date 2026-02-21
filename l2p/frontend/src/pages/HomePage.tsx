import React from 'react'
import { GameInterface } from '../components/GameInterface'
import { LobbiesList } from '../components/LobbiesList'
import { apiService } from '../services/apiService'
import { useLocalization } from '../hooks/useLocalization'
import styles from '../styles/App.module.css'
import homeStyles from '../styles/HomePage.module.css'

export const HomePage: React.FC = () => {
  const user = apiService.getCurrentUser()
  const { t } = useLocalization()

  return (
    <div className={styles.container}>
      {user && (
        <div className={`${styles.card} ${styles.textCenter}`} style={{ marginBottom: 'var(--spacing-lg)' }}>
          <div data-testid="welcome-message">
            {t('home.welcomeBack', { name: user.username })}
          </div>
        </div>
      )}
      
      <div className={homeStyles.gameSection}>
        <div className={`${styles.card} ${homeStyles.gameInterface}`}>
          <GameInterface />
        </div>
        
        <div className={`${styles.card} ${homeStyles.lobbiesList}`}>
          <LobbiesList />
        </div>
      </div>
    </div>
  )
} 