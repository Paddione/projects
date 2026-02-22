import React from 'react'
import styles from '../styles/DuelView.module.css'

interface DuelViewProps {
  currentDuelPair: [string, string] | null
  players: Array<{ id: string; username: string; character: string }>
  duelQueue: string[]
  duelWins: Record<string, number>
  currentPlayerId: string
  t: (key: string) => string
}

export const DuelView: React.FC<DuelViewProps> = ({
  currentDuelPair,
  players,
  duelQueue,
  duelWins,
  currentPlayerId,
  t,
}) => {
  const getPlayer = (id: string) => players.find((p) => p.id === id)

  const isDueling =
    currentDuelPair !== null &&
    (currentDuelPair[0] === currentPlayerId || currentDuelPair[1] === currentPlayerId)

  const isSpectating = currentDuelPair !== null && !isDueling

  const renderPlayerCard = (playerId: string) => {
    const player = getPlayer(playerId)
    if (!player) return null

    const isCurrent = player.id === currentPlayerId
    const wins = duelWins[player.id] ?? 0

    return (
      <div
        className={`${styles.playerCard} ${isCurrent ? styles.currentPlayerCard : ''}`}
        data-testid={`duel-player-${player.id}`}
      >
        <div className={styles.characterAvatar}>
          {player.character ? player.character.charAt(0).toUpperCase() : '?'}
        </div>
        <div className={styles.playerUsername}>{player.username}</div>
        <div className={styles.winCount}>
          <span className={styles.winIcon}>&#9733;</span>
          {wins} {t('game.duel.wins')}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container} data-testid="duel-view">
      {currentDuelPair ? (
        <>
          <div className={styles.duelArena}>
            {renderPlayerCard(currentDuelPair[0])}
            <div className={styles.vsDivider}>
              <span className={styles.vsText}>VS</span>
            </div>
            {renderPlayerCard(currentDuelPair[1])}
          </div>

          {isSpectating && (
            <div className={styles.spectatingBadge} data-testid="duel-spectating">
              <span className={styles.spectatingIcon}>&#128065;</span>
              {t('game.duel.spectating')}
            </div>
          )}
        </>
      ) : (
        <div className={styles.waitingMessage}>{t('game.duel.waiting')}</div>
      )}

      {duelQueue.length > 0 && (
        <div className={styles.queueSection}>
          <span className={styles.queueLabel}>{t('game.duel.upNext')}</span>
          <div className={styles.queueList}>
            {duelQueue.map((id) => {
              const player = getPlayer(id)
              if (!player) return null
              return (
                <span
                  key={id}
                  className={`${styles.queuePlayer} ${
                    id === currentPlayerId ? styles.queueCurrent : ''
                  }`}
                >
                  {player.username}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
