// Mock fetch globally BEFORE importing apiService
global.fetch = jest.fn()

// Mock localStorage with proper storage BEFORE importing apiService
const createLocalStorageMock = () => {
  const store: Record<string, string> = {}

  return {
    getItem(key: string): string | null {
      return store[key] ?? null
    },
    setItem(key: string, value: string): void {
      store[key] = value
    },
    removeItem(key: string): void {
      delete store[key]
    },
    clear(): void {
      Object.keys(store).forEach(key => delete store[key])
    },
    get _store() {
      return store
    }
  }
}

const localStorageMock = createLocalStorageMock()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  writable: true,
})

// Mock window.location BEFORE importing apiService
const mockLocation = {
  href: 'http://localhost:3000',
}
Object.defineProperty(window, 'location', {
  value: mockLocation,
  configurable: true,
})

// Now import apiService after mocks are in place
import { apiService } from '../apiService'

// Mock console.log and console.error to reduce test noise
const originalConsoleLog = console.log
const originalConsoleError = console.error

beforeAll(() => {
  console.log = jest.fn()
  console.error = jest.fn()
})

afterAll(() => {
  console.log = originalConsoleLog
  console.error = originalConsoleError
})

const mockFetch = fetch as jest.MockedFunction<typeof fetch>

// Helper function to create mock Response objects
const createMockResponse = (
  data: unknown,
  options: { ok?: boolean; status?: number; statusText?: string } = {}
) => ({
  ok: options.ok ?? true,
  status: options.status ?? 200,
  statusText: options.statusText ?? 'OK',
  headers: new Headers(),
  redirected: false,
  type: 'default' as ResponseType,
  url: 'http://test.com',
  clone: jest.fn(),
  body: null,
  bodyUsed: false,
  arrayBuffer: jest.fn(),
  blob: jest.fn(),
  formData: jest.fn(),
  json: jest.fn().mockResolvedValue(data),
  text: jest.fn(),
  bytes: jest.fn().mockResolvedValue(new Uint8Array()),
} as Response)

