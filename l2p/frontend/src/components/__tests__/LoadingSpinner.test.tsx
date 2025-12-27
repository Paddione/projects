import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LoadingSpinner } from '../LoadingSpinner';

describe('LoadingSpinner Component', () => {
  it('renders without crashing', () => {
    render(<LoadingSpinner />)
    // Check that the spinner element exists
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('displays default loading text', () => {
    render(<LoadingSpinner />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('displays custom text when provided', () => {
    render(<LoadingSpinner text="Processing..." />)
    expect(screen.getByText('Processing...')).toBeInTheDocument()
  })

  it('hides text when empty string provided', () => {
    render(<LoadingSpinner text="" />)
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  it('renders with small size', () => {
    render(<LoadingSpinner size="small" />)
    const spinner = screen.getByTestId('loading-spinner')
    expect(spinner).toBeInTheDocument()
  })

  it('renders with medium size (default)', () => {
    render(<LoadingSpinner size="medium" />)
    const spinner = screen.getByTestId('loading-spinner')
    expect(spinner).toBeInTheDocument()
  })

  it('renders with large size', () => {
    render(<LoadingSpinner size="large" />)
    const spinner = screen.getByTestId('loading-spinner')
    expect(spinner).toBeInTheDocument()
  })

  it('renders with default medium size when no size specified', () => {
    render(<LoadingSpinner />)
    const spinner = screen.getByTestId('loading-spinner')
    expect(spinner).toBeInTheDocument()
  })
}) 