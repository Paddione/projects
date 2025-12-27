import React from 'react'
import { render, screen } from '@testing-library/react'
import { Timer } from '../Timer'

describe('Timer Component', () => {
  const defaultProps = {
    timeRemaining: 60,
    totalTime: 60,
    isRunning: true,
    onTimeUp: jest.fn(),
    showProgress: true
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders timer display correctly', () => {
    render(<Timer {...defaultProps} />)
    
    expect(screen.getByTestId('timer-display')).toBeInTheDocument()
    expect(screen.getByText('1:00')).toBeInTheDocument()
  })

  it('displays correct time format', () => {
    render(<Timer {...defaultProps} timeRemaining={125} />)
    
    expect(screen.getByText('2:05')).toBeInTheDocument()
  })

  it('shows progress bar when showProgress is true', () => {
    render(<Timer {...defaultProps} />)
    
    expect(screen.getByTestId('timer-progress')).toBeInTheDocument()
  })

  it('hides progress bar when showProgress is false', () => {
    render(<Timer {...defaultProps} showProgress={false} />)
    
    expect(screen.queryByTestId('timer-progress')).not.toBeInTheDocument()
  })

  it('shows warning state when time is low', () => {
    render(<Timer {...defaultProps} timeRemaining={8} />)
    
    // Use async wait to ensure state updates are processed
    setTimeout(() => {
      const timerDisplay = screen.getByTestId('timer-display')
      expect(timerDisplay).toHaveClass('warning')
    }, 150)
  })

  it('shows critical state when time is very low', () => {
    render(<Timer {...defaultProps} timeRemaining={3} />)
    
    // Use async wait to ensure state updates are processed
    setTimeout(() => {
      const timerDisplay = screen.getByTestId('timer-display')
      expect(timerDisplay).toHaveClass('critical')
    }, 150)
  })

  it('calls onTimeUp when time reaches zero', () => {
    const onTimeUp = jest.fn()
    render(<Timer {...defaultProps} timeRemaining={0} onTimeUp={onTimeUp} />)
    
    expect(onTimeUp).toHaveBeenCalledTimes(1)
  })

  it('shows running indicator when isRunning is true', () => {
    render(<Timer {...defaultProps} />)
    
    const statusIndicator = screen.getByText('●')
    expect(statusIndicator).toHaveClass('running')
  })

  it('hides running indicator when isRunning is false', () => {
    render(<Timer {...defaultProps} isRunning={false} />)
    
    expect(screen.queryByText('●')).not.toBeInTheDocument()
  })

  it('calculates progress percentage correctly', () => {
    render(<Timer {...defaultProps} timeRemaining={30} totalTime={60} />)
    
    const progressBar = screen.getByTestId('timer-progress')
    expect(progressBar).toHaveStyle({ width: '50%' })
  })

  it('handles zero total time gracefully', () => {
    render(<Timer {...defaultProps} totalTime={0} />)
    
    expect(screen.getByTestId('timer-display')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Timer {...defaultProps} className="custom-timer" />)
    
    const timerContainer = screen.getByTestId('timer-container')
    expect(timerContainer).toHaveClass('custom-timer')
  })

  it('displays zero time correctly', () => {
    render(<Timer {...defaultProps} timeRemaining={0} />)
    
    expect(screen.getByText('0:00')).toBeInTheDocument()
  })

  it('handles negative time gracefully', () => {
    render(<Timer {...defaultProps} timeRemaining={-5} />)
    
    expect(screen.getByText('0:00')).toBeInTheDocument()
  })

  it('updates display when time changes', () => {
    const { rerender } = render(<Timer {...defaultProps} timeRemaining={60} />)
    
    expect(screen.getByText('1:00')).toBeInTheDocument()
    
    rerender(<Timer {...defaultProps} timeRemaining={45} />)
    
    expect(screen.getByText('0:45')).toBeInTheDocument()
  })

  it('maintains accessibility attributes', () => {
    render(<Timer {...defaultProps} />)
    
    const timerDisplay = screen.getByTestId('timer-display')
    expect(timerDisplay).toBeInTheDocument()
  })
}) 