import {
  Lobby,
  Question,
  ApiResponse,
  LobbyListResponse,
  MockLobby,
  MockData,
  QuestionSetData,
  AuthRequest,
  AuthResponse,
  Character,
  CharacterProfile,
  CreateLobbyRequest,
  JoinLobbyRequest,
  LobbyData,
  FileMetadata,
  QuestionText,
  QuestionAnswers,
  QuestionExplanation
} from '../types'
import { importMetaEnv } from '../utils/import-meta'

// JWT secrets for test mode - should match backend secrets
const JWT_SECRET = 'N8mK2xR9qW4eT6yU3oP7sA1dF5gH8jL0cV9bM6nQ4wE7rY2tI5uO3pA8sD1fG6hJ'
const JWT_REFRESH_SECRET = 'X2cV5bN8mK0qW9eR6tY4uI7oP3aS1dF9gH5jL2kM6nQ8wE4rT7yU0iO9pA3sD6fG'

// Simple JWT-like token generation for test mode (browser-compatible)
const generateAccessToken = (userId: string, username: string, email: string, isAdmin: boolean = false) => {
  const payload = {
    id: userId,
    username,
    email,
    isAdmin,
    type: 'access',
    exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
    iat: Math.floor(Date.now() / 1000)
  }

  // Create a simple base64 encoded token for test mode
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payloadEncoded = btoa(JSON.stringify(payload))
  const signature = btoa(`${header}.${payloadEncoded}.${JWT_SECRET}`)

  return `${header}.${payloadEncoded}.${signature}`
}

const generateRefreshToken = (userId: string) => {
  const payload = {
    id: userId,
    type: 'refresh',
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    iat: Math.floor(Date.now() / 1000)
  }

  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payloadEncoded = btoa(JSON.stringify(payload))
  const signature = btoa(`${header}.${payloadEncoded}.${JWT_REFRESH_SECRET}`)

  return `${header}.${payloadEncoded}.${signature}`
}

const validateJwtToken = (token: string, secret: string) => {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return { valid: false, payload: null }
    }

    const [header, payloadEncoded, signature] = parts
    const expectedSignature = btoa(`${header}.${payloadEncoded}.${secret}`)

    if (signature !== expectedSignature) {
      return { valid: false, payload: null }
    }

    if (!payloadEncoded) {
      return { valid: false, payload: null }
    }
    const payload = JSON.parse(atob(payloadEncoded))

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, payload: null }
    }

    return { valid: true, payload }
  } catch (error) {
    return { valid: false, payload: null }
  }
}

const normalizeAuthServiceUrl = (authUrl: string) => {
  const trimmed = authUrl.trim().replace(/\/+$/, '')
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
}



interface MockUser {
  id: string
  username: string
  email: string
  password: string
  isAdmin?: boolean
  verified?: boolean
}







class ApiService {
  private baseURL: string
  private authBaseURL: string
  private token: string | null = null

  // Enable lightweight front-end mocks for e2e when VITE_TEST_MODE=true
  private isMockEnabled: boolean
  private mockOverride: boolean | null = null
  private static mockData: MockData = {
    users: [
      { id: '1', username: 'testuser', email: 'test@example.com', password: 'TestPassword123!', isAdmin: false, verified: true },
    ],
    lobbies: {},
    characters: [
      { id: '1', name: 'Student', emoji: '🎓', description: 'A curious learner', unlockLevel: 1 },
      { id: '2', name: 'Professor', emoji: '🧑‍🏫', description: 'A wise teacher', unlockLevel: 10 },
      { id: '3', name: 'Scientist', emoji: '🧪', description: 'A brilliant mind', unlockLevel: 20 },
    ],
    questionSets: [],
    questions: []
  }

