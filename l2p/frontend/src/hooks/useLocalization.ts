import { useState, useEffect, useCallback } from 'react'
import { localizationService, Language } from '../services/localization'

export const useLocalization = () => {
  const [currentLanguage, setCurrentLanguageState] = useState<Language>(
    localizationService.getCurrentLanguage()
  )

  useEffect(() => {
    // Update state when language changes
    const handleLanguageChange = () => {
      setCurrentLanguageState(localizationService.getCurrentLanguage())
    }

    // Listen for language changes
    window.addEventListener('languageChanged', handleLanguageChange)
    
    return () => {
      window.removeEventListener('languageChanged', handleLanguageChange)
    }
  }, [])

  const setLanguage = useCallback((language: Language) => {
    localizationService.setLanguage(language)
    setCurrentLanguageState(language)
    
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: language }))
  }, [])

  const t = useCallback((key: string, fallback?: string) => {
    return localizationService.t(key, fallback)
  }, [])

  const getSupportedLanguages = useCallback(() => {
    return localizationService.getSupportedLanguages()
  }, [])

  const getLanguageName = useCallback((language: Language) => {
    return localizationService.getLanguageName(language)
  }, [])

  const getLanguageFlag = useCallback((language: Language) => {
    return localizationService.getLanguageFlag(language)
  }, [])

  return {
    currentLanguage,
    setLanguage,
    t,
    getSupportedLanguages,
    getLanguageName,
    getLanguageFlag
  }
} 