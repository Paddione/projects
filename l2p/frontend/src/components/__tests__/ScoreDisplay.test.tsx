import React from 'react';
import { render, screen } from '@testing-library/react';
import { ScoreDisplay } from '../ScoreDisplay';

describe('ScoreDisplay Component', () => {
  const defaultProps = {
    score: 1250,
    multiplier: 3,
    correctAnswers: 5
  }

  it('renders without crashing', () => {
    render(<ScoreDisplay {...defaultProps} />)
    expect(screen.getByTestId('score-value')).toBeInTheDocument()
  })

  it('displays score correctly', () => {
    render(<ScoreDisplay {...defaultProps} />)
    expect(screen.getByText('1,250')).toBeInTheDocument()
  })

  it('displays multiplier correctly', () => {
    render(<ScoreDisplay {...defaultProps} />)
    expect(screen.getByText('×3')).toBeInTheDocument()
  })

  it('displays correct answers count', () => {
    render(<ScoreDisplay {...defaultProps} />)
    expect(screen.getByText('🔥 5')).toBeInTheDocument()
  })

  it('handles zero score', () => {
    render(<ScoreDisplay {...defaultProps} score={0} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('handles 1x multiplier (should not show)', () => {
    render(<ScoreDisplay {...defaultProps} multiplier={1} />)
    expect(screen.queryByTestId('multiplier-value')).not.toBeInTheDocument()
  })

  it('handles maximum multiplier', () => {
    render(<ScoreDisplay {...defaultProps} multiplier={5} />)
    const multiplierElement = screen.getByTestId('multiplier-value')
    expect(multiplierElement).toBeInTheDocument()
    expect(multiplierElement).toHaveTextContent('×5')
  })

  it('formats large scores with commas', () => {
    render(<ScoreDisplay {...defaultProps} score={12345} />)
    expect(screen.getByText('12,345')).toBeInTheDocument()
  })

  it('shows streak when correct answers > 0', () => {
    render(<ScoreDisplay {...defaultProps} correctAnswers={3} />)
    const streakElement = screen.getByTestId('streak-value')
    expect(streakElement).toHaveTextContent('🔥 3')
  })

  it('applies custom className', () => {
    const { container } = render(<ScoreDisplay {...defaultProps} className="custom-score" />)
    expect(container.firstChild).toHaveClass('custom-score')
  })

  it('handles missing optional props', () => {
    render(<ScoreDisplay score={100} multiplier={1} correctAnswers={2} />)
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('🔥 2')).toBeInTheDocument()
  })

  it('displays progress with total questions', () => {
    render(<ScoreDisplay {...defaultProps} correctAnswers={3} totalQuestions={10} />)
    const progressFill = screen.getByTestId('progress-fill')
    expect(progressFill).toBeInTheDocument()
    expect(progressFill).toHaveStyle({ width: '30%' })
    expect(screen.getByText('3 / 10')).toBeInTheDocument()
  })

  it('shows multiplier color coding', () => {
    const { rerender } = render(<ScoreDisplay {...defaultProps} multiplier={2} />)
    expect(screen.getByTestId('multiplier-value')).toHaveClass('multiplier2')

    rerender(<ScoreDisplay {...defaultProps} multiplier={5} />)
    expect(screen.getByTestId('multiplier-value')).toHaveClass('multiplier5')
  })

  it('handles zero correct answers (no streak shown)', () => {
    render(<ScoreDisplay {...defaultProps} correctAnswers={0} />)
    expect(screen.queryByTestId('streak-value')).not.toBeInTheDocument()
  })

  it('can hide multiplier display', () => {
    render(<ScoreDisplay {...defaultProps} multiplier={3} showMultiplier={false} />)
    expect(screen.queryByTestId('multiplier-value')).not.toBeInTheDocument()
  })

  it('can hide streak display', () => {
    render(<ScoreDisplay {...defaultProps} correctAnswers={3} showStreak={false} />)
    expect(screen.queryByTestId('streak-value')).not.toBeInTheDocument()
  })

  it('shows streak with total questions', () => {
    render(<ScoreDisplay {...defaultProps} correctAnswers={3} totalQuestions={10} />)
    expect(screen.getByText('🔥 3/10')).toBeInTheDocument()
  })
}) 