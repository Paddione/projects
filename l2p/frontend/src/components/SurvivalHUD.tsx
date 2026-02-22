import React from 'react'
import styles from '../styles/SurvivalHUD.module.css'

interface SurvivalHUDProps {
  players: Array<{ id: string; username: string }>
  playerLives: Record<string, number>
  eliminatedPlayers: string[]
  currentPlayerId: string
  t: (key: string) => string
}

const MAX_LIVES = 3

export const SurvivalHUD: React.FC<SurvivalHUDProps> = ({
  players,
  playerLives,
  eliminatedPlayers,
  currentPlayerId,
  t,
}) => {
  return (
    <div className={styles.container} data-testid="survival-hud">
      {players.map((player) => {
        const isEliminated = eliminatedPlayers.includes(player.id)
        const isCurrent = player.id === currentPlayerId
        const lives = playerLives[player.id] ?? MAX_LIVES

        const entryClasses = [
          styles.playerEntry,
          isCurrent ? styles.currentPlayer : '',
          isEliminated ? styles.eliminated : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <div
            key={player.id}
            className={entryClasses}
            data-testid={`survival-player-${player.id}`}
          >
            <span className={styles.playerName}>{player.username}</span>
            {isEliminated ? (
              <span className={styles.skull} aria-label={t('game.survival.eliminated')}>
                &#9760;
              </span>
            ) : (
              <span className={styles.lives}>
                {Array.from({ length: MAX_LIVES }, (_, i) => (
                  <span
                    key={i}
                    className={`${styles.heart} ${
                      i < lives ? styles.heartFilled : styles.heartEmpty
                    }`}
                    aria-hidden="true"
                  >
                    &#9829;
                  </span>
                ))}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
