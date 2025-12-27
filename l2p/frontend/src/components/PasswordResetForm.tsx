import React, { useEffect, useState } from 'react'
import { apiService } from '../services/apiService'
import { ErrorDisplay } from './ErrorBoundary'
import styles from '../styles/AuthForm.module.css'

interface PasswordResetFormProps {
  onBackToLogin: () => void
  /** Optional: prefilled reset token from URL */
  initialToken?: string
  /** Optional: start step, defaults to 'request' */
  initialStep?: 'request' | 'reset'
}

export const PasswordResetForm: React.FC<PasswordResetFormProps> = ({ onBackToLogin, initialToken, initialStep }) => {
  const [step, setStep] = useState<'request' | 'reset'>(initialStep ?? 'request')
  const [formData, setFormData] = useState({
    email: '',
    token: '',
    newPassword: ''
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

  // If an initial token is provided, prefill it and show reset step
  useEffect(() => {
    if (initialToken && initialToken.trim().length > 0) {
      setFormData(prev => ({ ...prev, token: initialToken }))
      setStep('reset')
    }
  }, [initialToken])

  // Compute password validation result and update UI state
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
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    if (name === 'newPassword') {
      validatePassword(value)
    }
  }

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await apiService.requestPasswordReset(formData.email)
      if (response.success) {
        setSuccess('If the email address exists, a password reset email has been sent')
        setStep('reset')
      } else {
        setError(response.error || 'Failed to send password reset email')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send password reset email'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Validate password before submitting using a synchronous computation to avoid stale state
    const validationResult = validatePassword(formData.newPassword)
    const isPasswordValid = Object.values(validationResult).every(Boolean)
    
    if (!isPasswordValid) {
      setError('Please ensure your password meets all requirements')
      setIsLoading(false)
      return
    }

    try {
      const response = await apiService.completePasswordReset(formData.token, formData.newPassword)
      if (response.success) {
        setSuccess('Password reset completed successfully! You can now login with your new password.')
        setTimeout(() => {
          onBackToLogin()
        }, 3000)
      } else {
        setError(response.error || 'Failed to reset password')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset password'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToRequest = () => {
    setStep('request')
    setError(null)
    setSuccess(null)
    setFormData({
      email: '',
      token: '',
      newPassword: ''
    })
  }

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.header}>
          <h1>Password Reset</h1>
          <p>{step === 'request' ? 'Enter your email to receive a reset link' : 'Enter the token and new password'}</p>
        </div>

        <ErrorDisplay 
          error={error} 
          onClear={() => setError(null)}
        />

        {success && (
          <div className={styles.successMessage}>
            <p>{success}</p>
          </div>
        )}

        {step === 'request' ? (
          <form onSubmit={handleRequestReset} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email address"
                required
                className={styles.input}
              />
            </div>

            <button
              type="submit"
              className={`${styles.button} ${styles.primary}`}
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send Reset Email'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCompleteReset} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="token">Reset Token</label>
              <input
                id="token"
                name="token"
                type="text"
                value={formData.token}
                onChange={handleInputChange}
                placeholder="Enter the token from your email"
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
                  <li className={passwordValidation.length ? styles.valid : styles.invalid}>
                    At least 8 characters
                  </li>
                  <li className={passwordValidation.lowercase ? styles.valid : styles.invalid}>
                    At least one lowercase letter
                  </li>
                  <li className={passwordValidation.uppercase ? styles.valid : styles.invalid}>
                    At least one uppercase letter
                  </li>
                  <li className={passwordValidation.number ? styles.valid : styles.invalid}>
                    At least one number
                  </li>
                  <li className={passwordValidation.special ? styles.valid : styles.invalid}>
                    At least one special character (@$!%*?&)
                  </li>
                </ul>
              </div>
            </div>

            <button
              type="submit"
              className={`${styles.button} ${styles.primary}`}
              disabled={isLoading}
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        <div className={styles.switchMode}>
          {step === 'request' ? (
            <button
              type="button"
              className={styles.linkButton}
              onClick={onBackToLogin}
            >
              Back to Login
            </button>
          ) : (
            <>
              <button
                type="button"
                className={styles.linkButton}
                onClick={handleBackToRequest}
              >
                Request New Token
              </button>
              <button
                type="button"
                className={styles.linkButton}
                onClick={onBackToLogin}
                style={{ marginLeft: '1rem' }}
              >
                Back to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}