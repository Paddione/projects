import React, { useEffect, useState } from 'react'
import styles from '../styles/CharacterSelector.module.css'
import { useCharacterStore, useCharacterLoading, useCharacterUpdating, useOwnedCharacters, useRespectBalance } from '../stores/characterStore'
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
  const { loadCharacters, updateCharacter, characters, purchaseCharacter, loadCharacterProfile } = useCharacterStore()
  const ownedCharacters = useOwnedCharacters()
  const respectBalance = useRespectBalance()
  const [purchaseTarget, setPurchaseTarget] = useState<string | null>(null)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const isLoading = useCharacterLoading()
  const isUpdating = useCharacterUpdating()
  const { t } = useLocalization()

  useEffect(() => {
    loadCharacters()
  }, [loadCharacters])

  const handleCharacterSelect = async (characterId: string) => {
    if (!ownedCharacters.includes(characterId)) {
      setPurchaseTarget(characterId)
      setPurchaseError(null)
      return
    }
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
      {respectBalance > 0 && (
        <div style={{ textAlign: 'right', color: '#ffd700', fontSize: '0.85rem', marginBottom: '8px' }}>
          {respectBalance} ⭐ Respect
        </div>
      )}

      <div className={styles.characterGrid}>
        {characters.map((character) => {
          const isOwned = ownedCharacters.includes(character.id)
          const isSelected = selectedCharacter === character.id
          return (
            <button
              key={character.id}
              className={`${styles.characterButton} ${isSelected ? `${styles.selected} selected` : ''}`.trim()}
              onClick={() => handleCharacterSelect(character.id)}
              type="button"
              title={isOwned ? character.description : `Purchase for 500 Respect`}
              disabled={isUpdating && !skipServerUpdate}
              data-testid={`character-${character.id}`}
              style={!isOwned ? { opacity: 0.5, position: 'relative' } : undefined}
            >
              {showLevels ? (
                <CharacterDisplay
                  character={character}
                  level={1}
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
              {!isOwned && (
                <span style={{ fontSize: '0.7rem', color: '#ffd700', display: 'block' }}>🔒 500</span>
              )}
            </button>
          )
        })}
      </div>

      {purchaseTarget && (() => {
        const char = characters.find(c => c.id === purchaseTarget)
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: '12px', padding: '24px', maxWidth: '320px', textAlign: 'center', color: '#fff' }}>
              <h3 style={{ margin: '0 0 8px' }}>{char?.emoji} {char?.name}</h3>
              <p style={{ color: '#888', margin: '0 0 16px' }}>Purchase for 500 Respect?</p>
              <p style={{ color: '#ffd700', margin: '0 0 16px' }}>Your balance: {respectBalance} ⭐</p>
              {purchaseError && <p style={{ color: '#ff4444', margin: '0 0 12px' }}>{purchaseError}</p>}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={async () => {
                    const result = await purchaseCharacter(purchaseTarget)
                    if (result.success) {
                      setPurchaseTarget(null)
                      await updateCharacter(purchaseTarget)
                      onCharacterSelect(purchaseTarget)
                      await loadCharacterProfile()
                    } else {
                      setPurchaseError(result.error || 'Purchase failed')
                    }
                  }}
                  disabled={respectBalance < 500}
                  style={{ padding: '8px 20px', background: respectBalance >= 500 ? '#00f2ff' : '#333', color: respectBalance >= 500 ? '#000' : '#666', border: 'none', borderRadius: '6px', cursor: respectBalance >= 500 ? 'pointer' : 'not-allowed', fontWeight: 600 }}
                >
                  Buy
                </button>
                <button
                  onClick={() => { setPurchaseTarget(null); setPurchaseError(null) }}
                  style={{ padding: '8px 20px', background: '#333', color: '#ccc', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {isUpdating && !skipServerUpdate && (
        <div className={styles.updating}>{t('character.updating')}</div>
      )}
    </div>
  )
}
