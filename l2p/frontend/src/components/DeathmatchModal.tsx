import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '../stores/authStore'
import type { GameResult } from '../stores/gameStore'

export interface DeathmatchOfferData {
  earnedXp: Record<string, number>
  timeoutSeconds: number
  solo?: boolean
}

interface DeathmatchModalProps {
  offer: DeathmatchOfferData
  players: GameResult[]
  lobbyCode: string
  acceptedPlayerIds: string[]
  onAccept: (npcCount?: number) => void
  onDecline: () => void
  onClose: () => void
}

export const DeathmatchModal: React.FC<DeathmatchModalProps> = ({
  offer,
  players,
  lobbyCode: _lobbyCode,
  acceptedPlayerIds,
  onAccept,
  onDecline,
  onClose
}) => {
  const { user } = useAuthStore()
  const [timeLeft, setTimeLeft] = useState(offer.timeoutSeconds)
  const [responded, setResponded] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const myId = String(user?.id ?? '')
  const myXp = offer.earnedXp[myId] ?? 0

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Auto-decline on timeout
  useEffect(() => {
    if (timeLeft === 0 && !responded) {
      handleDecline()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft])

  const handleAccept = useCallback((npcCount?: number) => {
    if (responded) return
    setResponded(true)
    if (timerRef.current) clearInterval(timerRef.current)
    onAccept(npcCount)
  }, [responded, onAccept])

  const handleDecline = useCallback(() => {
    if (responded) return
    setResponded(true)
    if (timerRef.current) clearInterval(timerRef.current)
    onDecline()
  }, [responded, onDecline])

  // Show redirecting state when match starts (parent sets this via onClose + navigation)
  useEffect(() => {
    if (redirecting) {
      const t = setTimeout(onClose, 3000)
      return () => clearTimeout(t)
    }
  }, [redirecting, onClose])

  const timerPercent = (timeLeft / offer.timeoutSeconds) * 100
  const timerColor = timeLeft > 20 ? 'var(--color-success)' : timeLeft > 10 ? '#f59e0b' : 'var(--color-error, #ef4444)'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)'
      }}
      data-testid="deathmatch-modal"
    >
      <div
        style={{
          backgroundColor: 'var(--card-background, #1a1a2e)',
          border: '2px solid var(--primary-color, #7c3aed)',
          borderRadius: '16px',
          padding: '2rem',
          maxWidth: '480px',
          width: '90%',
          boxShadow: '0 0 40px rgba(124, 58, 237, 0.4)',
          textAlign: 'center'
        }}
      >
        {redirecting ? (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚔️</div>
            <h2 style={{ color: 'var(--primary-color, #7c3aed)', marginBottom: '0.5rem' }}>
              Redirecting to Arena...
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Prepare for battle!
            </p>
          </>
        ) : (
          <>
            {/* Header */}
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>⚔️</div>
            <h2 style={{
              color: 'var(--primary-color, #7c3aed)',
              marginBottom: '0.25rem',
              fontSize: '1.6rem'
            }}>
              Deathmatch Challenge!
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Bet your earned XP and fight in Arena!
            </p>

            {/* XP at stake */}
            <div style={{
              backgroundColor: 'rgba(124, 58, 237, 0.15)',
              border: '1px solid rgba(124, 58, 237, 0.4)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                Your XP at stake
              </div>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 'bold',
                color: 'var(--color-success, #22c55e)',
                textShadow: '0 0 12px rgba(34, 197, 94, 0.5)'
              }}>
                {myXp.toLocaleString()} XP
              </div>
            </div>

            {/* Countdown timer */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.4rem'
              }}>
                <span>Time remaining</span>
                <span style={{ color: timerColor, fontWeight: 'bold' }}>{timeLeft}s</span>
              </div>
              <div style={{
                height: '6px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${timerPercent}%`,
                  height: '100%',
                  backgroundColor: timerColor,
                  transition: 'width 1s linear, background-color 0.5s ease',
                  borderRadius: '3px'
                }} />
              </div>
            </div>

            {/* Who has accepted */}
            {acceptedPlayerIds.length > 0 && (
              <div style={{
                marginBottom: '1.25rem',
                padding: '0.75rem',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '8px',
                textAlign: 'left'
              }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Accepted ({acceptedPlayerIds.length}):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {acceptedPlayerIds.map(pid => {
                    const player = players.find(p => String(p.id) === pid)
                    return (
                      <span key={pid} style={{
                        fontSize: '0.85rem',
                        color: 'var(--color-success, #22c55e)',
                        fontWeight: 'bold'
                      }}>
                        {player?.username ?? pid}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Action buttons */}
            {!responded ? (
              offer.solo ? (
                /* Solo mode: NPC count picker */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 4px', textAlign: 'center' }}>
                    Win to keep XP + earn Respect. Lose and forfeit your XP.
                  </p>
                  {[
                    { count: 1, respect: 25 },
                    { count: 2, respect: 50 },
                    { count: 3, respect: 100 },
                  ].map(({ count, respect }) => (
                    <button
                      key={count}
                      onClick={() => handleAccept(count)}
                      data-testid={`deathmatch-npc-${count}-btn`}
                      style={{
                        padding: '12px 16px',
                        background: '#1a3a1a',
                        border: '1px solid #3eff8b',
                        borderRadius: '8px',
                        color: '#3eff8b',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        textAlign: 'center',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1f4a1f')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#1a3a1a')}
                    >
                      vs {count} NPC{count > 1 ? 's' : ''} — {respect} ⭐ Respect
                    </button>
                  ))}
                  <button
                    onClick={handleDecline}
                    data-testid="deathmatch-decline-btn"
                    style={{
                      padding: '10px 16px',
                      background: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '8px',
                      color: '#888',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      marginTop: '4px',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#666')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#444')}
                  >
                    Decline — Keep XP
                  </button>
                </div>
              ) : (
                /* Multiplayer mode: standard Accept/Decline */
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button
                    onClick={() => handleAccept()}
                    data-testid="deathmatch-accept-btn"
                    style={{
                      padding: '0.75rem 2rem',
                      backgroundColor: 'var(--primary-color, #7c3aed)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'transform 0.1s, box-shadow 0.1s',
                      boxShadow: '0 0 12px rgba(124, 58, 237, 0.4)'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    ⚔️ Accept
                  </button>
                  <button
                    onClick={handleDecline}
                    data-testid="deathmatch-decline-btn"
                    style={{
                      padding: '0.75rem 2rem',
                      backgroundColor: 'transparent',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-color, #333)',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--text-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color, #333)')}
                  >
                    Decline
                  </button>
                </div>
              )
            ) : (
              <div style={{
                padding: '0.75rem',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                color: 'var(--text-secondary)',
                fontSize: '0.95rem'
              }}>
                {acceptedPlayerIds.includes(myId)
                  ? '✅ Waiting for other players...'
                  : '❌ You declined the challenge.'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default DeathmatchModal
