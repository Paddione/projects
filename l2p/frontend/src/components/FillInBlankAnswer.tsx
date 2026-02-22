import React, { useState, useMemo, useRef } from 'react'
import { Question } from '../stores/gameStore'
import styles from '../styles/FillInBlankAnswer.module.css'

interface AnswerComponentProps {
  question: Question
  onSubmit: (answer: string) => void
  disabled: boolean
  t: (key: string) => string
}

export const FillInBlankAnswer: React.FC<AnswerComponentProps> = ({
  question,
  onSubmit,
  disabled,
  t,
}) => {
  const template = question.answerMetadata?.template ?? ''
  // Split template by blank marker (___) to determine how many blanks
  const parts = useMemo(() => template.split('___'), [template])
  const blankCount = parts.length - 1

  const [values, setValues] = useState<string[]>(() => new Array(Math.max(blankCount, 1)).fill(''))
  const [submitted, setSubmitted] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const isDisabled = disabled || submitted

  const handleChange = (index: number, value: string) => {
    setValues((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (index < blankCount - 1) {
        // Move to next blank
        inputRefs.current[index + 1]?.focus()
      } else {
        handleSubmit()
      }
    } else if (e.key === 'Tab' && !e.shiftKey && index < blankCount - 1) {
      // Natural tab progression
    }
  }

  const handleSubmit = () => {
    if (isDisabled) return
    const hasAnyValue = values.some((v) => v.trim())
    if (!hasAnyValue) return

    setSubmitted(true)
    if (blankCount <= 1) {
      // Single blank - submit as plain text
      onSubmit(values[0]?.trim() || '')
    } else {
      // Multiple blanks - submit as JSON array
      onSubmit(JSON.stringify(values.map((v) => v.trim())))
    }
  }

  const allFilled = values.every((v) => v.trim())

  // If no template, render a simple input (fallback)
  if (!template || blankCount === 0) {
    return (
      <div className={styles.container} data-testid="fill-blank-area">
        <input
          type="text"
          className={styles.blankInput}
          style={{ width: '100%' }}
          placeholder={t('game.enterAnswer')}
          value={values[0] || ''}
          onChange={(e) => handleChange(0, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSubmit()
            }
          }}
          disabled={isDisabled}
          autoFocus
          data-testid="fill-blank-input-0"
        />
        <div className={styles.submitRow}>
          <button
            className={styles.submitButton}
            onClick={handleSubmit}
            disabled={isDisabled || !values[0]?.trim()}
            data-testid="fill-blank-submit"
          >
            {t('game.submitFreeText')}
          </button>
        </div>
      </div>
    )
  }

  // Render template with inline inputs
  let blankIndex = 0
  return (
    <div className={styles.container} data-testid="fill-blank-area">
      <div className={styles.templateText}>
        {parts.map((part, i) => {
          const elements: React.ReactNode[] = [
            <span key={`text-${i}`}>{part}</span>,
          ]
          if (i < parts.length - 1) {
            const idx = blankIndex++
            elements.push(
              <input
                key={`blank-${idx}`}
                ref={(el) => { inputRefs.current[idx] = el }}
                type="text"
                className={styles.blankInput}
                placeholder={`${t('game.blank')} ${idx + 1}`}
                value={values[idx] || ''}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                disabled={isDisabled}
                autoFocus={idx === 0}
                data-testid={`fill-blank-input-${idx}`}
              />
            )
          }
          return elements
        })}
      </div>
      <div className={styles.submitRow}>
        <button
          className={styles.submitButton}
          onClick={handleSubmit}
          disabled={isDisabled || !allFilled}
          data-testid="fill-blank-submit"
        >
          {t('game.submitFreeText')}
        </button>
      </div>
    </div>
  )
}
