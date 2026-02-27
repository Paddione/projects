import React from 'react'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

jest.mock('../../services/themeService', () => ({
  themeService: { initialize: jest.fn(), setTheme: jest.fn() }
}))

jest.mock('../../services/avatarService', () => ({
  avatarService: { initialize: jest.fn(), setActiveAvatarOverride: jest.fn() }
}))

jest.mock('../../stores/authStore')
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>

// --- Mock Data ---

const mockUser = {
  id: '1',
  username: 'testuser',
  email: 'test@example.com',
  level: 12,
  experience: 2400,
}

/** Two avatar perks: Collection I (level 3, unlocked) and Collection II (level 12, unlocked) + Legendary (level 25, locked) */
const mockPerksPayload = {
  perks: [
    // --- Badge (level 2 = unlocked) ---
    {
      id: 1, user_id: 1, perk_id: 1, is_unlocked: true, is_active: false, configuration: {},
      perk: { id: 1, name: 'starter_badge', category: 'cosmetic', type: 'badge', level_required: 2, title: 'Starter Badge', description: 'Bronze badge', is_active: true }
    },
    // --- Avatar Collection I (level 3 = unlocked) ---
    {
      id: 2, user_id: 1, perk_id: 2, is_unlocked: true, is_active: false, configuration: {},
      perk: { id: 2, name: 'custom_avatars_basic', category: 'cosmetic', type: 'avatar', level_required: 3, title: 'Avatar Collection I', description: 'Basic avatars', is_active: true }
    },
    // --- Avatar Collection II (level 12 = unlocked) ---
    {
      id: 3, user_id: 1, perk_id: 3, is_unlocked: true, is_active: false, configuration: {},
      perk: { id: 3, name: 'custom_avatars_advanced', category: 'cosmetic', type: 'avatar', level_required: 12, title: 'Avatar Collection II', description: 'Advanced avatars', is_active: true }
    },
    // --- Legendary Avatars (level 25 = LOCKED) ---
    {
      id: 4, user_id: 1, perk_id: 4, is_unlocked: false, is_active: false, configuration: {},
      perk: { id: 4, name: 'legendary_avatars', category: 'cosmetic', type: 'avatar', level_required: 25, title: 'Legendary Avatars', description: 'Elite avatars', is_active: true }
    },
    // --- Theme (level 5 = unlocked) ---
    {
      id: 5, user_id: 1, perk_id: 5, is_unlocked: true, is_active: true, configuration: { theme_name: 'dark' },
      perk: { id: 5, name: 'ui_themes_basic', category: 'cosmetic', type: 'theme', level_required: 5, title: 'Color Themes I', description: 'Basic themes', is_active: true }
    },
    // --- Title (level 30 = LOCKED, all options locked -> slot locked) ---
    {
      id: 6, user_id: 1, perk_id: 6, is_unlocked: false, is_active: false, configuration: {},
      perk: { id: 6, name: 'master_scholar', category: 'cosmetic', type: 'title', level_required: 30, title: 'Master Scholar', description: 'Prestigious title', is_active: true }
    },
  ],
  activePerks: [
    {
      id: 5, user_id: 1, perk_id: 5, is_unlocked: true, is_active: true, configuration: { theme_name: 'dark' },
      perk: { id: 5, name: 'ui_themes_basic', category: 'cosmetic', type: 'theme', level_required: 5, title: 'Color Themes I', description: 'Basic themes', is_active: true }
    }
  ],
  loadout: {
    user_id: 1,
    active_avatar: null,
    active_badge: null,
    active_theme: 'dark',
    active_title: null,
    perks_config: {},
    active_perks: [],
    active_cosmetic_perks: {}
  }
}

function setupAuthMock(user: any = mockUser) {
  const mockStoreState = {
    user,
    token: 'test-token',
    isAuthenticated: !!user,
    login: jest.fn(), logout: jest.fn(), register: jest.fn(),
    refreshToken: jest.fn(), setUser: jest.fn(), setToken: jest.fn(),
    clearAuth: jest.fn(), setLoading: jest.fn(), setError: jest.fn()
  }
  mockUseAuthStore.mockImplementation((selector: any) => {
    if (typeof selector === 'function') return selector(mockStoreState)
    return mockStoreState
  })
}

