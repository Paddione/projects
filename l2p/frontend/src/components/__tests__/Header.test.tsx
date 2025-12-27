import React from 'react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Header } from '../Header'
import { apiService } from '../../services/apiService'

// Mock dependencies
jest.mock('../../services/apiService', () => ({
  apiService: {
    getCurrentUser: jest.fn(),
    logout: jest.fn(),
    clearAuth: jest.fn(),
  },
}))

jest.mock('../ThemeProvider', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: jest.fn(),
  }),
}))

jest.mock('../../hooks/useAudio', () => ({
  useAudio: () => ({
    masterVolume: 0.7,
    setMasterVolume: jest.fn(),
    isMuted: false,
    setIsMuted: jest.fn(),
    handleMenuSelect: jest.fn(),
    handleMenuConfirm: jest.fn(),
    handleMenuCancel: jest.fn(),
    handleVolumeChange: jest.fn(),
  }),
}))

// Mock window.location.reload
delete (window as any).location
window.location = { reload: jest.fn() } as any

describe('Header', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render logo and navigation', () => {
    jest.mocked(apiService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
    })

    render(<Header />)

    expect(screen.getByText('Learn2Play Quiz')).toBeInTheDocument()
    expect(screen.getByTestId('home-page')).toBeInTheDocument()
    expect(screen.getByTestId('profile-link')).toBeInTheDocument()
    expect(screen.getByText('Question Sets')).toBeInTheDocument()
  })

  it('should show admin link for admin users', () => {
    jest.mocked(apiService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'admin',
      email: 'admin@example.com',
      isAdmin: true,
    })

    render(<Header />)

    expect(screen.getByTestId('admin-dashboard-link')).toBeInTheDocument()
  })

  it('should not show admin link for non-admin users', () => {
    jest.mocked(apiService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'user',
      email: 'user@example.com',
      isAdmin: false,
    })

    render(<Header />)

    expect(screen.queryByTestId('admin-dashboard-link')).not.toBeInTheDocument()
  })

  it('should render mute toggle button', () => {
    jest.mocked(apiService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
    })

    render(<Header />)

    expect(screen.getByTestId('mute-toggle')).toBeInTheDocument()
  })

  it('should render theme toggle button', () => {
    jest.mocked(apiService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
    })

    render(<Header />)

    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument()
  })

  it('should render logout button', () => {
    jest.mocked(apiService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
    })

    render(<Header />)

    expect(screen.getByTestId('logout-button')).toBeInTheDocument()
  })

  it('should handle logout successfully', async () => {
    jest.mocked(apiService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
    })
    jest.mocked(apiService.logout).mockResolvedValue({ success: true })

    render(<Header />)

    fireEvent.click(screen.getByTestId('logout-button'))

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(apiService.logout).toHaveBeenCalled()
    expect(window.location.reload).toHaveBeenCalled()
  })

  it('should handle logout error by clearing auth and reloading', async () => {
    jest.mocked(apiService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
    })
    jest.mocked(apiService.logout).mockRejectedValue(new Error('Logout failed'))

    render(<Header />)

    fireEvent.click(screen.getByTestId('logout-button'))

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(apiService.logout).toHaveBeenCalled()
    expect(apiService.clearAuth).toHaveBeenCalled()
    expect(window.location.reload).toHaveBeenCalled()
  })
})
