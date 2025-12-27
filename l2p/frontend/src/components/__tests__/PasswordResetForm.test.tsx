import '@testing-library/jest-dom'
import React, { act } from 'react'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test-utils'

// Mock the API service functions
const mockRequestPasswordReset = jest.fn();
const mockCompletePasswordReset = jest.fn();

jest.mock('../../services/apiService', () => ({
  __esModule: true,
  get apiService() {
    return {
      requestPasswordReset: mockRequestPasswordReset,
      completePasswordReset: mockCompletePasswordReset
    }
  }
}));

// Reinitialize mocks before each test to ensure they work correctly
beforeEach(() => {
  mockRequestPasswordReset.mockClear();
  mockCompletePasswordReset.mockClear();
});

// Import the component after mocks are set up
import { PasswordResetForm } from '../PasswordResetForm';

describe('PasswordResetForm Component', () => {
  const mockOnBackToLogin = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Use real timers throughout tests to avoid userEvent issues

  describe('Initial Rendering', () => {
    it('renders without crashing', () => {
      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)
      expect(screen.getByText('Password Reset')).toBeInTheDocument()
    })

    it('displays the correct initial step content', () => {
      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)

      expect(screen.getByText('Enter your email to receive a reset link')).toBeInTheDocument()
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Send Reset Email' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Back to Login' })).toBeInTheDocument()
    })

    it('does not show reset step elements initially', () => {
      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)

      expect(screen.queryByLabelText('Reset Token')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reset Password' })).not.toBeInTheDocument()
    })
  })

  describe('Request Password Reset Step', () => {
    it('handles email input changes', async () => {
      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)

      const emailInput = screen.getByLabelText('Email Address')
      await user.type(emailInput, 'test@example.com')

      expect(emailInput).toHaveValue('test@example.com')
    })

    it('submits request reset form successfully', async () => {
      mockRequestPasswordReset.mockResolvedValue({
        success: true,
        data: { message: 'Reset email sent' },
        status: 200,
        statusText: 'OK',
        headers: {}
      })

      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)

      const emailInput = screen.getByLabelText('Email Address')
      const submitButton = screen.getByRole('button', { name: 'Send Reset Email' })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockRequestPasswordReset).toHaveBeenCalledWith('test@example.com')
      })

      expect(screen.getByText('If the email address exists, a password reset email has been sent')).toBeInTheDocument()
      expect(screen.getByText('Enter the token and new password')).toBeInTheDocument()
    })

    it('handles request reset API error', async () => {
      mockRequestPasswordReset.mockResolvedValue({
        success: false,
        error: 'Email not found',
        status: 404,
        statusText: 'Not Found',
        headers: {}
      })

      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)

      const emailInput = screen.getByLabelText('Email Address')
      const submitButton = screen.getByRole('button', { name: 'Send Reset Email' })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Email not found')).toBeInTheDocument()
      })
    })

    it('handles request reset network error', async () => {
      mockRequestPasswordReset.mockRejectedValue(new Error('Network error'))

      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)

      const emailInput = screen.getByLabelText('Email Address')
      const submitButton = screen.getByRole('button', { name: 'Send Reset Email' })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('shows loading state during request', async () => {
      let resolvePromise: (value: { success: boolean; data: { message: string }; status: number; statusText: string; headers: Record<string, string> }) => void
      mockRequestPasswordReset.mockImplementation(() => new Promise(resolve => {
        resolvePromise = resolve
      }))

      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)

      const emailInput = screen.getByLabelText('Email Address')
      const submitButton = screen.getByRole('button', { name: 'Send Reset Email' })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      expect(screen.getByRole('button', { name: 'Sending...' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled()

      // Resolve the promise to avoid hanging
      resolvePromise!({
        success: true,
        data: { message: 'Reset email sent' },
        status: 200,
        statusText: 'OK',
        headers: {}
      })
    })

    it('validates required email field', async () => {
      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)

      const submitButton = screen.getByRole('button', { name: 'Send Reset Email' })
      await user.click(submitButton)

      // HTML5 validation should prevent submission
      expect(mockRequestPasswordReset).not.toHaveBeenCalled()
    })
  })

  describe('Reset Password Step', () => {
    let user: import('@testing-library/user-event').UserEvent;
    beforeEach(async () => {
      mockRequestPasswordReset.mockResolvedValue({
        success: true,
        data: { message: 'Reset email sent' },
        status: 200,
        statusText: 'OK',
        headers: {}
      })

      const utils = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)
      user = utils.user

      const emailInput = screen.getByLabelText('Email Address')
      const submitButton = screen.getByRole('button', { name: 'Send Reset Email' })
      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)
      await waitFor(() => {
        expect(screen.getByText('Enter the token and new password')).toBeInTheDocument()
      })
    })

    it('displays reset step form elements', () => {
      expect(screen.getByLabelText('Reset Token')).toBeInTheDocument()
      expect(screen.getByLabelText('New Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reset Password' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Request New Token' })).toBeInTheDocument()
    })

    it('displays password requirements', () => {
      expect(screen.getByText('Password must contain:')).toBeInTheDocument()
      expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
      expect(screen.getByText('At least one lowercase letter')).toBeInTheDocument()
      expect(screen.getByText('At least one uppercase letter')).toBeInTheDocument()
      expect(screen.getByText('At least one number')).toBeInTheDocument()
      expect(screen.getByText('At least one special character (@$!%*?&)')).toBeInTheDocument()
    })

    it('handles token and password input changes', async () => {
      const tokenInput = screen.getByLabelText('Reset Token')
      const passwordInput = screen.getByLabelText('New Password')
      await user.type(tokenInput, 'reset-token-123')
      await user.type(passwordInput, 'NewPassword123!')
      expect(tokenInput).toHaveValue('reset-token-123')
      expect(passwordInput).toHaveValue('NewPassword123!')
    })

    it('validates password requirements in real-time', async () => {
      const passwordInput = screen.getByLabelText('New Password')
      // Start with invalid password
      await user.type(passwordInput, 'weak')
      // Wait for state updates and check that requirements show as invalid
      await waitFor(() => {
        const requirements = screen.getAllByRole('listitem')
        expect(requirements[0]).toHaveClass('invalid') // length
        expect(requirements[1]).toHaveClass('valid') // lowercase
        expect(requirements[2]).toHaveClass('invalid') // uppercase
        expect(requirements[3]).toHaveClass('invalid') // number
        expect(requirements[4]).toHaveClass('invalid') // special
      })
      // Type a valid password
      await user.clear(passwordInput)
      await user.type(passwordInput, 'StrongPass123!')
      // Wait for state updates and check that requirements show as valid
      await waitFor(() => {
        const requirements = screen.getAllByRole('listitem')
        expect(requirements[0]).toHaveClass('valid') // length
        expect(requirements[1]).toHaveClass('valid') // lowercase
        expect(requirements[2]).toHaveClass('valid') // uppercase
        expect(requirements[3]).toHaveClass('valid') // number
        expect(requirements[4]).toHaveClass('valid') // special
      })
    })

    it('submits reset form successfully with valid password', async () => {
      mockCompletePasswordReset.mockResolvedValue({
        success: true,
        data: { message: 'Password reset successful' },
        status: 200,
        statusText: 'OK',
        headers: {}
      })
      const tokenInput = screen.getByLabelText('Reset Token')
      const passwordInput = screen.getByLabelText('New Password')
      const submitButton = screen.getByRole('button', { name: 'Reset Password' })
      await user.type(tokenInput, 'reset-token-123')
      await user.type(passwordInput, 'StrongPass123!')
      await user.click(submitButton)
      await waitFor(() => {
        expect(mockCompletePasswordReset).toHaveBeenCalledWith('reset-token-123', 'StrongPass123!')
        expect(screen.getByText('Password reset completed successfully! You can now login with your new password.')).toBeInTheDocument()
      })
    })

    it('prevents submission with invalid password', async () => {
      const tokenInput = screen.getByLabelText('Reset Token')
      const passwordInput = screen.getByLabelText('New Password')
      const submitButton = screen.getByRole('button', { name: 'Reset Password' })

      await user.type(tokenInput, 'reset-token-123')
      await user.type(passwordInput, 'weak')
      await user.click(submitButton)

      expect(screen.getByText('Please ensure your password meets all requirements')).toBeInTheDocument()
      expect(mockCompletePasswordReset).not.toHaveBeenCalled()
    })

    it('handles reset API error', async () => {
      mockCompletePasswordReset.mockResolvedValue({
        success: false,
        error: 'Invalid token',
        status: 401,
        statusText: 'Unauthorized',
        headers: {}
      })

      const tokenInput = screen.getByLabelText('Reset Token')
      const passwordInput = screen.getByLabelText('New Password')
      const submitButton = screen.getByRole('button', { name: 'Reset Password' })

      await user.type(tokenInput, 'invalid-token')
      await user.type(passwordInput, 'StrongPass123!')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Invalid token')).toBeInTheDocument()
      })
    })

    it('handles reset network error', async () => {
      mockCompletePasswordReset.mockRejectedValue(new Error('Network error'))

      const tokenInput = screen.getByLabelText('Reset Token')
      const passwordInput = screen.getByLabelText('New Password')
      const submitButton = screen.getByRole('button', { name: 'Reset Password' })

      await user.type(tokenInput, 'reset-token-123')
      await user.type(passwordInput, 'StrongPass123!')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('shows loading state during reset', async () => {
      let resolvePromise: (value: { success: boolean; data: { message: string }; status: number; statusText: string; headers: Record<string, string> }) => void
      mockCompletePasswordReset.mockImplementation(() => new Promise(resolve => {
        resolvePromise = resolve
      }))

      const tokenInput = screen.getByLabelText('Reset Token')
      const passwordInput = screen.getByLabelText('New Password')
      const submitButton = screen.getByRole('button', { name: 'Reset Password' })

      await user.type(tokenInput, 'reset-token-123')
      await user.type(passwordInput, 'StrongPass123!')
      await user.click(submitButton)

      expect(screen.getByRole('button', { name: 'Resetting...' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Resetting...' })).toBeDisabled()

      // Resolve the promise to avoid hanging
      resolvePromise!({
        success: true,
        data: { message: 'Password reset successfully' },
        status: 200,
        statusText: 'OK',
        headers: {}
      })
    })

    it('calls onBackToLogin after successful reset', async () => {
      mockCompletePasswordReset.mockResolvedValue({
        success: true,
        data: { message: 'Password reset successful' },
        status: 200,
        statusText: 'OK',
        headers: {}
      })

      const tokenInput = screen.getByLabelText('Reset Token')
      const passwordInput = screen.getByLabelText('New Password')
      const submitButton = screen.getByRole('button', { name: 'Reset Password' })

      await user.type(tokenInput, 'reset-token-123')
      await user.type(passwordInput, 'StrongPass123!')
      // Use fake timers locally to advance the redirect timeout deterministically
      jest.useFakeTimers({ legacyFakeTimers: true })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Password reset completed successfully! You can now login with your new password.')).toBeInTheDocument()
      })

      // Fast-forward the 3s redirect timeout deterministically
      await act(async () => {
        jest.advanceTimersByTime(3000)
      })
      expect(mockOnBackToLogin).toHaveBeenCalled()
      jest.useRealTimers()
    })
  })

  describe('Navigation and State Management', () => {
    it('calls onBackToLogin when back button is clicked', async () => {
      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)

      const backButton = screen.getByRole('button', { name: 'Back to Login' })
      await user.click(backButton)

      expect(mockOnBackToLogin).toHaveBeenCalled()
    })

    it('switches back to request step when "Request New Token" is clicked', async () => {
      // First, get to reset step
      mockRequestPasswordReset.mockResolvedValue({
        success: true,
        data: { message: 'Reset email sent' }
      })

      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)

      const emailInput = screen.getByLabelText('Email Address')
      const submitButton = screen.getByRole('button', { name: 'Send Reset Email' })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Enter the token and new password')).toBeInTheDocument()
      })

      // Click "Request New Token"
      const requestNewTokenButton = screen.getByRole('button', { name: 'Request New Token' })
      await user.click(requestNewTokenButton)

      // Should be back to request step
      expect(screen.getByText('Enter your email to receive a reset link')).toBeInTheDocument()
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
      expect(screen.queryByLabelText('Reset Token')).not.toBeInTheDocument()
    })

    it('resets form state when switching back to request step', async () => {
      // First, get to reset step and fill some data
      mockRequestPasswordReset.mockResolvedValue({
        success: true,
        data: { message: 'Reset email sent' }
      })

      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)

      const emailInput = screen.getByLabelText('Email Address')
      const submitButton = screen.getByRole('button', { name: 'Send Reset Email' })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Enter the token and new password')).toBeInTheDocument()
      })

      // Fill reset form
      const tokenInput = screen.getByLabelText('Reset Token')
      const passwordInput = screen.getByLabelText('New Password')

      await user.type(tokenInput, 'some-token')
      await user.type(passwordInput, 'SomePassword123!')

      // Switch back to request step
      const requestNewTokenButton = screen.getByRole('button', { name: 'Request New Token' })
      await user.click(requestNewTokenButton)

      // Form should be reset
      expect(screen.getByLabelText('Email Address')).toHaveValue('')
    })
  })

  describe('Error Handling', () => {
    it('clears error when switching steps', async () => {
      // Create an error in request step
      mockRequestPasswordReset.mockResolvedValue({
        success: false,
        error: 'Email not found'
      })

      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)

      const emailInput = screen.getByLabelText('Email Address')
      const submitButton = screen.getByRole('button', { name: 'Send Reset Email' })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Email not found')).toBeInTheDocument()
      })

      // Switch to reset step (should clear error)
      mockRequestPasswordReset.mockResolvedValue({
        success: true,
        data: { message: 'Reset email sent' }
      })

      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.queryByText('Email not found')).not.toBeInTheDocument()
      })
    })

    it('handles error display component integration', async () => {
      mockRequestPasswordReset.mockResolvedValue({
        success: false,
        error: 'Test error message'
      })

      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)

      const emailInput = screen.getByLabelText('Email Address')
      const submitButton = screen.getByRole('button', { name: 'Send Reset Email' })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Test error message')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper form labels and structure', () => {
      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)

      expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Password Reset')
    })

    it('supports keyboard navigation', async () => {
      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)

      const emailInput = screen.getByLabelText('Email Address')
      const submitButton = screen.getByRole('button', { name: 'Send Reset Email' })

      emailInput.focus()
      expect(emailInput).toHaveFocus()

      await user.tab()
      expect(submitButton).toHaveFocus()
    })

    it('has proper ARIA attributes', () => {
      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)

      const emailInput = screen.getByLabelText('Email Address')
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('required')
    })
  })

  describe('Password Validation Logic', () => {
    it('validates password length correctly', async () => {
      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)

      // Get to reset step
      mockRequestPasswordReset.mockResolvedValue({
        success: true,
        data: { message: 'Reset email sent' }
      })

      const emailInput = screen.getByLabelText('Email Address')
      const submitButton = screen.getByRole('button', { name: 'Send Reset Email' })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByLabelText('New Password')).toBeInTheDocument()
      })

      const passwordInput = screen.getByLabelText('New Password')

      // Test short password
      await user.type(passwordInput, '123')
      expect(screen.getByText('At least 8 characters')).toHaveClass('invalid')

      // Test long enough password
      await user.clear(passwordInput)
      await user.type(passwordInput, '12345678')
      expect(screen.getByText('At least 8 characters')).toHaveClass('valid')
    })

    it('validates password complexity requirements', async () => {
      // Get to reset step
      mockRequestPasswordReset.mockResolvedValue({
        success: true,
        data: { message: 'Reset email sent' }
      })

      const { user } = renderWithProviders(<PasswordResetForm onBackToLogin={mockOnBackToLogin} />)

      const emailInput = screen.getByLabelText('Email Address')
      const submitButton = screen.getByRole('button', { name: 'Send Reset Email' })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByLabelText('New Password')).toBeInTheDocument()
      })

      const passwordInput = screen.getByLabelText('New Password')

      // Test each requirement individually
      await user.type(passwordInput, 'a') // lowercase
      expect(screen.getByText('At least one lowercase letter')).toHaveClass('valid')

      await user.type(passwordInput, 'A') // uppercase
      expect(screen.getByText('At least one uppercase letter')).toHaveClass('valid')

      await user.type(passwordInput, '1') // number
      expect(screen.getByText('At least one number')).toHaveClass('valid')

      await user.type(passwordInput, '@') // special
      expect(screen.getByText('At least one special character (@$!%*?&)')).toHaveClass('valid')
    })
  })
}) 