  constructor() {
    // Handle both Vite and Jest environments
    let envUrl: string | undefined;

    if (typeof importMetaEnv.VITE_API_URL === 'string') {
      envUrl = importMetaEnv.VITE_API_URL;
    }

    if (!envUrl && typeof process !== 'undefined' && typeof process.env?.VITE_API_URL === 'string') {
      // Fallback to process.env for Jest/Node environment
      envUrl = process.env.VITE_API_URL;
    }

    // Default to relative /api path to use Vite proxy in development
    // In production behind Traefik, calls go to same-origin `/api`
    this.baseURL = (envUrl && envUrl.trim()) || '/api'

    let authEnvUrl: string | undefined;
    if (typeof importMetaEnv.VITE_AUTH_SERVICE_URL === 'string') {
      authEnvUrl = importMetaEnv.VITE_AUTH_SERVICE_URL;
    }

    if (!authEnvUrl && typeof process !== 'undefined' && typeof process.env?.['VITE_AUTH_SERVICE_URL'] === 'string') {
      authEnvUrl = process.env['VITE_AUTH_SERVICE_URL'];
    }

    this.authBaseURL = authEnvUrl && authEnvUrl.trim()
      ? normalizeAuthServiceUrl(authEnvUrl)
      : this.baseURL

    console.log('ApiService initialized with baseURL:', this.baseURL, 'authBaseURL:', this.authBaseURL, 'envUrl:', envUrl)
    this.token = localStorage.getItem('auth_token')

    // Check for test mode via URL or localStorage to enable mocks even if env vars are missing
    let urlTestMode = false;
    let storageTestMode = false;
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        urlTestMode = urlParams.get('test') === 'true' || urlParams.get('mock') === 'true';

        // Persist test mode in sessionStorage so it survives navigations within the same session
        if (urlTestMode) {
          sessionStorage.setItem('test_mode', 'true');
        }

        storageTestMode = localStorage.getItem('test_mode') === 'true' || sessionStorage.getItem('test_mode') === 'true';
      }
    } catch {
      // ignore
    }

    // Determine if mock mode should be enabled for tests
    const viteTestFlag = importMetaEnv.VITE_TEST_MODE === 'true';
    const nodeEnvTest = (typeof process !== 'undefined' && process?.env?.NODE_ENV === 'test')
    const viteEnvTest = (typeof process !== 'undefined' && process?.env?.VITE_TEST_MODE === 'true')

    this.isMockEnabled = !!viteTestFlag || !!nodeEnvTest || !!viteEnvTest || urlTestMode || storageTestMode
    console.log('ApiService: isMockEnabled =', this.isMockEnabled, { viteTestFlag, nodeEnvTest, viteEnvTest, urlTestMode, storageTestMode })


    // In test/mock mode, hydrate mock data from localStorage to persist across reloads/tabs
    if (this.isMockEnabled) {
      try {
        const usersRaw = localStorage.getItem('mock_users')
        if (usersRaw) {
          const users = JSON.parse(usersRaw)
          if (Array.isArray(users)) {
            (ApiService.mockData.users as MockUser[]) = users
          }
        }
      } catch {
        // ignore parse errors
      }

      try {
        const lobbiesRaw = localStorage.getItem('mock_lobbies')
        if (lobbiesRaw) {
          const lobbies = JSON.parse(lobbiesRaw)
          if (lobbies && typeof lobbies === 'object') {
            (ApiService.mockData.lobbies as Record<string, MockLobby>) = lobbies
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    baseUrlOverride?: string
  ): Promise<ApiResponse<T>> {
    // Use lightweight front-end mocks in test mode to avoid backend dependency
    const useMock = this.mockOverride ?? this.isMockEnabled

    if (useMock) {
      return this.mockRequest<T>(endpoint, options)
    }

    const baseUrl = baseUrlOverride || this.baseURL
    const url = `${baseUrl}${endpoint}`
    console.log('Making API request to:', url)

    const headers: Record<string, string> = {
      'X-Requested-With': 'XMLHttpRequest',
      ...(options.headers as Record<string, string>),
    }

    // Only set Content-Type to application/json if body is not FormData
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }))

        // Handle token expiration with automatic refresh
        if (response.status === 401 && errorData.code === 'TOKEN_EXPIRED' && endpoint !== '/auth/refresh') {
          const refreshResponse = await this.refreshToken()
          if (refreshResponse.success) {
            // Retry the original request with new token
            return this.request(endpoint, options, baseUrlOverride)
          }
          // Refresh failed — session is truly dead
          this.clearAuth()
          if (typeof window !== 'undefined') {
            window.location.href = '/'
          }
        }

        const statusMessage = response.status ? `HTTP ${response.status}` : 'Request failed'
        const errorMessage = errorData.error || errorData.message || statusMessage

        return {
          success: false,
          error: errorMessage,
          details: errorData.details,
        }
      }

      const data = await response.json()
      return {
        success: true,
        data: data.data || data,
        message: data.message,
      }
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error)

      if (error instanceof Error) {
        // Handle authentication errors
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          this.clearAuth()
          if (typeof window !== 'undefined') {
            window.location.href = '/'
          }
        }

        return {
          success: false,
          error: error.message,
        }
      }

      return {
        success: false,
        error: 'An unexpected error occurred',
      }
    }
  }

  private async authRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    return this.request(endpoint, options, this.authBaseURL)
  }

  setMockMode(enable: boolean | null) {
    this.mockOverride = enable
  }

  // Lightweight mock handler for test mode
  private async mockRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const method = (options.method || 'GET').toUpperCase()
    console.log(`ApiService Mock: ${method} ${endpoint}`)
    try {
      const parseBody = () => {
        try {
          if (!options.body) return {}
          if (typeof options.body === 'string') return JSON.parse(options.body)
          if (options.body instanceof FormData || options.body instanceof URLSearchParams ||
            options.body instanceof ArrayBuffer || options.body instanceof Blob ||
            options.body instanceof ReadableStream) return {}
          if (typeof options.body === 'object' && options.body !== null && !('byteLength' in options.body)) {
            return options.body as Record<string, unknown>
          }
          return {}
        } catch {
          // ignore parse errors
          return {}
        }
      }

      // Profile mock
      if (endpoint === '/characters/profile' && method === 'GET') {
        const character = ApiService.mockData.characters[0]
        return {
          success: true,
          data: {
            character: character,
            level: 10,
            experience: 15400,
            progress: {
              currentLevel: 10,
              progress: 45,
              expInLevel: 450,
              expForNextLevel: 1000
            },
            availableCharacters: ApiService.mockData.characters
          }
        } as ApiResponse<T>;
      }

      // Perks endpoints
      if (endpoint === '/perks/all' && method === 'GET') {
        const perks = [
          {
            id: 1,
            name: 'starter_badge',
            category: 'cosmetic',
            type: 'badge',
            level_required: 1,
            title: 'Starter Badge',
            description: 'Celebrate your first session',
            config_schema: null,
            asset_data: null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
        return { success: true, data: perks as any } as ApiResponse<T>
      }

      if (endpoint === '/perks/user' && method === 'GET') {
        const currentUser = this.getCurrentUser() || { id: '0', username: 'guest', email: 'guest@example.com' }
        const userId = Number(currentUser.id) || 0
        const now = new Date().toISOString()
        const perks = [
          {
            id: 1,
            user_id: userId,
            perk_id: 1,
            is_unlocked: true,
            is_active: true,
            configuration: { theme_name: 'default' },
            unlocked_at: now,
            updated_at: now,
            perk: {
              id: 1,
              name: 'starter_theme',
              category: 'cosmetic',
              type: 'theme',
              level_required: 1,
              title: 'Campus Classic Theme',
              description: 'Adds a light academic theme to your dashboard.',
              is_active: true
            }
          },
          {
            id: 2,
            user_id: userId,
            perk_id: 2,
            is_unlocked: true,
            is_active: false,
            configuration: {},
            unlocked_at: now,
            updated_at: now,
            perk: {
              id: 2,
              name: 'avatar_scholar',
              category: 'cosmetic',
              type: 'avatar',
              level_required: 2,
              title: 'Scholar Avatar',
              description: 'Unlocks a scholarly avatar pose.',
              is_active: true
            }
          },
          {
            id: 3,
            user_id: userId,
            perk_id: 3,
            is_unlocked: true,
            is_active: false,
            configuration: {},
            unlocked_at: now,
            updated_at: now,
            perk: {
              id: 3,
              name: 'starter_badge',
              category: 'cosmetic',
              type: 'badge',
              level_required: 1,
              title: 'Starter Badge',
              description: 'Celebrate your first session.',
              is_active: true
            }
          },
          {
            id: 4,
            user_id: userId,
            perk_id: 4,
            is_unlocked: false,
            is_active: false,
            configuration: {},
            unlocked_at: null,
            updated_at: now,
            perk: {
              id: 4,
              name: 'focus_mode',
              category: 'utility',
              type: 'utility',
              level_required: 5,
              title: 'Focus Mode',
              description: 'Reduces distractions during quizzes.',
              is_active: false
            }
          },
        ]

        const response = {
          perks,
          activePerks: perks.filter(perk => perk.is_active),
          loadout: {
            user_id: userId,
            active_avatar: 'student',
            active_theme: 'default',
            active_badge: 'starter_badge',
            perks_config: {},
            active_perks: perks.filter(perk => perk.is_active)
          }
        }
        return { success: true, data: response as any } as ApiResponse<T>
      }

      if (endpoint.startsWith('/perks/activate/') && method === 'POST') {
        return { success: true, data: { message: 'Perk activated' } as any } as ApiResponse<T>
      }

      if (endpoint.startsWith('/perks/deactivate/') && method === 'POST') {
        return { success: true, data: { message: 'Perk deactivated' } as any } as ApiResponse<T>
      }

      if (endpoint.startsWith('/perks/options/') && method === 'GET') {
        return {
          success: true,
          data: {
            options: [
              { id: 'opt1', label: 'Option 1', value: 'val1' },
              { id: 'opt2', label: 'Option 2', value: 'val2' }
            ]
          } as any
        } as ApiResponse<T>
      }

      if (endpoint.startsWith('/perks/unlock/') && method === 'POST') {
        return { success: true, data: { message: 'Perk unlocked' } as any } as ApiResponse<T>
      }

      if (endpoint === '/user/me' && method === 'GET') {
        return { success: false, error: 'Unauthorized', status: 401 } as ApiResponse<T>;
      }

      // Auth endpoints
      if (endpoint === '/auth/register' && method === 'POST') {
        const body = parseBody()
        const { username, email, password } = body || {}
        if (!username || !email || !password) {
          return { success: false, error: 'Missing required fields' } as ApiResponse<T>
        }
        const existing = ApiService.mockData.users.find((u: any) => u.username === username)
        if (existing) {
          return { success: false, error: 'Username already exists' } as ApiResponse<T>
        }
        const id = String(ApiService.mockData.users.length + 1)
        ApiService.mockData.users.push({ id, username, email, password, isAdmin: false, verified: true })
        try {
          localStorage.setItem('mock_users', JSON.stringify(ApiService.mockData.users))
        } catch { /* ignore */ }
        const accessToken = generateAccessToken(id, username, email, false)
        const refreshToken = generateRefreshToken(id)
        const data = {
          tokens: { accessToken, refreshToken },
          user: { id, username, email, isAdmin: false, characterLevel: 10, selectedCharacter: 'student' }
        }
        return { success: true, data } as ApiResponse<T>
      }

      if (endpoint === '/auth/login' && method === 'POST') {
        const body = parseBody()
        const { username, usernameOrEmail, password } = body || {}
        const loginName = username || usernameOrEmail
        const user = ApiService.mockData.users.find((u: any) => u.username === loginName || u.email === loginName)
        if (!user || user.password !== password) {
          return { success: false, error: 'Invalid credentials' } as ApiResponse<T>
        }
        const accessToken = generateAccessToken(user.id, user.username, user.email, !!user.isAdmin)
        const refreshToken = generateRefreshToken(user.id)
        const data = {
          tokens: { accessToken, refreshToken },
          user: { id: user.id, username: user.username, email: user.email, isAdmin: !!user.isAdmin, characterLevel: 10, selectedCharacter: 'student' }
        }
        return { success: true, data } as ApiResponse<T>
      }

      if (endpoint === '/auth/logout' && method === 'POST') {
        this.clearAuth()
        return { success: true, data: undefined } as unknown as ApiResponse<T>
      }

      if (endpoint === '/auth/validate' && method === 'GET') {
        const currentToken = localStorage.getItem('auth_token')
        if (currentToken && currentToken !== this.token) {
          this.token = currentToken
        }
        if (!this.token) {
          return { success: true, data: { valid: false } as any } as ApiResponse<T>
        }
        const validation = validateJwtToken(this.token, JWT_SECRET)
        return { success: true, data: { valid: validation.valid } as any } as ApiResponse<T>
      }

      if (endpoint === '/auth/refresh' && method === 'POST') {
        const refreshToken = localStorage.getItem('refresh_token')
        if (!refreshToken) {
          return { success: false, error: 'No refresh token available' } as ApiResponse<T>
        }
        const validation = validateJwtToken(refreshToken, JWT_REFRESH_SECRET)
        if (!validation.valid || !validation.payload) {
          return { success: false, error: 'Invalid refresh token' } as ApiResponse<T>
        }
        const payload = validation.payload as Record<string, unknown>
        const newAccessToken = generateAccessToken(payload['id'] as string, (payload['username'] as string) || 'user', (payload['email'] as string) || 'user@example.com', Boolean(payload['isAdmin']))
        const newRefreshToken = generateRefreshToken(payload['id'] as string)
        const data = { tokens: { accessToken: newAccessToken, refreshToken: newRefreshToken } }
        return { success: true, data } as ApiResponse<T>
      }

      // Characters
      if (endpoint === '/characters' && method === 'GET') {
        return { success: true, data: ApiService.mockData.characters as any } as ApiResponse<T>
      }

      if (endpoint === '/characters/select' && method === 'PUT') {
        const body = parseBody()
        const character = ApiService.mockData.characters.find(c => c.id === String(body?.characterId)) || ApiService.mockData.characters[0]
        const profile = {
          user: { ...(this.getCurrentUser() || { id: '0', username: 'guest', email: 'guest@example.com' }) },
          characterInfo: {
            character,
            level: 10,
            experience: 0,
            progress: { currentLevel: 1, progress: 0, expInLevel: 0, expForNextLevel: 100 },
            availableCharacters: ApiService.mockData.characters
          }
        }
        return { success: true, data: profile as any } as ApiResponse<T>
      }

      // Lobbies
      if ((endpoint.startsWith('/lobbies') || endpoint.startsWith('/api/lobbies')) && method === 'GET') {
        // Parse query parameters for limit
        const url = new URL(`http://localhost${endpoint}`)
        const limit = parseInt(url.searchParams.get('limit') || '10', 10)

        // Convert lobby objects to the expected format with player arrays
        const lobbiesList = Object.values(ApiService.mockData.lobbies).map(lobby => ({
          id: Math.floor(Math.random() * 1000) + 1,
          code: lobby.code,
          host_id: 1,
          status: (lobby as any).status || 'waiting',
          question_count: 10,
          created_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
          updated_at: new Date().toISOString(),
          players: lobby.players.map(p => ({
            id: p.id,
            username: p.username,
            character: 'student',
            characterLevel: 1,
            isReady: p.isReady,
            isHost: p.isHost,
            score: 0,
            multiplier: 1,
            correctAnswers: 0,
            isConnected: true,
            joinedAt: new Date().toISOString()
          })),
          settings: {
            questionSetIds: [1],
            timeLimit: 30,
            allowReplay: false
          }
        })).slice(0, limit)

        return { success: true, data: { lobbies: lobbiesList } as any } as ApiResponse<T>
      }

      if (endpoint === '/lobbies' && method === 'POST') {
        const code = Array.from({ length: 6 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('')
        const currentUser = this.getCurrentUser() || { id: '0', username: 'guest', email: 'guest@example.com' }
        const lobby = {
          code,
          players: [{ id: currentUser.id, username: currentUser.username, isHost: true, isReady: false }],
          status: 'waiting'
        }
        ApiService.mockData.lobbies[code] = lobby
        // Persist lobbies so other tabs/pages can access them in e2e
        try {
          localStorage.setItem('mock_lobbies', JSON.stringify(ApiService.mockData.lobbies))
        } catch {
          // ignore storage errors
        }
        // Return the lobby directly as data to match expected structure
        return { success: true, data: lobby as any } as ApiResponse<T>
      }

      // Join lobby
      if (endpoint === '/lobbies/join' && method === 'POST') {
        const body = parseBody()
        const lobbyCode = (body?.lobbyCode || '').toString().toUpperCase()
        if (!lobbyCode || !ApiService.mockData.lobbies[lobbyCode]) {
          return { success: false, error: 'Lobby not found' } as ApiResponse<T>
        }
        const currentUser = this.getCurrentUser() || { id: '0', username: 'guest', email: 'guest@example.com' }
        const lobby = ApiService.mockData.lobbies[lobbyCode]
        if (!lobby.players.find(p => p.id === currentUser.id)) {
          lobby.players.push({ id: currentUser.id, username: currentUser.username, isHost: false, isReady: false })
        }
        try {
          localStorage.setItem('mock_lobbies', JSON.stringify(ApiService.mockData.lobbies))
        } catch {
          // ignore storage errors
        }
        // Return the lobby directly as data to match expected structure
        return { success: true, data: lobby as any } as ApiResponse<T>
      }

      // Get lobby
      if (method === 'GET' && /^\/lobbies\/[A-Z0-9]{6}$/.test(endpoint)) {
        const code = endpoint.split('/').pop() as string
        const lobby = code ? ApiService.mockData.lobbies[code] : undefined
        if (!lobby) {
          return { success: false, error: 'Lobby not found' } as ApiResponse<T>
        }
        // Return the lobby directly as data to match expected structure
        return { success: true, data: lobby as any } as ApiResponse<T>
      }

      if (endpoint.endsWith('/leave') && method === 'POST') {
        return { success: true, data: undefined } as unknown as ApiResponse<T>
      }

      // Start game (mock)
      if (method === 'POST' && /^\/lobbies\/[A-Z0-9]{6}\/start$/.test(endpoint)) {
        const code = endpoint.split('/')[2]
        const lobby = code ? ApiService.mockData.lobbies[code] : undefined
        if (!lobby) {
          return { success: false, error: 'Lobby not found' } as ApiResponse<T>
        }
        ; (lobby as MockLobby & { status: string }).status = 'playing'
        try {
          localStorage.setItem('mock_lobbies', JSON.stringify(ApiService.mockData.lobbies))
        } catch {
          // ignore storage errors
        }
        return { success: true, data: undefined } as unknown as ApiResponse<T>
      }

      // Question sets management endpoints
      if (endpoint === '/api/questions/sets' && method === 'POST') {
        const body = parseBody()
        const { name, description, category, difficulty, is_active, is_public } = body || {}
        if (!name || !description) {
          return { success: false, error: 'Missing required fields' } as ApiResponse<T>
        }
        const id = Math.floor(Math.random() * 10000) + 1
        const questionSet = {
          id,
          name,
          description,
          category: category || 'General',
          difficulty: difficulty || 'medium',
          is_active: is_active !== undefined ? is_active : true,
          is_public: is_public !== undefined ? is_public : true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        // Store the created question set for later retrieval
        if (!ApiService.mockData.questionSets) {
          (ApiService.mockData as any).questionSets = []
        }
        ; (ApiService.mockData as any).questionSets.push(questionSet)
        return { success: true, data: questionSet } as ApiResponse<T>
      }

      // Create individual question
      if (endpoint === '/api/questions' && method === 'POST') {
        const body = parseBody()
        const { question_set_id, question_text, answers, explanation, difficulty } = body || {}
        if (!question_set_id || !question_text || !answers) {
          return { success: false, error: 'Missing required fields' } as ApiResponse<T>
        }
        const id = Math.floor(Math.random() * 10000) + 1
        const question = {
          id,
          question_set_id,
          question_text,
          answers,
          explanation,
          difficulty: difficulty || 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        // Store the created question
        if (!ApiService.mockData.questions) {
          (ApiService.mockData as any).questions = []
        }
        ; (ApiService.mockData as any).questions.push(question)
        return { success: true, data: question } as ApiResponse<T>
      }

      // Get questions/sets with pagination
      if (endpoint.startsWith('/api/questions/sets?') && method === 'GET') {
        const url = new URL(`http://localhost${endpoint}`)
        const limit = parseInt(url.searchParams.get('limit') || '10', 10)
        const offset = parseInt(url.searchParams.get('offset') || '0', 10)
        const sort = url.searchParams.get('sort') || 'created_at'
        const dir = url.searchParams.get('dir') || 'DESC'

        const questionSets = (ApiService.mockData as any).questionSets || []
        const total = questionSets.length
        const items = questionSets.slice(offset, offset + limit)

        return {
          success: true,
          data: {
            items,
            limit,
            offset,
            sort: { by: sort, dir },
            total
          }
        } as ApiResponse<T>
      }

      // Get questions for a specific set with pagination
      if (method === 'GET' && /^\/api\/questions\/sets\/\d+\/questions/.test(endpoint)) {
        const url = new URL(`http://localhost${endpoint}`)
        const part = endpoint.split('/')[4] ?? '0'
        const setId = parseInt(part, 10) || 0
        const limit = parseInt(url.searchParams.get('limit') || '10', 10)
        const offset = parseInt(url.searchParams.get('offset') || '0', 10)
        const sort = url.searchParams.get('sort') || 'created_at'
        const dir = url.searchParams.get('dir') || 'DESC'

        const questions = (ApiService.mockData as any).questions || []
        const setQuestions = questions.filter((q: any) => q.question_set_id === setId)
        const total = setQuestions.length
        const items = setQuestions.slice(offset, offset + limit)

        return {
          success: true,
          data: {
            items,
            limit,
            offset,
            sort: { by: sort, dir },
            total
          }
        } as ApiResponse<T>
      }

      // Search questions
      if (endpoint.startsWith('/api/questions/search?') && method === 'GET') {
        const url = new URL(`http://localhost${endpoint}`)
        const q = url.searchParams.get('q') || ''
        const limit = parseInt(url.searchParams.get('limit') || '10', 10)
        const offset = parseInt(url.searchParams.get('offset') || '0', 10)
        const sort = url.searchParams.get('sort') || 'created_at'
        const dir = url.searchParams.get('dir') || 'DESC'

        const questions = (ApiService.mockData as any).questions || []
        // Simple search - match question text
        const filteredQuestions = questions.filter((question: any) => {
          const questionText = typeof question.question_text === 'object'
            ? (question.question_text.en || question.question_text.de || '')
            : (question.question_text || '')
          return questionText.toLowerCase().includes(q.toLowerCase())
        })

        const total = filteredQuestions.length
        const items = filteredQuestions.slice(offset, offset + limit)

        return {
          success: true,
          data: {
            items,
            limit,
            offset,
            sort: { by: sort, dir },
            total
          }
        } as ApiResponse<T>
      }

      // Fallback for unmocked endpoints
      console.warn(`[MockAPI] No mock handler for ${method} ${endpoint}. Returning failure.`)
      return { success: false, error: `No mock handler for ${endpoint}` } as ApiResponse<T>
    } catch (err) {
      console.error('[MockAPI] Error handling mock request:', err)
      return { success: false, error: 'Mock request failed' } as ApiResponse<T>
    }
  }

  // Authentication methods
  async register(data: AuthRequest): Promise<ApiResponse<AuthResponse>> {
    const response = await this.authRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })

    if (response.success && response.data) {
      // Backend returns { user, tokens } structure
      const authData = response.data as any
      // Convert user ID to string for frontend compatibility and normalize isAdmin
      const userData = {
        ...authData.user,
        id: String(authData.user?.id || ''),
        isAdmin: Boolean(authData.user?.isAdmin ?? authData.user?.is_admin ?? authData.user?.role === 'ADMIN')
      }
      this.setAuth(authData.tokens?.accessToken, authData.tokens?.refreshToken, userData)
    }

    return response
  }

  async login(data: Omit<AuthRequest, 'email'>): Promise<ApiResponse<AuthResponse>> {
    const response = await this.authRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        usernameOrEmail: data.username,
        password: data.password
      }),
    })

    if (response.success && response.data) {
      // Backend returns { user, tokens } structure
      const authData = response.data as any
      // Convert user ID to string for frontend compatibility
      const userData = {
        ...authData.user,
        id: String(authData.user?.id || authData.user?.userId || ''),
        // Normalize admin flag from backend (is_admin) to camelCase for the frontend
        isAdmin: Boolean(authData.user?.isAdmin ?? authData.user?.is_admin ?? authData.user?.role === 'ADMIN')
      }
      this.setAuth(authData.tokens?.accessToken, authData.tokens?.refreshToken, userData)
    }

    return response
  }

  async logout(): Promise<ApiResponse<void>> {
    const response = await this.authRequest<void>('/auth/logout', {
      method: 'POST',
    })

    this.clearAuth()
    return response
  }

  async validateToken(): Promise<ApiResponse<{ valid: boolean }>> {
    const response = await this.authRequest<any>('/auth/validate')
    if (response.success) {
      return {
        success: true,
        data: { valid: true }
      }
    }

    return {
      success: false,
      error: response.error || 'Validation failed',
      data: { valid: false }
    }
  }

  async getCurrentUserFromServer(): Promise<ApiResponse<any>> {
    // Use local auth endpoint which handles Traefik ForwardAuth headers
    const response = await this.request<any>('/auth/me')
    if (response.success && response.data?.user) {
      return {
        success: true,
        data: response.data.user
      }
    }
    return response
  }

  async refreshToken(): Promise<ApiResponse<AuthResponse>> {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      return {
        success: false,
        error: 'No refresh token available'
      }
    }

    const response = await this.authRequest<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    })

    if (response.success && response.data) {
      // Backend returns { tokens } structure
      const authData = response.data as any
      const userData = authData.user ? {
        ...authData.user,
        id: String(authData.user.id || authData.user.userId || '')
      } : undefined
      this.setAuth(authData.tokens.accessToken, authData.tokens.refreshToken, userData)
    }

    return response
  }

  // Password reset methods
  async requestPasswordReset(email: string): Promise<ApiResponse<{ message: string }>> {
    return this.authRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    })
  }

  async completePasswordReset(token: string, newPassword: string): Promise<ApiResponse<{ message: string }>> {
    return this.authRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    })
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<{ message: string }>> {
    return this.authRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    })
  }

  // Email verification methods
  async verifyEmail(token: string): Promise<ApiResponse<{ message: string }>> {
    return this.authRequest('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token })
    })
  }

  async resendEmailVerification(email: string): Promise<ApiResponse<{ message: string }>> {
    return this.authRequest('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email })
    })
  }

  // OAuth 2.0 methods
  async exchangeOAuthCode(code: string, state: string): Promise<ApiResponse<any>> {
    const response = await this.request<any>('/auth/oauth/exchange', {
      method: 'POST',
      body: JSON.stringify({ code, state })
    })

    if (response.success && response.data) {
      const authData = response.data as any
      const userData = {
        ...authData.user,
        id: String(authData.user?.id || authData.user?.userId || ''),
        isAdmin: Boolean(authData.user?.isAdmin ?? authData.user?.is_admin ?? authData.user?.role === 'ADMIN')
      }
      this.setAuth(authData.tokens?.accessToken, authData.tokens?.refreshToken, userData)
    }

    return response
  }

  async refreshOAuthToken(): Promise<ApiResponse<any>> {
    const response = await this.request<any>('/auth/oauth/refresh', {
      method: 'POST'
    })

    if (response.success && response.data) {
      const authData = response.data as any
      const userData = {
        ...authData.user,
        id: String(authData.user?.id || authData.user?.userId || ''),
        isAdmin: Boolean(authData.user?.isAdmin ?? authData.user?.is_admin ?? authData.user?.role === 'ADMIN')
      }
      this.setAuth(authData.tokens?.accessToken, authData.tokens?.refreshToken, userData)
    }

    return response
  }

  async oauthLogout(): Promise<ApiResponse<void>> {
    const response = await this.request<void>('/auth/oauth/logout', {
      method: 'POST'
    })

    this.clearAuth()
    return response
  }

  async getOAuthConfig(): Promise<any> {
    const response = await this.request<any>('/auth/oauth/config')
    return response.success ? response.data : null
  }

  // Lobby methods
  async createLobby(data: CreateLobbyRequest): Promise<ApiResponse<Lobby>> {
    const response = await this.request<any>('/lobbies', {
      method: 'POST',
      body: JSON.stringify(data),
    })

    // Normalize backend shape { message, lobby } -> return Lobby directly in data
    if (response.success && response.data) {
      if (response.data.lobby) {
        return { ...response, data: response.data.lobby as Lobby }
      }
      // If data is already a lobby object (mock case), return as is
      if (response.data.code) {
        return response as ApiResponse<Lobby>
      }
    }

    return response as ApiResponse<Lobby>
  }

  async joinLobby(data: JoinLobbyRequest): Promise<ApiResponse<Lobby>> {
    const response = await this.request<any>('/lobbies/join', {
      method: 'POST',
      body: JSON.stringify(data),
    })

    // Normalize backend shape { message, lobby } -> return Lobby directly in data
    if (response.success && response.data) {
      if (response.data.lobby) {
        return { ...response, data: response.data.lobby as Lobby }
      }
      // If data is already a lobby object (mock case), return as is
      if (response.data.code) {
        return response as ApiResponse<Lobby>
      }
    }

    return response as ApiResponse<Lobby>
  }

  async getLobby(lobbyCode: string): Promise<ApiResponse<Lobby>> {
    const response = await this.request<any>(`/lobbies/${lobbyCode}`)

    // Normalize backend shape { lobby } -> return Lobby directly in data
    if (response.success && response.data) {
      if (response.data.lobby) {
        return { ...response, data: response.data.lobby as Lobby }
      }
      // If data is already a lobby object (mock case), return as is
      if (response.data.code) {
        return response as ApiResponse<Lobby>
      }
    }

    return response as ApiResponse<Lobby>
  }

  async leaveLobby(lobbyCode: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/lobbies/${lobbyCode}/leave`, {
      method: 'POST',
    })
  }

  async setPlayerReady(lobbyCode: string, isReady: boolean): Promise<ApiResponse<void>> {
    return this.request<void>(`/lobbies/${lobbyCode}/ready`, {
      method: 'POST',
      body: JSON.stringify({ isReady }),
    })
  }

  async startGame(lobbyCode: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/lobbies/${lobbyCode}/start`, {
      method: 'POST',
    })
  }

  // Question methods
  async getQuestionSets(): Promise<ApiResponse<Array<{
    id: number;
    name: string;
    description: string;
    category?: string;
    difficulty?: string;
    is_active?: boolean;
    is_public?: boolean;
    is_featured?: boolean;
    tags?: string[];
    metadata?: Record<string, any>;
    owner_id?: number;
    created_at?: string;
    updated_at?: string;
  }>>> {
    // Use the question-management endpoint for consistency with other operations
    const response = await this.request<Array<{
      id: number;
      name: string;
      description: string;
      category?: string;
      difficulty?: string;
      is_active?: boolean;
      is_public?: boolean;
      is_featured?: boolean;
      tags?: string[];
      metadata?: Record<string, any>;
      owner_id?: number;
      created_at?: string;
      updated_at?: string;
    }>>('/question-management/question-sets')

    // Ensure we have a consistent response format
    if (response.success && Array.isArray(response.data)) {
      return {
        success: true,
        data: response.data.map(set => ({
          id: set.id,
          name: set.name,
          description: set.description || '',
          category: set.category || '',
          difficulty: set.difficulty || 'medium',
          is_active: set.is_active !== undefined ? set.is_active : true,
          ...(set.is_public !== undefined ? { is_public: set.is_public } : {}),
          ...(set.is_featured !== undefined ? { is_featured: set.is_featured } : {}),
          tags: set.tags || [],
          metadata: set.metadata || {},
          ...(set.owner_id !== undefined ? { owner_id: set.owner_id } : {}),
          ...(set.created_at !== undefined ? { created_at: set.created_at } : {}),
          ...(set.updated_at !== undefined ? { updated_at: set.updated_at } : {})
        }))
      }
    }

    return response
  }

  async getRandomQuestion(language = 'en'): Promise<ApiResponse<Question>> {
    return this.request<Question>(`/questions/random?lang=${language}`)
  }

  // Question Set Management methods
  async getQuestionSetDetails(id: number): Promise<ApiResponse<{
    id: number
    name: string
    description: string
    category: string
    difficulty: string
    is_active: boolean
    is_public?: boolean
    is_featured?: boolean
    tags?: string[]
    metadata?: Record<string, any>
    owner_id?: number
    created_at?: string
    updated_at?: string
    questions: Array<{
      id: number
      question_text: any
      answers: any
      explanation: any
      difficulty: number
    }>
  }>> {
    return this.request<{
      id: number
      name: string
      description: string
      category: string
      difficulty: string
      is_active: boolean
      is_public?: boolean
      is_featured?: boolean
      tags?: string[]
      metadata?: Record<string, any>
      owner_id?: number
      created_at?: string
      updated_at?: string
      questions: Array<{
        id: number
        question_text: any
        answers: any
        explanation: any
        difficulty: number
      }>
    }>(`/question-management/question-sets/${id}`)
  }

  async createQuestionSet(data: {
    name: string
    description: string
    category: string
    difficulty: string
  }): Promise<ApiResponse<{
    id: number
    name: string
    description: string
    category: string
    difficulty: string
    is_active: boolean
  }>> {
    return this.request<{
      id: number
      name: string
      description: string
      category: string
      difficulty: string
      is_active: boolean
    }>('/question-management/question-sets', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateQuestionSet(id: number, data: {
    name: string
    description: string
    category: string
    difficulty: string
    is_active: boolean
  }): Promise<ApiResponse<{
    id: number
    name: string
    description: string
    category: string
    difficulty: string
    is_active: boolean
  }>> {
    return this.request<{
      id: number
      name: string
      description: string
      category: string
      difficulty: string
      is_active: boolean
    }>(`/question-management/question-sets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteQuestionSet(id: number): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/question-management/question-sets/${id}`, {
      method: 'DELETE'
    })
  }

  async addQuestionToSet(setId: number, data: {
    question_text: any
    answers: any
    explanation: any
    difficulty: number
  }): Promise<ApiResponse<{
    id: number
    question_set_id: number
    question_text: any
    answers: any
    explanation: any
    difficulty: number
  }>> {
    return this.request<{
      id: number
      question_set_id: number
      question_text: any
      answers: any
      explanation: any
      difficulty: number
    }>(`/question-management/question-sets/${setId}/questions`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateQuestion(id: number, data: {
    question_text: any
    answers: any
    explanation: any
    difficulty: number
  }): Promise<ApiResponse<{
    id: number
    question_set_id: number
    question_text: any
    answers: any
    explanation: any
    difficulty: number
  }>> {
    return this.request<{
      id: number
      question_set_id: number
      question_text: any
      answers: any
      explanation: any
      difficulty: number
    }>(`/question-management/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteQuestion(id: number): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/question-management/questions/${id}`, {
      method: 'DELETE'
    })
  }

  async exportQuestionSet(id: number): Promise<ApiResponse<QuestionSetData>> {
    return this.request<QuestionSetData>(`/question-management/question-sets/${id}/export`)
  }

  async importQuestionSet(data: QuestionSetData): Promise<ApiResponse<{
    message: string
    questionSetId: number
    questionsImported: number
  }>> {
    return this.request<{
      message: string
      questionSetId: number
      questionsImported: number
    }>('/question-management/question-sets/import', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async getQuestionSetStats(id: number): Promise<ApiResponse<{
    total_questions: number
    avg_difficulty: number
    min_difficulty: number
    max_difficulty: number
  }>> {
    const response = await this.request<{
      total_questions: number | string
      avg_difficulty: number | string
      min_difficulty: number | string
      max_difficulty: number | string
    }>(`/question-management/question-sets/${id}/stats`)

    if (response.success && response.data) {
      const d = response.data
      return {
        ...response,
        data: {
          total_questions: Number(d.total_questions) || 0,
          avg_difficulty: Number(d.avg_difficulty),
          min_difficulty: Number(d.min_difficulty),
          max_difficulty: Number(d.max_difficulty)
        }
      }
    }

    return response as ApiResponse<{
      total_questions: number
      avg_difficulty: number
      min_difficulty: number
      max_difficulty: number
    }>
  }

  // Game methods
  async submitAnswer(
    lobbyCode: string,
    questionId: number,
    answerIndex: number
  ): Promise<ApiResponse<{ isCorrect: boolean; score: number }>> {
    return this.request<{ isCorrect: boolean; score: number }>(`/lobbies/${lobbyCode}/answer`, {
      method: 'POST',
      body: JSON.stringify({ questionId, answerIndex }),
    })
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.request<{ status: string; timestamp: string }>('/health')
  }

  // Hall of Fame
  async getHallOfFame(questionSetId?: number): Promise<ApiResponse<Array<{
    id: string
    username: string
    score: number
    questionSetName: string
    createdAt: string
  }>>> {
    const params = questionSetId ? `?questionSetId=${questionSetId}` : ''
    return this.request<Array<{
      id: string
      username: string
      score: number
      questionSetName: string
      createdAt: string
    }>>(`/hall-of-fame${params}`)
  }

  // Character management methods
  async getAllCharacters(): Promise<ApiResponse<Character[]>> {
    return this.request<Character[]>('/characters')
  }

  async getAvailableCharacters(): Promise<ApiResponse<{
    availableCharacters: Character[]
    currentCharacter: Character
    level: number
    experience: number
    progress: { currentLevel: number; progress: number; expInLevel: number; expForNextLevel: number }
  }>> {
    return this.request<{
      availableCharacters: Character[]
      currentCharacter: Character
      level: number
      experience: number
      progress: { currentLevel: number; progress: number; expInLevel: number; expForNextLevel: number }
    }>('/characters/available')
  }

  async getCharacterProfile(): Promise<ApiResponse<CharacterProfile>> {
    return this.request<CharacterProfile>('/characters/profile')
  }

  async updateCharacter(characterId: string): Promise<ApiResponse<{
    user: any
    characterInfo: CharacterProfile
  }>> {
    return this.request<{
      user: any
      characterInfo: CharacterProfile
    }>('/characters/select', {
      method: 'PUT',
      body: JSON.stringify({ characterId })
    })
  }

  async awardExperience(experiencePoints: number): Promise<ApiResponse<{
    user: any
    levelUp: boolean
    newLevel: number
    oldLevel: number
    progress: { currentLevel: number; progress: number; expInLevel: number; expForNextLevel: number }
    experienceAwarded: number
  }>> {
    return this.request<{
      user: any
      levelUp: boolean
      newLevel: number
      oldLevel: number
      progress: { currentLevel: number; progress: number; expInLevel: number; expForNextLevel: number }
      experienceAwarded: number
    }>('/characters/experience/award', {
      method: 'POST',
      body: JSON.stringify({ experiencePoints })
    })
  }

  async getExperienceRequirements(level: number = 10): Promise<ApiResponse<Array<{
    level: number
    experienceRequired: number
    experienceTotal: number
  }>>> {
    return this.request<Array<{
      level: number
      experienceRequired: number
      experienceTotal: number
    }>>(`/characters/experience/calculate?level=${level}`)
  }

  // AI Question Generation Methods
  async generateQuestions(data: {
    topic: string
    category: string
    difficulty: 'easy' | 'medium' | 'hard'
    questionCount: number
    language: 'en' | 'de'
  }): Promise<ApiResponse<{
    questionSet: {
      id: number
      name: string
      description: string
      category: string
      difficulty: string
      is_active: boolean
    }
    questions: Array<{
      id: number
      question_set_id: number
      question_text: QuestionText | string
      answers: QuestionAnswers | string[]
      explanation: QuestionExplanation | string
      difficulty: number
    }>
    metadata: {
      topic: string
      category: string
      difficulty: string
      generatedAt: string
      contextUsed: string[]
    }
    message: string
  }>> {
    return this.request('/question-management/question-sets/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async generateQuestionsFromFile(formData: FormData): Promise<ApiResponse<{
    questionSet: {
      id: number
      name: string
      description: string
      category: string
      difficulty: string
      is_active: boolean
    }
    questions: Array<{
      id: number
      question_set_id: number
      question_text: QuestionText | string
      answers: QuestionAnswers | string[]
      explanation: QuestionExplanation | string
      difficulty: number
    }>
    metadata: {
      topic: string
      category: string
      difficulty: string
      generatedAt: string
      sourceFile: string
    }
    message: string
  }>> {
    return this.request('/question-management/question-sets/generate-from-file', {
      method: 'POST',
      body: formData
    })
  }

  async generateQuestionsFromText(data: {
    topic: string
    category: string
    difficulty: 'easy' | 'medium' | 'hard'
    questionCount: number
    language: 'en' | 'de'
    content: string
  }): Promise<ApiResponse<{
    questionSet: {
      id: number
      name: string
      description: string
      category: string
      difficulty: string
      is_active: boolean
    }
    questions: Array<{
      id: number
      question_set_id: number
      question_text: QuestionText | string
      answers: QuestionAnswers | string[]
      explanation: QuestionExplanation | string
      difficulty: number
    }>
    metadata: {
      topic: string
      category: string
      difficulty: string
      generatedAt: string
      sourceContent: string
    }
    message: string
  }>> {
    return this.request('/question-management/question-sets/generate-from-text', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async testGeminiConnection(): Promise<ApiResponse<{ success: boolean; error?: string }>> {
    return this.request('/question-management/ai/test-gemini', {
      method: 'GET',
    })
  }

  async testChromaConnection(): Promise<ApiResponse<{ success: boolean; error?: string }>> {
    return this.request('/question-management/ai/test-chroma', {
      method: 'GET',
    })
  }

  async getChromaStats(): Promise<ApiResponse<{
    totalDocuments: number
    totalEmbeddings: number
    sources: string[]
    subjects: string[]
  }>> {
    return this.request('/question-management/ai/chroma-stats', {
      method: 'GET',
    })
  }

  async addDocumentsToChroma(data: {
    content: string
    metadata: FileMetadata
  }): Promise<ApiResponse<{
    success: boolean
    documentsProcessed: number
    embeddingsCreated: number
    error?: string
  }>> {
    return this.request('/question-management/ai/add-documents', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async searchChromaContext(data: {
    query: string
    nResults?: number
    subject?: string
  }): Promise<ApiResponse<{
    success: boolean
    results: Array<{
      content: string
      metadata: FileMetadata
      distance: number
    }>
    count: number
  }>> {
    return this.request('/question-management/ai/search-context', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getAvailableData(): Promise<ApiResponse<{
    sources: string[]
    subjects: string[]
  }>> {
    return this.request('/question-management/ai/available-data', {
      method: 'GET',
    })
  }

  // Question set management for lobbies
  async getAvailableQuestionSets(): Promise<ApiResponse<Array<{
    id: number
    name: string
    category: string
    difficulty: string
    questionCount: number
    isActive: boolean
  }>>> {
    return this.request('/lobbies/question-sets/available', {
      method: 'GET',
    })
  }

  async getLobbyQuestionSetInfo(lobbyCode: string): Promise<ApiResponse<{
    selectedSets: Array<{ id: number; name: string; questionCount: number }>
    totalQuestions: number
    selectedQuestionCount: number
    maxQuestionCount: number
  }>> {
    return this.request(`/lobbies/${lobbyCode}/question-sets`, {
      method: 'GET',
    })
  }

  async updateLobbyQuestionSets(
    lobbyCode: string,
    questionSetIds: number[],
    questionCount: number
  ): Promise<ApiResponse<{
    message: string
    lobby: LobbyData
  }>> {
    return this.request(`/lobbies/${lobbyCode}/question-sets`, {
      method: 'PUT',
      body: JSON.stringify({
        questionSetIds,
        questionCount
      })
    })
  }

  // Generic HTTP methods
  async get<T>(endpoint: string): Promise<T> {
    const response = await this.request<T>(endpoint, {
      method: 'GET'
    })

    if (!response.success) {
      throw new Error(response.error || 'Request failed')
    }

    return response.data as T
  }

  async post<T>(endpoint: string, data?: Record<string, unknown>): Promise<T> {
    const response = await this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : null
    })

    if (!response.success) {
      throw new Error(response.error || 'Request failed')
    }

    return response.data as T
  }

  async put<T>(endpoint: string, data?: Record<string, unknown>): Promise<T> {
    const response = await this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : null
    })

    if (!response.success) {
      throw new Error(response.error || 'Request failed')
    }

    return response.data as T
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await this.request<T>(endpoint, {
      method: 'DELETE'
    })

    if (!response.success) {
      throw new Error(response.error || 'Request failed')
    }

    return response.data as T
  }

  // Utility methods
  setAuth(token: string, refreshToken?: string, userData?: any): void {
    this.token = token
    localStorage.setItem('auth_token', token)
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken)
    }
    if (userData) {
      // Ensure ID is normalized and present before storing
      const normalizedUser = {
        ...userData,
        id: String(userData.id || userData.userId || userData.sub || ''),
        isAdmin: Boolean(userData.isAdmin ?? userData.is_admin ?? userData.role === 'ADMIN')
      }
      localStorage.setItem('user_data', JSON.stringify(normalizedUser))
    }
  }

  clearAuth(): void {
    this.token = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_data')
  }

  isAuthenticated(): boolean {
    // Always check localStorage for the most current token state
    // This ensures synchronization even if this.token is stale
    const currentToken = localStorage.getItem('auth_token')
    if (currentToken && currentToken !== this.token) {
      this.token = currentToken
    }

    // Check for explicit token or presence of user_data as evidence 
    // of session-based authentication (cookie-based)
    return !!this.token || !!localStorage.getItem('user_data')
  }

  getToken(): string | null {
    // Always check localStorage for the most current token state
    const currentToken = localStorage.getItem('auth_token')
    if (currentToken && currentToken !== this.token) {
      this.token = currentToken
    }
    return this.token
  }

  getCurrentUser(): { id: string; username: string; email: string; isAdmin?: boolean } | null {
    const userData = localStorage.getItem('user_data')
    if (userData) {
      try {
        return JSON.parse(userData)
      } catch {
        return null
      }
    }
    return null
  }

  // File Upload Methods
  async uploadFile(formData: FormData): Promise<ApiResponse<{
    fileId: string
    originalName: string
    fileType: string
    fileSize: number
    metadata: any
    chromaDocumentId: string
    chunks: number
    wordCount: number
  }>> {
    return this.request('/file-upload/single', {
      method: 'POST',
      headers: {
        // Don't set Content-Type for FormData, let the browser set it with boundary
      },
      body: formData,
    })
  }

  async uploadFiles(formData: FormData): Promise<ApiResponse<{
    processed: number
    failed: number
    results: Array<{
      fileId: string
      originalName: string
      fileType: string
      fileSize: number
      metadata: any
      chromaDocumentId: string
      chunks: number
      wordCount: number
    }>
    errors: Array<{
      originalName: string
      error: string
      details?: string[]
    }>
  }>> {
    return this.request('/file-upload/batch', {
      method: 'POST',
      headers: {
        // Don't set Content-Type for FormData, let the browser set it with boundary
      },
      body: formData,
    })
  }

  async getFiles(params?: URLSearchParams): Promise<ApiResponse<{
    files: Array<{
      fileId: string
      originalName: string
      fileType: string
      fileSize: number
      metadata: any
      chromaDocumentId: string
      createdAt: string
    }>
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
    }
  }>> {
    const queryString = params ? `?${params.toString()}` : ''
    return this.request(`/file-upload/files${queryString}`)
  }

  async getFile(fileId: string): Promise<ApiResponse<{
    fileId: string
    originalName: string
    fileType: string
    fileSize: number
    metadata: any
    chromaDocumentId: string
    createdAt: string
  }>> {
    return this.request(`/file-upload/files/${fileId}`)
  }

  async deleteFile(fileId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/file-upload/${fileId}`, {
      method: 'DELETE',
    })
  }

  async getFileStatus(fileId: string): Promise<ApiResponse<{
    fileId: string;
    originalName: string;
    fileType: string;
    fileSize: number;
    metadata: any;
    chromaDocumentId: string;
    createdAt: string;
    status: string;
    // Optional fields exposed by processing pipeline
    progress?: number;
    currentStep?: string;
    error?: string;
    content?: string;
    chunks?: string[];
  }>> {
    return this.request(`/file-upload/status/${fileId}`)
  }

  async updateFileOptions(fileId: string, options: Record<string, unknown>): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request(`/file-upload/${fileId}/options`, {
      method: 'PUT',
      body: JSON.stringify(options),
    });
  }

  async updateFileMetadata(fileId: string, metadata: Record<string, unknown>): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request(`/files/${fileId}/metadata`, {
      method: 'PUT',
      body: JSON.stringify(metadata),
    });
  }

  // Admin Users Management methods
  async getAdminUsers(params?: URLSearchParams): Promise<ApiResponse<{
    items: Array<{
      id: number;
      username: string;
      email: string;
      is_admin: boolean;
      is_active: boolean;
      selected_character: string | null;
      character_level: number;
      experience_points: number;
      created_at: string;
      last_login: string | null;
      avatar_url: string | null;
      timezone: string | null;
    }>;
    total: number;
    limit: number;
    offset: number;
    sort: {
      by: string;
      dir: 'ASC' | 'DESC';
    };
  }>> {
    const queryString = params ? `?${params.toString()}` : '';
    return this.request(`/admin/users${queryString}`, {
      method: 'GET'
    });
  }

  async updateUserCharacterLevel(userId: number, level: number): Promise<ApiResponse<{
    success: boolean;
    user: { id: number; character_level: number };
  }>> {
    return this.request(`/admin/users/${userId}/character-level`, {
      method: 'PUT',
      body: JSON.stringify({ level }),
    })
  }

  async setUserPassword(userId: number, newPassword: string): Promise<ApiResponse<{
    success: boolean;
  }>> {
    return this.request(`/admin/users/${userId}/password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    })
  }

  async deleteUser(userId: number): Promise<ApiResponse<{
    success: boolean;
  }>> {
    return this.request(`/admin/users/${userId}`, {
      method: 'DELETE',
    })
  }

  // Generic user update (admin)
  async updateUser(userId: number, data: Record<string, unknown>): Promise<ApiResponse<{ success: boolean; user: Record<string, unknown> }>> {
    return this.request(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  // Clear lobbies (admin)
  async clearLobbies(): Promise<ApiResponse<{ success: boolean; deleted: { lobbies: number; sessions: number } }>> {
    return this.request(`/admin/lobbies/clear`, {
      method: 'POST'
    })
  }

  // Create user (admin)
  async createUser(data: { username: string; email: string; password: string; is_admin?: boolean; is_active?: boolean }): Promise<ApiResponse<{ success: boolean; user: any }>> {
    return this.request(`/admin/users`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Rebuild service (admin)
  async rebuildService(): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request(`/admin/service/rebuild`, {
      method: 'POST'
    })
  }

  // Perks Management methods
  async getAllPerks(): Promise<ApiResponse<Array<{
    id: number;
    name: string;
    category: string;
    type: string;
    level_required: number;
    title: string;
    description: string;
    config_schema?: any;
    asset_data?: any;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>>> {
    return this.request('/perks/all')
  }

  async getUserPerks(): Promise<ApiResponse<{
    perks: Array<{
      id: number;
      user_id: number;
      perk_id: number;
      is_unlocked: boolean;
      is_active: boolean;
      configuration: any;
      unlocked_at?: string;
      activated_at?: string;
      updated_at: string;
      perk?: {
        id: number;
        name: string;
        category: string;
        type: string;
        level_required: number;
        title: string;
        description: string;
        is_active: boolean;
      };
    }>;
    activePerks: Array<{
      id: number;
      user_id: number;
      perk_id: number;
      is_unlocked: boolean;
      is_active: boolean;
      configuration: any;
      perk?: {
        id: number;
        name: string;
        category: string;
        type: string;
        level_required: number;
        title: string;
        description: string;
        is_active: boolean;
      };
    }>;
    loadout: {
      user_id: number;
      active_avatar: string;
      active_badge?: string;
      active_theme: string;
      perks_config: any;
      active_perks: any[];
    };
  }>> {
    return this.request('/perks/user')
  }

  async unlockPerk(perkId: number): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/perks/unlock/${perkId}`, {
      method: 'POST',
    })
  }

  async activatePerk(perkId: number, configuration: any = {}): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/perks/activate/${perkId}`, {
      method: 'POST',
      body: JSON.stringify({ configuration }),
    })
  }

  async deactivatePerk(perkId: number): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/perks/deactivate/${perkId}`, {
      method: 'POST',
    })
  }

  async getPerkOptions(perkId: number): Promise<ApiResponse<{
    perkId: number;
    type: string;
    configSchema: any;
    assetData: any;
  }>> {
    return this.request(`/perks/options/${perkId}`)
  }

  async getUserLoadout(): Promise<ApiResponse<{
    user_id: number;
    active_avatar: string;
    active_badge?: string;
    active_theme: string;
    perks_config: any;
    active_perks: any[];
  }>> {
    return this.request('/perks/loadout')
  }

  async getPerksByCategory(category: string): Promise<ApiResponse<Array<{
    id: number;
    name: string;
    category: string;
    type: string;
    level_required: number;
    title: string;
    description: string;
    is_active: boolean;
  }>>> {
    return this.request(`/perks/category/${category}`)
  }

  async checkPerkUnlocks(): Promise<ApiResponse<{
    newlyUnlocked: Array<{
      id: number;
      name: string;
      category: string;
      type: string;
      level_required: number;
      title: string;
      description: string;
    }>;
    totalUnlocked: number;
  }>> {
    return this.request('/perks/check-unlocks', {
      method: 'POST',
    })
  }

  // Perk Draft methods
  async getPendingDrafts(): Promise<ApiResponse<{ pendingDrafts: any[]; count: number }>> {
    return this.request('/perks/draft/pending')
  }

  async pickDraftPerk(level: number, perkId: number): Promise<ApiResponse<{ message: string }>> {
    return this.request('/perks/draft/pick', {
      method: 'POST',
      body: JSON.stringify({ level, perkId }),
    })
  }

  async dumpDraftOffer(level: number): Promise<ApiResponse<{ message: string }>> {
    return this.request('/perks/draft/dump', {
      method: 'POST',
      body: JSON.stringify({ level }),
    })
  }

  async getDraftHistory(): Promise<ApiResponse<any[]>> {
    return this.request('/perks/draft/history')
  }

  async getActiveGameplayPerks(): Promise<ApiResponse<any[]>> {
    return this.request('/perks/draft/active')
  }

  async getAvailablePool(): Promise<ApiResponse<{ pool: any[]; size: number }>> {
    return this.request('/perks/draft/pool')
  }

  async resetDrafts(): Promise<ApiResponse<any>> {
    return this.request('/perks/draft/reset', {
      method: 'POST',
    })
  }

  async checkNeedsRedraft(): Promise<ApiResponse<{ needsRedraft: boolean }>> {
    return this.request('/perks/draft/needs-redraft')
  }

  async clearRedraftFlag(): Promise<ApiResponse<{ message: string }>> {
    return this.request('/perks/draft/clear-redraft', {
      method: 'POST',
    })
  }

  async getSkillTreeData(): Promise<ApiResponse<any>> {
    return this.request('/perks/draft/skill-tree')
  }
}

// Export singleton instance and types
export const apiService = new ApiService()
export type { ApiResponse, AuthRequest, AuthResponse, Character, CharacterProfile, CreateLobbyRequest, JoinLobbyRequest } 
