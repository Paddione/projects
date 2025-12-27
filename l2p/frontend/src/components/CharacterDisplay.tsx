import React from 'react'
import styles from '../styles/CharacterDisplay.module.css'
import { Character } from '../types'
import { avatarService } from '../services/avatarService'

interface CharacterDisplayProps {
  character: Character
  level: number
  experience?: number
  progress?: {
    currentLevel: number
    progress: number
    expInLevel: number
    expForNextLevel: number
  }
  showLevel?: boolean
  showProgress?: boolean
  size?: 'small' | 'medium' | 'large'
  className?: string
}

export const CharacterDisplay: React.FC<CharacterDisplayProps> = ({
  character,
  level,
  experience,
  progress,
  showLevel = true,
  showProgress = false,
  size = 'medium',
  className = ''
}) => {
  const getLevelColor = (level: number): string => {
    if (level >= 50) return '#FFD700' // Gold for high levels
    if (level >= 25) return '#C0C0C0' // Silver for mid-high levels
    if (level >= 10) return '#CD7F32' // Bronze for mid levels
    return '#4F46E5' // Default blue for low levels
  }

  const getSizeClass = (size: string): string => {
    switch (size) {
      case 'small': return styles.small
      case 'large': return styles.large
      default: return styles.medium
    }
  }

  return (
    <div className={`${styles.characterDisplay} ${getSizeClass(size)} ${className}`.trim()}>
      <div className={styles.characterContainer}>
        <div className={styles.characterAvatar}>
          <span className={styles.characterEmoji}>
            {avatarService.getAvatarEmoji(character.id) || character.emoji}
          </span>
          {showLevel && (
            <div 
              className={styles.levelBadge}
              style={{ backgroundColor: getLevelColor(level) }}
            >
              {level}
            </div>
          )}
        </div>
        
        {showProgress && progress && (
          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill}
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            <div className={styles.progressText}>
              {progress.expInLevel} / {progress.expForNextLevel} XP
            </div>
          </div>
        )}
      </div>
      
      {size !== 'small' && (
        <div className={styles.characterInfo}>
          <div className={styles.characterName}>{character.name}</div>
          {experience !== undefined && (
            <div className={styles.experienceText}>
              {experience.toLocaleString()} XP
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CharacterDisplay 