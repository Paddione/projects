import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './components/ThemeProvider'
import { Header } from './components/Header'
import { AuthGuard } from './components/AuthGuard'
import { EmailVerificationPage } from './components/EmailVerificationPage'
import { HomePage } from './pages/HomePage'
import { ProfilePage } from './pages/ProfilePage'
import { LobbyPage } from './pages/LobbyPage'
import { GamePage } from './pages/GamePage'
import { ResultsPage } from './pages/ResultsPage'
import { QuestionSetManagerPage } from './pages/QuestionSetManagerPage'
import AdminPanel from './pages/AdminPanel'
import { DemoPage } from './components/DemoPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import { PerformanceMonitor } from './components/PerformanceMonitor'
import { LevelUpNotificationManager } from './components/LevelUpNotificationManager'
import ErrorBoundary from './components/ErrorBoundary'
import { useSettingsStore } from './stores/settingsStore'
import { useEffect, useState } from 'react'
import styles from './styles/App.module.css'


// Separate AppContent component for easier testing
export function AppContent() {
  const [isHydrated, setIsHydrated] = useState(false)
  const theme = useSettingsStore((state) => state.theme)
  // Check if we're in test environment
  const isTestEnvironment = (() => {
    // Handle Jest test environment (process is only available in Node.js)
    if (typeof process !== 'undefined' && process.env['NODE_ENV'] === 'test') return true;
    
    // Handle Vite environment variables safely
    try {
      // Check if running in browser with Vite
      if (typeof window !== 'undefined' && window.location) {
        // Check for test mode via URL params or hostname
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('test') === 'true') return true;
        
        // Development environment check
        if (window.location.hostname === 'localhost' && 
            window.location.port === '3000') return true;
      }
    } catch {
      // Fallback for any environment issues
    }
    
    return false;
  })();

  // Handle store hydration
  useEffect(() => {
    // Set initial theme immediately for testing
    if (isTestEnvironment) {
      document.documentElement.setAttribute('data-theme', theme)
      // In test environment, mark as hydrated immediately
      setIsHydrated(true)
      return undefined // Explicit return for test environment
    } else {
      // Mark as hydrated after a short delay to ensure store is ready
      const timer = setTimeout(() => {
        setIsHydrated(true)
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [theme, isTestEnvironment])



  return (
    <ErrorBoundary>
      <div className={`${styles.app} app`} data-testid="app-ready">
        {isHydrated || isTestEnvironment ? (
          <ThemeProvider>
            {/* Always render global landmarks for accessibility */}
            <Header />
            <main id="main" className={`${styles.main} main`} role="main">
              <div className={`${styles.container} container`}>
                {/* Gate protected content via AuthGuard */}
                <AuthGuard>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/dashboard" element={<HomePage />} />
                    <Route path="/verify-email" element={<EmailVerificationPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/lobby/:lobbyId" element={<LobbyPage />} />
                    <Route path="/game/:lobbyId" element={<GamePage />} />
                    <Route path="/results/:lobbyId" element={<ResultsPage />} />
                    <Route path="/question-sets" element={<QuestionSetManagerPage />} />
                    <Route path="/admin" element={<AdminPanel />} />
                    <Route path="/demo" element={<DemoPage />} />
                  </Routes>
                </AuthGuard>
              </div>
            </main>
            <PerformanceMonitor />
            <LevelUpNotificationManager />
          </ThemeProvider>
        ) : (
          // Loading state - app-ready element is still present for tests
          <div className={styles.loading}>
            <div className={styles.loadingSpinner}></div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

function App() {
  return (
    <Router future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true
    }}>
      <AppContent />
    </Router>
  )
}

export default App
