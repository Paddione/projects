import React, { useEffect } from 'react'
import styles from '../styles/CharacterSelector.module.css'
import { useCharacterStore, useAvailableCharacters, useCharacterLoading, useCharacterUpdating } from '../stores/characterStore'
import { CharacterDisplay } from './CharacterDisplay'
import { useLocalization } from '../hooks/useLocalization'

interface CharacterSelectorProps {
  selectedCharacter: string
  onCharacterSelect: (characterId: string) => void
  className?: string
  showLevels?: boolean
  skipServerUpdate?: boolean
}

export const CharacterSelector: React.FC<CharacterSelectorProps> = ({
  selectedCharacter,
  onCharacterSelect,
  className = '',
  showLevels = true,
  skipServerUpdate = false
}) => {
  const { loadCharacters, updateCharacter } = useCharacterStore()
  const availableCharacters = useAvailableCharacters()
  const isLoading = useCharacterLoading()
  const isUpdating = useCharacterUpdating()
  const { t } = useLocalization()

  useEffect(() => {
    loadCharacters()
  }, [loadCharacters])

  const handleCharacterSelect = async (characterId: string) => {
    if (skipServerUpdate) {
      onCharacterSelect(characterId)
      return
    }
    const success = await updateCharacter(characterId)
    if (success) {
      onCharacterSelect(characterId)
    }
  }

  if (isLoading) {
    return (
      <div className={`${styles.characterSelector} ${className}`.trim()}>
        <div className={styles.loading}>{t('character.loading')}</div>
      </div>
    )
  }

  return (
    <div className={`${styles.characterSelector} ${className}`.trim()}>
      <label className={styles.label}>{t('character.chooseTitle')}</label>
      <p className={styles.description}>
        {t('character.chooseDescription')}
      </p>
      
      <div className={styles.characterGrid}>
        {availableCharacters.map((character) => (
          <button
            key={character.id}
            className={
              selectedCharacter === character.id 
                ? `${styles.characterButton} ${styles.selected} selected` 
                : styles.characterButton
            }
            onClick={() => handleCharacterSelect(character.id)}
            type="button"
            title={character.description}
            disabled={isUpdating && !skipServerUpdate}
            data-testid={`character-${character.id}`}
          >
            {showLevels ? (
              <CharacterDisplay
                character={character}
                level={1} // Default level for selection
                size="small"
                showLevel={true}
                showProgress={false}
              />
            ) : (
              <>
                <span className={styles.characterEmoji}>{character.emoji}</span>
                <span className={styles.characterName}>{character.name}</span>
              </>
            )}
          </button>
        ))}
      </div>
      
      {isUpdating && !skipServerUpdate && (
        <div className={styles.updating}>{t('character.updating')}</div>
      )}
    </div>
  )
} 