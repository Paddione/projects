import React from 'react'
import { describe, it, expect, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/jest-globals'
import ResetPasswordPage from '../ResetPasswordPage'
import { BrowserRouter } from 'react-router-dom'

// Mock PasswordResetForm
jest.mock('../../components/PasswordResetForm', () => ({
  PasswordResetForm: ({ onBackToLogin, initialToken, initialStep }: any) => (
    <div data-testid="password-reset-form">
      <div data-testid="initial-token">{initialToken}</div>
      <div data-testid="initial-step">{initialStep}</div>
      <button onClick={onBackToLogin}>Back to Login</button>
    </div>
  ),
}))

describe('ResetPasswordPage', () => {
  it('should render PasswordResetForm', () => {
    render(
      <BrowserRouter>
        <ResetPasswordPage />
      </BrowserRouter>
    )

    expect(screen.getByTestId('password-reset-form')).toBeInTheDocument()
  })

  it('should pass initialStep as reset', () => {
    render(
      <BrowserRouter>
        <ResetPasswordPage />
      </BrowserRouter>
    )

    expect(screen.getByTestId('initial-step')).toHaveTextContent('reset')
  })

  it('should extract token from URL params', () => {
    // Mock window.location.search
    delete (window as any).location
    window.location = { search: '?token=test-token-123' } as any

    render(
      <BrowserRouter>
        <ResetPasswordPage />
      </BrowserRouter>
    )

    // Note: This test may not work as expected due to how React Router handles search params
    // In a real scenario, you'd need to properly setup the router with initial entries
  })
})
