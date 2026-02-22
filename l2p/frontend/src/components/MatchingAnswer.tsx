import React, { useState, useMemo } from 'react'
import { Question } from '../stores/gameStore'
import styles from '../styles/MatchingAnswer.module.css'

interface AnswerComponentProps {
  question: Question
  onSubmit: (answer: string) => void
  disabled: boolean
  t: (key: string) => string
}

interface MatchedPair {
  leftIndex: number
  rightIndex: number
}

const MATCH_COLORS = [
  styles.matchColor0,
  styles.matchColor1,
  styles.matchColor2,
  styles.matchColor3,
  styles.matchColor4,
  styles.matchColor5,
]

export const MatchingAnswer: React.FC<AnswerComponentProps> = ({
  question,
  onSubmit,
  disabled,
  t,
}) => {
  const pairs = question.answerMetadata?.pairs ?? []
  const leftItems = useMemo(() => pairs.map((p) => p.left), [pairs])
  const rightItems = useMemo(() => {
    // Shuffle right items for the player to match
    const indexed = pairs.map((p, i) => ({ text: p.right, originalIndex: i }))
    // Use a seeded shuffle based on question id for consistency
    const shuffled = [...indexed].sort((a, b) => {
      const hash = (question.id || '').charCodeAt(0) || 0
      return ((a.originalIndex * 31 + hash) % 7) - ((b.originalIndex * 31 + hash) % 7)
    })
    return shuffled
  }, [pairs, question.id])

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null)
  const [matched, setMatched] = useState<MatchedPair[]>([])
  const [submitted, setSubmitted] = useState(false)

  const isDisabled = disabled || submitted

  // Track which left/right indices are already matched
  const matchedLeftIndices = new Set(matched.map((m) => m.leftIndex))
  const matchedRightIndices = new Set(matched.map((m) => m.rightIndex))

  // Get color for a matched pair
  const getMatchColor = (pairIndex: number) => MATCH_COLORS[pairIndex % MATCH_COLORS.length]

  const getLeftMatchIndex = (leftIdx: number) => matched.findIndex((m) => m.leftIndex === leftIdx)
  const getRightMatchIndex = (rightOrigIdx: number) => matched.findIndex((m) => m.rightIndex === rightOrigIdx)

  const handleLeftClick = (leftIdx: number) => {
    if (isDisabled || matchedLeftIndices.has(leftIdx)) return
    setSelectedLeft(selectedLeft === leftIdx ? null : leftIdx)
  }

  const handleRightClick = (rightOriginalIdx: number) => {
    if (isDisabled || matchedRightIndices.has(rightOriginalIdx)) return
    if (selectedLeft === null) return

    // Create a match
    const newMatch: MatchedPair = { leftIndex: selectedLeft, rightIndex: rightOriginalIdx }
    setMatched((prev) => [...prev, newMatch])
    setSelectedLeft(null)
  }

  const handleSubmit = () => {
    if (isDisabled) return
    setSubmitted(true)
    // Convert to array of {left, right} text pairs
    const result = matched.map((m) => ({
      left: leftItems[m.leftIndex],
      right: pairs[m.rightIndex]?.right ?? '',
    }))
    onSubmit(JSON.stringify(result))
  }

  const allMatched = matched.length === pairs.length

  if (pairs.length === 0) {
    return <div data-testid="matching-area">{t('game.noItems')}</div>
  }

  return (
    <div className={styles.container} data-testid="matching-area">
      <div className={styles.columns}>
        <div className={styles.column}>
          <div className={styles.columnLabel}>{t('game.matchLeft')}</div>
          {leftItems.map((item, idx) => {
            const matchIdx = getLeftMatchIndex(idx)
            const isMatched = matchIdx >= 0
            const isSelected = selectedLeft === idx
            return (
              <button
                key={idx}
                className={`${styles.item} ${isSelected ? styles.itemSelected : ''} ${isMatched ? `${styles.matched} ${getMatchColor(matchIdx)}` : ''} ${isDisabled ? styles.disabled : ''}`}
                onClick={() => handleLeftClick(idx)}
                disabled={isDisabled || isMatched}
                data-testid={`matching-left-${idx}`}
              >
                {isMatched && <span className={styles.matchIndex}>{matchIdx + 1}</span>}
                {item}
              </button>
            )
          })}
        </div>
        <div className={styles.column}>
          <div className={styles.columnLabel}>{t('game.matchRight')}</div>
          {rightItems.map((item) => {
            const matchIdx = getRightMatchIndex(item.originalIndex)
            const isMatched = matchIdx >= 0
            return (
              <button
                key={item.originalIndex}
                className={`${styles.item} ${isMatched ? `${styles.matched} ${getMatchColor(matchIdx)}` : ''} ${isDisabled ? styles.disabled : ''}`}
                onClick={() => handleRightClick(item.originalIndex)}
                disabled={isDisabled || isMatched || selectedLeft === null}
                data-testid={`matching-right-${item.originalIndex}`}
              >
                {isMatched && <span className={styles.matchIndex}>{matchIdx + 1}</span>}
                {item.text}
              </button>
            )
          })}
        </div>
      </div>
      <div className={styles.pairCount}>
        {matched.length} / {pairs.length} {t('game.pairsMatched')}
      </div>
      <button
        className={styles.submitButton}
        onClick={handleSubmit}
        disabled={isDisabled || !allMatched}
        data-testid="matching-submit"
      >
        {t('game.submitFreeText')}
      </button>
    </div>
  )
}
