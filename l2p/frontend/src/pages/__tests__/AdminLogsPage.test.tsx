import React from 'react'
import { describe, it, expect, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import AdminLogsPage from '../AdminLogsPage'

// Mock LogStream
jest.mock('../../components/LogStream', () => ({
  __esModule: true,
  default: () => <div data-testid="log-stream">Log Stream</div>,
}))

describe('AdminLogsPage', () => {
  it.skip('should render LogStream component', () => {
    render(<AdminLogsPage />)

    expect(screen.getByTestId('log-stream')).toBeInTheDocument()
  })
})
