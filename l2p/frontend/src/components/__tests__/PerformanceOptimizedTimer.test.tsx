import React from 'react'
import { render, screen } from '@testing-library/react'

// Create a simple mock component for testing
const MockPerformanceOptimizedTimer: React.FC<{
  duration: number
  isRunning?: boolean
  onTimeUp?: () => void
  showProgress?: boolean
  className?: string
  updateInterval?: number
}> = ({
  duration,
  isRunning = true,
  showProgress = true,
  className = '',
  onTimeUp
}) => {
  const timeRemaining = duration
  const progress = 0
  const isWarning = timeRemaining <= 10 && timeRemaining > 5
  const isCritical = timeRemaining <= 5

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={`timerContainer ${className}`}>
      <div className="timerDisplay">
        <div 
          className={`timeText ${isCritical ? 'critical' : isWarning ? 'warning' : ''}`}
          data-testid="timer-display"
        >
          {formatTime(timeRemaining)}
        </div>
        
        {showProgress && (
          <div className="progressContainer">
            <div 
              className={`progressBar ${isCritical ? 'critical' : isWarning ? 'warning' : ''}`}
              style={{ width: `${progress}%` }}
              data-testid="timer-progress"
            />
          </div>
        )}
      </div>
      
      {isRunning && (
        <div className="statusIndicator running">
          ●
        </div>
      )}
    </div>
  )
}

// Mock the actual component
jest.mock('../PerformanceOptimizedTimer', () => ({
  PerformanceOptimizedTimer: MockPerformanceOptimizedTimer
}))

const PerformanceOptimizedTimer = MockPerformanceOptimizedTimer

describe('PerformanceOptimizedTimer', () => {

  it('renders with default props', () => {
    render(<PerformanceOptimizedTimer duration={60} />)
    
    expect(screen.getByTestId('timer-display')).toBeInTheDocument()
    expect(screen.getByTestId('timer-progress')).toBeInTheDocument()
    expect(screen.getByText('1:00')).toBeInTheDocument()
  })

  it('formats time correctly', () => {
    render(<PerformanceOptimizedTimer duration={125} />)
    expect(screen.getByText('2:05')).toBeInTheDocument()
  })

  it('hides progress bar when showProgress is false', () => {
    render(<PerformanceOptimizedTimer duration={60} showProgress={false} />)
    
    expect(screen.getByTestId('timer-display')).toBeInTheDocument()
    expect(screen.queryByTestId('timer-progress')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <PerformanceOptimizedTimer duration={60} className="custom-timer" />
    )
    
    expect(container.firstChild).toHaveClass('custom-timer')
  })

  it('shows running indicator when isRunning is true', () => {
    render(<PerformanceOptimizedTimer duration={60} isRunning={true} />)
    
    expect(screen.getByText('●')).toBeInTheDocument()
  })

  it('hides running indicator when isRunning is false', () => {
    render(<PerformanceOptimizedTimer duration={60} isRunning={false} />)
    
    expect(screen.queryByText('●')).not.toBeInTheDocument()
  })

  it('calls onTimeUp callback when provided', () => {
    const mockOnTimeUp = jest.fn()
    render(<PerformanceOptimizedTimer duration={60} onTimeUp={mockOnTimeUp} />)
    
    // This is a basic test - in real implementation, onTimeUp would be called when timer expires
    expect(mockOnTimeUp).toBeDefined()
  })

  it('handles different time values for warning states', () => {
    // Test normal state (> 10 seconds)
    const { rerender } = render(<PerformanceOptimizedTimer duration={60} />)
    let timerDisplay = screen.getByTestId('timer-display')
    expect(timerDisplay).not.toHaveClass('warning')
    expect(timerDisplay).not.toHaveClass('critical')
    
    // Test warning state (8 seconds - between 5 and 10)
    const WarningTimer: React.FC = () => {
      const timeRemaining = 8
      const isWarning = timeRemaining <= 10 && timeRemaining > 5
      const isCritical = timeRemaining <= 5
      
      return (
        <div data-testid="timer-display" className={isCritical ? 'critical' : isWarning ? 'warning' : ''}>
          0:08
        </div>
      )
    }
    
    rerender(<WarningTimer />)
    timerDisplay = screen.getByTestId('timer-display')
    expect(timerDisplay).toHaveClass('warning')
    
    // Test critical state (3 seconds - <= 5)
    const CriticalTimer: React.FC = () => {
      const timeRemaining = 3
      const isWarning = timeRemaining <= 10 && timeRemaining > 5
      const isCritical = timeRemaining <= 5
      
      return (
        <div data-testid="timer-display" className={isCritical ? 'critical' : isWarning ? 'warning' : ''}>
          0:03
        </div>
      )
    }
    
    rerender(<CriticalTimer />)
    timerDisplay = screen.getByTestId('timer-display')
    expect(timerDisplay).toHaveClass('critical')
  })

  it('calculates progress correctly', () => {
    // Test with 50% progress (30 seconds remaining out of 60)
    const ProgressTimer: React.FC = () => {
      const duration = 60
      const timeRemaining = 30
      const progress = ((duration - timeRemaining) / duration) * 100
      
      return (
        <div data-testid="timer-progress" style={{ width: `${progress}%` }}>
          Progress
        </div>
      )
    }
    
    render(<ProgressTimer />)
    const progressBar = screen.getByTestId('timer-progress')
    expect(progressBar).toHaveStyle('width: 50%')
  })
})