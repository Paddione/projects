import React from 'react'
import styles from '../styles/LoadingSpinner.module.css'

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  text?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  text = 'Loading...' 
}) => {
  return (
    <div className={styles.container}>
      <div 
        data-testid="loading-spinner"
        className={`${styles.spinner} ${styles[size]} spinner`}
      />
      {text && <p className={`${styles.text} ${styles[size]}`}>{text}</p>}
    </div>
  )
} 