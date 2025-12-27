import { describe, it, expect, beforeEach } from '@jest/globals'
import { useAuthStore } from '../authStore'

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useAuthStore.getState()
    store.clearAuth()
    store.setLoading(false)
    store.setError(null)
  })

  describe('Initial state', () => {
    it('should have correct initial values', () => {
      const state = useAuthStore.getState()

      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('setUser', () => {
    it('should set user and mark as authenticated', () => {
      const mockUser = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        character: 'warrior',
        level: 5,
        experience: 1000
      }

      useAuthStore.getState().setUser(mockUser)

      const state = useAuthStore.getState()
      expect(state.user).toEqual(mockUser)
      expect(state.isAuthenticated).toBe(true)
    })
  })

  describe('setToken', () => {
    it('should set token', () => {
      const token = 'test-token-123'

      useAuthStore.getState().setToken(token)

      const state = useAuthStore.getState()
      expect(state.token).toBe(token)
    })
  })

  describe('clearAuth', () => {
    it('should clear all auth state', () => {
      // First set some auth data
      useAuthStore.getState().setUser({
        id: '123',
        username: 'testuser',
        email: 'test@example.com'
      })
      useAuthStore.getState().setToken('test-token')

      // Then clear it
      useAuthStore.getState().clearAuth()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })
  })

  describe('setLoading', () => {
    it('should set loading state to true', () => {
      useAuthStore.getState().setLoading(true)

      const state = useAuthStore.getState()
      expect(state.isLoading).toBe(true)
    })

    it('should set loading state to false', () => {
      useAuthStore.getState().setLoading(true)
      useAuthStore.getState().setLoading(false)

      const state = useAuthStore.getState()
      expect(state.isLoading).toBe(false)
    })
  })

  describe('setError', () => {
    it('should set error message', () => {
      const errorMessage = 'Test error message'

      useAuthStore.getState().setError(errorMessage)

      const state = useAuthStore.getState()
      expect(state.error).toBe(errorMessage)
    })

    it('should clear error when set to null', () => {
      useAuthStore.getState().setError('Some error')
      useAuthStore.getState().setError(null)

      const state = useAuthStore.getState()
      expect(state.error).toBeNull()
    })
  })

  describe('login', () => {
    it('should successfully log in user', async () => {
      const username = 'testuser'
      const password = 'password123'

      const result = await useAuthStore.getState().login(username, password)

      expect(result).toBe(true)

      const state = useAuthStore.getState()
      expect(state.user).toEqual({
        id: '1',
        username: 'testuser',
        email: 'testuser@example.com'
      })
      expect(state.isAuthenticated).toBe(true)
      expect(state.token).toBe('mock-token')
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should handle login with loading states', async () => {
      const loginPromise = useAuthStore.getState().login('testuser', 'password')

      // Check that loading is true during the async operation
      // Note: This might not catch it due to timing, but the finally block ensures it's false after

      await loginPromise

      const state = useAuthStore.getState()
      expect(state.isLoading).toBe(false)
    })
  })

  describe('logout', () => {
    it('should clear auth state on logout', () => {
      // First login
      useAuthStore.getState().setUser({
        id: '123',
        username: 'testuser',
        email: 'test@example.com'
      })
      useAuthStore.getState().setToken('test-token')

      // Then logout
      useAuthStore.getState().logout()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })
  })

  describe('register', () => {
    it('should successfully register user', async () => {
      const username = 'newuser'
      const email = 'newuser@example.com'
      const password = 'password123'

      const result = await useAuthStore.getState().register(username, email, password)

      expect(result).toBe(true)

      const state = useAuthStore.getState()
      expect(state.user).toEqual({
        id: '1',
        username: 'newuser',
        email: 'newuser@example.com'
      })
      expect(state.isAuthenticated).toBe(true)
      expect(state.token).toBe('mock-token')
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should handle register with loading states', async () => {
      const registerPromise = useAuthStore.getState().register('newuser', 'new@example.com', 'password')

      await registerPromise

      const state = useAuthStore.getState()
      expect(state.isLoading).toBe(false)
    })
  })

  describe('Persistence', () => {
    it('should persist user, token, and isAuthenticated', () => {
      const mockUser = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com'
      }
      const token = 'test-token-123'

      useAuthStore.getState().setUser(mockUser)
      useAuthStore.getState().setToken(token)

      // The persist middleware should have saved these to localStorage
      // We can verify the state is set correctly
      const state = useAuthStore.getState()
      expect(state.user).toEqual(mockUser)
      expect(state.token).toBe(token)
      expect(state.isAuthenticated).toBe(true)
    })
  })

  describe('Complex scenarios', () => {
    it('should handle multiple operations in sequence', async () => {
      // Register
      await useAuthStore.getState().register('user1', 'user1@example.com', 'pass123')
      let state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)

      // Logout
      useAuthStore.getState().logout()
      state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)

      // Login
      await useAuthStore.getState().login('user1', 'pass123')
      state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
    })

    it('should maintain error state until explicitly cleared', async () => {
      useAuthStore.getState().setError('Test error')

      let state = useAuthStore.getState()
      expect(state.error).toBe('Test error')

      // Error should persist through other operations
      useAuthStore.getState().setLoading(true)
      state = useAuthStore.getState()
      expect(state.error).toBe('Test error')

      // Clear error explicitly
      useAuthStore.getState().setError(null)
      state = useAuthStore.getState()
      expect(state.error).toBeNull()
    })
  })
})
