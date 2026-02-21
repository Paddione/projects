import React, { useState } from 'react'
import { apiService } from '../services/apiService'
import { useLocalization } from '../hooks/useLocalization'
import { ErrorDisplay } from './ErrorBoundary'
import styles from '../styles/AuthForm.module.css'

interface ChangePasswordFormProps {
  onClose?: () => void
}

export const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({ onClose }) => {
  const { t } = useLocalization()
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [passwordValidation, setPasswordValidation] = useState({
    length: false,
    lowercase: false,
    uppercase: false,
    number: false,
    special: false
  })

  // Compute password validation result
  const computePasswordValidation = (password: string) => ({
    length: password.length >= 8,
    lowercase: /(?=.*[a-z])/.test(password),
    uppercase: /(?=.*[A-Z])/.test(password),
    number: /(?=.*\d)/.test(password),
    special: /(?=.*[@$!%*?&])/.test(password)
  })

  const validatePassword = (password: string) => {
    const result = computePasswordValidation(password)
    setPasswordValidation(result)
    return result
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    if (name === 'newPassword') {
      validatePassword(value)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    // Validate passwords
    const validationResult = validatePassword(formData.newPassword)
    const isPasswordValid = Object.values(validationResult).every(Boolean)

    if (!isPasswordValid) {
      setError(t('password.requirementsError'))
      setIsLoading(false)
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError(t('password.mismatchError'))
      setIsLoading(false)
      return
    }

    try {
      const response = await apiService.changePassword(formData.currentPassword, formData.newPassword)
      if (response.success) {
        setSuccess(t('password.success'))
        setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' })
        if (onClose) {
          setTimeout(() => onClose(), 1500)
        }
      } else {
        setError(response.error || t('password.failed'))
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('password.failed')
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.header}>
          <h2>{t('password.title')}</h2>
          <p>{t('password.subtitle')}</p>
        </div>

        <ErrorDisplay error={error} onClear={() => setError(null)} />

        {success && (
          <div className={styles.successMessage}>
            <p>{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="currentPassword">{t('password.currentLabel')}</label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              value={formData.currentPassword}
              onChange={handleInputChange}
              placeholder={t('password.currentPlaceholder')}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="newPassword">{t('password.newLabel')}</label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              value={formData.newPassword}
              onChange={handleInputChange}
              placeholder={t('password.newPlaceholder')}
              required
              minLength={8}
              className={styles.input}
            />
            <div className={styles.passwordRequirements}>
              <p>{t('password.mustContain')}</p>
              <ul>
                <li className={passwordValidation.length ? styles.valid : styles.invalid}>{t('password.minLength')}</li>
                <li className={passwordValidation.lowercase ? styles.valid : styles.invalid}>{t('password.lowercase')}</li>
                <li className={passwordValidation.uppercase ? styles.valid : styles.invalid}>{t('password.uppercase')}</li>
                <li className={passwordValidation.number ? styles.valid : styles.invalid}>{t('password.number')}</li>
                <li className={passwordValidation.special ? styles.valid : styles.invalid}>{t('password.special')}</li>
              </ul>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="confirmPassword">{t('password.confirmLabel')}</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder={t('password.confirmPlaceholder')}
              required
              minLength={8}
              className={styles.input}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={isLoading}>
              {isLoading ? t('password.saving') : t('password.save')}
            </button>
            {onClose && (
              <button type="button" className={`${styles.button} ${styles.buttonOutline}`} onClick={onClose}>
                {t('password.cancel')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