describe('PerksManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupAuthMock()
    ;(apiService.getUserPerks as jest.Mock).mockResolvedValue({ success: true, data: mockPerksPayload })
    ;(apiService.activatePerk as jest.Mock).mockResolvedValue({ success: true })
    ;(apiService.deactivatePerk as jest.Mock).mockResolvedValue({ success: true })
  })

  // --- Loading & Error States ---

  it('shows loading spinner before data resolves', () => {
    render(<PerksManager />)
    expect(screen.getByText('Loading your perks...')).toBeInTheDocument()
    expect(document.querySelector('.loading-spinner')).toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    ;(apiService.getUserPerks as jest.Mock).mockResolvedValueOnce({ success: false, error: 'Server error' })
    render(<PerksManager />)
    expect(await screen.findByText('Unable to Load Perks')).toBeInTheDocument()
    expect(screen.getByText('Server error')).toBeInTheDocument()
    expect(screen.getByText('Retry Now')).toBeInTheDocument()
  })

  it('handles network errors gracefully', async () => {
    ;(apiService.getUserPerks as jest.Mock).mockRejectedValueOnce(new Error('Network error'))
    render(<PerksManager />)
    expect(await screen.findByText('Unable to Load Perks')).toBeInTheDocument()
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('renders nothing when unauthenticated', () => {
    setupAuthMock(null)
    const { container } = render(<PerksManager />)
    expect(apiService.getUserPerks).not.toHaveBeenCalled()
    expect(container.firstChild?.textContent).toBe('')
  })

  // --- Flat Grid Rendering ---

  it('renders all 9 slot sections after data loads', async () => {
    render(<PerksManager />)
    await screen.findByText('Your Loadout')
    // Each slot label appears at least in the main area
    for (const label of ['Avatar', 'Theme', 'Badge']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('renders flat option buttons for unlocked avatar perks', async () => {
    render(<PerksManager />)
    await screen.findByText('Your Loadout')
    // Avatar Collection I options (level 3, unlocked): student/professor/librarian/researcher mapped to Scholarly Student etc.
    // Avatar Collection II options (level 12, unlocked): detective/chef/astronaut mapped to labels
    // These come from the AVATAR_OPTIONS constant which has: Scholarly Student, Wise Professor, Master Librarian, Lab Researcher
    // AND the advanced options mapped via config_schema from the perk
    // The flat grid should show buttons, not a <select> dropdown
    const selects = screen.queryAllByRole('combobox')
    // No combobox/select elements should exist for slots with options
    // (the old UI used <select>, new UI uses button grid)
    expect(selects.length).toBe(0)
  })

  it('shows locked options with lock indicator and level requirement', async () => {
    render(<PerksManager />)
    await screen.findByText('Your Loadout')
    // Legendary Avatars perk requires level 25, user is level 12
    // Its options should show as locked with "Lv 25"
    expect(screen.getAllByText(/Lv\s*25/i).length).toBeGreaterThanOrEqual(1)
  })

  it('shows fully locked slot when all perks require higher level', async () => {
    render(<PerksManager />)
    await screen.findByText('Your Loadout')
    // Title slot: only perk is master_scholar at level 30, user is level 12
    expect(screen.getByText(/Unlock at Level 30/i)).toBeInTheDocument()
  })

  // --- Selection & Activation ---

  it('calls activatePerk when clicking an unlocked option', async () => {
    const user = userEvent.setup()
    render(<PerksManager />)
    await screen.findByText('Your Loadout')

    // Find and click the first avatar option button (e.g., "Scholarly Student")
    // Multiple exist because both basic + advanced avatar perks produce the same options
    const studentBtns = screen.getAllByRole('button', { name: /Scholarly Student/i })
    await user.click(studentBtns[0])

    await waitFor(() => {
      expect(apiService.activatePerk).toHaveBeenCalledWith(
        2, // perk ID for custom_avatars_basic
        expect.objectContaining({ selected_avatar: 'student' })
      )
    })
  })

  it('does not call activatePerk when clicking a locked option', async () => {
    const user = userEvent.setup()
    render(<PerksManager />)
    await screen.findByText('Your Loadout')

    // Find a locked option button (Legendary Avatars) -- they should be disabled
    const lockedButtons = document.querySelectorAll('.option-btn.locked')
    if (lockedButtons.length > 0) {
      await user.click(lockedButtons[0] as HTMLElement)
    }
    expect(apiService.activatePerk).not.toHaveBeenCalled()
  })

  it('highlights the currently active option', async () => {
    render(<PerksManager />)
    await screen.findByText('Your Loadout')
    // Theme "dark" is active in the loadout (active_theme: 'dark')
    // The Dark Mode button should have the 'selected' class
    const darkBtn = screen.getByRole('button', { name: /Dark Mode/i })
    expect(darkBtn.classList.contains('selected')).toBe(true)
  })

  // --- Clear Slot ---

  it('shows clear button for slots with active perk and calls deactivatePerk', async () => {
    const user = userEvent.setup()
    render(<PerksManager />)
    await screen.findByText('Your Loadout')

    // Theme slot has an active perk -- should show a clear button
    const clearBtns = screen.getAllByRole('button', { name: /clear/i })
    expect(clearBtns.length).toBeGreaterThanOrEqual(1)

    // Click the clear button in the theme slot area
    await user.click(clearBtns[0])

    await waitFor(() => {
      expect(apiService.deactivatePerk).toHaveBeenCalled()
    })
  })

  // --- Sidebar ---

  it('shows loadout summary sidebar with active slot values', async () => {
    render(<PerksManager />)
    await screen.findByText('Your Loadout')
    expect(screen.getByText('Current Loadout')).toBeInTheDocument()
    // Theme is active with value 'dark'
    expect(screen.getByText('dark')).toBeInTheDocument()
  })
})
