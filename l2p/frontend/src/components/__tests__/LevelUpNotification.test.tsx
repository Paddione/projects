import React from 'react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/jest-globals'
import { LevelUpNotification } from '../LevelUpNotification'

// Mock timers
jest.useFakeTimers()

describe('LevelUpNotification', () => {
  const mockOnClose = jest.fn()
  const mockNotification = {
    playerId: 'test-player-id',
    username: 'TestUser',
    character: 'student' as const,
    oldLevel: 5,
    newLevel: 6,
    experienceAwarded: 500,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  it('should render level up notification', () => {
    render(<LevelUpNotification notification={mockNotification} onClose={mockOnClose} />)

    expect(screen.getByText('Level Up!')).toBeInTheDocument()
    expect(screen.getByText('TestUser')).toBeInTheDocument()
    expect(screen.getByText('Level 5')).toBeInTheDocument()
    expect(screen.getByText('Level 6')).toBeInTheDocument()
    expect(screen.getByText('+500 XP gained!')).toBeInTheDocument()
  })

  it('should show student character emoji', () => {
    render(<LevelUpNotification notification={mockNotification} onClose={mockOnClose} />)

    expect(screen.getByText('👨‍🎓')).toBeInTheDocument()
  })

  it('should show professor character emoji', () => {
    const professorNotification = { ...mockNotification, character: 'professor' as const }
    render(<LevelUpNotification notification={professorNotification} onClose={mockOnClose} />)

    expect(screen.getByText('👨‍🏫')).toBeInTheDocument()
  })

  it('should show confetti effect', () => {
    const { container } = render(<LevelUpNotification notification={mockNotification} onClose={mockOnClose} />)

    // Should have 20 confetti elements
    const confettiElements = container.querySelectorAll('[style*="confettiFall"]')
    expect(confettiElements.length).toBeGreaterThanOrEqual(20)
  })

  it('should auto-close after 5 seconds', () => {
    render(<LevelUpNotification notification={mockNotification} onClose={mockOnClose} />)

    // Fast-forward 5 seconds
    jest.advanceTimersByTime(5000)

    // Should start fade out animation
    // onClose should be called after additional 500ms
    jest.advanceTimersByTime(500)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should close when close button is clicked', () => {
    render(<LevelUpNotification notification={mockNotification} onClose={mockOnClose} />)

    const closeButton = screen.getByText('×')
    fireEvent.click(closeButton)

    // Fast-forward fade out animation
    jest.advanceTimersByTime(500)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should clean up timer on unmount', () => {
    const { unmount } = render(<LevelUpNotification notification={mockNotification} onClose={mockOnClose} />)

    unmount()

    // Fast-forward timers - should not call onClose since component unmounted
    jest.advanceTimersByTime(6000)
  })

  it('should display all character types correctly', () => {
    const characters = [
      { char: 'professor' as const, emoji: '👨‍🏫' },
      { char: 'student' as const, emoji: '👨‍🎓' },
      { char: 'librarian' as const, emoji: '👩‍💼' },
      { char: 'researcher' as const, emoji: '👨‍🔬' },
      { char: 'dean' as const, emoji: '👩‍⚖️' },
      { char: 'graduate' as const, emoji: '🎓' },
      { char: 'lab_assistant' as const, emoji: '👨‍🔬' },
      { char: 'teaching_assistant' as const, emoji: '👩‍🏫' },
    ]

    characters.forEach(({ char, emoji }) => {
      const notification = { ...mockNotification, character: char }
      const { unmount } = render(<LevelUpNotification notification={notification} onClose={mockOnClose} />)

      expect(screen.getByText(emoji)).toBeInTheDocument()

      unmount()
    })
  })
})
