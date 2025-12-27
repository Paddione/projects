import React from 'react'
import { LoadingSpinner } from './LoadingSpinner'
import { PlayerGrid } from './PlayerGrid'
import { Timer } from './Timer'
import { ScoreDisplay } from './ScoreDisplay'
import { GameInterface } from './GameInterface'
import { LobbyView } from './LobbyView'
import { ConnectionStatus } from './ConnectionStatus'
import styles from '../styles/DemoPage.module.css'

export const DemoPage: React.FC = () => {
  // Mock data for demo
  const mockPlayers = [
    {
      id: '1',
      username: 'Alice',
      character: 'wizard',
      characterLevel: 5,
      isReady: true,
      isHost: true,
      score: 1250,
      multiplier: 3,
      correctAnswers: 5,
      currentStreak: 3,
      isConnected: true,
    },
    {
      id: '2',
      username: 'Bob',
      character: 'knight',
      characterLevel: 3,
      isReady: true,
      isHost: false,
      score: 890,
      multiplier: 2,
      correctAnswers: 3,
      currentStreak: 2,
      isConnected: true,
    },
    {
      id: '3',
      username: 'Charlie',
      character: 'archer',
      characterLevel: 1,
      isReady: false,
      isHost: false,
      score: 0,
      multiplier: 1,
      correctAnswers: 0,
      currentStreak: 0,
      isConnected: true,
    },
    {
      id: '4',
      username: 'Diana',
      character: 'mage',
      characterLevel: 2,
      isReady: true,
      isHost: false,
      score: 650,
      multiplier: 2,
      correctAnswers: 4,
      currentStreak: 1,
      isConnected: true,
    }
  ]

  return (
    <div className={styles.demoContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Learn2Play Quiz Foundation</h1>
        <p className={styles.subtitle}>Core UI components with responsive design and dark/light theme support</p>
      </div>

      <div className={`${styles.grid} ${styles.gridCols1} ${styles.gapLg} grid gridCols1 gapLg`}>

        {/* PlayerGrid Demo */}
        <div className={`${styles.card} card`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>PlayerGrid Component</h2>
            <p className={styles.cardDescription}>4x2 responsive grid layout for up to 8 players with avatars, scores, and status indicators</p>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.demoSection}>
              <PlayerGrid players={mockPlayers} />
            </div>
          </div>
        </div>

        {/* Timer Demo */}
        <div className={`${styles.card} card`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Timer Component</h2>
            <p className={styles.cardDescription}>60-second countdown with visual feedback and progress bar</p>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.demoGrid}>
              <Timer timeRemaining={45} />
              <Timer timeRemaining={8} />
              <Timer timeRemaining={3} />
            </div>
          </div>
        </div>

        {/* ScoreDisplay Demo */}
        <div className={`${styles.card} card`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>ScoreDisplay Component</h2>
            <p className={styles.cardDescription}>Real-time score, multiplier, and streak display with progress tracking</p>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.demoGrid}>
              <ScoreDisplay score={1250} multiplier={3} correctAnswers={5} totalQuestions={10} />
              <ScoreDisplay score={2100} multiplier={5} correctAnswers={7} totalQuestions={10} />
              <ScoreDisplay score={450} multiplier={1} correctAnswers={2} totalQuestions={10} />
            </div>
          </div>
        </div>

        {/* Loading Demo */}
        <div className={`${styles.card} card`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Loading Components</h2>
            <p className={styles.cardDescription}>Loading spinners in different sizes with customizable text</p>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.demoGrid}>
              <LoadingSpinner size="small" text="Small" />
              <LoadingSpinner size="medium" text="Medium" />
              <LoadingSpinner size="large" text="Large" />
            </div>
          </div>
        </div>

        {/* GameInterface Demo */}
        <div className={`${styles.card} card`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>GameInterface Component</h2>
            <p className={styles.cardDescription}>Unified interface for creating and joining lobbies with character selection</p>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.demoSection}>
              <GameInterface />
            </div>
          </div>
        </div>

        {/* LobbyView Demo */}
        <div className={`${styles.card} card`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>LobbyView Component</h2>
            <p className={styles.cardDescription}>Lobby management with player status and ready state</p>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.demoSection}>
              <LobbyView />
            </div>
          </div>
        </div>

        {/* ConnectionStatus Demo */}
        <div className={`${styles.card} card`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>ConnectionStatus Component</h2>
            <p className={styles.cardDescription}>WebSocket connection status with real-time updates</p>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.demoSection}>
              <ConnectionStatus />
            </div>
          </div>
        </div>

        {/* Responsive Demo */}
        <div className={`${styles.card} card`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Responsive Design</h2>
            <p className={styles.cardDescription}>This layout adapts to different screen sizes</p>
          </div>
          <div className={styles.cardContent}>
            <ul>
              <li><strong>Mobile (320px+):</strong> Single column layout</li>
              <li><strong>Tablet (641px+):</strong> Two column layout</li>
              <li><strong>Desktop (1025px+):</strong> Four column layout</li>
            </ul>
            <p>Try resizing your browser window to see the responsive behavior!</p>
          </div>
        </div>

      </div>
    </div>
  )
} 