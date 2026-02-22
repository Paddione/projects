import React from 'react'
import styles from '../styles/WagerSlider.module.css'

interface WagerSliderProps {
  currentScore: number
  wagerPercent: number
  onWagerChange: (pct: number) => void
  disabled: boolean
  t: (key: string) => string
}

const QUICK_VALUES = [0, 25, 50, 100]

export const WagerSlider: React.FC<WagerSliderProps> = ({
  currentScore,
  wagerPercent,
  onWagerChange,
  disabled,
  t,
}) => {
  const wagerAmount = Math.round((currentScore * wagerPercent) / 100)

  if (currentScore <= 0) {
    return (
      <div className={styles.container} data-testid="wager-slider">
        <div className={styles.heading}>{t('game.wager.title')}</div>
        <div className={styles.disabledMessage}>
          {t('game.wager.noScore')}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container} data-testid="wager-slider">
      <div className={styles.heading}>{t('game.wager.title')}</div>

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
          onChange={(e) => onWagerChange(Number(e.target.value))}
          disabled={disabled}
          data-testid="wager-slider-input"
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
            onClick={() => onWagerChange(val)}
            disabled={disabled}
            data-testid={`wager-quick-${val}`}
          >
            {val}%
          </button>
        ))}
      </div>
    </div>
  )
}
