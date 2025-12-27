import React from 'react'
import styles from '../styles/ScoreDisplay.module.css'

interface ScoreDisplayProps {
  score: number
  multiplier: number
  correctAnswers: number
  totalQuestions?: number
  showMultiplier?: boolean
  showStreak?: boolean
  className?: string
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  score,
  multiplier,
  correctAnswers,
  totalQuestions,
  showMultiplier = true,
  showStreak = true,
  className = ''
}) => {
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
    <div className={`${styles.scoreDisplay} ${className}`}>
      <div className={styles.scoreSection}>
        <div className={styles.scoreLabel}>Score</div>
        <div className={styles.scoreValue} data-testid="score-value">
          {score.toLocaleString()}
        </div>
      </div>
      
      {showMultiplier && multiplier > 1 && (
        <div className={styles.multiplierSection}>
          <div className={styles.multiplierLabel}>Multiplier</div>
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
          <div className={styles.streakLabel}>Streak</div>
          <div 
            className={`${styles.streakValue} ${getStreakColor(correctAnswers)}`}
            data-testid="streak-value"
          >
            🔥 {correctAnswers}
            {totalQuestions && `/${totalQuestions}`}
          </div>
        </div>
      )}
      
      {totalQuestions && (
        <div className={styles.progressSection}>
          <div className={styles.progressLabel}>Progress</div>
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