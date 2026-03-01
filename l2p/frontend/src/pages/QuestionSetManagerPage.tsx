import React from 'react'
import { QuestionSetManager } from '../components/QuestionSetManager'
import { ErrorDisplay } from '../components/ErrorBoundary'
import { useLocalization } from '../hooks/useLocalization'
import { useGameStore } from '../stores/gameStore'
import styles from '../styles/App.module.css'

export const QuestionSetManagerPage: React.FC = () => {
  const { t } = useLocalization()
  const { error, setError } = useGameStore()

  return (
    <div className={styles.container}>
      {/* Error Display */}
      <ErrorDisplay
        error={error}
        onClear={() => setError(null)}
        onRetry={() => window.location.reload()}
      />

      <div>
        <h1>{t('questionSets.pageTitle')}</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          {t('questionSets.pageSubtitle')}
        </p>
      </div>

      <QuestionSetManager />
    </div>
  )
} 
