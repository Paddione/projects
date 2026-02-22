import React, { useState, useEffect, useCallback } from 'react'
import styles from '../styles/WagerPanel.module.css'

interface WagerPanelProps {
  currentScore: number
  timeLimit: number
  onSubmitWager: (wagerPercent: number) => void
  disabled: boolean
  t: (key: string) => string
}

const QUICK_VALUES = [0, 25, 50, 100]

export const WagerPanel: React.FC<WagerPanelProps> = ({
  currentScore,
  timeLimit,
  onSubmitWager,
  disabled,
  t,
}) => {
  const [wagerPercent, setWagerPercent] = useState(25)
  const [timeLeft, setTimeLeft] = useState(timeLimit)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (disabled || submitted) return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [disabled, submitted])

  useEffect(() => {
    if (timeLeft === 0 && !submitted && !disabled) {
      handleSubmit()
    }
  }, [timeLeft, submitted, disabled])

  const handleSubmit = useCallback(() => {
    if (submitted || disabled) return
    setSubmitted(true)
    onSubmitWager(wagerPercent)
  }, [submitted, disabled, wagerPercent, onSubmitWager])

  const wagerAmount = Math.round((currentScore * wagerPercent) / 100)
  const timerPercent = (timeLeft / timeLimit) * 100
  const timerClass = timeLeft <= 3 ? styles.critical : timeLeft <= 7 ? styles.warning : ''

  if (currentScore <= 0) {
    return (
      <div className={styles.container} data-testid="wager-panel">
        <div className={styles.heading}>{t('game.wager.title')}</div>
        <div className={styles.disabledMessage}>
          {t('game.wager.noScore')}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container} data-testid="wager-panel">
      <div className={styles.heading}>{t('game.wager.title')}</div>

      <div className={styles.timerBar}>
        <div
          className={`${styles.timerFill} ${timerClass}`}
          style={{ width: `${timerPercent}%` }}
          data-testid="wager-timer"
        />
      </div>

      <div className={styles.scoreInfo}>
        {t('game.wager.currentScore')}{' '}
        <span className={styles.scoreValue}>{currentScore.toLocaleString()}</span>
      </div>

      <div className={styles.sliderSection}>
        <div className={styles.sliderLabel}>
          <span className={styles.sliderPercent}>{wagerPercent}</span>
          <span className={styles.sliderUnit}>%</span>
        </div>

        <input
          type="range"
          className={styles.slider}
          min={0}
          max={100}
          step={5}
          value={wagerPercent}
          onChange={(e) => setWagerPercent(Number(e.target.value))}
          disabled={disabled || submitted}
          data-testid="wager-slider"
        />
      </div>

      <div className={styles.preview}>
        <span className={styles.gain}>+{wagerAmount.toLocaleString()}</span>
        <span className={styles.loss}>-{wagerAmount.toLocaleString()}</span>
      </div>

      <div className={styles.quickButtons}>
        {QUICK_VALUES.map((val) => (
          <button
            key={val}
            className={`${styles.quickButton} ${wagerPercent === val ? styles.active : ''}`}
            onClick={() => setWagerPercent(val)}
            disabled={disabled || submitted}
            data-testid={`wager-quick-${val}`}
          >
            {val}%
          </button>
        ))}
      </div>

      <button
        className={styles.submitButton}
        onClick={handleSubmit}
        disabled={disabled || submitted}
        data-testid="wager-submit"
      >
        {t('game.wager.submit')}
      </button>
    </div>
  )
}
