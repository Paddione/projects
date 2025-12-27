import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { apiService } from '../services/apiService'
import { ErrorDisplay } from './ErrorBoundary'
import styles from '../styles/AuthForm.module.css'

export const EmailVerificationPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setError('No verification token provided')
      return
    }

    verifyEmail(token)
  }, [searchParams])

  const verifyEmail = async (token: string) => {
    try {
      const response = await apiService.verifyEmail(token)
      if (response.success) {
        setStatus('success')
        setMessage('Email verified successfully! You can now login to your account.')
      } else {
        setStatus('error')
        setError(response.error || 'Email verification failed')
      }
    } catch (err) {
      setStatus('error')
      const errorMessage = err instanceof Error ? err.message : 'Email verification failed'
      setError(errorMessage)
    }
  }

  const handleResendVerification = async () => {
    const email = searchParams.get('email')
    if (!email) {
      setError('Email address not found. Please try logging in again.')
      return
    }

    try {
      const response = await apiService.resendEmailVerification(email)
      if (response.success) {
        setMessage('Verification email sent successfully! Please check your inbox.')
        setError(null)
      } else {
        setError(response.error || 'Failed to send verification email')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send verification email'
      setError(errorMessage)
    }
  }

  const handleGoToLogin = () => {
    navigate('/')
  }

  if (status === 'verifying') {
    return (
      <div className={styles.authContainer}>
        <div className={styles.authCard}>
          <div className={styles.header}>
            <h1>Verifying Email</h1>
            <p>Please wait while we verify your email address...</p>
          </div>
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              border: '3px solid var(--border-color)', 
              borderTop: '3px solid var(--primary-color)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }} />
            <p>Verifying your email...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.header}>
          <h1>Email Verification</h1>
          <p>{status === 'success' ? 'Verification Complete' : 'Verification Failed'}</p>
        </div>

        {error && (
          <ErrorDisplay 
            error={error} 
            onClear={() => setError(null)}
          />
        )}

        {message && (
          <div className={styles.successMessage}>
            <p>{message}</p>
          </div>
        )}

        <div className={styles.verificationContent}>
          {status === 'success' ? (
            <div className={styles.successContent}>
              <div className={styles.successIcon}>
                ✓
              </div>
              <h2>Email Verified Successfully!</h2>
              <p>Your email address has been verified. You can now login to your account and start playing Learn2Play!</p>
              
              <button
                onClick={handleGoToLogin}
                className={`${styles.button} ${styles.primary}`}
              >
                Go to Login
              </button>
            </div>
          ) : (
            <div className={styles.errorContent}>
              <div className={styles.errorIcon}>
                ✗
              </div>
              <h2>Verification Failed</h2>
              <p>The verification link may be invalid or expired. You can request a new verification email or try logging in.</p>
              
              <div className={styles.verificationActions}>
                <button
                  onClick={handleResendVerification}
                  className={`${styles.button} ${styles.secondary}`}
                >
                  Resend Verification Email
                </button>
                
                <button
                  onClick={handleGoToLogin}
                  className={`${styles.button} ${styles.primary}`}
                >
                  Go to Login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 