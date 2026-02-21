import React from 'react'
import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import PerksManager from '../PerksManager'
import { useAuthStore } from '../../stores/authStore'
import { apiService } from '../../services/apiService'

jest.mock('../../services/apiService', () => ({
  apiService: {
    getUserPerks: jest.fn(),
    activatePerk: jest.fn(),
    deactivatePerk: jest.fn(),
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
          name: 'ui_themes_basic',
          category: 'cosmetic',
          type: 'theme',
          level_required: 3,
          title: 'Basic Themes',
          description: 'Switch themes',
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
          name: 'custom_avatars',
          category: 'cosmetic',
          type: 'avatar',
          level_required: 20,
          title: 'Custom Avatars',
          description: 'New avatars',
          is_active: true,
        }
      },
    ],
    activePerks: [
      {
        id: 2,
        user_id: 1,
        perk_id: 2,
        is_unlocked: true,
        is_active: true,
        configuration: { theme_name: 'dark' },
        perk: {
          id: 2,
          name: 'ui_themes_basic',
          category: 'cosmetic',
          type: 'theme',
          level_required: 3,
          title: 'Basic Themes',
          description: 'Switch themes',
          is_active: true,
        }
      }
    ],
    loadout: {
      user_id: 1,
      active_avatar: 'student',
      active_badge: null,
      active_theme: 'dark',
      active_title: null,
      perks_config: {},
      active_perks: [],
      active_cosmetic_perks: {}
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    const mockStoreState = {
      user: mockUser,
      token: 'test-token',
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
    }
    mockUseAuthStore.mockImplementation((selector: any) => {
      if (typeof selector === 'function') return selector(mockStoreState)
      return mockStoreState
    })
    ;(apiService.getUserPerks as jest.Mock).mockResolvedValue({ success: true, data: mockPerksPayload })
  })

  it('shows a loading indicator before data resolves', () => {
    render(<PerksManager />)
    expect(screen.getByText('Loading your perks...')).toBeInTheDocument()
    expect(document.querySelector('.loading-spinner')).toBeInTheDocument()
  })

  it('renders slot selectors when data loads', async () => {
    render(<PerksManager />)
    // Wait for data — new header is "Your Loadout"
    expect(await screen.findByText('Your Loadout')).toBeInTheDocument()
    expect(apiService.getUserPerks).toHaveBeenCalledTimes(1)
    // All 9 slot labels should appear (each appears twice: slot row + sidebar)
    expect(screen.getAllByText('Avatar').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Theme').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Badge').length).toBeGreaterThanOrEqual(2)
    // Sidebar shows current loadout
    expect(screen.getByText('Current Loadout')).toBeInTheDocument()
  })

  it('shows locked state for slots above user level', async () => {
    render(<PerksManager />)
    await screen.findByText('Your Loadout')
    // Avatar slot is locked (level 20 required, user is level 12)
    expect(screen.getByText(/Unlock at Level 20/i)).toBeInTheDocument()
  })

  it('shows dropdown with available perks for unlocked slots', async () => {
    render(<PerksManager />)
    await screen.findByText('Your Loadout')
    // Badge slot should have a select with Starter Badge option
    const selects = screen.getAllByRole('combobox')
    const badgeSelect = selects.find(s => {
      const options = within(s).queryAllByRole('option')
      return options.some(o => o.textContent === 'Starter Badge')
    })
    expect(badgeSelect).toBeTruthy()
  })

  it('handles API errors gracefully', async () => {
    ;(apiService.getUserPerks as jest.Mock).mockResolvedValueOnce({ success: false, error: 'Failed to fetch perks' })
    render(<PerksManager />)
    expect(await screen.findByText('Unable to Load Perks')).toBeInTheDocument()
    expect(screen.getByText('Failed to fetch perks')).toBeInTheDocument()
    expect(screen.getByText('Retry Now')).toBeInTheDocument()
  })

  it('handles network errors gracefully', async () => {
    ;(apiService.getUserPerks as jest.Mock).mockRejectedValueOnce(new Error('Network error'))
    render(<PerksManager />)
    expect(await screen.findByText('Unable to Load Perks')).toBeInTheDocument()
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('renders nothing when the user is not authenticated', () => {
    const noAuth = {
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
    mockUseAuthStore.mockImplementation((selector: any) => {
      if (typeof selector === 'function') return selector(noAuth)
      return noAuth
    })
    const { container } = render(<PerksManager />)
    expect(apiService.getUserPerks).not.toHaveBeenCalled()
    expect(container.firstChild).toBeInstanceOf(HTMLDivElement)
    expect(container.firstChild?.textContent).toBe('')
  })
})
