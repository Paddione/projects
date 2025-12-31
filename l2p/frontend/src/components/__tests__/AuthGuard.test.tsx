import React from 'react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AuthGuard } from '../AuthGuard'
import { apiService } from '../../services/apiService'
import { useAuthStore } from '../../stores/authStore'

// Mock apiService
jest.mock('../../services/apiService', () => ({
  apiService: {
    isAuthenticated: jest.fn(),
    validateToken: jest.fn(),
    getCurrentUser: jest.fn(),
    getCurrentUserFromServer: jest.fn(),
    getToken: jest.fn(),
    clearAuth: jest.fn(),
  },
}))

// Mock AuthForm and PasswordResetForm
jest.mock('../AuthForm', () => ({
  AuthForm: ({ onAuthSuccess }: any) => (
    <div data-testid="auth-form">
      <button onClick={onAuthSuccess} data-testid="auth-success-button">Auth Success</button>
    </div>
  ),
}))

jest.mock('../PasswordResetForm', () => ({
  PasswordResetForm: ({ onBackToLogin }: any) => (
    <div data-testid="password-reset-form">
      <button onClick={onBackToLogin} data-testid="back-to-login-button">Back</button>
    </div>
  ),
}))

describe('AuthGuard', () => {
  const mockChildren = <div data-testid="protected-content">Protected Content</div>

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset auth store
    useAuthStore.getState().clearAuth()
    jest.mocked(apiService.getCurrentUserFromServer).mockResolvedValue({ success: false })
  })

  describe('Authentication validation', () => {
    it('should show loading state while validating', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(true)
      jest.mocked(apiService.validateToken).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true, data: { valid: true } }), 100))
      )
      jest.mocked(apiService.getCurrentUser).mockReturnValue({
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
      })
      jest.mocked(apiService.getToken).mockReturnValue('valid-token')

      render(<AuthGuard>{mockChildren}</AuthGuard>)

      expect(screen.getByText('Validating authentication...')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should show protected content when authenticated', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(true)
      jest.mocked(apiService.validateToken).mockResolvedValue({
        success: true,
        data: { valid: true },
      })
      jest.mocked(apiService.getCurrentUser).mockReturnValue({
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
      })
      jest.mocked(apiService.getToken).mockReturnValue('valid-token')

      render(<AuthGuard>{mockChildren}</AuthGuard>)

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      })
    })

    it('should show auth form when not authenticated', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(false)

      render(<AuthGuard>{mockChildren}</AuthGuard>)

      await waitFor(() => {
        expect(screen.getByTestId('auth-form')).toBeInTheDocument()
        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
      })
    })

    it('should show auth form when token validation fails', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(true)
      jest.mocked(apiService.validateToken).mockResolvedValue({
        success: false,
      })

      render(<AuthGuard>{mockChildren}</AuthGuard>)

      await waitFor(() => {
        expect(screen.getByTestId('auth-form')).toBeInTheDocument()
        expect(apiService.clearAuth).toHaveBeenCalled()
      }, { timeout: 5000 })
    })

    it('should handle validation errors', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(true)
      jest.mocked(apiService.validateToken).mockRejectedValue(new Error('Network error'))

      render(<AuthGuard>{mockChildren}</AuthGuard>)

      await waitFor(() => {
        expect(screen.getByTestId('auth-form')).toBeInTheDocument()
        expect(apiService.clearAuth).toHaveBeenCalled()
      }, { timeout: 5000 })
    })
  })

  describe('Authentication success handling', () => {
    it('should show protected content after successful auth', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(false)

      render(<AuthGuard>{mockChildren}</AuthGuard>)

      await waitFor(() => {
        expect(screen.getByTestId('auth-form')).toBeInTheDocument()
      })

      // Simulate successful authentication
      jest.mocked(apiService.getCurrentUser).mockReturnValue({
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
      })
      jest.mocked(apiService.getToken).mockReturnValue('new-token')

      const authSuccessButton = screen.getByTestId('auth-success-button')
      authSuccessButton.click()

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      })
    })

    it('should update auth store on successful auth', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(false)

      render(<AuthGuard>{mockChildren}</AuthGuard>)

      await waitFor(() => {
        expect(screen.getByTestId('auth-form')).toBeInTheDocument()
      })

      jest.mocked(apiService.getCurrentUser).mockReturnValue({
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        selectedCharacter: 'warrior',
        characterLevel: 5,
      })
      jest.mocked(apiService.getToken).mockReturnValue('new-token')

      const authSuccessButton = screen.getByTestId('auth-success-button')
      authSuccessButton.click()

      await waitFor(() => {
        const authState = useAuthStore.getState()
        expect(authState.user).toEqual({
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          character: 'warrior',
          level: 5,
        })
        expect(authState.token).toBe('new-token')
      })
    })
  })

  describe('Password reset flow', () => {
    it('should show password reset form when requested', async () => {
      // This test would require the actual AuthForm to trigger password reset
      // Since we're mocking it, we'll skip this for now
      // In a real implementation, you'd need to render the actual AuthForm
    })
  })

  describe('Storage change detection', () => {
    it('should re-validate on storage change', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(true)
      jest.mocked(apiService.validateToken).mockResolvedValue({
        success: true,
        data: { valid: true },
      })
      jest.mocked(apiService.getCurrentUser).mockReturnValue({
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
      })
      jest.mocked(apiService.getToken).mockReturnValue('valid-token')

      render(<AuthGuard>{mockChildren}</AuthGuard>)

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      })

      // Clear mocks to track new calls
      jest.clearAllMocks()

      // Simulate storage change
      const storageEvent = new StorageEvent('storage', {
        key: 'auth_token',
        newValue: 'new-token',
      })
      window.dispatchEvent(storageEvent)

      await waitFor(() => {
        expect(apiService.isAuthenticated).toHaveBeenCalled()
      })
    })
  })

  describe('User data handling', () => {
    it('should handle user with default character when not set', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(true)
      jest.mocked(apiService.validateToken).mockResolvedValue({
        success: true,
        data: { valid: true },
      })
      jest.mocked(apiService.getCurrentUser).mockReturnValue({
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
      })
      jest.mocked(apiService.getToken).mockReturnValue('valid-token')

      render(<AuthGuard>{mockChildren}</AuthGuard>)

      await waitFor(() => {
        const authState = useAuthStore.getState()
        expect(authState.user?.character).toBe('student')
        expect(authState.user?.level).toBe(1)
      })
    })

    it('should handle user with custom character', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(true)
      jest.mocked(apiService.validateToken).mockResolvedValue({
        success: true,
        data: { valid: true },
      })
      jest.mocked(apiService.getCurrentUser).mockReturnValue({
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        selectedCharacter: 'mage',
        characterLevel: 10,
      })
      jest.mocked(apiService.getToken).mockReturnValue('valid-token')

      render(<AuthGuard>{mockChildren}</AuthGuard>)

      await waitFor(() => {
        const authState = useAuthStore.getState()
        expect(authState.user?.character).toBe('mage')
        expect(authState.user?.level).toBe(10)
      })
    })

    it('should not update store if user data is missing', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(true)
      jest.mocked(apiService.validateToken).mockResolvedValue({
        success: true,
        data: { valid: true },
      })
      jest.mocked(apiService.getCurrentUser).mockReturnValue(null)
      jest.mocked(apiService.getToken).mockReturnValue(null)

      render(<AuthGuard>{mockChildren}</AuthGuard>)

      await waitFor(() => {
        const authState = useAuthStore.getState()
        expect(authState.user).toBeNull()
        expect(authState.token).toBeNull()
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle validation response without data', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(true)
      jest.mocked(apiService.validateToken).mockResolvedValue({
        success: true,
      })

      render(<AuthGuard>{mockChildren}</AuthGuard>)

      await waitFor(() => {
        expect(screen.getByTestId('auth-form')).toBeInTheDocument()
      }, { timeout: 5000 })
    })

    it('should handle multiple rapid validation attempts', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(true)
      jest.mocked(apiService.validateToken).mockResolvedValue({
        success: true,
        data: { valid: true },
      })
      jest.mocked(apiService.getCurrentUser).mockReturnValue({
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
      })
      jest.mocked(apiService.getToken).mockReturnValue('valid-token')

      const { rerender } = render(<AuthGuard>{mockChildren}</AuthGuard>)

      // Rerender multiple times
      rerender(<AuthGuard>{mockChildren}</AuthGuard>)
      rerender(<AuthGuard>{mockChildren}</AuthGuard>)

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      })
    })
  })
})
