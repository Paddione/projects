import React, { useState } from 'react'
import styles from '../styles/PerkDraftPanel.module.css'
import { localizationService } from '../services/localization'
import type { DraftOfferResult } from '../stores/gameStore'

interface DraftPerk {
  id: number
  name: string
  description: string
  category: string
  tier: number
  effect_type: string
  effect_config: Record<string, any>
}

interface PerkDraftPanelProps {
  draftOffers: DraftOfferResult[]
  currentIndex: number
  onPick: (level: number, perkId: number) => Promise<boolean>
  onDump: (level: number) => Promise<boolean>
  onComplete: () => void
  isLoading?: boolean
}

const CATEGORY_ICONS: Record<string, string> = {
  time: '\u23F1\uFE0F',
  info: '\uD83D\uDCA1',
  scoring: '\u2B50',
  recovery: '\uD83D\uDEE1\uFE0F',
  xp: '\uD83D\uDCDA',
}

const getCategoryCardClass = (category: string): string => {
  switch (category) {
    case 'time': return styles.categoryTimeCard
    case 'info': return styles.categoryInfoCard
    case 'scoring': return styles.categoryScoringCard
    case 'recovery': return styles.categoryRecoveryCard
    case 'xp': return styles.categoryXpCard
    default: return ''
  }
}

const getCategoryStripeClass = (category: string): string => {
  switch (category) {
    case 'time': return styles.categoryTime
    case 'info': return styles.categoryInfo
    case 'scoring': return styles.categoryScoring
    case 'recovery': return styles.categoryRecovery
    case 'xp': return styles.categoryXp
    default: return ''
  }
}

const getTierLabel = (tier: number): string => {
  switch (tier) {
    case 1: return 'Tier I'
    case 2: return 'Tier II'
    case 3: return 'Tier III'
    default: return `Tier ${tier}`
  }
}

export const PerkDraftPanel: React.FC<PerkDraftPanelProps> = ({
  draftOffers,
  currentIndex,
  onPick,
  onDump,
  onComplete,
  isLoading = false,
}) => {
  const [showDumpConfirm, setShowDumpConfirm] = useState(false)
  const t = localizationService.t.bind(localizationService)

  if (currentIndex >= draftOffers.length) {
    return (
      <div className={styles.draftPanel}>
        <div className={styles.completeMessage}>
          {t('draft.complete')}
        </div>
      </div>
    )
  }

  const currentOffer = draftOffers[currentIndex]
  if (!currentOffer) return null

  if (currentOffer.perks.length === 0) {
    return (
      <div className={styles.draftPanel}>
        <div className={styles.exhaustedMessage}>
          {t('draft.poolExhausted')}
        </div>
      </div>
    )
  }

  const handlePick = async (perkId: number) => {
    const success = await onPick(currentOffer.level, perkId)
    if (success && currentIndex + 1 >= draftOffers.length) {
      onComplete()
    }
  }

  const handleDump = async () => {
    setShowDumpConfirm(false)
    const success = await onDump(currentOffer.level)
    if (success && currentIndex + 1 >= draftOffers.length) {
      onComplete()
    }
  }

  return (
    <div className={styles.draftPanel}>
      <div className={styles.draftHeader}>
        <div className={styles.draftTitle}>
          Level {currentOffer.level}! {t('draft.chooseTitle')}
        </div>
        {draftOffers.length > 1 && (
          <div className={styles.draftProgress}>
            Draft {currentIndex + 1}/{draftOffers.length}
          </div>
        )}
      </div>

      <div className={styles.cardsContainer}>
        {currentOffer.perks.map((perk: DraftPerk) => (
          <div
            key={perk.id}
            className={`${styles.perkCard} ${getCategoryCardClass(perk.category)}`}
          >
            <div className={`${styles.categoryStripe} ${getCategoryStripeClass(perk.category)}`} />
            <div className={styles.perkIcon}>
              {CATEGORY_ICONS[perk.category] || '\u2728'}
            </div>
            <div className={styles.perkName}>{perk.name}</div>
            <div className={styles.perkTier}>{getTierLabel(perk.tier)}</div>
            <div className={styles.perkDescription}>{perk.description}</div>
            <button
              className={styles.pickButton}
              onClick={() => handlePick(perk.id)}
              disabled={isLoading}
            >
              {t('draft.choose')}
            </button>
          </div>
        ))}
      </div>

      <button
        className={styles.dumpButton}
        onClick={() => setShowDumpConfirm(true)}
        disabled={isLoading}
      >
        {t('draft.dumpAll')}
      </button>

      {showDumpConfirm && (
        <div className={styles.confirmOverlay} onClick={() => setShowDumpConfirm(false)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmTitle}>{t('draft.confirmTitle')}</div>
            <div className={styles.confirmText}>{t('draft.confirmText')}</div>
            <div className={styles.confirmActions}>
              <button className={styles.confirmYes} onClick={handleDump} disabled={isLoading}>
                {t('draft.confirmYes')}
              </button>
              <button className={styles.confirmNo} onClick={() => setShowDumpConfirm(false)}>
                {t('draft.confirmNo')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
