import React from 'react'
import { render, screen } from '@testing-library/react'
import { DemoPage } from '../DemoPage'

// Mock child components
jest.mock('../LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading</div>
}))

interface MockPlayer {
  id: string
  username: string
  character: string
  isReady: boolean
  isHost: boolean
  score: number
  multiplier: number
  correctAnswers: number
  currentStreak: number
  isConnected: boolean
}

jest.mock('../PlayerGrid', () => ({
  PlayerGrid: ({ players }: { players: MockPlayer[] }) => (
    <div data-testid="player-grid">Players: {players.length}</div>
  )
}))

jest.mock('../Timer', () => ({
  Timer: ({ timeRemaining }: { timeRemaining: number }) => (
    <div data-testid="timer">Time: {timeRemaining}</div>
  )
}))

jest.mock('../ScoreDisplay', () => ({
  ScoreDisplay: ({ score, multiplier }: { score: number; multiplier: number }) => (
    <div data-testid="score-display">Score: {score} x{multiplier}</div>
  )
}))

jest.mock('../GameInterface', () => ({
  GameInterface: () => <div data-testid="game-interface">Game Interface</div>
}))

jest.mock('../LobbyView', () => ({
  LobbyView: () => <div data-testid="lobby-view">Lobby View</div>
}))

jest.mock('../ConnectionStatus', () => ({
  ConnectionStatus: ({ status }: { status: string }) => (
    <div data-testid="connection-status">Status: {status}</div>
  )
}))

describe('DemoPage Component', () => {
  it('renders without crashing', () => {
    render(<DemoPage />)
    expect(screen.getByText('Learn2Play Quiz Foundation')).toBeInTheDocument()
  })

  it('displays welcome section', () => {
    render(<DemoPage />)

    expect(screen.getByText('Learn2Play Quiz Foundation')).toBeInTheDocument()
    expect(screen.getByText(/Core UI components with responsive design/)).toBeInTheDocument()
  })

  it('renders PlayerGrid demo section', () => {
    render(<DemoPage />)

    expect(screen.getByText('PlayerGrid Component')).toBeInTheDocument()
    expect(screen.getByText(/4x2 responsive grid layout/)).toBeInTheDocument()
    expect(screen.getByTestId('player-grid')).toBeInTheDocument()
  })

  it('renders Timer demo section with multiple timer states', () => {
    render(<DemoPage />)

    expect(screen.getByText('Timer Component')).toBeInTheDocument()
    expect(screen.getByText(/60-second countdown/)).toBeInTheDocument()

    // Check for different timer states
    const timers = screen.getAllByTestId('timer')
    expect(timers).toHaveLength(3)
    expect(screen.getByText('Time: 45')).toBeInTheDocument()
    expect(screen.getByText('Time: 8')).toBeInTheDocument()
    expect(screen.getByText('Time: 3')).toBeInTheDocument()
  })

  it('renders ScoreDisplay demo section', () => {
    render(<DemoPage />)

    expect(screen.getByText('ScoreDisplay Component')).toBeInTheDocument()
    expect(screen.getByText(/Real-time score, multiplier/)).toBeInTheDocument()
  })

  it('passes correct mock data to PlayerGrid', () => {
    render(<DemoPage />)

    const playerGrid = screen.getByTestId('player-grid')
    expect(playerGrid).toHaveTextContent('Players: 4')
  })

  it('has proper grid layout structure', () => {
    const { container } = render(<DemoPage />)

    const gridContainer = container.querySelector('.grid')
    expect(gridContainer).toBeInTheDocument()
    expect(gridContainer).toHaveClass('gridCols1')
    expect(gridContainer).toHaveClass('gapLg')
  })

  it('uses card layout for sections', () => {
    const { container } = render(<DemoPage />)

    const cards = container.querySelectorAll('.card')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('displays correct section headings', () => {
    render(<DemoPage />)

    const headings = ['PlayerGrid Component', 'Timer Component', 'ScoreDisplay Component']
    headings.forEach(heading => {
      expect(screen.getByText(heading)).toBeInTheDocument()
    })
  })
}) 