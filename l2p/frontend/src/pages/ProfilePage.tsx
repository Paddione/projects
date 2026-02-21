import React, { useEffect, useState } from 'react'
import { apiService } from '../services/apiService'
import { CharacterDisplay } from '../components/CharacterDisplay'
import { ErrorDisplay } from '../components/ErrorBoundary'
import { ChangePasswordForm } from '../components/ChangePasswordForm'
import PerksManager from '../components/PerksManager'
import styles from '../styles/ProfilePage.module.css'
import appStyles from '../styles/App.module.css'
import { Link } from 'react-router-dom'
import { useLocalization } from '../hooks/useLocalization'

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
  const { t } = useLocalization()
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
        setError(response.error || t('profile.failedToLoad'))
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('profile.failedToLoad')
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
        setError(response.error || t('profile.failedToUpdate'))
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('profile.failedToUpdate')
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
    if (level >= 50) return t('profile.legendaryScholar')
    if (level >= 25) return t('profile.distinguishedProfessor')
    if (level >= 10) return t('profile.experiencedStudent')
    return t('profile.noviceLearner')
  }

  if (isLoading) {
    return (
      <div className={styles.profileContainer}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner} />
          <p>{t('profile.loadingProfile')}</p>
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
          {t('profile.retry')}
        </button>
      </div>
    )
  }

  if (!profileData) {
    return (
      <div className={styles.profileContainer}>
        <div className={styles.errorContainer}>
          <p>{t('profile.noData')}</p>
          <button
            onClick={loadProfile}
            className={styles.retryButton}
          >
            {t('profile.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.profileContainer}>
      <div className={styles.profileHeader}>
        <h1>{t('profile.title')}</h1>
        <p>{t('profile.subtitle')}</p>
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={styles.changePasswordButton || styles.retryButton}
            onClick={() => setShowChangePassword(prev => !prev)}
          >
            {showChangePassword ? t('profile.closeChangePassword') : t('profile.changePassword')}
          </button>
          <button
            type="button"
            className={styles.changePasswordButton || styles.retryButton}
            onClick={() => setShowPerks(prev => !prev)}
            data-testid="perks-button"
          >
            {showPerks ? t('profile.closePerks') : t('profile.perks')}
          </button>
          {isAdmin && (
            <Link
              to="/admin"
              className={`${appStyles.button} ${appStyles.buttonOutline}`}
              data-testid="admin-dashboard-link"
            >
              {t('profile.admin')}
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
                <h2>{t('profile.perksManager')}</h2>
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
            <h2>{t('profile.currentCharacter')}</h2>
            {isUpdating && (
              <span className={styles.updatingLabel}>{t('profile.updating')}</span>
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
          <h2>{t('profile.levelProgress')}</h2>

          <div className={styles.levelInfo}>
            <div className={styles.levelBadge} style={{ backgroundColor: getLevelColor(profileData.level) }}>
              <span className={styles.levelNumber}>{profileData.level}</span>
            </div>
            <div className={styles.levelDetails}>
              <h3>{getLevelTitle(profileData.level)}</h3>
              <p>{profileData.experience.toLocaleString()} {t('profile.totalXp')}</p>
            </div>
          </div>

          <div className={styles.progressBar}>
            <div className={styles.progressLabel}>
              <span>{t('profile.levelProgressLabel', { level: profileData.progress.currentLevel })}</span>
              <span>{profileData.progress.expInLevel} / {profileData.progress.expForNextLevel} XP</span>
            </div>
            <div className={styles.progressBarContainer}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${profileData.progress.progress}%` }}
              />
            </div>
            <div className={styles.progressPercentage}>
              {Math.round(profileData.progress.progress)}{t('profile.complete')}
            </div>
          </div>

          {profileData.progress.expForNextLevel > 0 && (
            <div className={styles.nextLevelInfo}>
              <p>
                <strong>{profileData.progress.expForNextLevel - profileData.progress.expInLevel} XP</strong>
                {' '}{t('profile.neededForLevel', { level: profileData.level + 1 })}
              </p>
            </div>
          )}
        </div>

        {/* Available Characters Section */}
        <div className={styles.availableCharactersSection}>
          <h2>{t('profile.availableCharacters')}</h2>
          <p>{t('profile.unlockByLevel')}</p>

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
                        <span className={styles.unlocked}>✓ {t('profile.unlocked')}</span>
                        {isCurrent ? (
                          <span className={styles.currentBadge}>{t('profile.current')}</span>
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
                            {isUpdating ? t('profile.selecting') : t('profile.select')}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className={styles.unlockStatus}>
                        <span className={styles.locked}>🔒 {t('profile.unlockAtLevel', { level: character.unlockLevel })}</span>
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