describe('ApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.clear()
    // Clear auth to ensure test isolation
    apiService.clearAuth()
    // Disable mock mode for most tests
    apiService.setMockMode(false)
  })

  describe('Constructor and Initialization', () => {
    it('should initialize with correct baseURL from environment', () => {
      expect((apiService as any).baseURL).toBeDefined()
    })

    it('should read token from localStorage on initialization', () => {
      localStorageMock.setItem('auth_token', 'test-token')
      expect(apiService.getToken()).toBe('test-token')
    })

    it('should handle missing environment variables gracefully', () => {
      expect((apiService as any).baseURL).toBeTruthy()
    })
  })

  describe('HTTP Methods - GET Requests', () => {
    it('should make successful GET request', async () => {
      const mockData = { status: 'ok', timestamp: '2024-01-01' }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockData }))

      const result = await apiService.healthCheck()

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockData)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/health'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })

    it('should include Authorization header when token exists', async () => {
      // Use setAuth to ensure both localStorage and internal state are updated
      apiService.setAuth('test-token')
      mockFetch.mockResolvedValue(createMockResponse({ data: { valid: true } }))

      await apiService.validateToken()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      )
    })

    it('should not include Authorization header when no token', async () => {
      localStorageMock.removeItem('auth_token')
      mockFetch.mockResolvedValue(createMockResponse({ data: { status: 'ok' } }))

      await apiService.healthCheck()

      const callArgs = mockFetch.mock.calls[0]
      const headers = callArgs?.[1]?.headers as Record<string, string>
      expect(headers?.['Authorization']).toBeUndefined()
    })
  })

  describe('HTTP Methods - POST Requests', () => {
    it('should make successful POST request with JSON body', async () => {
      const loginData = { username: 'testuser', password: 'testpass' }
      const mockResponse = {
        tokens: { accessToken: 'token', refreshToken: 'refresh' },
        user: { id: '1', username: 'testuser', email: 'test@test.com', isAdmin: false },
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockResponse }))

      const result = await apiService.login(loginData)

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            usernameOrEmail: loginData.username,
            password: loginData.password,
          }),
        })
      )
    })

    it('should handle POST request with FormData', async () => {
      const formData = new FormData()
      formData.append('file', new Blob(['test']), 'test.pdf')

      mockFetch.mockResolvedValue(
        createMockResponse({
          data: { fileId: 'file-123', originalName: 'test.pdf' },
        })
      )

      const result = await apiService.uploadFile(formData)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ fileId: 'file-123', originalName: 'test.pdf' })

      // Verify Content-Type was not set (browser sets it with boundary for FormData)
      const callArgs = mockFetch.mock.calls[0]
      const headers = callArgs?.[1]?.headers as Record<string, string>
      expect(headers?.['Content-Type']).toBeUndefined()
    })
  })

  describe('HTTP Methods - PUT Requests', () => {
    it('should make successful PUT request', async () => {
      const updateData = {
        name: 'Updated Set',
        description: 'Updated description',
        category: 'General',
        difficulty: 'medium',
        is_active: true,
      }
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { id: 1, ...updateData } })
      )

      const result = await apiService.updateQuestionSet(1, updateData)

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/question-management/question-sets/1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData),
        })
      )
    })
  })

  describe('HTTP Methods - DELETE Requests', () => {
    it('should make successful DELETE request', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { message: 'Deleted successfully' } })
      )

      const result = await apiService.deleteQuestionSet(1)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ message: 'Deleted successfully' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/question-management/question-sets/1'),
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle HTTP 400 errors', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(
          { error: 'Bad Request' },
          { ok: false, status: 400, statusText: 'Bad Request' }
        )
      )

      const result = await apiService.healthCheck()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Bad Request')
    })

    it('should handle HTTP 404 errors', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(
          { error: 'Not Found' },
          { ok: false, status: 404, statusText: 'Not Found' }
        )
      )

      const result = await apiService.getLobby('INVALID')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Not Found')
    })

    it('should handle HTTP 500 errors', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(
          { error: 'Internal Server Error' },
          { ok: false, status: 500, statusText: 'Internal Server Error' }
        )
      )

      const result = await apiService.healthCheck()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Internal Server Error')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await apiService.healthCheck()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('should handle JSON parsing errors', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      }
      mockFetch.mockResolvedValue(mockResponse as any)

      const result = await apiService.healthCheck()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('should handle unexpected errors', async () => {
      mockFetch.mockRejectedValue('Unexpected error')

      const result = await apiService.healthCheck()

      expect(result.success).toBe(false)
      expect(result.error).toBe('An unexpected error occurred')
    })

    it('should handle response without error field', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(
          {},
          { ok: false, status: 400, statusText: 'Bad Request' }
        )
      )

      const result = await apiService.healthCheck()

      expect(result.success).toBe(false)
      expect(result.error).toContain('HTTP 400')
    })
  })

  describe('Authentication - Token Refresh', () => {
    it('should automatically refresh token on 401 TOKEN_EXPIRED error', async () => {
      localStorageMock.setItem('auth_token', 'old-token')
      localStorageMock.setItem('refresh_token', 'refresh-token')

      // First call fails with TOKEN_EXPIRED
      const errorResponse = createMockResponse(
        { error: 'Token expired', code: 'TOKEN_EXPIRED' },
        { ok: false, status: 401 }
      )

      // Refresh call succeeds
      const refreshResponse = createMockResponse({
        data: {
          tokens: { accessToken: 'new-token', refreshToken: 'new-refresh' },
        },
      })

      // Retry call succeeds
      const successResponse = createMockResponse({
        data: { status: 'ok' },
      })

      mockFetch
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(refreshResponse)
        .mockResolvedValueOnce(successResponse)

      const result = await apiService.healthCheck()

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(3)
      // Verify refresh endpoint was called
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/api/auth/refresh'),
        expect.anything()
      )
    })

    it('should not retry refresh token endpoint itself', async () => {
      localStorageMock.setItem('refresh_token', 'invalid-refresh')

      mockFetch.mockResolvedValue(
        createMockResponse(
          { error: 'Invalid token', code: 'TOKEN_EXPIRED' },
          { ok: false, status: 401 }
        )
      )

      const result = await apiService.refreshToken()

      expect(result.success).toBe(false)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should return error if no refresh token available', async () => {
      localStorageMock.removeItem('refresh_token')

      const result = await apiService.refreshToken()

      expect(result.success).toBe(false)
      expect(result.error).toBe('No refresh token available')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should clear auth and redirect on 401 without TOKEN_EXPIRED code', async () => {
      localStorageMock.setItem('auth_token', 'token')

      mockFetch.mockResolvedValue(
        createMockResponse(
          { error: 'Unauthorized' },
          { ok: false, status: 401 }
        )
      )

      await apiService.healthCheck()

      // Auth should be cleared
      expect(localStorageMock.getItem('auth_token')).toBeNull()
    })
  })

  describe('Authentication - Login', () => {
    it('should login successfully and store tokens', async () => {
      const loginData = { username: 'testuser', password: 'testpass' }
      const mockResponse = {
        tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
        user: { id: '1', username: 'testuser', email: 'test@test.com', isAdmin: false },
      }

      mockFetch.mockResolvedValue(createMockResponse({ data: mockResponse }))

      const result = await apiService.login(loginData)

      expect(result.success).toBe(true)
      expect(localStorageMock.getItem('auth_token')).toBe('access-token')
      expect(localStorageMock.getItem('refresh_token')).toBe('refresh-token')
      expect(localStorageMock.getItem('user_data')).toContain('testuser')
    })

    it('should normalize backend user ID to string', async () => {
      const mockResponse = {
        tokens: { accessToken: 'token', refreshToken: 'refresh' },
        user: { id: 123, username: 'test', email: 'test@test.com', is_admin: true },
      }

      mockFetch.mockResolvedValue(createMockResponse({ data: mockResponse }))

      await apiService.login({ username: 'test', password: 'pass' })

      const userData = JSON.parse(localStorageMock.getItem('user_data') || '{}')
      expect(userData.id).toBe('123')
      expect(userData.isAdmin).toBe(true)
    })

    it('should handle login failure', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(
          { error: 'Invalid credentials' },
          { ok: false, status: 401 }
        )
      )

      const result = await apiService.login({ username: 'bad', password: 'bad' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid credentials')
      expect(localStorageMock.getItem('auth_token')).toBeNull()
    })
  })

  describe('Authentication - Register', () => {
    it('should register successfully and store tokens', async () => {
      const registerData = {
        username: 'newuser',
        email: 'new@test.com',
        password: 'password123',
      }
      const mockResponse = {
        tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
        user: { id: '2', username: 'newuser', email: 'new@test.com', isAdmin: false },
      }

      mockFetch.mockResolvedValue(createMockResponse({ data: mockResponse }))

      const result = await apiService.register(registerData)

      expect(result.success).toBe(true)
      expect(localStorageMock.getItem('auth_token')).toBe('access-token')
      expect(localStorageMock.getItem('refresh_token')).toBe('refresh-token')
    })

    it('should handle registration failure', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(
          { error: 'Username already exists' },
          { ok: false, status: 400 }
        )
      )

      const result = await apiService.register({
        username: 'existing',
        email: 'test@test.com',
        password: 'pass',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Username already exists')
    })
  })

  describe('Authentication - Logout', () => {
    it('should logout and clear tokens', async () => {
      localStorageMock.setItem('auth_token', 'token')
      localStorageMock.setItem('refresh_token', 'refresh')
      localStorageMock.setItem('user_data', '{"id":"1","username":"test"}')

      mockFetch.mockResolvedValue(
        createMockResponse({ data: { message: 'Logged out' } })
      )

      await apiService.logout()

      expect(localStorageMock.getItem('auth_token')).toBeNull()
      expect(localStorageMock.getItem('refresh_token')).toBeNull()
      expect(localStorageMock.getItem('user_data')).toBeNull()
    })
  })

  describe('Authentication - Token Validation', () => {
    it('should validate token', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { valid: true } })
      )

      const result = await apiService.validateToken()

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ valid: true })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/validate'),
        expect.anything()
      )
    })

    it('should return invalid for failed validation', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ error: 'Invalid token' }, { ok: false, status: 401 })
      )

      const result = await apiService.validateToken()

      expect(result.success).toBe(false)
      expect(result.data?.valid).toBe(false)
    })
  })

  describe('Authentication - Password Reset', () => {
    it('should request password reset', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { message: 'Reset email sent' } })
      )

      const result = await apiService.requestPasswordReset('test@test.com')

      expect(result.success).toBe(true)
      expect(result.data?.message).toBe('Reset email sent')
    })

    it('should complete password reset', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { message: 'Password reset successful' } })
      )

      const result = await apiService.completePasswordReset('reset-token', 'newpass')

      expect(result.success).toBe(true)
      expect(result.data?.message).toBe('Password reset successful')
    })

    it('should change password for authenticated user', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { message: 'Password changed' } })
      )

      const result = await apiService.changePassword('oldpass', 'newpass')

      expect(result.success).toBe(true)
      expect(result.data?.message).toBe('Password changed')
    })
  })

  describe('Authentication - Email Verification', () => {
    it('should verify email with token', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { message: 'Email verified' } })
      )

      const result = await apiService.verifyEmail('verification-token')

      expect(result.success).toBe(true)
      expect(result.data?.message).toBe('Email verified')
    })

    it('should resend verification email', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { message: 'Verification email sent' } })
      )

      const result = await apiService.resendEmailVerification('test@test.com')

      expect(result.success).toBe(true)
      expect(result.data?.message).toBe('Verification email sent')
    })
  })

  describe('Utility Methods', () => {
    it('should set authentication tokens', () => {
      apiService.setAuth('test-token', 'refresh-token', {
        id: '1',
        username: 'test',
        email: 'test@test.com',
      })

      expect(localStorageMock.getItem('auth_token')).toBe('test-token')
      expect(localStorageMock.getItem('refresh_token')).toBe('refresh-token')
      expect(localStorageMock.getItem('user_data')).toContain('test')
    })

    it('should set token without refresh token', () => {
      apiService.setAuth('test-token')

      expect(localStorageMock.getItem('auth_token')).toBe('test-token')
      expect(localStorageMock.getItem('refresh_token')).toBeNull()
    })

    it('should clear authentication tokens', () => {
      localStorageMock.setItem('auth_token', 'token')
      localStorageMock.setItem('refresh_token', 'refresh')
      localStorageMock.setItem('user_data', '{"id":"1"}')

      apiService.clearAuth()

      expect(localStorageMock.getItem('auth_token')).toBeNull()
      expect(localStorageMock.getItem('refresh_token')).toBeNull()
      expect(localStorageMock.getItem('user_data')).toBeNull()
    })

    it('should check if user is authenticated', () => {
      localStorageMock.removeItem('auth_token')
      expect(apiService.isAuthenticated()).toBe(false)

      localStorageMock.setItem('auth_token', 'test-token')
      expect(apiService.isAuthenticated()).toBe(true)
    })

    it('should get current token', () => {
      localStorageMock.removeItem('auth_token')
      expect(apiService.getToken()).toBeNull()

      localStorageMock.setItem('auth_token', 'test-token')
      expect(apiService.getToken()).toBe('test-token')
    })

    it('should get current user data', () => {
      localStorageMock.removeItem('user_data')
      expect(apiService.getCurrentUser()).toBeNull()

      const userData = { id: '1', username: 'test', email: 'test@test.com' }
      localStorageMock.setItem('user_data', JSON.stringify(userData))
      expect(apiService.getCurrentUser()).toEqual(userData)
    })

    it('should handle corrupted user data gracefully', () => {
      localStorageMock.setItem('user_data', 'invalid-json')
      expect(apiService.getCurrentUser()).toBeNull()
    })

    it('should sync token from localStorage', () => {
      // Simulate token being set in another tab/window
      localStorageMock.setItem('auth_token', 'new-token')

      // getToken should pick up the new value
      expect(apiService.getToken()).toBe('new-token')
    })
  })

  describe('Generic HTTP Methods', () => {
    it('should perform GET request', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { message: 'success' } })
      )

      const result = await apiService.get<{ message: string }>('/test')

      expect(result).toEqual({ message: 'success' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({ method: 'GET' })
      )
    })

    it('should perform POST request', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { id: 1 } })
      )

      const result = await apiService.post<{ id: number }>('/test', { name: 'test' })

      expect(result).toEqual({ id: 1 })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' }),
        })
      )
    })

    it('should perform PUT request', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { updated: true } })
      )

      const result = await apiService.put<{ updated: boolean }>('/test', {
        name: 'updated',
      })

      expect(result).toEqual({ updated: true })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({ method: 'PUT' })
      )
    })

    it('should perform DELETE request', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { deleted: true } })
      )

      const result = await apiService.delete<{ deleted: boolean }>('/test')

      expect(result).toEqual({ deleted: true })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('should throw error on failed generic request', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(
          { error: 'Failed' },
          { ok: false, status: 400 }
        )
      )

      await expect(apiService.get('/test')).rejects.toThrow('Failed')
    })
  })

  describe('Response Data Normalization', () => {
    it('should handle response with data wrapper', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { id: 1, name: 'Test' } })
      )

      const result = await apiService.healthCheck()

      expect(result.data).toEqual({ id: 1, name: 'Test' })
    })

    it('should handle response without data wrapper', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ id: 1, name: 'Test' })
      )

      const result = await apiService.healthCheck()

      expect(result.data).toEqual({ id: 1, name: 'Test' })
    })

    it('should include message from response', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { id: 1 }, message: 'Success!' })
      )

      const result = await apiService.healthCheck()

      expect(result.message).toBe('Success!')
    })
  })

  describe('Lobby Management', () => {
    it('should create lobby successfully', async () => {
      const mockLobby = {
        lobby: { id: 1, code: 'ABC123', status: 'waiting', players: [] },
        message: 'Lobby created',
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockLobby }))

      const result = await apiService.createLobby({ questionCount: 10 })

      expect(result.success).toBe(true)
      expect(result.data?.code).toBe('ABC123')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/lobbies'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should join lobby successfully', async () => {
      const mockLobby = {
        lobby: { code: 'ABC123', players: [{ id: '1', username: 'test' }] },
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockLobby }))

      const result = await apiService.joinLobby({ lobbyCode: 'ABC123' })

      expect(result.success).toBe(true)
      expect(result.data?.code).toBe('ABC123')
    })

    it('should get lobby details', async () => {
      const mockLobby = {
        lobby: { code: 'ABC123', status: 'waiting' },
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockLobby }))

      const result = await apiService.getLobby('ABC123')

      expect(result.success).toBe(true)
      expect(result.data?.code).toBe('ABC123')
    })

    it('should leave lobby', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { message: 'Left lobby' } })
      )

      const result = await apiService.leaveLobby('ABC123')

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/lobbies/ABC123/leave'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should set player ready status', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { message: 'Ready status updated' } })
      )

      const result = await apiService.setPlayerReady('ABC123', true)

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/lobbies/ABC123/ready'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ isReady: true }),
        })
      )
    })

    it('should start game', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { message: 'Game started' } })
      )

      const result = await apiService.startGame('ABC123')

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/lobbies/ABC123/start'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should get available question sets for lobby', async () => {
      const mockSets = [
        { id: 1, name: 'General', category: 'general', difficulty: 'easy', questionCount: 10, isActive: true }
      ]
      mockFetch.mockResolvedValue(createMockResponse({ data: mockSets }))

      const result = await apiService.getAvailableQuestionSets()

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
    })

    it('should update lobby question sets', async () => {
      const mockData = {
        message: 'Updated',
        lobby: { code: 'ABC123', questionSetIds: [1, 2] },
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockData }))

      const result = await apiService.updateLobbyQuestionSets('ABC123', [1, 2], 20)

      expect(result.success).toBe(true)
      expect(result.data?.lobby?.code).toBe('ABC123')
    })
  })

  describe('Question Management', () => {
    it('should get question sets', async () => {
      const mockSets = [
        { id: 1, name: 'General Knowledge', description: 'General questions' },
      ]
      mockFetch.mockResolvedValue(createMockResponse({ data: mockSets }))

      const result = await apiService.getQuestionSets()

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
    })

    it('should get question set details', async () => {
      const mockSet = {
        id: 1,
        name: 'Test Set',
        description: 'Test',
        category: 'general',
        difficulty: 'medium',
        is_active: true,
        questions: [],
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockSet }))

      const result = await apiService.getQuestionSetDetails(1)

      expect(result.success).toBe(true)
      expect(result.data?.id).toBe(1)
    })

    it('should create question set', async () => {
      const setData = {
        name: 'New Set',
        description: 'Test',
        category: 'general',
        difficulty: 'easy',
      }
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { id: 1, ...setData, is_active: true } })
      )

      const result = await apiService.createQuestionSet(setData)

      expect(result.success).toBe(true)
      expect(result.data?.name).toBe('New Set')
    })

    it('should add question to set', async () => {
      const questionData = {
        question_text: { en: 'What is 2+2?' },
        answers: { en: ['3', '4', '5'] },
        explanation: { en: '2+2=4' },
        difficulty: 1,
      }
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { id: 1, question_set_id: 1, ...questionData } })
      )

      const result = await apiService.addQuestionToSet(1, questionData)

      expect(result.success).toBe(true)
      expect(result.data?.id).toBe(1)
    })

    it('should update question', async () => {
      const questionData = {
        question_text: { en: 'Updated question' },
        answers: { en: ['A', 'B', 'C'] },
        explanation: { en: 'Explanation' },
        difficulty: 2,
      }
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { id: 1, question_set_id: 1, ...questionData } })
      )

      const result = await apiService.updateQuestion(1, questionData)

      expect(result.success).toBe(true)
      expect(result.data?.difficulty).toBe(2)
    })

    it('should delete question', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { message: 'Question deleted' } })
      )

      const result = await apiService.deleteQuestion(1)

      expect(result.success).toBe(true)
    })

    it('should export question set', async () => {
      const mockData = {
        questionSet: {
          id: 1,
          name: 'Test Set',
          description: 'Test',
          category: 'general',
          difficulty: 'easy',
          is_active: true
        },
        questions: [],
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockData }))

      const result = await apiService.exportQuestionSet(1)

      expect(result.success).toBe(true)
      expect(result.data?.questionSet.name).toBe('Test Set')
    })

    it('should import question set', async () => {
      const importData = {
        questionSet: {
          id: 0,
          name: 'Imported Set',
          description: 'Test',
          category: 'general',
          difficulty: 'easy',
          is_active: true
        },
        questions: [],
      }
      mockFetch.mockResolvedValue(
        createMockResponse({
          data: { message: 'Imported', questionSetId: 1, questionsImported: 0 },
        })
      )

      const result = await apiService.importQuestionSet(importData)

      expect(result.success).toBe(true)
      expect(result.data?.questionSetId).toBe(1)
    })

    it('should get question set stats', async () => {
      const stats = {
        total_questions: 10,
        avg_difficulty: 2.5,
        min_difficulty: 1,
        max_difficulty: 5,
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: stats }))

      const result = await apiService.getQuestionSetStats(1)

      expect(result.success).toBe(true)
      expect(result.data?.total_questions).toBe(10)
    })
  })

  describe('Character Management', () => {
    it('should get all characters', async () => {
      const mockCharacters = [
        { id: '1', name: 'Student', emoji: '🎓', description: 'Learner', unlockLevel: 1 },
      ]
      mockFetch.mockResolvedValue(createMockResponse({ data: mockCharacters }))

      const result = await apiService.getAllCharacters()

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
    })

    it('should get character profile', async () => {
      const mockProfile = {
        character: { id: '1', name: 'Student', emoji: '🎓' },
        level: 5,
        experience: 1250,
        progress: { currentLevel: 5, progress: 50, expInLevel: 250, expForNextLevel: 500 },
        availableCharacters: [],
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockProfile }))

      const result = await apiService.getCharacterProfile()

      expect(result.success).toBe(true)
      expect(result.data?.level).toBe(5)
    })

    it('should update character selection', async () => {
      const mockResponse = {
        user: { id: '1', username: 'test' },
        characterInfo: { character: { id: '2', name: 'Professor' }, level: 1 },
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockResponse }))

      const result = await apiService.updateCharacter('2')

      expect(result.success).toBe(true)
      expect(result.data?.characterInfo?.character?.id).toBe('2')
    })

    it('should award experience points', async () => {
      const mockResponse = {
        user: { id: '1' },
        levelUp: true,
        newLevel: 6,
        oldLevel: 5,
        progress: { currentLevel: 6, progress: 0, expInLevel: 0, expForNextLevel: 600 },
        experienceAwarded: 500,
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockResponse }))

      const result = await apiService.awardExperience(500)

      expect(result.success).toBe(true)
      expect(result.data?.levelUp).toBe(true)
      expect(result.data?.newLevel).toBe(6)
    })

    it('should get experience requirements', async () => {
      const mockRequirements = [
        { level: 1, experienceRequired: 100, experienceTotal: 100 },
        { level: 2, experienceRequired: 200, experienceTotal: 300 },
      ]
      mockFetch.mockResolvedValue(createMockResponse({ data: mockRequirements }))

      const result = await apiService.getExperienceRequirements(10)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
    })
  })

  describe('AI Question Generation', () => {
    it('should generate questions from topic', async () => {
      const mockResponse = {
        questionSet: { id: 1, name: 'AI Generated', description: 'Test', category: 'general', difficulty: 'medium', is_active: true },
        questions: [{ id: 1, question_set_id: 1, question_text: 'Test?', answers: ['A', 'B'], explanation: 'Test', difficulty: 1 }],
        metadata: { topic: 'Test', category: 'general', difficulty: 'medium', generatedAt: '2024-01-01', contextUsed: [] },
        message: 'Generated',
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockResponse }))

      const result = await apiService.generateQuestions({
        topic: 'Test',
        category: 'general',
        difficulty: 'medium',
        questionCount: 5,
        language: 'en',
      })

      expect(result.success).toBe(true)
      expect(result.data?.questions).toHaveLength(1)
    })

    it('should generate questions from text', async () => {
      const mockResponse = {
        questionSet: { id: 1, name: 'From Text', description: 'Test', category: 'general', difficulty: 'easy', is_active: true },
        questions: [],
        metadata: { topic: 'Test', category: 'general', difficulty: 'easy', generatedAt: '2024-01-01', sourceContent: 'test content' },
        message: 'Generated',
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockResponse }))

      const result = await apiService.generateQuestionsFromText({
        topic: 'Test',
        category: 'general',
        difficulty: 'easy',
        questionCount: 5,
        language: 'en',
        content: 'test content',
      })

      expect(result.success).toBe(true)
    })

    it('should test Gemini connection', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { success: true } })
      )

      const result = await apiService.testGeminiConnection()

      expect(result.success).toBe(true)
      expect(result.data?.success).toBe(true)
    })

    it('should test Chroma connection', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { success: true } })
      )

      const result = await apiService.testChromaConnection()

      expect(result.success).toBe(true)
    })

    it('should get Chroma stats', async () => {
      const stats = {
        totalDocuments: 100,
        totalEmbeddings: 500,
        sources: ['source1'],
        subjects: ['subject1'],
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: stats }))

      const result = await apiService.getChromaStats()

      expect(result.success).toBe(true)
      expect(result.data?.totalDocuments).toBe(100)
    })
  })

  describe('File Upload', () => {
    it('should upload single file', async () => {
      const mockResponse = {
        fileId: 'file-123',
        originalName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        metadata: {},
        chromaDocumentId: 'doc-123',
        chunks: 5,
        wordCount: 500,
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockResponse }))

      const formData = new FormData()
      formData.append('file', new Blob(['test']), 'test.pdf')

      const result = await apiService.uploadFile(formData)

      expect(result.success).toBe(true)
      expect(result.data?.fileId).toBe('file-123')
    })

    it('should upload multiple files', async () => {
      const mockResponse = {
        processed: 2,
        failed: 0,
        results: [
          { fileId: 'file-1', originalName: 'test1.pdf', fileType: 'application/pdf', fileSize: 1024, metadata: {}, chromaDocumentId: 'doc-1', chunks: 3, wordCount: 300 },
        ],
        errors: [],
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockResponse }))

      const formData = new FormData()
      formData.append('files', new Blob(['test1']), 'test1.pdf')
      formData.append('files', new Blob(['test2']), 'test2.pdf')

      const result = await apiService.uploadFiles(formData)

      expect(result.success).toBe(true)
      expect(result.data?.processed).toBe(2)
    })

    it('should get file status', async () => {
      const mockStatus = {
        fileId: 'file-123',
        originalName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        metadata: {},
        chromaDocumentId: 'doc-123',
        createdAt: '2024-01-01',
        status: 'completed',
        progress: 100,
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockStatus }))

      const result = await apiService.getFileStatus('file-123')

      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('completed')
    })

    it('should delete file', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { message: 'File deleted' } })
      )

      const result = await apiService.deleteFile('file-123')

      expect(result.success).toBe(true)
    })
  })

  describe('Admin Management', () => {
    it('should get admin users list', async () => {
      const mockResponse = {
        items: [
          { id: 1, username: 'admin', email: 'admin@test.com', is_admin: true, is_active: true, character_level: 1, experience_points: 0, created_at: '2024-01-01', selected_character: null, last_login: null, avatar_url: null, timezone: null },
        ],
        total: 1,
        limit: 10,
        offset: 0,
        sort: { by: 'created_at', dir: 'DESC' as const },
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockResponse }))

      const result = await apiService.getAdminUsers()

      expect(result.success).toBe(true)
      expect(result.data?.items).toHaveLength(1)
    })

    it('should update user character level', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { success: true, user: { id: 1, character_level: 5 } } })
      )

      const result = await apiService.updateUserCharacterLevel(1, 5)

      expect(result.success).toBe(true)
      expect(result.data?.user?.character_level).toBe(5)
    })

    it('should set user password', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { success: true } })
      )

      const result = await apiService.setUserPassword(1, 'newpassword')

      expect(result.success).toBe(true)
    })

    it('should delete user', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { success: true } })
      )

      const result = await apiService.deleteUser(1)

      expect(result.success).toBe(true)
    })

    it('should create user', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { success: true, user: { id: 2, username: 'newuser' } } })
      )

      const result = await apiService.createUser({
        username: 'newuser',
        email: 'new@test.com',
        password: 'password',
      })

      expect(result.success).toBe(true)
      expect(result.data?.user?.username).toBe('newuser')
    })

    it('should clear lobbies', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { success: true, deleted: { lobbies: 5, sessions: 10 } } })
      )

      const result = await apiService.clearLobbies()

      expect(result.success).toBe(true)
      expect(result.data?.deleted?.lobbies).toBe(5)
    })
  })

  describe('Perks Management', () => {
    it('should get all perks', async () => {
      const mockPerks = [
        { id: 1, name: 'perk1', category: 'cosmetic', type: 'badge', level_required: 1, title: 'Perk 1', description: 'Test perk', is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
      ]
      mockFetch.mockResolvedValue(createMockResponse({ data: mockPerks }))

      const result = await apiService.getAllPerks()

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
    })

    it('should get user perks', async () => {
      const mockResponse = {
        perks: [{ id: 1, user_id: 1, perk_id: 1, is_unlocked: true, is_active: false, configuration: {}, updated_at: '2024-01-01' }],
        activePerks: [],
        loadout: { user_id: 1, active_avatar: 'student', active_theme: 'default', perks_config: {}, active_perks: [] },
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockResponse }))

      const result = await apiService.getUserPerks()

      expect(result.success).toBe(true)
      expect(result.data?.perks).toHaveLength(1)
    })

    it('should unlock perk', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { message: 'Perk unlocked' } })
      )

      const result = await apiService.unlockPerk(1)

      expect(result.success).toBe(true)
    })

    it('should activate perk', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { message: 'Perk activated' } })
      )

      const result = await apiService.activatePerk(1, {})

      expect(result.success).toBe(true)
    })

    it('should deactivate perk', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: { message: 'Perk deactivated' } })
      )

      const result = await apiService.deactivatePerk(1)

      expect(result.success).toBe(true)
    })

    it('should check perk unlocks', async () => {
      const mockResponse = {
        newlyUnlocked: [{ id: 2, name: 'perk2', category: 'cosmetic', type: 'badge', level_required: 5, title: 'Perk 2', description: 'New perk' }],
        totalUnlocked: 2,
      }
      mockFetch.mockResolvedValue(createMockResponse({ data: mockResponse }))

      const result = await apiService.checkPerkUnlocks()

      expect(result.success).toBe(true)
      expect(result.data?.newlyUnlocked).toHaveLength(1)
    })
  })
})
