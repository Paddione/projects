import React, { useState, useEffect } from 'react'
import { apiService } from '../services/apiService'
import { useAuthStore } from '../stores/authStore'
import { AuthForm } from './AuthForm'
import { PasswordResetForm } from './PasswordResetForm'

interface AuthGuardProps {
  children: React.ReactNode
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isValidating, setIsValidating] = useState(true)
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const { setUser, setToken, clearAuth } = useAuthStore()

  useEffect(() => {
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

  const validateAuthentication = async () => {
    console.log('AuthGuard: Starting validation, current token:', apiService.getToken())
    setIsValidating(true)

    try {
      // First check if we have a token in localStorage
      const hasToken = apiService.isAuthenticated()
      console.log('AuthGuard: Has token in localStorage:', hasToken)

      if (!hasToken) {
        // Even if we don't have a token in localStorage, we might have a session cookie
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
      console.log('AuthGuard: Validation response:', response)
      const isValid = !!(response.success && response.data?.valid)
      setIsAuthenticated(isValid)

      if (isValid) {
        // Update Zustand store with user data and token
        const userData = apiService.getCurrentUser()
        const token = apiService.getToken()

        if (userData && token) {
          console.log('AuthGuard: Updating Zustand store with user data:', userData)
          setUser({
            id: String(userData.id),
            username: userData.username,
            email: userData.email,
            character: (userData as any).selectedCharacter || (userData as any).selected_character || 'student',
            level: (userData as any).characterLevel || (userData as any).character_level || 1
          })
          setToken(token)
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
    return <AuthForm onAuthSuccess={handleAuthSuccess} onShowPasswordReset={handleShowPasswordReset} />
  }

  // Show protected content if authenticated
  return <>{children}</>
}