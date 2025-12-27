import React from 'react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ThemeSelector } from '../ThemeSelector'

// Mock hooks
const mockSetTheme = jest.fn()
const mockHandleThemeChange = jest.fn()
const mockHandleButtonHover = jest.fn()

jest.mock('../../stores/themeStore', () => ({
  useThemeStore: () => ({
    theme: 'light',
    setTheme: mockSetTheme,
    isDark: false,
  }),
}))

jest.mock('../../hooks/useAudio', () => ({
  useAudio: () => ({
    handleThemeChange: mockHandleThemeChange,
    handleButtonHover: mockHandleButtonHover,
  }),
}))

describe('ThemeSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render theme selector', () => {
    render(<ThemeSelector />)

    expect(screen.getByTestId('theme-selector')).toBeInTheDocument()
    expect(screen.getByText('Theme / Design')).toBeInTheDocument()
  })

  it('should render all theme options', () => {
    render(<ThemeSelector />)

    expect(screen.getByText('Light')).toBeInTheDocument()
    expect(screen.getByText('Dark')).toBeInTheDocument()
    expect(screen.getByText('Auto')).toBeInTheDocument()
  })

  it('should render theme icons', () => {
    render(<ThemeSelector />)

    expect(screen.getByText('☀️')).toBeInTheDocument()
    expect(screen.getByText('🌙')).toBeInTheDocument()
    expect(screen.getByText('🔄')).toBeInTheDocument()
  })

  it('should show current theme mode', () => {
    render(<ThemeSelector />)

    expect(screen.getByText('Current: Light Mode')).toBeInTheDocument()
  })

  it('should call setTheme when theme button is clicked', () => {
    render(<ThemeSelector />)

    fireEvent.click(screen.getByText('Dark'))

    expect(mockSetTheme).toHaveBeenCalledWith('dark')
    expect(mockHandleThemeChange).toHaveBeenCalled()
  })

  it('should call handleButtonHover on mouse enter', () => {
    render(<ThemeSelector />)

    const lightButton = screen.getByText('Light').closest('button')!
    fireEvent.mouseEnter(lightButton)

    expect(mockHandleButtonHover).toHaveBeenCalled()
  })

  it('should mark active theme button', () => {
    render(<ThemeSelector />)

    const lightButton = screen.getByText('Light').closest('button')!
    expect(lightButton).toHaveClass('active')
  })

  it('should handle clicking auto theme', () => {
    render(<ThemeSelector />)

    fireEvent.click(screen.getByText('Auto'))

    expect(mockSetTheme).toHaveBeenCalledWith('auto')
  })
})
