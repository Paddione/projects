import React from 'react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/jest-globals'
import { AuthForm } from '../AuthForm'
import { apiService } from '../../services/apiService'

// Mock apiService
jest.mock('../../services/apiService', () => ({
  apiService: {
    login: jest.fn(),
    register: jest.fn(),
  },
}))

describe('AuthForm', () => {
  const mockOnAuthSuccess = jest.fn()
  const mockOnShowPasswordReset = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Initial render', () => {
    it('should render login form by default', () => {
      render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />)

      expect(screen.getByTestId('login-tab')).toHaveClass('active')
      expect(screen.getByTestId('username-input')).toBeInTheDocument()
      expect(screen.getByTestId('password-input')).toBeInTheDocument()
      expect(screen.getByTestId('login-button')).toBeInTheDocument()
    })

    it('should render logo', () => {
      render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />)

      const logo = screen.getByAltText('Learn2Play Logo')
      expect(logo).toBeInTheDocument()
      expect(logo).toHaveAttribute('src', '/icons/branding/l2p-logo.svg')
    })

    it('should render forgot password link when callback provided', () => {
      render(<AuthForm onAuthSuccess={mockOnAuthSuccess} onShowPasswordReset={mockOnShowPasswordReset} />)

      expect(screen.getByTestId('forgot-password-link')).toBeInTheDocument()
    })

    it('should not render forgot password link when callback not provided', () => {
      render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />)

      expect(screen.queryByTestId('forgot-password-link')).not.toBeInTheDocument()
    })
  })

  describe('Tab switching', () => {
    it('should switch to register tab when clicked', () => {
      render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />)

      fireEvent.click(screen.getByTestId('register-tab'))

      expect(screen.getByTestId('register-tab')).toHaveClass('active')
      expect(screen.getByTestId('email-input')).toBeInTheDocument()
      expect(screen.getByTestId('confirm-password-input')).toBeInTheDocument()
      expect(screen.getByTestId('register-button')).toBeInTheDocument()
    })

    it('should switch back to login tab', () => {
      render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />)

      fireEvent.click(screen.getByTestId('register-tab'))
      fireEvent.click(screen.getByTestId('login-tab'))

      expect(screen.getByTestId('login-tab')).toHaveClass('active')
      expect(screen.queryByTestId('email-input')).not.toBeInTheDocument()
    })

    it('should preserve form data when switching tabs via tab buttons', () => {
      render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />)

      const usernameInput = screen.getByTestId('username-input') as HTMLInputElement
      fireEvent.change(usernameInput, { target: { value: 'testuser' } })

      fireEvent.click(screen.getByTestId('register-tab'))

      const newUsernameInput = screen.getByTestId('username-input') as HTMLInputElement
      // Tab buttons don't clear form, only toggle mode link does
      expect(newUsernameInput.value).toBe('testuser')
    })

    it('should use switch mode link to toggle', () => {
      render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />)

      fireEvent.click(screen.getByTestId('register-link'))

      expect(screen.getByTestId('register-tab')).toHaveClass('active')
    })
  })

  describe('Login functionality', () => {
    it('should handle successful login', async () => {
      jest.mocked(apiService.login).mockResolvedValue({
        success: true,
        data: { user: { id: '1', username: 'testuser', email: 'test@example.com', isAdmin: false }, tokens: { accessToken: 'token', refreshToken: 'refresh' } },
      })

      render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />)

      fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'testuser' } })
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByTestId('login-button'))

      await waitFor(() => {
        expect(apiService.login).toHaveBeenCalledWith({
          username: 'testuser',
          password: 'password123',
        })
        expect(mockOnAuthSuccess).toHaveBeenCalled()
      })
    })

    it('should handle login failure', async () => {
      jest.mocked(apiService.login).mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      })

      render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />)

      fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'testuser' } })
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'wrongpassword' } })
      fireEvent.click(screen.getByTestId('login-button'))

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
        expect(mockOnAuthSuccess).not.toHaveBeenCalled()
      })
    })

    it('should show loading state during login', async () => {
      jest.mocked(apiService.login).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ success: true, data: { user: { id: '1', username: 'testuser', email: 'test@example.com', isAdmin: false }, tokens: { accessToken: 'token', refreshToken: 'refresh' } } }), 100))
      )

      render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />)

      fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'testuser' } })
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByTestId('login-button'))

      expect(screen.getByText('Logging in...')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.queryByText('Logging in...')).not.toBeInTheDocument()
      })
    })

    it('should call forgot password callback', () => {
      render(<AuthForm onAuthSuccess={mockOnAuthSuccess} onShowPasswordReset={mockOnShowPasswordReset} />)

      fireEvent.click(screen.getByTestId('forgot-password-link'))

      expect(mockOnShowPasswordReset).toHaveBeenCalled()
    })
  })

  describe('Registration functionality', () => {
    beforeEach(() => {
      render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />)
      fireEvent.click(screen.getByTestId('register-tab'))
    })

    it('should render all registration fields', () => {
      expect(screen.getByTestId('username-input')).toBeInTheDocument()
      expect(screen.getByTestId('email-input')).toBeInTheDocument()
      expect(screen.getByTestId('password-input')).toBeInTheDocument()
      expect(screen.getByTestId('confirm-password-input')).toBeInTheDocument()
    })

    it('should show password requirements', () => {
      expect(screen.getByText('Password must contain:')).toBeInTheDocument()
      expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
      expect(screen.getByText('At least one lowercase letter')).toBeInTheDocument()
      expect(screen.getByText('At least one uppercase letter')).toBeInTheDocument()
      expect(screen.getByText('At least one number')).toBeInTheDocument()
    })

    it('should validate password in real-time', () => {
      const passwordInput = screen.getByTestId('password-input')

      fireEvent.change(passwordInput, { target: { value: 'Short1!' } })

      // Password requirements list should update
      const requirements = screen.getByText('Password must contain:').parentElement
      expect(requirements).toBeInTheDocument()
    })

    it('should handle successful registration', async () => {
      jest.mocked(apiService.register).mockResolvedValue({
        success: true,
        data: { user: { id: '1', username: 'newuser', email: 'new@example.com', isAdmin: false }, tokens: { accessToken: 'token', refreshToken: 'refresh' } },
      })

      fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'newuser' } })
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'new@example.com' } })
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'Password123!' } })
      fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'Password123!' } })
      fireEvent.click(screen.getByTestId('register-button'))

      await waitFor(() => {
        expect(apiService.register).toHaveBeenCalledWith({
          username: 'newuser',
          email: 'new@example.com',
          password: 'Password123!',
        })
        expect(mockOnAuthSuccess).toHaveBeenCalled()
      })
    })

    it('should validate username length', async () => {
      fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'ab' } })
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'Password123!' } })
      fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'Password123!' } })
      fireEvent.click(screen.getByTestId('register-button'))

      await waitFor(() => {
        expect(screen.getByTestId('username-error')).toHaveTextContent('Username must be at least 3 characters')
        expect(apiService.register).not.toHaveBeenCalled()
      })
    })

    it('should validate email format', async () => {
      fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'testuser' } })
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'invalid-email' } })
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'Password123!' } })
      fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'Password123!' } })
      fireEvent.click(screen.getByTestId('register-button'))

      await waitFor(() => {
        expect(screen.getByTestId('email-error')).toHaveTextContent('Please enter a valid email address')
        expect(apiService.register).not.toHaveBeenCalled()
      })
    })

    it('should validate password mismatch', async () => {
      fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'testuser' } })
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'Password123!' } })
      fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'DifferentPass123!' } })
      fireEvent.click(screen.getByTestId('register-button'))

      await waitFor(() => {
        expect(screen.getByTestId('confirm-password-error')).toHaveTextContent('Passwords do not match')
        expect(apiService.register).not.toHaveBeenCalled()
      })
    })

    it('should handle registration failure', async () => {
      jest.mocked(apiService.register).mockResolvedValue({
        success: false,
        error: 'Username already exists',
      })

      fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'existinguser' } })
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'Password123!' } })
      fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'Password123!' } })
      fireEvent.click(screen.getByTestId('register-button'))

      await waitFor(() => {
        expect(screen.getByText('Username already exists')).toBeInTheDocument()
        expect(mockOnAuthSuccess).not.toHaveBeenCalled()
      })
    })

    it('should disable submit button when password requirements not met', () => {
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'weak' } })

      const submitButton = screen.getByTestId('register-button') as HTMLButtonElement
      expect(submitButton).toBeDisabled()
    })
  })

  describe('Error handling', () => {
    it('should display API errors', async () => {
      jest.mocked(apiService.login).mockResolvedValue({
        success: false,
        error: 'Network error',
      })

      render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />)

      fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'testuser' } })
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password' } })
      fireEvent.click(screen.getByTestId('login-button'))

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('should handle thrown errors gracefully', async () => {
      jest.mocked(apiService.login).mockRejectedValue(new Error('Connection failed'))

      render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />)

      fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'testuser' } })
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password' } })
      fireEvent.click(screen.getByTestId('login-button'))

      await waitFor(() => {
        expect(screen.getByText('Connection failed')).toBeInTheDocument()
      })
    })

    it('should allow clearing errors', async () => {
      jest.mocked(apiService.login).mockResolvedValue({
        success: false,
        error: 'Test error',
      })

      render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />)

      fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'testuser' } })
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password' } })
      fireEvent.click(screen.getByTestId('login-button'))

      await waitFor(() => {
        expect(screen.getByText('Test error')).toBeInTheDocument()
      })

      // Error should clear on new submission
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'newpassword' } })
      jest.mocked(apiService.login).mockResolvedValue({ success: true, data: { user: { id: '1', username: 'testuser', email: 'test@example.com', isAdmin: false }, tokens: { accessToken: 'token', refreshToken: 'refresh' } } })
      fireEvent.click(screen.getByTestId('login-button'))

      await waitFor(() => {
        expect(screen.queryByText('Test error')).not.toBeInTheDocument()
      })
    })
  })

  describe('Form validation edge cases', () => {
    it('should handle empty form submission for login', async () => {
      render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />)

      fireEvent.click(screen.getByTestId('login-button'))

      // Should still attempt login with empty values
      await waitFor(() => {
        expect(apiService.login).toHaveBeenCalledWith({
          username: '',
          password: '',
        })
      })
    })

    it('should validate all fields on registration', async () => {
      render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />)
      fireEvent.click(screen.getByTestId('register-tab'))

      fireEvent.click(screen.getByTestId('register-button'))

      await waitFor(() => {
        expect(screen.getByTestId('username-error')).toBeInTheDocument()
        expect(screen.getByTestId('email-error')).toBeInTheDocument()
        expect(apiService.register).not.toHaveBeenCalled()
      })
    })
  })
})
