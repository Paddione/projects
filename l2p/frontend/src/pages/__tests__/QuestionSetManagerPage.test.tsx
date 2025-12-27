import React from 'react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QuestionSetManagerPage } from '../QuestionSetManagerPage'
import { useGameStore } from '../../stores/gameStore'

// Mock dependencies
jest.mock('../../stores/gameStore')
jest.mock('../../components/QuestionSetManager', () => ({
  QuestionSetManager: () => <div data-testid="question-set-manager">Question Set Manager</div>,
}))

describe('QuestionSetManagerPage', () => {
  const mockSetError = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()

    jest.mocked(useGameStore).mockReturnValue({
      error: null,
      setError: mockSetError,
    } as any)
  })

  it('should render page title and description', () => {
    render(<QuestionSetManagerPage />)

    expect(screen.getByText('Question Set Management')).toBeInTheDocument()
    expect(screen.getByText('Import, edit, and manage question sets for your games')).toBeInTheDocument()
  })

  it('should render QuestionSetManager component', () => {
    render(<QuestionSetManagerPage />)

    expect(screen.getByTestId('question-set-manager')).toBeInTheDocument()
  })

  it('should display error when present', () => {
    jest.mocked(useGameStore).mockReturnValue({
      error: 'Test error message',
      setError: mockSetError,
    } as any)

    render(<QuestionSetManagerPage />)

    expect(screen.getByText('Test error message')).toBeInTheDocument()
  })
})
