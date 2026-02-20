import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useGameStore } from '../../stores/gameStore'
import { apiService } from '../../services/apiService'

jest.mock('../../services/apiService', () => ({
  apiService: {
    getAvailableQuestionSets: jest.fn(),
    getLobbyQuestionSetInfo: jest.fn(),
  }
}))

jest.mock('../../stores/gameStore')

jest.mock('../../styles/QuestionSetSelector.module.css', () =>
  new Proxy({}, { get: (_, name) => name })
)

jest.mock('../../hooks/useLocalization', () => ({
  useLocalization: () => ({
    t: (key: string) => key,
  }),
}))

import { QuestionSetSelector } from '../QuestionSetSelector'

const mockApi = apiService as jest.Mocked<typeof apiService>
const mockUseGameStore = useGameStore as unknown as jest.Mock & { getState: jest.Mock }

const mockQuestionSets = [
  {
    id: 1,
    name: 'Science Quiz',
    category: 'Science',
    difficulty: 'medium',
    is_active: true,
    description: 'Science questions',
    tags: ['physics', 'chemistry'],
    metadata: { questionCount: 20 },
    questions: [],
  },
  {
    id: 2,
    name: 'History Test',
    category: 'History',
    difficulty: 'easy',
    is_active: true,
    description: 'Historical events',
    tags: ['world'],
    metadata: { questionCount: 15 },
    questions: [],
  },
  {
    id: 3,
    name: 'Hard Math',
    category: 'Science',
    difficulty: 'hard',
    is_active: true,
    description: 'Advanced math',
    tags: ['calculus'],
    metadata: { questionCount: 10 },
    questions: [],
  },
]

const mockQuestionSetInfo = {
  questionSetInfo: {
    selectedSets: [
      { id: 1, name: 'Science Quiz', questionCount: 20 },
    ],
    totalQuestions: 20,
    selectedQuestionCount: 15,
    maxQuestionCount: 20,
  },
}

function setupGameStoreMock(overrides: Record<string, unknown> = {}) {
  const state = {
    lobbyCode: 'ABC123',
    isHost: true,
    setQuestionSetInfo: jest.fn(),
    ...overrides,
  }
  mockUseGameStore.mockReturnValue(state)
  mockUseGameStore.getState = jest.fn(() => state)
  return state
}

function setupDefaultApiMocks() {
  mockApi.getAvailableQuestionSets.mockResolvedValue({
    success: true,
    data: mockQuestionSets,
  } as any)
  mockApi.getLobbyQuestionSetInfo.mockResolvedValue({
    success: true,
    data: mockQuestionSetInfo,
  } as any)
}

