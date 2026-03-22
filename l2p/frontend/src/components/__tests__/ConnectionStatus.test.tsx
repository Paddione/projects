import React from 'react'
import { render, screen } from '@testing-library/react'

// Mock socketService to control connection status
vi.mock('../../services/socketService', () => ({
  socketService: {
    getConnectionStatus: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}))

// Import the component after all mocks are defined
import { ConnectionStatus } from '../ConnectionStatus'

import { socketService } from '../../services/socketService'

describe('ConnectionStatus Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with default props', () => {
    socketService.getConnectionStatus.mockReturnValue('disconnected')
    render(<ConnectionStatus />)
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
  })

  it('applies custom className', () => {
    socketService.getConnectionStatus.mockReturnValue('connected')
    const { container } = render(<ConnectionStatus className="custom-status" />)
    expect(container.firstChild).toHaveClass('custom-status')
  })

  it('shows connected status', () => {
    socketService.getConnectionStatus.mockReturnValue('connected')
    render(<ConnectionStatus />)
    expect(screen.getByText(/connected/i)).toBeInTheDocument()
  })

  it('shows connecting status', () => {
    socketService.getConnectionStatus.mockReturnValue('connecting')
    render(<ConnectionStatus />)
    expect(screen.getByText(/connecting/i)).toBeInTheDocument()
  })

  it('shows disconnected status', () => {
    socketService.getConnectionStatus.mockReturnValue('disconnected')
    render(<ConnectionStatus />)
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
  })

  it('sets up socket event listeners', () => {
    render(<ConnectionStatus />)
    
    // Verify that event listeners are registered
    expect(socketService.on).toHaveBeenCalledWith('connect', expect.any(Function))
    expect(socketService.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
    expect(socketService.on).toHaveBeenCalledWith('connect_error', expect.any(Function))
  })
}) 