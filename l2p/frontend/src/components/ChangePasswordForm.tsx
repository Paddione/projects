import React, { useState } from 'react'
import { apiService } from '../services/apiService'
import { ErrorDisplay } from './ErrorBoundary'
import styles from '../styles/AuthForm.module.css'

interface ChangePasswordFormProps {
  onClose?: () => void
}

export const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({ onClose }) => {
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
      setError('Please ensure your new password meets all requirements')
      setIsLoading(false)
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('New password and confirmation do not match')
      setIsLoading(false)
      return
    }

    try {
      const response = await apiService.changePassword(formData.currentPassword, formData.newPassword)
      if (response.success) {
        setSuccess('Password changed successfully')
        setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' })
        if (onClose) {
          setTimeout(() => onClose(), 1500)
        }
      } else {
        setError(response.error || 'Failed to change password')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to change password'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.header}>
          <h2>Change Password</h2>
          <p>Update your password to keep your account secure</p>
        </div>

        <ErrorDisplay error={error} onClear={() => setError(null)} />

        {success && (
          <div className={styles.successMessage}>
            <p>{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="currentPassword">Current Password</label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              value={formData.currentPassword}
              onChange={handleInputChange}
              placeholder="Enter your current password"
              required
              className={styles.input}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              value={formData.newPassword}
              onChange={handleInputChange}
              placeholder="Enter your new password"
              required
              minLength={8}
              className={styles.input}
            />
            <div className={styles.passwordRequirements}>
              <p>Password must contain:</p>
              <ul>
                <li className={passwordValidation.length ? styles.valid : styles.invalid}>At least 8 characters</li>
                <li className={passwordValidation.lowercase ? styles.valid : styles.invalid}>At least one lowercase letter</li>
                <li className={passwordValidation.uppercase ? styles.valid : styles.invalid}>At least one uppercase letter</li>
                <li className={passwordValidation.number ? styles.valid : styles.invalid}>At least one number</li>
                <li className={passwordValidation.special ? styles.valid : styles.invalid}>At least one special character (@$!%*?&)</li>
              </ul>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Re-enter your new password"
              required
              minLength={8}
              className={styles.input}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Password'}
            </button>
            {onClose && (
              <button type="button" className={`${styles.button} ${styles.buttonOutline}`} onClick={onClose}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
