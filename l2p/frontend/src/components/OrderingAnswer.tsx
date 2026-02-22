import React, { useState, useCallback } from 'react'
import { Question } from '../stores/gameStore'
import styles from '../styles/OrderingAnswer.module.css'

interface AnswerComponentProps {
  question: Question
  onSubmit: (answer: string) => void
  disabled: boolean
  t: (key: string) => string
}

export const OrderingAnswer: React.FC<AnswerComponentProps> = ({
  question,
  onSubmit,
  disabled,
  t,
}) => {
  const items = question.answerMetadata?.items ?? []
  // Track order as array of original indices
  const [order, setOrder] = useState<number[]>(() => items.map((_, i) => i))
  const [submitted, setSubmitted] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const isDisabled = disabled || submitted

  const moveItem = useCallback((from: number, to: number) => {
    if (isDisabled) return
    setOrder((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved!)
      return next
    })
  }, [isDisabled])

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (isDisabled) return
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    const fromIndex = Number(e.dataTransfer.getData('text/plain'))
    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      moveItem(fromIndex, toIndex)
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleSubmit = () => {
    if (isDisabled) return
    setSubmitted(true)
    onSubmit(JSON.stringify(order))
  }

  if (items.length === 0) {
    return <div data-testid="ordering-area">{t('game.noItems')}</div>
  }

  return (
    <div className={styles.container} data-testid="ordering-area">
      <div className={styles.itemList}>
        {order.map((originalIndex, currentIndex) => (
          <div
            key={originalIndex}
            className={`${styles.item} ${dragIndex === currentIndex ? styles.dragging : ''} ${dragOverIndex === currentIndex ? styles.dragOver : ''} ${isDisabled ? styles.disabled : ''}`}
            draggable={!isDisabled}
            onDragStart={(e) => handleDragStart(e, currentIndex)}
            onDragOver={(e) => handleDragOver(e, currentIndex)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, currentIndex)}
            onDragEnd={handleDragEnd}
            data-testid={`ordering-item-${currentIndex}`}
          >
            <span className={styles.dragHandle} aria-hidden>
              &#8942;&#8942;
            </span>
            <span className={styles.itemIndex}>{currentIndex + 1}</span>
            <span className={styles.itemText}>{items[originalIndex]}</span>
            <div className={styles.arrowButtons}>
              <button
                className={styles.arrowButton}
                onClick={() => moveItem(currentIndex, currentIndex - 1)}
                disabled={isDisabled || currentIndex === 0}
                aria-label={t('game.moveUp')}
                tabIndex={-1}
              >
                &#9650;
              </button>
              <button
                className={styles.arrowButton}
                onClick={() => moveItem(currentIndex, currentIndex + 1)}
                disabled={isDisabled || currentIndex === order.length - 1}
                aria-label={t('game.moveDown')}
                tabIndex={-1}
              >
                &#9660;
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        className={styles.submitButton}
        onClick={handleSubmit}
        disabled={isDisabled}
        data-testid="ordering-submit"
      >
        {t('game.submitFreeText')}
      </button>
    </div>
  )
}
