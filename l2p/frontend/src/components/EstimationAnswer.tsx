import React, { useState } from 'react'
import { Question } from '../stores/gameStore'
import styles from '../styles/EstimationAnswer.module.css'

interface AnswerComponentProps {
  question: Question
  onSubmit: (answer: string) => void
  disabled: boolean
  t: (key: string) => string
}

export const EstimationAnswer: React.FC<AnswerComponentProps> = ({
  question,
  onSubmit,
  disabled,
  t,
}) => {
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    if (disabled || submitted || !value.trim()) return
    setSubmitted(true)
    onSubmit(value.trim())
  }

  // Show proximity feedback after submission if metadata is available
  const showProximity = submitted && question.answerMetadata?.correct_value !== undefined
  let proximityClass = ''
  if (showProximity) {
    const correctValue = question.answerMetadata!.correct_value!
    const tolerance = question.answerMetadata!.tolerance ?? 0
    const diff = Math.abs(Number(value) - correctValue)
    proximityClass = diff <= tolerance ? styles.proximityClose : styles.proximityFar
  }

  return (
    <div className={styles.container} data-testid="estimation-area">
      <div className={styles.inputRow}>
        <input
          type="number"
          className={styles.numberInput}
          placeholder={t('game.enterEstimate')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSubmit()
            }
          }}
          disabled={disabled || submitted}
          autoFocus
          data-testid="estimation-input"
        />
        <button
          className={styles.submitButton}
          onClick={handleSubmit}
          disabled={disabled || submitted || !value.trim()}
          data-testid="estimation-submit"
        >
          {t('game.submitFreeText')}
        </button>
      </div>
      {showProximity && (
        <div className={`${styles.proximityFeedback} ${proximityClass}`} data-testid="estimation-feedback">
          {proximityClass === styles.proximityClose
            ? t('game.estimationClose')
            : t('game.estimationFar')}
        </div>
      )}
    </div>
  )
}
