import React from 'react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/jest-globals'
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
    getOAuthConfig: jest.fn(),
  },
}))

// Mock import-meta — no VITE_AUTH_SERVICE_URL so redirectToAuthService
// falls through to getOAuthConfig (which we mock to avoid actual redirects)
jest.mock('../../utils/import-meta', () => ({
  importMetaEnv: {},
}))

describe('AuthGuard', () => {
  const mockChildren = <div data-testid="protected-content">Protected Content</div>

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset auth store
    useAuthStore.getState().clearAuth()
    jest.mocked(apiService.getCurrentUserFromServer).mockResolvedValue({ success: false })
    // Mock getOAuthConfig to return null (no redirect will happen, error shown instead)
    jest.mocked(apiService.getOAuthConfig).mockResolvedValue(null)
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

    it('should show error when not authenticated and no auth service configured', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(false)

      render(<AuthGuard>{mockChildren}</AuthGuard>)

      await waitFor(() => {
        // Without VITE_AUTH_SERVICE_URL, falls back to getOAuthConfig which returns null
        expect(screen.getByText('Authentication service URL not configured')).toBeInTheDocument()
        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
      })
    })

    it('should attempt redirect via OAuth config when not authenticated', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(false)

      render(<AuthGuard>{mockChildren}</AuthGuard>)

      await waitFor(() => {
        expect(apiService.getOAuthConfig).toHaveBeenCalled()
      })
    })

    it('should clear auth and attempt redirect when token validation fails', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(true)
      jest.mocked(apiService.validateToken).mockResolvedValue({
        success: false,
      })

      render(<AuthGuard>{mockChildren}</AuthGuard>)

      await waitFor(() => {
        expect(apiService.clearAuth).toHaveBeenCalled()
        // Falls back to getOAuthConfig for redirect
        expect(apiService.getOAuthConfig).toHaveBeenCalled()
      }, { timeout: 5000 })
    })

    it('should handle validation errors and attempt redirect', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(true)
      jest.mocked(apiService.validateToken).mockRejectedValue(new Error('Network error'))

      render(<AuthGuard>{mockChildren}</AuthGuard>)

      await waitFor(() => {
        expect(apiService.clearAuth).toHaveBeenCalled()
        expect(apiService.getOAuthConfig).toHaveBeenCalled()
      }, { timeout: 5000 })
    })

    it('should show error when getOAuthConfig fails', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(false)
      jest.mocked(apiService.getOAuthConfig).mockRejectedValue(new Error('Network error'))

      render(<AuthGuard>{mockChildren}</AuthGuard>)

      await waitFor(() => {
        expect(screen.getByText('Unable to reach authentication service')).toBeInTheDocument()
      })
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
      } as any)
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
    it('should attempt redirect when validation response has no data', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(true)
      jest.mocked(apiService.validateToken).mockResolvedValue({
        success: true,
      })

      render(<AuthGuard>{mockChildren}</AuthGuard>)

      await waitFor(() => {
        expect(apiService.getOAuthConfig).toHaveBeenCalled()
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
