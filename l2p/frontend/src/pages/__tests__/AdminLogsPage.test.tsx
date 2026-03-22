import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminLogsPage } from '../AdminLogsPage'

describe('AdminLogsPage', () => {
  it('should render static admin logs content', () => {
    render(<AdminLogsPage />)

    expect(screen.getByText('Admin Logs')).toBeInTheDocument()
    expect(screen.getByText('Admin logs page content')).toBeInTheDocument()
  })
})
