import React, { useEffect, useState } from 'react'
import { apiService } from '../services/apiService'
import { CharacterDisplay } from '../components/CharacterDisplay'
import { ErrorDisplay } from '../components/ErrorBoundary'
import { ChangePasswordForm } from '../components/ChangePasswordForm'
import PerksManager from '../components/PerksManager'
import styles from '../styles/ProfilePage.module.css'
import appStyles from '../styles/App.module.css'
import { Link } from 'react-router-dom'

interface ProfileData {
  character: {
    id: string
    name: string
    emoji: string
    description: string
    unlockLevel: number
  }
  level: number
  experience: number
  progress: {
    currentLevel: number
    progress: number
    expInLevel: number
    expForNextLevel: number
  }
  availableCharacters: Array<{
    id: string
    name: string
    emoji: string
    description: string
    unlockLevel: number
  }>
}

export const ProfilePage: React.FC = () => {
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showPerks, setShowPerks] = useState(false)
  const currentUser = apiService.getCurrentUser()
  const isAdmin = !!currentUser?.isAdmin

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await apiService.getCharacterProfile()
      if (response.success && response.data) {
        setProfileData(response.data)
      } else {
        console.error('ProfilePage: Failed to load profile:', response.error);
        setError(response.error || 'Failed to load profile')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCharacterSelect = async (characterId: string) => {
    try {
      setIsUpdating(true)
      setError(null)

      const response = await apiService.updateCharacter(characterId)
      if (response.success && response.data) {
        setProfileData(response.data.characterInfo)
      } else {
        setError(response.error || 'Failed to update character')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update character'
      setError(errorMessage)
    } finally {
      setIsUpdating(false)
    }
  }

  const getLevelColor = (level: number): string => {
    if (level >= 50) return '#FFD700' // Gold
    if (level >= 25) return '#C0C0C0' // Silver
    if (level >= 10) return '#CD7F32' // Bronze
    return '#4F46E5' // Default blue
  }

  const getLevelTitle = (level: number): string => {
    if (level >= 50) return 'Legendary Scholar'
    if (level >= 25) return 'Distinguished Professor'
    if (level >= 10) return 'Experienced Student'
    return 'Novice Learner'
  }

  if (isLoading) {
    return (
      <div className={styles.profileContainer}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner} />
          <p>Loading your profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.profileContainer}>
        <ErrorDisplay
          error={error}
          onClear={() => setError(null)}
        />
        <button
          onClick={loadProfile}
          className={styles.retryButton}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!profileData) {
    return (
      <div className={styles.profileContainer}>
        <div className={styles.errorContainer}>
          <p>No profile data available</p>
          <button
            onClick={loadProfile}
            className={styles.retryButton}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.profileContainer}>
      <div className={styles.profileHeader}>
        <h1>Your Profile</h1>
        <p>Manage your character and track your progress</p>
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={styles.changePasswordButton || styles.retryButton}
            onClick={() => setShowChangePassword(prev => !prev)}
          >
            {showChangePassword ? 'Close Change Password' : 'Change Password'}
          </button>
          <button
            type="button"
            className={styles.changePasswordButton || styles.retryButton}
            onClick={() => setShowPerks(prev => !prev)}
            data-testid="perks-button"
          >
            {showPerks ? 'Close Perks' : 'Perks'}
          </button>
          {isAdmin && (
            <Link
              to="/admin"
              className={`${appStyles.button} ${appStyles.buttonOutline}`}
              data-testid="admin-dashboard-link"
            >
              Admin
            </Link>
          )}
        </div>
      </div>

      <div className={styles.profileContent}>
        {showChangePassword && (
          <div style={{ marginBottom: '1.5rem' }}>
            <ChangePasswordForm onClose={() => setShowChangePassword(false)} />
          </div>
        )}
        {showPerks && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div className={styles.perksSection}>
              <div className={styles.sectionHeader}>
                <h2>Perks Manager</h2>
                <button
                  type="button"
                  onClick={() => setShowPerks(false)}
                  className={styles.closeButton}
                  style={{ fontSize: '1.2rem', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              <PerksManager />
            </div>
          </div>
        )}
        {/* Current Character Section */}
        <div className={styles.characterSection}>
          <div className={styles.sectionHeader}>
            <h2>Current Character</h2>
            {isUpdating && (
              <span className={styles.updatingLabel}>Updating...</span>
            )}
          </div>

          <div className={styles.currentCharacter}>
            <CharacterDisplay
              character={profileData.character}
              level={profileData.level}
              experience={profileData.experience}
              progress={profileData.progress}
              showLevel={true}
              showProgress={true}
              size="large"
            />
          </div>
        </div>

        {/* Level Progress Section */}
        <div className={styles.progressSection}>
          <h2>Level Progress</h2>

          <div className={styles.levelInfo}>
            <div className={styles.levelBadge} style={{ backgroundColor: getLevelColor(profileData.level) }}>
              <span className={styles.levelNumber}>{profileData.level}</span>
            </div>
            <div className={styles.levelDetails}>
              <h3>{getLevelTitle(profileData.level)}</h3>
              <p>{profileData.experience.toLocaleString()} total experience points</p>
            </div>
          </div>

          <div className={styles.progressBar}>
            <div className={styles.progressLabel}>
              <span>Level {profileData.progress.currentLevel} Progress</span>
              <span>{profileData.progress.expInLevel} / {profileData.progress.expForNextLevel} XP</span>
            </div>
            <div className={styles.progressBarContainer}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${profileData.progress.progress}%` }}
              />
            </div>
            <div className={styles.progressPercentage}>
              {Math.round(profileData.progress.progress)}% complete
            </div>
          </div>

          {profileData.progress.expForNextLevel > 0 && (
            <div className={styles.nextLevelInfo}>
              <p>
                <strong>{profileData.progress.expForNextLevel - profileData.progress.expInLevel} XP</strong>
                {' '}needed for level {profileData.level + 1}
              </p>
            </div>
          )}
        </div>

        {/* Available Characters Section */}
        <div className={styles.availableCharactersSection}>
          <h2>Available Characters</h2>
          <p>Unlock new characters by reaching higher levels</p>

          <div className={styles.charactersGrid}>
            {profileData.availableCharacters.map((character) => {
              const isUnlocked = profileData.level >= character.unlockLevel
              const isCurrent = character.id === profileData.character.id

              return (
                <div
                  key={character.id}
                  className={`${styles.characterCard} ${isCurrent ? styles.current : ''} ${!isUnlocked ? styles.locked : ''}`}
                  onClick={() => {
                    if (isUnlocked && !isCurrent && !isUpdating) {
                      handleCharacterSelect(character.id)
                    }
                  }}
                  role={isUnlocked && !isCurrent ? 'button' : undefined}
                  aria-disabled={!isUnlocked || isCurrent || isUpdating}
                >
                  <div className={styles.characterCardContent}>
                    <span className={styles.characterEmoji}>{character.emoji}</span>
                    <h4>{character.name}</h4>
                    <p>{character.description}</p>

                    {isUnlocked ? (
                      <div className={styles.unlockStatus}>
                        <span className={styles.unlocked}>✓ Unlocked</span>
                        {isCurrent ? (
                          <span className={styles.currentBadge}>Current</span>
                        ) : (
                          <button
                            type="button"
                            className={styles.selectButton}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!isUpdating) handleCharacterSelect(character.id)
                            }}
                            disabled={isUpdating}
                          >
                            {isUpdating ? 'Selecting...' : 'Select'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className={styles.unlockStatus}>
                        <span className={styles.locked}>🔒 Unlock at level {character.unlockLevel}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
} 
