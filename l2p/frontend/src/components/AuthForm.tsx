import React, { useState } from 'react'

import { apiService } from '../services/apiService'
import { ErrorDisplay } from './ErrorBoundary'
import { buildAuthorizationUrl, generateRandomState, storeOAuthState } from '../utils/oauth'
import styles from '../styles/AuthForm.module.css'

interface AuthFormProps {
  onAuthSuccess: () => void
  onShowPasswordReset?: () => void
}

export const AuthForm: React.FC<AuthFormProps> = ({ onAuthSuccess, onShowPasswordReset }) => {
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isOAuthLoading, setIsOAuthLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordValidation, setPasswordValidation] = useState({
    length: false,
    lowercase: false,
    uppercase: false,
    number: false,
    special: false
  })
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; email?: string; password?: string; confirmPassword?: string }>({})

  const validatePassword = (password: string) => {
    setPasswordValidation({
      length: password.length >= 8,
      lowercase: /(?=.*[a-z])/.test(password),
      uppercase: /(?=.*[A-Z])/.test(password),
      number: /(?=.*\d)/.test(password),
      special: /(?=.*[@$!%*?&])/.test(password)
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Validate password in real-time for registration
    if (name === 'password' && !isLogin) {
      validatePassword(value)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setFieldErrors({})

    try {
      if (isLogin) {
        console.log('AuthForm: Attempting login for user:', formData.username)
        const response = await apiService.login({
          username: formData.username,
          password: formData.password
        })
        console.log('AuthForm: Login response:', response)

        if (response.success) {
          console.log('AuthForm: Login successful, calling onAuthSuccess')
          onAuthSuccess()
        } else {
          setError(response.error || 'Login failed')
        }
      } else {
        // Validate password before submitting registration
        validatePassword(formData.password)
        const isPasswordValid = Object.values(passwordValidation).every(Boolean)
        const errors: typeof fieldErrors = {}

        // Basic synchronous validations
        if (!formData.username || formData.username.length < 3) {
          errors.username = 'Username must be at least 3 characters'
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!formData.email || !emailRegex.test(formData.email)) {
          errors.email = 'Please enter a valid email address'
        }
        if (!isPasswordValid) {
          errors.password = 'Password must be at least 8 characters and include upper, lower, number, and special character'
        }
        if (formData.password !== formData.confirmPassword) {
          errors.confirmPassword = 'Passwords do not match'
        }

        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors)
          setIsLoading(false)
          return
        }

        console.log('AuthForm: Attempting registration for user:', formData.username)
        const response = await apiService.register({
          username: formData.username,
          email: formData.email,
          password: formData.password
        })
        console.log('AuthForm: Registration response:', response)

        if (response.success) {
          console.log('AuthForm: Registration successful, calling onAuthSuccess')
          onAuthSuccess()
        } else {
          setError(response.error || 'Registration failed')
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMode = () => {
    setIsLogin(!isLogin)
    setError(null)
    setFormData({
      username: '',
      email: '',
      password: '',
      confirmPassword: ''
    })
    setPasswordValidation({
      length: false,
      lowercase: false,
      uppercase: false,
      number: false,
      special: false
    })
  }

  const handleOAuthLogin = async () => {
    setIsOAuthLoading(true)
    setError(null)

    try {
      // Get OAuth configuration from backend
      const config = await apiService.getOAuthConfig()

      if (!config) {
        setError('OAuth configuration not available')
        setIsOAuthLoading(false)
        return
      }

      // Generate and store CSRF state
      const state = generateRandomState()
      storeOAuthState(state)

      // Build authorization URL
      const authUrl = buildAuthorizationUrl(
        config.authServiceUrl,
        config.clientId,
        config.redirectUri,
        state
      )

      // Redirect to auth service
      window.location.href = authUrl
    } catch (error) {
      console.error('OAuth login error:', error)
      setError(error instanceof Error ? error.message : 'Failed to initiate OAuth login')
      setIsOAuthLoading(false)
    }
  }

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.header}>
          <img 
            src="/visuals/L2P-Logo.png" 
            alt="Learn2Play Logo" 
            className={styles.logo}
          />
        </div>

        <div className={styles.authTabs}>
          <button
            className={isLogin ? `${styles.tab} ${styles.active}` : styles.tab}
            onClick={() => setIsLogin(true)}
            type="button"
            data-testid="login-tab"
          >
            Login
          </button>
          <button
            className={!isLogin ? `${styles.tab} ${styles.active}` : styles.tab}
            onClick={() => setIsLogin(false)}
            type="button"
            data-testid="register-tab"
          >
            Register
          </button>
        </div>

        <ErrorDisplay
          error={error}
          onClear={() => setError(null)}
        />

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.inputGroup}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Enter your username"
              // required handled via custom validation
              minLength={3}
              maxLength={30}
              className={styles.input}
              data-testid="username-input"
              aria-describedby={fieldErrors.username ? 'username-error' : undefined}
              aria-invalid={fieldErrors.username ? 'true' : undefined}
            />
            {(error && error.includes('username')) || fieldErrors.username ? (
              <div id="username-error" data-testid="username-error" className={styles.error}>
                {fieldErrors.username || error}
              </div>
            ) : null}
          </div>

          {!isLogin && (
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
                // required handled via custom validation
                className={styles.input}
                data-testid="email-input"
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                aria-invalid={fieldErrors.email ? 'true' : undefined}
              />
              {fieldErrors.email && (
                <div id="email-error" data-testid="email-error" className={styles.error}>
                  {fieldErrors.email}
                </div>
              )}
            </div>
          )}

          <div className={styles.inputGroup}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              // required handled via custom validation
              minLength={8}
              className={styles.input}
              data-testid="password-input"
              aria-describedby={(!isLogin && (fieldErrors.password ? 'password-error' : 'password-help')) || undefined}
              aria-invalid={fieldErrors.password ? 'true' : undefined}
            />
            {!isLogin && (
              <div className={styles.passwordRequirements} id="password-help">
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
            )}
            {!isLogin && fieldErrors.password && (
              <div id="password-error" data-testid="password-error" className={styles.error}>
                {fieldErrors.password}
              </div>
            )}
            {!isLogin && (
              <div className={styles.inputGroup}>
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  // required handled via custom validation
                  minLength={8}
                  className={styles.input}
                  data-testid="confirm-password-input"
                  aria-describedby={fieldErrors.confirmPassword ? 'confirm-password-error' : undefined}
                  aria-invalid={fieldErrors.confirmPassword ? 'true' : undefined}
                />
                {fieldErrors.confirmPassword && (
                  <div id="confirm-password-error" data-testid="confirm-password-error" className={styles.error}>
                    {fieldErrors.confirmPassword}
                  </div>
                )}
              </div>
            )}
            {isLogin && onShowPasswordReset && (
              <div className={styles.forgotPassword}>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={onShowPasswordReset}
                  data-testid="forgot-password-link"
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </div>



          <button
            type="submit"
            className={`${styles.button} ${styles.primary}`}
            disabled={isLoading || isOAuthLoading || (!isLogin && formData.password.length > 0 && Object.values(passwordValidation).some(v => !v))}
            data-testid={isLogin ? "login-button" : "register-button"}
          >
            {isLoading ? (isLogin ? 'Logging in...' : 'Registering...') : (isLogin ? 'Login' : 'Register')}
          </button>

          {isLogin && (
            <>
              <div className={styles.divider}>
                <span>OR</span>
              </div>
              <button
                type="button"
                className={`${styles.button} ${styles.secondary}`}
                onClick={handleOAuthLogin}
                disabled={isLoading || isOAuthLoading}
                data-testid="oauth-login-button"
              >
                {isOAuthLoading ? 'Redirecting...' : 'Login with Auth Service'}
              </button>
            </>
          )}
        </form>

        <div className={styles.switchMode}>
          <p>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              className={styles.linkButton}
              onClick={toggleMode}
              data-testid={isLogin ? "register-link" : "login-link"}
            >
              {isLogin ? 'Register here' : 'Login here'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}