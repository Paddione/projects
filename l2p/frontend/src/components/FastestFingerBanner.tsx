import React, { useState, useEffect } from 'react'
import styles from '../styles/FastestFingerBanner.module.css'

interface FastestFingerBannerProps {
  isFirstCorrect: boolean
  playerName: string
  t: (key: string) => string
}

export const FastestFingerBanner: React.FC<FastestFingerBannerProps> = ({
  isFirstCorrect,
  playerName,
  t,
}) => {
  const [visible, setVisible] = useState(false)
  const [hiding, setHiding] = useState(false)

  useEffect(() => {
    if (isFirstCorrect) {
      setVisible(true)
      setHiding(false)

      const hideTimer = setTimeout(() => {
        setHiding(true)
      }, 1700)

      const removeTimer = setTimeout(() => {
        setVisible(false)
        setHiding(false)
      }, 2000)

      return () => {
        clearTimeout(hideTimer)
        clearTimeout(removeTimer)
      }
    } else {
      setVisible(false)
      setHiding(false)
    }
  }, [isFirstCorrect])

  if (!visible) return null

  return (
    <div
      className={`${styles.overlay} ${hiding ? styles.hiding : ''}`}
      data-testid="fastest-finger-banner"
    >
      <div className={styles.banner}>
        <span className={styles.title}>
          {t('game.fastestFinger.first')}
        </span>
        <span className={styles.playerName}>{playerName}</span>
      </div>
    </div>
  )
}
