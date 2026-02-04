import React, { useEffect, useState } from 'react'
import styles from '../styles/SkillTree.module.css'
import { usePerkDraftStore } from '../stores/perkDraftStore'
import { localizationService } from '../services/localization'

const CATEGORY_ICONS: Record<string, string> = {
  time: '\u23F1\uFE0F',
  info: '\uD83D\uDCA1',
  scoring: '\u2B50',
  recovery: '\uD83D\uDEE1\uFE0F',
  xp: '\uD83D\uDCDA',
}

const getCategoryNodeClass = (category: string): string => {
  switch (category) {
    case 'time': return styles.nodeChosenTime
    case 'info': return styles.nodeChosenInfo
    case 'scoring': return styles.nodeChosenScoring
    case 'recovery': return styles.nodeChosenRecovery
    case 'xp': return styles.nodeChosenXp
    default: return ''
  }
}

export const SkillTree: React.FC = () => {
  const {
    skillTreeData,
    loadSkillTreeData,
    resetAllDrafts,
    isLoading,
    redraftInProgress,
  } = usePerkDraftStore()
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const t = localizationService.t.bind(localizationService)

  useEffect(() => {
    loadSkillTreeData()
  }, [loadSkillTreeData])

  if (!skillTreeData) {
    return (
      <div className={styles.skillTreeContainer}>
        <div className={styles.skillTreeTitle}>{t('skillTree.title')}</div>
        {isLoading ? <p>{t('skillTree.loading')}</p> : <p>{t('skillTree.noData')}</p>}
      </div>
    )
  }

  const { history, allPerks, maxLevel, currentLevel } = skillTreeData
  const perkMap = new Map(allPerks.map(p => [p.id, p]))
  const historyMap = new Map(history.map(h => [h.level, h]))
  const pickedCount = history.filter(h => h.chosenPerkId !== null).length

  const handleReset = async () => {
    setShowResetConfirm(false)
    const success = await resetAllDrafts()
    if (success) {
      await loadSkillTreeData()
    }
  }

  const levels = Array.from({ length: maxLevel }, (_, i) => i + 1)

  return (
    <div className={styles.skillTreeContainer}>
      <div className={styles.skillTreeHeader}>
        <div>
          <div className={styles.skillTreeTitle}>{t('skillTree.title')}</div>
          <div className={styles.skillTreeProgress}>
            {pickedCount}/{maxLevel} Perks
          </div>
        </div>
        <button
          className={styles.resetButton}
          onClick={() => setShowResetConfirm(true)}
          disabled={isLoading || redraftInProgress || pickedCount === 0}
        >
          {t('skillTree.reset')}
        </button>
      </div>

      <div className={styles.treePath}>
        {levels.map((level) => {
          const record = historyMap.get(level)
          const isReached = level <= currentLevel
          const chosenPerk = record?.chosenPerkId ? perkMap.get(record.chosenPerkId) : null
          const isDumped = record?.dumped === true
          const isPending = isReached && !record

          let nodeClass = styles.nodeEmpty
          if (chosenPerk) {
            nodeClass = `${styles.nodeChosen} ${getCategoryNodeClass(chosenPerk.category)}`
          } else if (isDumped) {
            nodeClass = styles.nodeDumped
          } else if (isPending) {
            nodeClass = styles.nodePending
          }

          return (
            <div key={level} className={styles.treeNode}>
              <div
                className={`${styles.nodeCircle} ${nodeClass}`}
                onMouseEnter={() => setHoveredLevel(level)}
                onMouseLeave={() => setHoveredLevel(null)}
              >
                {chosenPerk
                  ? (CATEGORY_ICONS[chosenPerk.category] || level)
                  : isDumped
                    ? '\u2715'
                    : isPending
                      ? '?'
                      : level}
                {level < maxLevel && <div className={styles.connector} />}
              </div>
              <div className={styles.nodeLevel}>Lv.{level}</div>

              {hoveredLevel === level && chosenPerk && (
                <div className={styles.tooltip}>
                  <div className={styles.tooltipName}>{chosenPerk.name}</div>
                  <div className={styles.tooltipDesc}>{chosenPerk.description}</div>
                </div>
              )}
              {hoveredLevel === level && isDumped && (
                <div className={styles.tooltip}>
                  <div className={styles.tooltipName}>{t('skillTree.dumped')}</div>
                </div>
              )}
              {hoveredLevel === level && isPending && (
                <div className={styles.tooltip}>
                  <div className={styles.tooltipName}>{t('skillTree.pending')}</div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showResetConfirm && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            style={{
              background: 'var(--card-bg, #1e1e1e)', border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-xl)',
              maxWidth: 400, textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: 'var(--spacing-md)' }}>
              {t('skillTree.resetConfirmTitle')}
            </div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)', fontSize: '0.9rem' }}>
              {t('skillTree.resetConfirmText')}
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'center' }}>
              <button
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-lg)', border: 'none',
                  borderRadius: 'var(--radius-md)', background: '#ef5350',
                  color: 'white', fontWeight: 'bold', cursor: 'pointer'
                }}
                onClick={handleReset}
                disabled={isLoading}
              >
                {t('skillTree.resetConfirmYes')}
              </button>
              <button
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-lg)',
                  border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
                  background: 'transparent', color: 'var(--text-primary, white)', cursor: 'pointer'
                }}
                onClick={() => setShowResetConfirm(false)}
              >
                {t('skillTree.resetConfirmNo')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
