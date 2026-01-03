import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import PerksManager from '../PerksManager'
import { useAuthStore } from '../../stores/authStore'
import { apiService } from '../../services/apiService'

jest.mock('../../services/apiService', () => ({
  apiService: {
    getUserPerks: jest.fn(),
  }
}))

jest.mock('../../stores/authStore')
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>

describe('PerksManager', () => {
  const mockUser = {
    id: '1',
    username: 'testuser',
    email: 'test@example.com',
    level: 12,
    experience: 2400,
  }

  const mockToken = 'test-token'

  const mockPerksPayload = {
    perks: [
      {
        id: 1,
        user_id: 1,
        perk_id: 1,
        is_unlocked: true,
        is_active: false,
        configuration: {},
        perk: {
          id: 1,
          name: 'starter_badge',
          category: 'cosmetic',
          type: 'badge',
          level_required: 1,
          title: 'Starter Badge',
          description: 'Celebrate the beginning of your journey',
          is_active: true,
        }
      },
      {
        id: 2,
        user_id: 1,
        perk_id: 2,
        is_unlocked: true,
        is_active: true,
        configuration: { theme_name: 'dark' },
        perk: {
          id: 2,
          name: 'dark_theme',
          category: 'cosmetic',
          type: 'theme',
          level_required: 5,
          title: 'Night Studies',
          description: 'Switch to a dark study mode',
          is_active: true,
        }
      },
      {
        id: 3,
        user_id: 1,
        perk_id: 3,
        is_unlocked: false,
        is_active: false,
        configuration: {},
        perk: {
          id: 3,
          name: 'research_lab',
          category: 'gameplay',
          type: 'avatar',
          level_required: 20,
          title: 'Research Lab Assistant',
          description: 'Unlock a new avatar for lab challenges',
          is_active: true,
        }
      }
    ],
    activePerks: [
      {
        id: 2,
        user_id: 1,
        perk_id: 2,
        is_unlocked: true,
        is_active: true,
        configuration: { theme_name: 'dark' }
      }
    ],
    loadout: {
      user_id: 1,
      active_avatar: 'scientist',
      active_badge: null,
      active_theme: 'default',
      perks_config: {},
      active_perks: []
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockUseAuthStore.mockReturnValue({
      user: mockUser,
      token: mockToken,
      isAuthenticated: true,
      login: jest.fn(),
      logout: jest.fn(),
      register: jest.fn(),
      refreshToken: jest.fn(),
      setUser: jest.fn(),
      setToken: jest.fn(),
      clearAuth: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn()
    } as any)

      ; (apiService.getUserPerks as jest.Mock).mockResolvedValue({ success: true, data: mockPerksPayload })
  })

  it('shows a loading indicator before data resolves', () => {
    render(<PerksManager />)

    expect(screen.getByText('Loading your perks...')).toBeInTheDocument()
    expect(document.querySelector('.loading-spinner')).toBeInTheDocument()
  })

  it('renders core sections when perks resolve successfully', async () => {
    render(<PerksManager />)

    expect(await screen.findByText('🎨 Perks & Customization')).toBeInTheDocument()
    expect(apiService.getUserPerks).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Current Loadout')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /All Perks \(\d+\)/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Unlocked \(\d+\)$/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Locked \(\d+\)$/i })).toBeInTheDocument()

    expect(screen.getAllByText('Starter Badge').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Night Studies').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Research Lab Assistant').length).toBeGreaterThan(0)
  })

  it('handles API errors gracefully', async () => {
    ; (apiService.getUserPerks as jest.Mock).mockResolvedValueOnce({ success: false, error: 'Failed to fetch perks' })

    render(<PerksManager />)
    expect(await screen.findByText('Unable to Load Perks')).toBeInTheDocument()
    expect(screen.getByText('Failed to fetch perks')).toBeInTheDocument()
    expect(screen.getByText('Retry Now')).toBeInTheDocument()
  })

  it('handles network errors gracefully', async () => {
    ; (apiService.getUserPerks as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    render(<PerksManager />)
    expect(await screen.findByText('Unable to Load Perks')).toBeInTheDocument()
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('renders nothing when the user is not authenticated', () => {
    const mockStoreState = {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: jest.fn(),
      logout: jest.fn(),
      register: jest.fn(),
      setUser: jest.fn(),
      setToken: jest.fn(),
      clearAuth: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn()
    }

    // Mock implementation that properly handles Zustand selectors
    mockUseAuthStore.mockImplementation((selector: any) => {
      if (typeof selector === 'function') {
        return selector(mockStoreState)
      }
      return mockStoreState
    })

    const { container } = render(<PerksManager />)
    expect(apiService.getUserPerks).not.toHaveBeenCalled()
    expect(container.firstChild).toBeInstanceOf(HTMLDivElement)
    expect(container.firstChild?.textContent).toBe('')
  })
})
