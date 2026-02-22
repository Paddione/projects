import React, { useState } from 'react'
import { Question } from '../stores/gameStore'
import styles from '../styles/TrueFalseAnswer.module.css'

interface AnswerComponentProps {
  question: Question
  onSubmit: (answer: string) => void
  disabled: boolean
  t: (key: string) => string
}

export const TrueFalseAnswer: React.FC<AnswerComponentProps> = ({
  question,
  onSubmit,
  disabled,
  t,
}) => {
  const [selected, setSelected] = useState<string | null>(null)

  const handleClick = (value: string) => {
    if (disabled || selected) return
    setSelected(value)
    onSubmit(value)
  }

  return (
    <div className={styles.container} data-testid="true-false-area">
      <button
        className={`${styles.choiceButton} ${styles.trueButton} ${selected === 'True' ? styles.selected : ''}`}
        onClick={() => handleClick('True')}
        disabled={disabled || selected !== null}
        data-testid="true-false-true"
      >
        {t('game.true')}
      </button>
      <button
        className={`${styles.choiceButton} ${styles.falseButton} ${selected === 'False' ? styles.selected : ''}`}
        onClick={() => handleClick('False')}
        disabled={disabled || selected !== null}
        data-testid="true-false-false"
      >
        {t('game.false')}
      </button>
    </div>
  )
}
