import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock services that use import.meta
jest.mock('../../services/apiService', () => ({
  apiService: {
    getQuestionSets: jest.fn(),
    getLobby: jest.fn(),
    isAuthenticated: jest.fn(),
    // Add other methods as needed
  }
}));

jest.mock('../../services/socketService', () => ({
  socketService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    // Add other methods as needed
  }
}));

// Mock the required stores
const mockLobbyStore = {
  lobbyCode: 'ABC123',
  players: [
    { id: '1', username: 'Alice', isHost: true, isReady: true, character: 'wizard' },
    { id: '2', username: 'Bob', isHost: false, isReady: false, character: 'knight' }
  ],
  isHost: false,
  currentPlayerId: '2',
  gameSettings: {
    questionCount: 10,
    questionSets: ['general']
  }
}

const mockGameStore = {
  startGame: jest.fn(),
  leaveLobby: jest.fn(),
  setReady: jest.fn(),
  updateSettings: jest.fn()
}

jest.mock('../../stores/gameStore', () => ({
  useGameStore: () => mockGameStore,
}))

// Mock child components
jest.mock('../PlayerGrid', () => ({
  PlayerGrid: ({ players }: { players: any[] }) => (
    <div data-testid="player-grid">
      {players.map(p => <div key={p.id}>{p.username}</div>)}
    </div>
  )
}))

jest.mock('../ConnectionStatus', () => ({
  ConnectionStatus: ({ status }: { status: string }) => (
    <div data-testid="connection-status">{status}</div>
  )
}))

// Import the component after all mocks are defined
import { LobbyView } from '../LobbyView'

describe('LobbyView Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<LobbyView />)
    expect(screen.getByTestId('lobby-view')).toBeInTheDocument()
  })

  it('displays lobby code', () => {
    render(<LobbyView />)
    expect(screen.getByText('ABC123')).toBeInTheDocument()
  })

  it('shows player grid with current players', () => {
    render(<LobbyView />)
    
    expect(screen.getByTestId('player-grid')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('displays ready button for non-ready players', () => {
    render(<LobbyView />)
    
    const readyButton = screen.getByText(/ready/i)
    expect(readyButton).toBeInTheDocument()
    expect(readyButton).not.toBeDisabled()
  })

  it('calls setReady when ready button is clicked', async () => {
    const user = userEvent.setup()
    render(<LobbyView />)
    
    const readyButton = screen.getByText(/ready/i)
    await user.click(readyButton)
    
    expect(mockGameStore.setReady).toHaveBeenCalledWith(true)
  })

  it('shows start game button for host when all players ready', () => {
    const hostLobbyStore = {
      ...mockLobbyStore,
      isHost: true,
      players: mockLobbyStore.players.map(p => ({ ...p, isReady: true }))
    }
    
    jest.mocked(require('../../stores/gameStore').useGameStore).mockReturnValue(hostLobbyStore)
    
    render(<LobbyView />)
    
    const startButton = screen.getByText(/start game/i)
    expect(startButton).toBeInTheDocument()
    expect(startButton).not.toBeDisabled()
  })

  it('disables start game button when not all players ready', () => {
    const hostLobbyStore = { ...mockLobbyStore, isHost: true }
    jest.mocked(require('../../stores/gameStore').useGameStore).mockReturnValue(hostLobbyStore)
    
    render(<LobbyView />)
    
    const startButton = screen.getByText(/start game/i)
    expect(startButton).toBeDisabled()
  })

  it('calls startGame when start button is clicked', async () => {
    const user = userEvent.setup()
    const hostLobbyStore = {
      ...mockLobbyStore,
      isHost: true,
      players: mockLobbyStore.players.map(p => ({ ...p, isReady: true }))
    }
    
    jest.mocked(require('../../stores/gameStore').useGameStore).mockReturnValue(hostLobbyStore)
    
    render(<LobbyView />)
    
    const startButton = screen.getByText(/start game/i)
    await user.click(startButton)
    
    expect(mockGameStore.startGame).toHaveBeenCalled()
  })

  it('shows leave lobby button', () => {
    render(<LobbyView />)
    
    const leaveButton = screen.getByText(/leave/i)
    expect(leaveButton).toBeInTheDocument()
  })

  it('calls leaveLobby when leave button is clicked', async () => {
    const user = userEvent.setup()
    render(<LobbyView />)
    
    const leaveButton = screen.getByText(/leave/i)
    await user.click(leaveButton)
    
    expect(mockGameStore.leaveLobby).toHaveBeenCalled()
  })

  it('displays game settings', () => {
    render(<LobbyView />)
    
    expect(screen.getByText(/10.*questions/i)).toBeInTheDocument()
    expect(screen.getByText(/general/i)).toBeInTheDocument()
  })

  it('allows host to modify settings', () => {
    const hostLobbyStore = { ...mockLobbyStore, isHost: true }
    jest.mocked(require('../../stores/gameStore').useGameStore).mockReturnValue(hostLobbyStore)
    
    render(<LobbyView />)
    
    expect(screen.getByRole('combobox')).toBeInTheDocument() // Settings dropdown
  })

  it('prevents non-host from modifying settings', () => {
    render(<LobbyView />)
    
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('shows connection status', () => {
    render(<LobbyView />)
    
    expect(screen.getByTestId('connection-status')).toBeInTheDocument()
  })

  it('displays player count', () => {
    render(<LobbyView />)
    
    expect(screen.getByText(/2.*8.*players/i)).toBeInTheDocument()
  })

  it('shows lobby code copy functionality', async () => {
    const user = userEvent.setup()
    
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockImplementation(() => Promise.resolve()),
      },
    })
    
    render(<LobbyView />)
    
    const copyButton = screen.getByRole('button', { name: /copy/i })
    await user.click(copyButton)
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ABC123')
  })

  it('indicates when lobby is full', () => {
    const fullLobbyStore = {
      ...mockLobbyStore,
      players: Array.from({ length: 8 }, (_, i) => ({
        id: `${i + 1}`,
        username: `Player${i + 1}`,
        isHost: i === 0,
        isReady: false,
        character: 'wizard'
      }))
    }
    
    jest.mocked(require('../../stores/gameStore').useGameStore).mockReturnValue(fullLobbyStore)
    
    render(<LobbyView />)
    
    expect(screen.getByText(/lobby full/i)).toBeInTheDocument()
  })

  it('shows waiting message when not all players ready', () => {
    render(<LobbyView />)
    
    expect(screen.getByText(/waiting for players/i)).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<LobbyView className="custom-lobby" />)
    
    expect(container.firstChild).toHaveClass('custom-lobby')
  })

  it('handles empty lobby gracefully', () => {
    const emptyLobbyStore = { ...mockLobbyStore, players: [] }
    jest.mocked(require('../../stores/gameStore').useGameStore).mockReturnValue(emptyLobbyStore)
    
    render(<LobbyView />)
    
    expect(screen.getByTestId('lobby-view')).toBeInTheDocument()
    expect(screen.getByText(/0.*8.*players/i)).toBeInTheDocument()
  })
}) 