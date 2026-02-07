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
      <div className={styles.draftPanel} data-testid="perk-draft-panel">
        <div className={styles.completeMessage} data-testid="draft-complete-message">
          {t('draft.complete')}
        </div>
      </div>
    )
  }

  const currentOffer = draftOffers[currentIndex]
  if (!currentOffer) return null

  if (currentOffer.perks.length === 0) {
    return (
      <div className={styles.draftPanel} data-testid="perk-draft-panel">
        <div className={styles.exhaustedMessage} data-testid="draft-pool-exhausted">
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
    <div className={styles.draftPanel} data-testid="perk-draft-panel">
      <div className={styles.draftHeader} data-testid="draft-header">
        <div className={styles.draftTitle} data-testid="draft-title">
          Level {currentOffer.level}! {t('draft.chooseTitle')}
        </div>
        {draftOffers.length > 1 && (
          <div className={styles.draftProgress} data-testid="draft-progress">
            Draft {currentIndex + 1}/{draftOffers.length}
          </div>
        )}
      </div>

      <div className={styles.cardsContainer} data-testid="draft-cards-container">
        {currentOffer.perks.map((perk: DraftPerk, index: number) => (
          <div
            key={perk.id}
            className={`${styles.perkCard} ${getCategoryCardClass(perk.category)}`}
            data-testid={`draft-perk-card-${index}`}
            data-perk-id={perk.id}
            data-perk-category={perk.category}
          >
            <div className={`${styles.categoryStripe} ${getCategoryStripeClass(perk.category)}`} />
            <div className={styles.perkIcon}>
              {CATEGORY_ICONS[perk.category] || '\u2728'}
            </div>
            <div className={styles.perkName} data-testid={`draft-perk-name-${index}`}>{perk.name}</div>
            <div className={styles.perkTier} data-testid={`draft-perk-tier-${index}`}>{getTierLabel(perk.tier)}</div>
            <div className={styles.perkDescription} data-testid={`draft-perk-description-${index}`}>{perk.description}</div>
            <button
              className={styles.pickButton}
              onClick={() => handlePick(perk.id)}
              disabled={isLoading}
              data-testid={`draft-pick-button-${index}`}
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
        data-testid="draft-dump-all-button"
      >
        {t('draft.dumpAll')}
      </button>

      {showDumpConfirm && (
        <div className={styles.confirmOverlay} onClick={() => setShowDumpConfirm(false)} data-testid="dump-confirm-overlay">
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()} data-testid="dump-confirm-dialog">
            <div className={styles.confirmTitle}>{t('draft.confirmTitle')}</div>
            <div className={styles.confirmText}>{t('draft.confirmText')}</div>
            <div className={styles.confirmActions}>
              <button className={styles.confirmYes} onClick={handleDump} disabled={isLoading} data-testid="dump-confirm-yes">
                {t('draft.confirmYes')}
              </button>
              <button className={styles.confirmNo} onClick={() => setShowDumpConfirm(false)} data-testid="dump-confirm-no">
                {t('draft.confirmNo')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
