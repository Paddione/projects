import React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PasswordResetForm } from '../components/PasswordResetForm'

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  return (
    <PasswordResetForm
      onBackToLogin={() => navigate('/')}
      initialToken={token}
      initialStep="reset"
    />
  )
}

export default ResetPasswordPage
