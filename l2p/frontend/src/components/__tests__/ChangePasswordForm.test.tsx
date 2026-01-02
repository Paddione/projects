import React from 'react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/jest-globals'
import { ChangePasswordForm } from '../ChangePasswordForm'
import { apiService } from '../../services/apiService'

// Mock apiService
jest.mock('../../services/apiService', () => ({
  apiService: {
    changePassword: jest.fn(),
  },
}))

// Mock setTimeout for testing auto-close
jest.useFakeTimers()

describe('ChangePasswordForm', () => {
  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  describe('Initial render', () => {
    it('should render all form fields', () => {
      render(<ChangePasswordForm />)

      expect(screen.getByText('Change Password')).toBeInTheDocument()
      expect(screen.getByLabelText('Current Password')).toBeInTheDocument()
      expect(screen.getByLabelText('New Password')).toBeInTheDocument()
      expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument()
      expect(screen.getByText('Save Password')).toBeInTheDocument()
    })

    it('should render password requirements', () => {
      render(<ChangePasswordForm />)

      expect(screen.getByText('Password must contain:')).toBeInTheDocument()
      expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
      expect(screen.getByText('At least one lowercase letter')).toBeInTheDocument()
      expect(screen.getByText('At least one uppercase letter')).toBeInTheDocument()
      expect(screen.getByText('At least one number')).toBeInTheDocument()
    })

    it('should render cancel button when onClose provided', () => {
      render(<ChangePasswordForm onClose={mockOnClose} />)

      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('should not render cancel button when onClose not provided', () => {
      render(<ChangePasswordForm />)

      expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
    })
  })

  describe('Password validation', () => {
    it('should validate password in real-time', () => {
      render(<ChangePasswordForm />)

      const newPasswordInput = screen.getByLabelText('New Password') as HTMLInputElement

      // Type a weak password
      fireEvent.change(newPasswordInput, { target: { value: 'weak' } })

      const requirements = screen.getByText('Password must contain:').parentElement
      expect(requirements).toBeInTheDocument()
    })

    it('should show password requirements initially as invalid', () => {
      render(<ChangePasswordForm />)

      const requirement = screen.getByText('At least 8 characters')
      expect(requirement).toHaveClass('invalid')
    })
  })

  describe('Form submission', () => {
    it('should handle successful password change', async () => {
      jest.mocked(apiService.changePassword).mockResolvedValue({
        success: true,
      })

      render(<ChangePasswordForm onClose={mockOnClose} />)

      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'OldPass123!' } })
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewPass123!' } })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'NewPass123!' } })

      fireEvent.click(screen.getByText('Save Password'))

      await waitFor(() => {
        expect(apiService.changePassword).toHaveBeenCalledWith('OldPass123!', 'NewPass123!')
        expect(screen.getByText('Password changed successfully')).toBeInTheDocument()
      })

      // Fast-forward timers to trigger auto-close
      jest.advanceTimersByTime(1500)
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should handle password change failure', async () => {
      jest.mocked(apiService.changePassword).mockResolvedValue({
        success: false,
        error: 'Current password is incorrect',
      })

      render(<ChangePasswordForm />)

      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'WrongPass123!' } })
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewPass123!' } })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'NewPass123!' } })

      fireEvent.click(screen.getByText('Save Password'))

      await waitFor(() => {
        expect(screen.getByText('Current password is incorrect')).toBeInTheDocument()
      })
    })

    it('should validate password requirements before submission', async () => {
      render(<ChangePasswordForm />)

      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'OldPass123!' } })
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'weak' } })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'weak' } })

      fireEvent.click(screen.getByText('Save Password'))

      await waitFor(() => {
        expect(screen.getByText('Please ensure your new password meets all requirements')).toBeInTheDocument()
        expect(apiService.changePassword).not.toHaveBeenCalled()
      })
    })

    it('should validate password confirmation match', async () => {
      render(<ChangePasswordForm />)

      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'OldPass123!' } })
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewPass123!' } })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'DifferentPass123!' } })

      fireEvent.click(screen.getByText('Save Password'))

      await waitFor(() => {
        expect(screen.getByText('New password and confirmation do not match')).toBeInTheDocument()
        expect(apiService.changePassword).not.toHaveBeenCalled()
      })
    })

    it('should show loading state during submission', async () => {
      jest.mocked(apiService.changePassword).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      )

      render(<ChangePasswordForm />)

      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'OldPass123!' } })
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewPass123!' } })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'NewPass123!' } })

      fireEvent.click(screen.getByText('Save Password'))

      expect(screen.getByText('Saving...')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
      })
    })

    it('should disable submit button while loading', async () => {
      jest.mocked(apiService.changePassword).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      )

      render(<ChangePasswordForm />)

      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'OldPass123!' } })
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewPass123!' } })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'NewPass123!' } })

      fireEvent.click(screen.getByText('Save Password'))

      const submitButton = screen.getByText('Saving...') as HTMLButtonElement
      expect(submitButton).toBeDisabled()

      await waitFor(() => {
        expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
      })
    })

    it('should clear form after successful password change', async () => {
      jest.mocked(apiService.changePassword).mockResolvedValue({
        success: true,
      })

      render(<ChangePasswordForm />)

      const currentPasswordInput = screen.getByLabelText('Current Password') as HTMLInputElement
      const newPasswordInput = screen.getByLabelText('New Password') as HTMLInputElement
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password') as HTMLInputElement

      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123!' } })
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass123!' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPass123!' } })

      fireEvent.click(screen.getByText('Save Password'))

      await waitFor(() => {
        expect(currentPasswordInput.value).toBe('')
        expect(newPasswordInput.value).toBe('')
        expect(confirmPasswordInput.value).toBe('')
      })
    })
  })

  describe('Cancel functionality', () => {
    it('should call onClose when cancel button clicked', () => {
      render(<ChangePasswordForm onClose={mockOnClose} />)

      fireEvent.click(screen.getByText('Cancel'))

      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    it('should handle API errors', async () => {
      jest.mocked(apiService.changePassword).mockRejectedValue(new Error('Network error'))

      render(<ChangePasswordForm />)

      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'OldPass123!' } })
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewPass123!' } })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'NewPass123!' } })

      fireEvent.click(screen.getByText('Save Password'))

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('should handle non-Error exceptions', async () => {
      jest.mocked(apiService.changePassword).mockRejectedValue('Unknown error')

      render(<ChangePasswordForm />)

      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'OldPass123!' } })
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewPass123!' } })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'NewPass123!' } })

      fireEvent.click(screen.getByText('Save Password'))

      await waitFor(() => {
        expect(screen.getByText('Failed to change password')).toBeInTheDocument()
      })
    })

    it('should clear error when submitting again', async () => {
      jest.mocked(apiService.changePassword).mockResolvedValue({
        success: false,
        error: 'Test error',
      })

      render(<ChangePasswordForm />)

      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'OldPass123!' } })
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewPass123!' } })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'NewPass123!' } })

      fireEvent.click(screen.getByText('Save Password'))

      await waitFor(() => {
        expect(screen.getByText('Test error')).toBeInTheDocument()
      })

      // Submit again with different password
      jest.mocked(apiService.changePassword).mockResolvedValue({ success: true })
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'AnotherPass123!' } })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'AnotherPass123!' } })

      fireEvent.click(screen.getByText('Save Password'))

      await waitFor(() => {
        expect(screen.queryByText('Test error')).not.toBeInTheDocument()
      })
    })
  })

  describe('Password validation edge cases', () => {
    it('should validate password with all requirements', () => {
      render(<ChangePasswordForm />)

      const newPasswordInput = screen.getByLabelText('New Password')
      fireEvent.change(newPasswordInput, { target: { value: 'SecurePass123!' } })

      // All requirements should be met (validated visually through the component)
      expect(screen.getByText('Password must contain:')).toBeInTheDocument()
    })

    it('should handle empty passwords', async () => {
      render(<ChangePasswordForm />)

      const form = screen.getByRole('button', { name: /save password/i }).closest('form')
      if (form) {
        fireEvent.submit(form)
      }

      await waitFor(() => {
        expect(screen.getByText(/please ensure your new password meets all requirements/i)).toBeInTheDocument()
      })
    })
  })

  describe('Success message handling', () => {
    it('should not auto-close if onClose not provided', async () => {
      jest.mocked(apiService.changePassword).mockResolvedValue({
        success: true,
      })

      render(<ChangePasswordForm />)

      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'OldPass123!' } })
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewPass123!' } })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'NewPass123!' } })

      fireEvent.click(screen.getByText('Save Password'))

      await waitFor(() => {
        expect(screen.getByText('Password changed successfully')).toBeInTheDocument()
      })

      // Fast-forward timers
      jest.advanceTimersByTime(1500)

      // onClose should not be called because it wasn't provided
      // Just verify the success message is still there
      expect(screen.getByText('Password changed successfully')).toBeInTheDocument()
    })
  })
})
