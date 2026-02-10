import React, { useEffect, useRef } from 'react'
import { Player } from '../types'
import styles from '../styles/PlayerGrid.module.css'
import { CharacterDisplay } from './CharacterDisplay'
import { useCharacterStore } from '../stores/characterStore'
import { useGameStore } from '../stores/gameStore'

interface PlayerGridProps {
  players: Player[]
  maxPlayers?: number
  showScores?: boolean
  showMultipliers?: boolean
  compact?: boolean
  className?: string
  'data-testid'?: string
  rankings?: Record<string, number>
  columns?: number
}

export const PlayerGrid: React.FC<PlayerGridProps> = ({
  players,
  maxPlayers = 8,
  showScores = true,
  showMultipliers = true,
  compact = false,
  className = '',
  'data-testid': dataTestId,
  rankings,
  columns
}) => {
  const { characters } = useCharacterStore()
  const { playerAnswerStatus } = useGameStore()
  const prevScoresRef = useRef<Record<string, number>>({})
  const prevStreakRef = useRef<Record<string, number | undefined>>({})

  // Sort provided players by score descending for display order
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)

  // Determine top-3 medal mapping by overall rank (0-based)
  const getMedalForRank = (rankIndex: number | undefined | null) => {
    if (rankIndex === 0) return '🥇'
    if (rankIndex === 1) return '🥈'
    if (rankIndex === 2) return '🥉'
    return null
  }

  // Create empty slots for up to maxPlayers (after sorting)
  const slots = Array.from({ length: maxPlayers }, (_, index) => {
    const player = sortedPlayers[index]
    return player || null
  })

  const getCharacterById = (characterId: string) => {
    return characters.find(char => char.id === characterId) || {
      id: characterId,
      name: characterId,
      emoji: '👤',
      description: 'Unknown character',
      unlockLevel: 1
    }
  }

  const getAnswerBadge = (playerId: string) => {
    const status = playerAnswerStatus[playerId]
    if (status === 'correct') return <div className={styles.correctBadge}>✓</div>
    if (status === 'wrong') return <div className={styles.wrongBadge}>✗</div>
    return null
  }

  // After each render, record current scores for next-diff comparison
  useEffect(() => {
    const next: Record<string, number> = {}
    for (const p of players) next[p.id] = p.score
    prevScoresRef.current = next
  }, [players])

  useEffect(() => {
    const next: Record<string, number | undefined> = {}
    for (const p of players) next[p.id] = p.currentStreak
    prevStreakRef.current = next
  }, [players])

  return (
    <div className={`${styles.playerGrid} ${compact ? styles.playerGridCompact : ''} ${className}`} data-testid={dataTestId} style={columns ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : undefined}>
      {slots.map((player, index) => (
        <div
          key={player?.id || `empty-${index}`}
          className={`${styles.playerSlot} ${styles.slotEnter} ${player ? styles.occupied : styles.empty} ${player ? (playerAnswerStatus[player.id] === 'correct' ? styles.slotGlowCorrect : playerAnswerStatus[player.id] === 'wrong' ? styles.slotGlowWrong : '') : ''} ${player && rankings?.[player.id] === 0 ? styles.topRank : ''} ${player && rankings?.[player.id] !== undefined ? styles[`rank${rankings[player.id]}`] : ''}`}
          data-testid={player ? `player-${player.id}` : `empty-slot-${index}`}
          style={{ animationDelay: `${index * 80}ms` }}
        >
          {player ? (
            <>
              {/* Confetti celebration on streak milestones */}
              {(() => {
                const prevStreak = prevStreakRef.current[player.id] || 0
                const currentStreak = player.currentStreak || 0
                const milestones = [3, 5, 10]
                const celebrate = currentStreak > prevStreak && milestones.includes(currentStreak)
                if (!celebrate) return null
                return (
                  <div className={styles.confettiContainer} aria-hidden>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <span key={i} className={styles.confettiPiece} style={{ '--i': i } as React.CSSProperties} />
                    ))}
                  </div>
                )
              })()}

              <div className={styles.avatarContainer}>
                <CharacterDisplay
                  character={getCharacterById(player.character)}
                  level={player.characterLevel || 1}
                  size="medium"
                  showLevel={false}
                  showProgress={false}
                />
                {player.isHost && <div className={styles.hostBadge}>👑</div>}
                {!player.isConnected && <div className={styles.disconnectedBadge}>🔌</div>}
                {getAnswerBadge(player.id)}
                {getMedalForRank(rankings?.[player.id] ?? null) && (
                  <div className={`${styles.medalBadge} ${styles.medalPop}`}>{getMedalForRank(rankings?.[player.id] ?? null)}</div>
                )}
              </div>

              <div className={styles.playerInfo}>
                <div className={styles.username}>{player.username}</div>

                {showScores && (
                  <div className={styles.scoreContainer}>
                    {(() => {
                      const prevScore = prevScoresRef.current[player.id]
                      const bumped = prevScore != null && player.score > prevScore
                      return (
                        <span className={`${styles.score} ${bumped ? styles.scoreBump : ''}`}>{player.score}</span>
                      )
                    })()}
                    {showMultipliers && player.multiplier > 1 && (
                      <span className={`${styles.multiplier} ${styles[`multiplier-${player.multiplier}`]}`}>
                        ×{player.multiplier}
                      </span>
                    )}
                  </div>
                )}
                {!showScores && showMultipliers && player.multiplier > 1 && (
                  <div className={styles.scoreContainer}>
                    <span className={`${styles.multiplier} ${styles[`multiplier-${player.multiplier}`]}`}>
                      ×{player.multiplier}
                    </span>
                  </div>
                )}

                <div className={styles.statusIndicators}>
                  {player.isReady && <div className={styles.readyIndicator}>✓</div>}
                </div>
              </div>

              {/* Sheen overlay for top rank */}
              {rankings?.[player.id] === 0 && <div className={styles.sheen} aria-hidden />}
            </>
          ) : (
            <div className={styles.emptySlot}>
              <div className={styles.emptyAvatar}>?</div>
              <div className={styles.emptyText}>Empty</div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
} 