describe('QuestionSetSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupGameStoreMock()
    setupDefaultApiMocks()
  })

  // 1. Non-host view: read-only info display
  it('renders read-only info display when isHost is false', async () => {
    setupGameStoreMock({ isHost: false })

    await act(async () => {
      render(<QuestionSetSelector />)
    })

    await waitFor(() => {
      expect(screen.getByText('selector.selectedQuestions')).toBeInTheDocument()
    })

    // Non-host should see the selected set name and question count
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeInTheDocument()
      expect(screen.getByText('20 Qs')).toBeInTheDocument()
    })

    // Non-host should NOT see the search input or filter controls
    expect(screen.queryByPlaceholderText('selector.searchSets')).not.toBeInTheDocument()
    expect(screen.queryByText('selector.management')).not.toBeInTheDocument()
  })

  // 2. Host view: full selector with search, filters, and grid
  it('renders full selector with search, filters, and sets grid for host', async () => {
    await act(async () => {
      render(<QuestionSetSelector />)
    })

    await waitFor(() => {
      expect(screen.getByText('selector.management')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('selector.searchSets')).toBeInTheDocument()
    })

    // All three sets should be rendered
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeInTheDocument()
      expect(screen.getByText('History Test')).toBeInTheDocument()
      expect(screen.getByText('Hard Math')).toBeInTheDocument()
    })

    // Category and difficulty filter dropdowns should exist
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBe(2)
  })

  // 3. Loading state: spinner while loading
  it('shows loading spinner while fetching question sets', async () => {
    // Make the API call hang so loading state persists
    mockApi.getAvailableQuestionSets.mockReturnValue(new Promise(() => {}))

    await act(async () => {
      render(<QuestionSetSelector />)
    })

    expect(screen.getByText('selector.fetchingSets')).toBeInTheDocument()
  })

  // 4. Error state: shows error message when API fails
  it('shows error message when API call fails', async () => {
    mockApi.getAvailableQuestionSets.mockResolvedValue({
      success: false,
      error: 'Server error',
    } as any)

    await act(async () => {
      render(<QuestionSetSelector />)
    })

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })

  // 5. Search filtering: filters by name, description, and tags
  it('filters question sets by search term matching name, description, and tags', async () => {
    await act(async () => {
      render(<QuestionSetSelector />)
    })

    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeInTheDocument()
    })

    // Search by tag
    const searchInput = screen.getByPlaceholderText('selector.searchSets')
    fireEvent.change(searchInput, { target: { value: 'calculus' } })

    expect(screen.getByText('Hard Math')).toBeInTheDocument()
    expect(screen.queryByText('Science Quiz')).not.toBeInTheDocument()
    expect(screen.queryByText('History Test')).not.toBeInTheDocument()

    // Search by description
    fireEvent.change(searchInput, { target: { value: 'Historical' } })

    expect(screen.getByText('History Test')).toBeInTheDocument()
    expect(screen.queryByText('Science Quiz')).not.toBeInTheDocument()
    expect(screen.queryByText('Hard Math')).not.toBeInTheDocument()
  })

  // 6. Category filtering
  it('filters question sets by category', async () => {
    await act(async () => {
      render(<QuestionSetSelector />)
    })

    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeInTheDocument()
    })

    const selects = screen.getAllByRole('combobox')
    const categorySelect = selects[0]

    fireEvent.change(categorySelect, { target: { value: 'History' } })

    expect(screen.getByText('History Test')).toBeInTheDocument()
    expect(screen.queryByText('Science Quiz')).not.toBeInTheDocument()
    expect(screen.queryByText('Hard Math')).not.toBeInTheDocument()
  })

  // 7. Difficulty filtering
  it('filters question sets by difficulty', async () => {
    await act(async () => {
      render(<QuestionSetSelector />)
    })

    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeInTheDocument()
    })

    const selects = screen.getAllByRole('combobox')
    const difficultySelect = selects[1]

    fireEvent.change(difficultySelect, { target: { value: 'hard' } })

    expect(screen.getByText('Hard Math')).toBeInTheDocument()
    expect(screen.queryByText('Science Quiz')).not.toBeInTheDocument()
    expect(screen.queryByText('History Test')).not.toBeInTheDocument()
  })

  // 8. Question set toggle: clicking a set toggles selection
  it('toggles question set selection when clicked', async () => {
    // Start with no pre-selected sets
    mockApi.getLobbyQuestionSetInfo.mockResolvedValue({
      success: true,
      data: {
        questionSetInfo: {
          selectedSets: [],
          totalQuestions: 0,
          selectedQuestionCount: 0,
          maxQuestionCount: 0,
        },
      },
    } as any)

    await act(async () => {
      render(<QuestionSetSelector />)
    })

    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeInTheDocument()
    })

    // Initially 0 sets selected (from summary text: "0 selector.setsSelected")
    expect(screen.getByText(/0 selector\.setsSelected/)).toBeInTheDocument()

    // Click to select "Science Quiz"
    fireEvent.click(screen.getByText('Science Quiz'))

    await waitFor(() => {
      expect(screen.getByText(/1 selector\.setsSelected/)).toBeInTheDocument()
    })

    // Click again to deselect
    fireEvent.click(screen.getByText('Science Quiz'))

    await waitFor(() => {
      expect(screen.getByText(/0 selector\.setsSelected/)).toBeInTheDocument()
    })
  })

  // 9. Question count slider: adjusting slider updates count
  it('updates question count when slider is changed', async () => {
    await act(async () => {
      render(<QuestionSetSelector />)
    })

    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeInTheDocument()
    })

    const slider = screen.getByRole('slider')
    expect(slider).toBeInTheDocument()

    // Change slider to a new value
    fireEvent.change(slider, { target: { value: '10' } })

    await waitFor(() => {
      expect(screen.getByText(/10 selector\.questionsCount/)).toBeInTheDocument()
    })
  })

  // 10. Selection too small warning
  it('shows warning when selected sets have fewer than 5 questions', async () => {
    const tinySet = [
      {
        id: 10,
        name: 'Tiny Set',
        category: 'General',
        difficulty: 'easy',
        is_active: true,
        description: 'Very small set',
        tags: [],
        metadata: { questionCount: 3 },
        questions: [],
      },
    ]

    mockApi.getAvailableQuestionSets.mockResolvedValue({
      success: true,
      data: tinySet,
    } as any)

    mockApi.getLobbyQuestionSetInfo.mockResolvedValue({
      success: true,
      data: {
        questionSetInfo: {
          selectedSets: [{ id: 10, name: 'Tiny Set', questionCount: 3 }],
          totalQuestions: 3,
          selectedQuestionCount: 3,
          maxQuestionCount: 3,
        },
      },
    } as any)

    await act(async () => {
      render(<QuestionSetSelector />)
    })

    await waitFor(() => {
      expect(screen.getByText('Tiny Set')).toBeInTheDocument()
    })

    // The warning should appear because computedMaxQuestions (3) < 5
    await waitFor(() => {
      expect(screen.getByText(/selector\.needMoreQuestions/)).toBeInTheDocument()
    })
  })

  // 11. Empty results: shows "no results" when filters match nothing
  it('shows no results message when filters match nothing', async () => {
    await act(async () => {
      render(<QuestionSetSelector />)
    })

    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('selector.searchSets')
    fireEvent.change(searchInput, { target: { value: 'xyznonexistent' } })

    expect(screen.getByText('selector.noResults')).toBeInTheDocument()
    expect(screen.queryByText('Science Quiz')).not.toBeInTheDocument()
  })

  // 12. Does not render selector content without lobby code
  it('does not fetch question sets when lobbyCode is empty', async () => {
    setupGameStoreMock({ lobbyCode: '' })

    await act(async () => {
      render(<QuestionSetSelector />)
    })

    // The API should not have been called without a lobbyCode
    expect(mockApi.getAvailableQuestionSets).not.toHaveBeenCalled()
    expect(mockApi.getLobbyQuestionSetInfo).not.toHaveBeenCalled()
  })
})
