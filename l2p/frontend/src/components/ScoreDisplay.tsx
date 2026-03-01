import React from 'react'
import { Icon } from './Icon'
import { useLocalization } from '../hooks/useLocalization'
import styles from '../styles/ScoreDisplay.module.css'

interface ScoreDisplayProps {
  score: number
  multiplier: number
  correctAnswers: number
  totalQuestions?: number
  showMultiplier?: boolean
  showStreak?: boolean
  compact?: boolean
  className?: string
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  score,
  multiplier,
  correctAnswers,
  totalQuestions,
  showMultiplier = true,
  showStreak = false,
  compact = false,
  className = ''
}) => {
  const { t } = useLocalization()
  const getMultiplierColor = (mult: number): string => {
    if (mult >= 5) return `${styles.multiplier5} multiplier5`
    if (mult >= 4) return `${styles.multiplier4} multiplier4`
    if (mult >= 3) return `${styles.multiplier3} multiplier3`
    if (mult >= 2) return `${styles.multiplier2} multiplier2`
    return `${styles.multiplier1} multiplier1`
  }

  const getStreakColor = (streak: number): string => {
    if (streak >= 5) return styles.streak5
    if (streak >= 3) return styles.streak3
    if (streak >= 1) return styles.streak1
    return ''
  }

  return (
    <div className={`${styles.scoreDisplay} ${compact ? styles.scoreDisplayCompact : ''} ${className}`}>
      <div className={styles.scoreSection}>
        <div className={styles.scoreLabel}>{t('game.score')}</div>
        <div className={styles.scoreValue} data-testid="score-value">
          {score.toLocaleString()}
        </div>
      </div>

      {showMultiplier && multiplier > 1 && (
        <div className={styles.multiplierSection}>
          <div className={styles.multiplierLabel}>{t('game.multiplier')}</div>
          <div
            className={`${styles.multiplierValue} ${getMultiplierColor(multiplier)}`}
            data-testid="multiplier-value"
          >
            ×{multiplier}
          </div>
        </div>
      )}

      {showStreak && correctAnswers > 0 && (
        <div className={styles.streakSection}>
          <div className={styles.streakLabel}>{t('multiplier.streak')}</div>
          <div
            className={`${styles.streakValue} ${getStreakColor(correctAnswers)}`}
            data-testid="streak-value"
          >
            <Icon name="game-ui/streak" size={20} alt={t('score.streak')} /> {correctAnswers}
            {totalQuestions && `/${totalQuestions}`}
          </div>
        </div>
      )}

      {totalQuestions && (
        <div className={styles.progressSection}>
          <div className={styles.progressLabel}>{t('game.progressLabel')}</div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${(correctAnswers / totalQuestions) * 100}%` }}
              data-testid="progress-fill"
            />
          </div>
          <div className={styles.progressText}>
            {correctAnswers} / {totalQuestions}
          </div>
        </div>
      )}
    </div>
  )
} 