import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Header } from '../Header'
import { apiService } from '../../services/apiService'

// Mock dependencies
vi.mock('../../services/apiService', () => ({
  apiService: {
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
    clearAuth: vi.fn(),
  },
}))

vi.mock('../ThemeProvider', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}))

vi.mock('../../hooks/useAudio', () => ({
  useAudio: () => ({
    masterVolume: 0.7,
    setMasterVolume: vi.fn(),
    isMuted: false,
    setIsMuted: vi.fn(),
    handleMenuSelect: vi.fn(),
    handleMenuConfirm: vi.fn(),
    handleMenuCancel: vi.fn(),
    handleVolumeChange: vi.fn(),
  }),
}))

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render logo and navigation', () => {
    vi.mocked(apiService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
    })

    render(<MemoryRouter><Header /></MemoryRouter>)

    expect(screen.getByText('Learn2Play Quiz')).toBeInTheDocument()
    expect(screen.getByTestId('home-page')).toBeInTheDocument()
    expect(screen.getByTestId('profile-link')).toBeInTheDocument()
    expect(screen.getByText('Question Sets')).toBeInTheDocument()
  })

  it('should show admin link for admin users', () => {
    vi.mocked(apiService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'admin',
      email: 'admin@example.com',
      isAdmin: true,
    })

    render(<MemoryRouter><Header /></MemoryRouter>)

    expect(screen.getByTestId('admin-dashboard-link')).toBeInTheDocument()
  })

  it('should not show admin link for non-admin users', () => {
    vi.mocked(apiService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'user',
      email: 'user@example.com',
      isAdmin: false,
    })

    render(<MemoryRouter><Header /></MemoryRouter>)

    expect(screen.queryByTestId('admin-dashboard-link')).not.toBeInTheDocument()
  })

  it('should render mute toggle button', () => {
    vi.mocked(apiService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
    })

    render(<MemoryRouter><Header /></MemoryRouter>)

    expect(screen.getByTestId('mute-toggle')).toBeInTheDocument()
  })

  it('should render volume slider', () => {
    vi.mocked(apiService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
    })

    render(<MemoryRouter><Header /></MemoryRouter>)

    expect(screen.getByLabelText('Master volume')).toBeInTheDocument()
  })

  it('should render logout button', () => {
    vi.mocked(apiService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
    })

    render(<MemoryRouter><Header /></MemoryRouter>)

    expect(screen.getByTestId('logout-button')).toBeInTheDocument()
  })

  it('should handle logout successfully', async () => {
    vi.mocked(apiService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
    })
    vi.mocked(apiService.logout).mockResolvedValue({ success: true })

    render(<MemoryRouter><Header /></MemoryRouter>)

    fireEvent.click(screen.getByTestId('logout-button'))

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(apiService.logout).toHaveBeenCalled()
  })

  it('should handle logout error by clearing auth and reloading', async () => {
    vi.mocked(apiService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
    })
    vi.mocked(apiService.logout).mockRejectedValue(new Error('Logout failed'))

    render(<MemoryRouter><Header /></MemoryRouter>)

    fireEvent.click(screen.getByTestId('logout-button'))

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(apiService.logout).toHaveBeenCalled()
    expect(apiService.clearAuth).toHaveBeenCalled()
  })
})
