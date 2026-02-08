import React, { useState, useEffect, useCallback } from 'react'
import { apiService } from '../services/apiService'
import { useAuthStore } from '../stores/authStore'
import { extractOAuthParams, validateState, getOAuthState, clearOAuthState, clearOAuthParamsFromUrl } from '../utils/oauth'
import { importMetaEnv } from '../utils/import-meta'

interface AuthGuardProps {
  children: React.ReactNode
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isValidating, setIsValidating] = useState(true)
  const [oauthError, setOauthError] = useState<string | null>(null)
  const { setUser, setToken, clearAuth } = useAuthStore()

  const processingOAuth = React.useRef(false)

  const redirectToAuthService = useCallback(async () => {
    const callbackURL = window.location.origin + window.location.pathname

    // Use VITE_AUTH_SERVICE_URL if available
    if (importMetaEnv.VITE_AUTH_SERVICE_URL) {
      const authUrl = String(importMetaEnv.VITE_AUTH_SERVICE_URL).replace(/\/api$/, '')
      window.location.href = `${authUrl}/login?callbackURL=${encodeURIComponent(callbackURL)}`
      return
    }

    // Fallback: fetch auth URL from backend's OAuth config endpoint
    try {
      const config = await apiService.getOAuthConfig()
      if (config?.authServiceUrl) {
        const authUrl = String(config.authServiceUrl).replace(/\/api$/, '')
        window.location.href = `${authUrl}/login?callbackURL=${encodeURIComponent(callbackURL)}`
      } else {
        setOauthError('Authentication service URL not configured')
      }
    } catch (error) {
      console.error('AuthGuard: Failed to fetch auth config:', error)
      setOauthError('Unable to reach authentication service')
    }
  }, [])

  // Define callbacks BEFORE useEffect hooks that reference them
  const handleOAuthCallback = useCallback(async (code: string, state: string) => {
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
  }, [setUser, setToken])

  const validateAuthentication = useCallback(async () => {
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

          // Synchronize with ApiService so subsequent calls to isAuthenticated() return true
          apiService.setAuth('', '', userData)

          setUser({
            id: String(userData.id || userData.userId),
            username: userData.username,
            email: userData.email,
            character: userData.selectedCharacter || userData.selected_character || 'student',
            level: userData.characterLevel || userData.character_level || 1
          })
          setToken('session')
          setIsAuthenticated(true)
          setIsValidating(false)
          return
        }

        setIsAuthenticated(false)
        setIsValidating(false)
        redirectToAuthService()
        return;
      }

      // If we have a token in localStorage, validate it
      const response = await apiService.validateToken()
      console.log('AuthGuard: Validation result:', response)
      const isValid = !!(response.success && response.data && typeof response.data === 'object' && 'valid' in response.data && response.data.valid)
      setIsAuthenticated(isValid)

      if (isValid) {
        const userData = apiService.getCurrentUser()
        const token = apiService.getToken()

        if (userData && token) {
          const currentStoreUser = useAuthStore.getState().user;
          const currentStoreToken = useAuthStore.getState().token;

          if (!currentStoreUser || currentStoreUser.id !== String(userData.id) || currentStoreToken !== token) {
            const userDataWithOptional = userData as unknown as { id: number; username: string; email: string; selectedCharacter?: string; selected_character?: string; characterLevel?: number; character_level?: number }
            setUser({
              id: String(userData.id),
              username: userData.username,
              email: userData.email,
              character: userDataWithOptional.selectedCharacter || userDataWithOptional.selected_character || 'student',
              level: userDataWithOptional.characterLevel || userDataWithOptional.character_level || 1
            })
            setToken(token)
          } else {
            console.log('AuthGuard: Store already up to date, skipping update')
          }
        }
      } else {
        console.log('AuthGuard: Validation failed, clearing auth and redirecting')
        apiService.clearAuth()
        clearAuth()
        redirectToAuthService()
      }
    } catch (error) {
      console.error('AuthGuard: Validation error:', error)
      // Clear auth on validation failure
      apiService.clearAuth()
      clearAuth()
      setIsAuthenticated(false)
      redirectToAuthService()
    } finally {
      setIsValidating(false)
    }
  }, [setUser, setToken, clearAuth, redirectToAuthService])

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
  }, [isAuthenticated, isValidating, handleOAuthCallback, validateAuthentication])

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
  }, [validateAuthentication])

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

  // Not authenticated — show redirect spinner (redirect already triggered in validateAuthentication)
  if (!isAuthenticated) {
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
          {oauthError ? (
            <div style={{
              background: 'var(--error-color, #dc2626)',
              color: 'white',
              padding: '1rem 2rem',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}>
              {oauthError}
            </div>
          ) : (
            <>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid var(--border-color)',
                borderTop: '3px solid var(--primary-color)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem'
              }} />
              <p>Redirecting to authentication service...</p>
            </>
          )}
        </div>
      </div>
    )
  }

  // Show protected content if authenticated
  return <>{children}</>
}
