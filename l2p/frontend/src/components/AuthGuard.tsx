import React, { useState, useEffect } from 'react'
import { apiService } from '../services/apiService'
import { useAuthStore } from '../stores/authStore'
import { AuthForm } from './AuthForm'
import { PasswordResetForm } from './PasswordResetForm'
import { extractOAuthParams, validateState, getOAuthState, clearOAuthState, clearOAuthParamsFromUrl } from '../utils/oauth'

interface AuthGuardProps {
  children: React.ReactNode
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isValidating, setIsValidating] = useState(true)
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [oauthError, setOauthError] = useState<string | null>(null)
  const { setUser, setToken, clearAuth } = useAuthStore()

  const processingOAuth = React.useRef(false)

  // Handle OAuth callback first (before any other validation)
  useEffect(() => {
    const { code, state } = extractOAuthParams()

    if (code && state && !processingOAuth.current) {
      console.log('AuthGuard: OAuth callback detected')
      processingOAuth.current = true
      handleOAuthCallback(code, state)
      return // Skip normal validation
    }

    if (code && state && processingOAuth.current) {
      return // Already processing or processed
    }

    // If no OAuth callback, proceed with normal validation
    console.log('AuthGuard: Component mounted, isAuthenticated:', isAuthenticated, 'isValidating:', isValidating)
    if (isAuthenticated === null) {
      console.log('AuthGuard: Not authenticated, validating...')
      validateAuthentication()
    } else {
      console.log('AuthGuard: State already determined (isAuthenticated: ' + isAuthenticated + '), skipping validation')
    }
  }, [isAuthenticated])

  // Add a listener for storage changes to detect when auth state changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token') {
        console.log('AuthGuard: Storage change detected, re-validating')
        validateAuthentication()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const handleOAuthCallback = async (code: string, state: string) => {
    console.log('AuthGuard: Processing OAuth callback')
    setIsValidating(true)
    setOauthError(null)

    try {
      // Validate state parameter (CSRF protection)
      const storedState = getOAuthState()
      if (!validateState(state, storedState)) {
        console.error('AuthGuard: Invalid OAuth state parameter')
        setOauthError('Invalid OAuth state. Possible CSRF attack.')
        clearOAuthState()
        clearOAuthParamsFromUrl()
        setIsValidating(false)
        setIsAuthenticated(false)
        return
      }

      console.log('AuthGuard: State validated, exchanging code for tokens')

      // Exchange authorization code for tokens
      const response = await apiService.exchangeOAuthCode(code, state)

      if (response.success && response.data) {
        console.log('AuthGuard: OAuth login successful')

        // Store tokens and user data
        const { user, tokens } = response.data
        apiService.setAuth(tokens.accessToken, tokens.refreshToken, user)

        // Update Zustand store
        setUser({
          id: String(user.userId),
          username: user.username,
          email: user.email,
          character: user.selectedCharacter || 'student',
          level: user.characterLevel || 1
        })
        setToken(tokens.accessToken)

        // Clear OAuth state and URL params
        clearOAuthState()
        clearOAuthParamsFromUrl()

        setIsAuthenticated(true)
      } else {
        console.error('AuthGuard: OAuth exchange failed', response)
        setOauthError('Failed to complete OAuth login')
        clearOAuthState()
        clearOAuthParamsFromUrl()
        setIsAuthenticated(false)
      }
    } catch (error) {
      console.error('AuthGuard: OAuth callback error:', error)
      setOauthError(error instanceof Error ? error.message : 'OAuth login failed')
      clearOAuthState()
      clearOAuthParamsFromUrl()
      setIsAuthenticated(false)
    } finally {
      processingOAuth.current = false
      setIsValidating(false)
    }
  }

  const validateAuthentication = async () => {
    setIsValidating(true)

    try {
      // First check if we have a token in localStorage
      const hasToken = apiService.isAuthenticated()

      if (!hasToken) {
        console.log('AuthGuard: No token in localStorage, checking for session cookie...')
        const meResponse = await apiService.getCurrentUserFromServer()

        if (meResponse.success && meResponse.data) {
          console.log('AuthGuard: Session cookie found, authenticated!')
          const userData = meResponse.data
          setUser({
            id: String(userData.id),
            username: userData.username,
            email: userData.email,
            character: userData.selected_character || 'student',
            level: userData.character_level || 1
          })
          setIsAuthenticated(true)
          setIsValidating(false)
          return
        }

        setIsAuthenticated(false)
        setIsValidating(false)
        return
      }

      // If we have a token in localStorage, validate it
      const response = await apiService.validateToken()
      console.log('AuthGuard: Validation result:', response)
      const isValid = !!(response.success && (response.data as any)?.valid)
      setIsAuthenticated(isValid)

      if (isValid) {
        const userData = apiService.getCurrentUser()
        const token = apiService.getToken()

        if (userData && token) {
          const currentStoreUser = useAuthStore.getState().user;
          const currentStoreToken = useAuthStore.getState().token;

          if (!currentStoreUser || currentStoreUser.id !== String(userData.id) || currentStoreToken !== token) {
            setUser({
              id: String(userData.id),
              username: userData.username,
              email: userData.email,
              character: (userData as any).selectedCharacter || (userData as any).selected_character || 'student',
              level: (userData as any).characterLevel || (userData as any).character_level || 1
            })
            setToken(token)
          } else {
            console.log('AuthGuard: Store already up to date, skipping update')
          }
        }
      } else {
        console.log('AuthGuard: Validation failed, clearing auth')
        apiService.clearAuth()
        clearAuth()
      }
    } catch (error) {
      console.error('AuthGuard: Validation error:', error)
      // Clear auth on validation failure
      apiService.clearAuth()
      clearAuth()
      setIsAuthenticated(false)
    } finally {
      setIsValidating(false)
    }
  }

  const handleAuthSuccess = () => {
    console.log('AuthGuard: Auth success callback called')
    console.log('AuthGuard: Current token after auth success:', apiService.getToken())

    // Update Zustand store with user data and token
    const userData = apiService.getCurrentUser()
    const token = apiService.getToken()

    if (userData && token) {
      console.log('AuthGuard: Updating Zustand store after auth success:', userData)
      setUser({
        id: userData.id,
        username: userData.username,
        email: userData.email,
        character: (userData as any).selectedCharacter || 'student',
        level: (userData as any).characterLevel || 1
      })
      setToken(token)
    }

    // Directly set authenticated state since we just successfully authenticated
    // No need to re-validate as the authentication just completed successfully
    setIsAuthenticated(true)
    setIsValidating(false)
  }

  const handleShowPasswordReset = () => {
    setShowPasswordReset(true)
  }

  const handleBackToLogin = () => {
    setShowPasswordReset(false)
  }

  // Show loading state while validating
  if (isValidating) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'var(--background-color)',
        color: 'var(--text-primary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border-color)',
            borderTop: '3px solid var(--primary-color)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p>Validating authentication...</p>
        </div>
      </div>
    )
  }

  // Show password reset form if requested
  if (showPasswordReset) {
    return <PasswordResetForm onBackToLogin={handleBackToLogin} />
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        {oauthError && (
          <div style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--error-color, #dc2626)',
            color: 'white',
            padding: '1rem 2rem',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000
          }}>
            {oauthError}
          </div>
        )}
        <AuthForm onAuthSuccess={handleAuthSuccess} onShowPasswordReset={handleShowPasswordReset} />
      </>
    )
  }

  // Show protected content if authenticated
  return <>{children}</>
}
