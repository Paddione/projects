import React from 'react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LanguageSelector } from '../LanguageSelector'

// Mock hooks
const mockSetLanguage = jest.fn()
const mockHandleLanguageChange = jest.fn()
const mockHandleButtonHover = jest.fn()

jest.mock('../../hooks/useLocalization', () => ({
  useLocalization: () => ({
    currentLanguage: 'en',
    setLanguage: mockSetLanguage,
    getSupportedLanguages: () => ['en', 'de'],
    getLanguageName: (lang: string) => (lang === 'en' ? 'English' : 'Deutsch'),
    getLanguageFlag: (lang: string) => (lang === 'en' ? '🇺🇸' : '🇩🇪'),
  }),
}))

jest.mock('../../hooks/useAudio', () => ({
  useAudio: () => ({
    handleLanguageChange: mockHandleLanguageChange,
    handleButtonHover: mockHandleButtonHover,
  }),
}))

describe('LanguageSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render language selector', () => {
    render(<LanguageSelector />)

    expect(screen.getByTestId('language-selector')).toBeInTheDocument()
    expect(screen.getByText('Language / Sprache')).toBeInTheDocument()
  })

  it('should render English and German buttons', () => {
    render(<LanguageSelector />)

    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Deutsch')).toBeInTheDocument()
  })

  it('should render language flags', () => {
    render(<LanguageSelector />)

    expect(screen.getByText('🇺🇸')).toBeInTheDocument()
    expect(screen.getByText('🇩🇪')).toBeInTheDocument()
  })

  it('should call setLanguage when language button is clicked', () => {
    render(<LanguageSelector />)

    fireEvent.click(screen.getByText('Deutsch'))

    expect(mockSetLanguage).toHaveBeenCalledWith('de')
    expect(mockHandleLanguageChange).toHaveBeenCalled()
  })

  it('should call handleButtonHover on mouse enter', () => {
    render(<LanguageSelector />)

    const englishButton = screen.getByText('English').closest('button')!
    fireEvent.mouseEnter(englishButton)

    expect(mockHandleButtonHover).toHaveBeenCalled()
  })

  it('should mark active language button', () => {
    render(<LanguageSelector />)

    const englishButton = screen.getByText('English').closest('button')!
    expect(englishButton).toHaveClass('active')
  })
})
