import { render, screen, fireEvent } from '@testing-library/react'
import React, { useState } from 'react'

// Simplified mock component for testing integration
const MockGameComponent: React.FC = () => {
  const [score, setScore] = useState(0)
  const [multiplier, setMultiplier] = useState(1)
  const [timeRemaining, setTimeRemaining] = useState(60)
  const [gameRunning, setGameRunning] = useState(false)

  const addScore = () => {
    setScore(prev => prev + (100 * multiplier))
  }

  const startGame = () => {
    setGameRunning(true)
    setTimeRemaining(60)
  }

  const endGame = () => {
    setGameRunning(false)
  }

  return (
    <div data-testid="game-component">
      <div data-testid="score">Score: {score}</div>
      <div data-testid="multiplier">Multiplier: {multiplier}x</div>
      <div data-testid="time">Time: {timeRemaining}s</div>
      <div data-testid="status">{gameRunning ? 'Running' : 'Stopped'}</div>
      
      <button onClick={addScore} data-testid="add-score">
        Add Score
      </button>
      <button onClick={() => setMultiplier(prev => Math.min(5, prev + 1))} data-testid="increase-multiplier">
        Increase Multiplier
      </button>
      <button onClick={startGame} data-testid="start-game" disabled={gameRunning}>
        Start Game
      </button>
      <button onClick={endGame} data-testid="end-game">
        End Game
      </button>
    </div>
  )
}

describe('Component Integration Tests', () => {
  describe('Basic Game Flow', () => {
    it('handles score calculation with multipliers', () => {
      render(<MockGameComponent />)

      // Initial state
      expect(screen.getByTestId('score')).toHaveTextContent('Score: 0')
      expect(screen.getByTestId('multiplier')).toHaveTextContent('Multiplier: 1x')

      // Add score with 1x multiplier
      fireEvent.click(screen.getByTestId('add-score'))
      expect(screen.getByTestId('score')).toHaveTextContent('Score: 100')

      // Increase multiplier and add score
      fireEvent.click(screen.getByTestId('increase-multiplier'))
      fireEvent.click(screen.getByTestId('add-score'))
      expect(screen.getByTestId('score')).toHaveTextContent('Score: 300') // 100 + (100 * 2)
    })

    it('manages game state correctly', () => {
      render(<MockGameComponent />)

      // Initial state
      expect(screen.getByTestId('status')).toHaveTextContent('Stopped')
      expect(screen.getByTestId('start-game')).not.toBeDisabled()

      // Start game
      fireEvent.click(screen.getByTestId('start-game'))
      expect(screen.getByTestId('status')).toHaveTextContent('Running')
      expect(screen.getByTestId('start-game')).toBeDisabled()

      // End game
      fireEvent.click(screen.getByTestId('end-game'))
      expect(screen.getByTestId('status')).toHaveTextContent('Stopped')
      expect(screen.getByTestId('start-game')).not.toBeDisabled()
    })

    it('enforces multiplier limits', () => {
      render(<MockGameComponent />)

      // Increase multiplier beyond max
      for (let i = 0; i < 6; i++) {
        fireEvent.click(screen.getByTestId('increase-multiplier'))
      }

      expect(screen.getByTestId('multiplier')).toHaveTextContent('Multiplier: 5x')
    })
  })

  describe('Integration Scenarios', () => {
    it('handles complete game session', () => {
      render(<MockGameComponent />)

      // Start game and play
      fireEvent.click(screen.getByTestId('start-game'))
      fireEvent.click(screen.getByTestId('add-score'))
      fireEvent.click(screen.getByTestId('increase-multiplier'))
      fireEvent.click(screen.getByTestId('add-score'))

      expect(screen.getByTestId('status')).toHaveTextContent('Running')
      expect(screen.getByTestId('score')).toHaveTextContent('Score: 300')
      expect(screen.getByTestId('multiplier')).toHaveTextContent('Multiplier: 2x')
    })
  })
}) 