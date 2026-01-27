import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore, type GameResult } from '../stores/gameStore'
import styles from '../styles/App.module.css'
import { useAuthStore } from '../stores/authStore'
import { useCharacterStore } from '../stores/characterStore'
import { avatarService } from '../services/avatarService'

// Component for animated score to experience conversion
const AnimatedScoreConversion: React.FC<{
  finalScore: number;
  experienceAwarded: number;
  levelUp: boolean;
  oldLevel: number;
  newLevel: number;
  character: string;
  onAnimationComplete?: () => void;
}> = ({ finalScore, experienceAwarded, levelUp, oldLevel, newLevel, character, onAnimationComplete }) => {
  const [currentScore, setCurrentScore] = useState(finalScore)
  const [currentExperience, setCurrentExperience] = useState(0)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [animationStarted, setAnimationStarted] = useState(false)

  const renderCharacterAvatar = (character: string, size: number) => {
    const svgPath = avatarService.getAvatarSvgPath(character)
    if (svgPath) {
      return <img src={svgPath} alt={character} width={size} height={size} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
    }
    return avatarService.getAvatarEmoji(character)
  }

  useEffect(() => {
    // Use finalScore as experience if experienceAwarded is 0 or undefined
    const expToGain = experienceAwarded > 0 ? experienceAwarded : finalScore

    // Start animation after 1 second
    const startTimeout = setTimeout(() => {
      setAnimationStarted(true)

      const duration = 2500 // 2.5 seconds
      const steps = 50
      const stepDuration = duration / steps
      const scoreDecrement = finalScore / steps
      const experienceIncrement = expToGain / steps

      let step = 0
      const interval = setInterval(() => {
        step++

        const newScore = Math.max(0, Math.round(finalScore - (scoreDecrement * step)))
        const newExperience = Math.round(experienceIncrement * step)

        setCurrentScore(newScore)
        setCurrentExperience(newExperience)

        if (step >= steps) {
          clearInterval(interval)
          setCurrentScore(0)
          setCurrentExperience(expToGain)

          // Show level up animation if applicable
          if (levelUp) {
            setTimeout(() => setShowLevelUp(true), 200)
          }

          onAnimationComplete?.()
        }
      }, stepDuration)

      return () => clearInterval(interval)
    }, 1000)

    return () => clearTimeout(startTimeout)
  }, [finalScore, experienceAwarded, levelUp, onAnimationComplete])

  // Use finalScore as experience if experienceAwarded is 0 or undefined
  const expToGain = experienceAwarded > 0 ? experienceAwarded : finalScore
  return (
    <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
      <div style={{
        fontSize: '3rem',
        marginBottom: 'var(--spacing-md)',
        transition: 'transform 0.3s ease',
        transform: showLevelUp ? 'scale(1.2)' : 'scale(1)'
      }}>
        {renderCharacterAvatar(character, 48)}
      </div>

      {showLevelUp && (
        <div style={{
          animation: 'levelUpPulse 1s ease-in-out',
          color: 'var(--color-success)',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          marginBottom: 'var(--spacing-md)'
        }}>
          🎉 LEVEL UP! 🎉
          <div style={{ fontSize: '1rem', marginTop: 'var(--spacing-xs)' }}>
            Level {oldLevel} → {newLevel}
          </div>
        </div>
      )}

      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        gap: 'var(--spacing-xl)',
        marginTop: 'var(--spacing-lg)'
      }}>
        <div>
          <div style={{
            fontSize: '1.2rem',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--spacing-xs)'
          }}>
            Score
          </div>
          <div style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: currentScore > 0 ? 'var(--primary-color)' : 'var(--text-secondary)'
          }}>
            {currentScore}
          </div>
        </div>

        <div style={{
          fontSize: '2rem',
          animation: animationStarted ? 'transferArrow 2.5s ease-in-out' : 'none'
        }}>
          →
        </div>

        <div>
          <div style={{
            fontSize: '1.2rem',
            color: 'var(--color-success)',
            marginBottom: 'var(--spacing-xs)'
          }}>
            Experience
          </div>
          <div style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: 'var(--color-success)',
            textShadow: currentExperience > 0 ? '0 0 10px rgba(76, 175, 80, 0.5)' : 'none'
          }}>
            +{currentExperience}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes levelUpPulse {
          0% { transform: scale(1); opacity: 0; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        
        @keyframes transferArrow {
          0% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); color: var(--color-success); }
          100% { opacity: 0.7; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

export const ResultsPage: React.FC = () => {
  const navigate = useNavigate()
  const { gameResults, totalQuestions } = useGameStore()
  const { user } = useAuthStore()
  const { progress } = useCharacterStore()

  // Use actual game results or fallback to mock data
  const finalPlayers: GameResult[] = gameResults.length > 0 ? gameResults : [
    {
      id: '4',
      username: 'Diana',
      character: 'professor',
      characterLevel: 5,
      finalScore: 2100,
      correctAnswers: 7,
      multiplier: 1,
      experienceAwarded: 2100,
      levelUp: true,
      newLevel: 6,
      oldLevel: 5
    },
    {
      id: '1',
      username: 'Alice',
      character: 'student',
      characterLevel: 3,
      finalScore: 1250,
      correctAnswers: 5,
      multiplier: 1,
      experienceAwarded: 1250,
      levelUp: false,
      newLevel: 3,
      oldLevel: 3
    },
    {
      id: '2',
      username: 'Bob',
      character: 'librarian',
      characterLevel: 2,
      finalScore: 890,
      correctAnswers: 3,
      multiplier: 1,
      experienceAwarded: 890,
      levelUp: false,
      newLevel: 2,
      oldLevel: 2
    },
    {
      id: '3',
      username: 'Charlie',
      character: 'researcher',
      characterLevel: 1,
      finalScore: 450,
      correctAnswers: 2,
      multiplier: 1,
      experienceAwarded: 450,
      levelUp: false,
      newLevel: 1,
      oldLevel: 1
    },
  ]

  const handlePlayAgain = () => {
    navigate('/')
  }

  const renderCharacterAvatar = (character: string, size: number) => {
    const svgPath = avatarService.getAvatarSvgPath(character)
    if (svgPath) {
      return <img src={svgPath} alt={character} width={size} height={size} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
    }
    return <>{avatarService.getAvatarEmoji(character)}</>
  }

  const winner = finalPlayers[0]

  return (
    <div className={styles.container}>
      <div className={`${styles.card} ${styles.textCenter}`} style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h1>🏆 Game Results</h1>
        <p>Final scores, rankings, and experience gained</p>
      </div>

      {/* Winner Announcement with Animation */}
      {winner && (
        <div className={`${styles.card} ${styles.textCenter}`} style={{ marginBottom: 'var(--spacing-xl)' }}>
          <h2>🎉 Winner: {winner.username}!</h2>
          <p style={{ marginBottom: 'var(--spacing-lg)' }}>
            Level {winner.newLevel} {winner.character} • {winner.correctAnswers}/{totalQuestions || 10} correct
          </p>

          <AnimatedScoreConversion
            finalScore={winner.finalScore}
            experienceAwarded={winner.experienceAwarded}
            levelUp={winner.levelUp}
            oldLevel={winner.oldLevel}
            newLevel={winner.newLevel}
            character={winner.character}
            onAnimationComplete={() => {
              // Optional: play celebratory sound when animation completes
            }}
          />
        </div>
      )}

      {/* Final Rankings with Experience */}
      <div className={styles.card} style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h3>Final Rankings & Experience</h3>
        <div style={{ gap: 'var(--spacing-md)', display: 'flex', flexDirection: 'column' }}>
          {finalPlayers.map((player, index) => (
            <div key={player.id} className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`} style={{
              padding: 'var(--spacing-md)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: player.levelUp ? 'rgba(76, 175, 80, 0.1)' : 'transparent'
            }}>
              <div className={`${styles.flex} ${styles.itemsCenter} ${styles.gapSm}`}>
                <span style={{
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: index === 0 ? 'var(--primary-color)' : 'var(--secondary-color)',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  minWidth: '2.5rem',
                  textAlign: 'center'
                }}>
                  #{index + 1}
                </span>
                <div className={styles.flex} style={{ alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <span style={{ fontSize: '1.5rem' }}>{renderCharacterAvatar(player.character, 24)}</span>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{player.username}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Level {player.newLevel} {player.character}
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.textRight}>
                <div style={{ fontWeight: 'bold', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {player.finalScore} pts
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-success)', fontWeight: 'bold' }}>
                  +{player.experienceAwarded || player.finalScore} XP
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {player.correctAnswers}/{totalQuestions || 10} correct
                </div>
                {player.levelUp && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 'bold' }}>
                    🎉 Level {player.oldLevel} → {player.newLevel}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Experience Summary & Progress */}
      <div className={styles.card} style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h3>Experience Summary</h3>
        <div className={styles.grid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--spacing-lg)' }}>
          {finalPlayers.map(player => (
            <div key={player.id} style={{
              padding: 'var(--spacing-lg)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.02)'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 'var(--spacing-sm)' }}>
                {renderCharacterAvatar(player.character, 40)}
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: 'var(--spacing-xs)' }}>
                {player.username}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                Level {player.newLevel} {player.character}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--spacing-md)',
                marginBottom: 'var(--spacing-lg)',
                padding: 'var(--spacing-md)',
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                borderRadius: 'var(--radius-md)'
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Score</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{player.finalScore}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Experience</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--color-success)' }}>+{player.experienceAwarded || player.finalScore} XP</div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Accuracy</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                    {Math.round((player.correctAnswers / (totalQuestions || 10)) * 100)}%
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Rank</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>#{finalPlayers.indexOf(player) + 1}</div>
                </div>
              </div>

              {/* Progress toward next level if it's the current player's character */}
              {player.id === user?.id && progress && (
                <div style={{ marginTop: 'var(--spacing-md)', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 'var(--spacing-xs)' }}>
                    <span>Next Level</span>
                    <span>{Math.round(progress.progress)}%</span>
                  </div>
                  <div style={{
                    height: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${progress.progress}%`,
                      height: '100%',
                      backgroundColor: 'var(--color-success)',
                      transition: 'width 1s ease-out'
                    }}></div>
                  </div>
                </div>
              )}

              {player.levelUp && (
                <div style={{
                  fontSize: '0.875rem',
                  color: 'var(--color-success)',
                  fontWeight: 'bold',
                  marginBottom: 'var(--spacing-sm)'
                }}>
                  🎉 LEVEL UP!
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className={`${styles.flex} ${styles.justifyCenter} ${styles.gapLg}`}>
        <button
          className={styles.button}
          onClick={handlePlayAgain}
        >
          Play Again
        </button>
        <button
          className={`${styles.button} ${styles.buttonSecondary}`}
          onClick={() => navigate('/')}
        >
          Back to Home
        </button>
      </div>
    </div>
  )
} 
