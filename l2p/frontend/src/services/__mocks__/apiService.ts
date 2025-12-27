import { ApiResponse, CreateLobbyRequest, JoinLobbyRequest, AuthRequest, AuthResponse } from '../apiService'
import { Player, Lobby, Question } from '../../types'

// Mock data for testing
const mockPlayer: Player = {
  id: 'user_123',
  username: 'TestPlayer',
  character: 'wizard',
  characterLevel: 5,
  isReady: true,
  isHost: true,
  score: 100,
  multiplier: 2,
  correctAnswers: 3,
  currentStreak: 2,
  isConnected: true,
}

const mockLobby: Lobby = {
  id: 1,
  code: 'TEST123',
  hostId: 'mock-player-1',
  status: 'waiting',
  players: [mockPlayer],
  questionCount: 10,
  currentQuestion: 0,
  settings: {
    questionSetIds: [1],
    timeLimit: 60,
    allowReplay: true,
  },
}

const mockQuestion: Question = {
  id: 1,
  questionText: 'Was ist die Hauptstadt von Frankreich?',
  answers: [
    {
      id: 'a1',
      text: 'Paris',
      isCorrect: true,
    },
    {
      id: 'a2',
      text: 'London',
      isCorrect: false,
    },
    {
      id: 'a3',
      text: 'Berlin',
      isCorrect: false,
    },
    {
      id: 'a4',
      text: 'Madrid',
      isCorrect: false,
    },
  ],
  explanation: 'Paris ist die Hauptstadt und größte Stadt Frankreichs.',
  difficulty: 1,
}

class MockApiService {
  private token: string | null = 'mock-token'
  private shouldFail = false
  private networkDelay = 100

  // Control mock behavior for testing
  setShouldFail(fail: boolean) {
    this.shouldFail = fail
  }

  setNetworkDelay(delay: number) {
    this.networkDelay = delay
  }

  setToken(token: string | null) {
    this.token = token
  }

  private async mockRequest<T>(data: T): Promise<ApiResponse<T>> {
    await new Promise(resolve => setTimeout(resolve, this.networkDelay))
    
    if (this.shouldFail) {
      return {
        success: false,
        error: 'Mock API Error',
        message: 'This is a mock error for testing',
      }
    }

    return {
      success: true,
      data,
    }
  }

  // Authentication methods
  async register(request: AuthRequest): Promise<ApiResponse<AuthResponse>> {
    return this.mockRequest({
      user: {
        id: 'mock-user-id',
        username: request.username,
        email: request.email || 'test@example.com',
        isAdmin: false,
      },
      tokens: {
        accessToken: 'mock-auth-token',
        refreshToken: 'mock-refresh-token',
      },
    })
  }

  async login(request: AuthRequest): Promise<ApiResponse<AuthResponse>> {
    return this.mockRequest({
      user: {
        id: 'mock-user-id',
        username: request.username,
        email: 'test@example.com',
        isAdmin: false,
      },
      tokens: {
        accessToken: 'mock-auth-token',
        refreshToken: 'mock-refresh-token',
      },
    })
  }

  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    return this.mockRequest({
      token: 'mock-refreshed-token',
    })
  }

  async logout(): Promise<ApiResponse<null>> {
    return this.mockRequest(null)
  }

  // Lobby methods
  async createLobby(request: CreateLobbyRequest): Promise<ApiResponse<Lobby>> {
    const lobby: Lobby = {
      ...mockLobby,
      settings: {
        ...mockLobby.settings,
        questionSetIds: request.questionSetIds || [1],
        timeLimit: request.timeLimit || 60,
      },
      questionCount: request.questionCount,
      players: [{
        ...mockPlayer,
        username: 'mock-user',
        character: 'student',
      }],
    }
    return this.mockRequest(lobby)
  }

  async joinLobby(request: JoinLobbyRequest): Promise<ApiResponse<Lobby>> {
    const lobby: Lobby = {
      ...mockLobby,
      code: request.lobbyCode,
      players: [
        ...mockLobby.players,
        {
          ...mockPlayer,
          id: 'mock-player-2',
          username: 'mock-user',
          character: 'student',
          isHost: false,
        },
      ],
    }
    return this.mockRequest(lobby)
  }

  async getLobby(lobbyCode: string): Promise<ApiResponse<Lobby>> {
    const lobby: Lobby = {
      ...mockLobby,
      code: lobbyCode,
    }
    return this.mockRequest(lobby)
  }

  async leaveLobby(_lobbyCode: string): Promise<ApiResponse<null>> {
    return this.mockRequest(null)
  }

  async deleteLobby(_lobbyCode: string): Promise<ApiResponse<null>> {
    return this.mockRequest(null)
  }

  // Player methods
  async setPlayerReady(_lobbyCode: string, _isReady: boolean): Promise<ApiResponse<null>> {
    return this.mockRequest(null)
  }

  async kickPlayer(_lobbyCode: string, _playerId: string): Promise<ApiResponse<null>> {
    return this.mockRequest(null)
  }

  // Game methods
  async startGame(_lobbyCode: string): Promise<ApiResponse<{ gameStarted: boolean }>> {
    return this.mockRequest({ gameStarted: true })
  }

  async submitAnswer(
    _lobbyCode: string,
    _questionId: number,
    answerIndex: number
  ): Promise<ApiResponse<{ isCorrect: boolean; score: number }>> {
    return this.mockRequest({
      isCorrect: answerIndex === 0, // First answer is always correct in mock
      score: answerIndex === 0 ? 100 : 0,
    })
  }

  // Question methods
  async getQuestions(_setIds?: number[]): Promise<ApiResponse<Question[]>> {
    return this.mockRequest([mockQuestion])
  }

  async getQuestionSets(): Promise<ApiResponse<Array<{ id: number; name: string; count: number }>>> {
    return this.mockRequest([
      { id: 1, name: 'General Knowledge', count: 100 },
      { id: 2, name: 'Science', count: 50 },
      { id: 3, name: 'History', count: 75 },
    ])
  }

  // Leaderboard methods
  async getLeaderboard(_setId?: number): Promise<ApiResponse<Array<{ username: string; score: number; rank: number }>>> {
    return this.mockRequest([
      { username: 'Player1', score: 1000, rank: 1 },
      { username: 'Player2', score: 950, rank: 2 },
      { username: 'Player3', score: 900, rank: 3 },
    ])
  }

  // Health check
  async health(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.mockRequest({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!this.token
  }

  getToken(): string | null {
    return this.token
  }
}

export const mockApiService = new MockApiService()
export default mockApiService 