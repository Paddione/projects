import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HomePage } from '../HomePage'
import { apiService } from '../../services/apiService'

// Mock components
vi.mock('../../components/GameInterface', () => ({
  GameInterface: () => <div data-testid="game-interface">Game Interface</div>,
}))

vi.mock('../../components/LobbiesList', () => ({
  LobbiesList: () => <div data-testid="lobbies-list">Lobbies List</div>,
}))

// Mock apiService
vi.mock('../../services/apiService', () => ({
  apiService: {
    getCurrentUser: vi.fn(),
  },
}))

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render GameInterface and LobbiesList', () => {
    vi.mocked(apiService.getCurrentUser).mockReturnValue(null)

    render(<HomePage />)

    expect(screen.getByTestId('game-interface')).toBeInTheDocument()
    expect(screen.getByTestId('lobbies-list')).toBeInTheDocument()
  })

  it('should show welcome message when user is logged in', () => {
    vi.mocked(apiService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
    })

    render(<HomePage />)

    expect(screen.getByTestId('welcome-message')).toHaveTextContent('Welcome back, testuser!')
  })

  it('should not show welcome message when user is not logged in', () => {
    vi.mocked(apiService.getCurrentUser).mockReturnValue(null)

    render(<HomePage />)

    expect(screen.queryByTestId('welcome-message')).not.toBeInTheDocument()
  })
})
