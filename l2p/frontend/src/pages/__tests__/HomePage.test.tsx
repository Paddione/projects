import React from 'react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/jest-globals'
import { HomePage } from '../HomePage'
import { apiService } from '../../services/apiService'

// Mock components
jest.mock('../../components/GameInterface', () => ({
  GameInterface: () => <div data-testid="game-interface">Game Interface</div>,
}))

jest.mock('../../components/LobbiesList', () => ({
  LobbiesList: () => <div data-testid="lobbies-list">Lobbies List</div>,
}))

// Mock apiService
jest.mock('../../services/apiService', () => ({
  apiService: {
    getCurrentUser: jest.fn(),
  },
}))

describe('HomePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render GameInterface and LobbiesList', () => {
    jest.mocked(apiService.getCurrentUser).mockReturnValue(null)

    render(<HomePage />)

    expect(screen.getByTestId('game-interface')).toBeInTheDocument()
    expect(screen.getByTestId('lobbies-list')).toBeInTheDocument()
  })

  it('should show welcome message when user is logged in', () => {
    jest.mocked(apiService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
    })

    render(<HomePage />)

    expect(screen.getByTestId('welcome-message')).toHaveTextContent('Welcome back, testuser!')
  })

  it('should not show welcome message when user is not logged in', () => {
    jest.mocked(apiService.getCurrentUser).mockReturnValue(null)

    render(<HomePage />)

    expect(screen.queryByTestId('welcome-message')).not.toBeInTheDocument()
  })
})
