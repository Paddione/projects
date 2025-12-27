import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  username: string
  email: string
  character?: string
  level?: number
  experience?: number
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  
  // Actions
  setUser: (user: User) => void
  setToken: (token: string) => void
  clearAuth: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  register: (username: string, email: string, password: string) => Promise<boolean>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, _get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: true }),
      setToken: (token) => set({ token }),
      clearAuth: () => set({ user: null, token: null, isAuthenticated: false }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      login: async (username, _password) => {
        set({ isLoading: true, error: null })
        try {
          // Mock login implementation
          const mockUser: User = {
            id: '1',
            username,
            email: `${username}@example.com`
          }
          set({ user: mockUser, isAuthenticated: true, token: 'mock-token' })
          return true
        } catch {
          set({ error: 'Login failed' })
          return false
        } finally {
          set({ isLoading: false })
        }
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false })
      },

      register: async (username, email, _password) => {
        set({ isLoading: true, error: null })
        try {
          // Mock register implementation
          const mockUser: User = {
            id: '1',
            username,
            email
          }
          set({ user: mockUser, isAuthenticated: true, token: 'mock-token' })
          return true
        } catch {
          set({ error: 'Registration failed' })
          return false
        } finally {
          set({ isLoading: false })
        }
      }
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)
