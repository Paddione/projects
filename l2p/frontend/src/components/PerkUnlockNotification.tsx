import React, { useState, useEffect } from 'react'
import { PerkUnlockNotification as PerkUnlockNotificationType } from '../stores/gameStore'
import { avatarService } from '../services/avatarService'
import { useLocalization } from '../hooks/useLocalization'

interface PerkUnlockNotificationProps {
  notification: PerkUnlockNotificationType
  onClose: () => void
}

export const PerkUnlockNotification: React.FC<PerkUnlockNotificationProps> = ({ 
  notification, 
  onClose 
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const { t } = useLocalization()

  useEffect(() => {
    // Show notification with animation
    setIsVisible(true)
    setShowConfetti(true)

    // Auto-hide after 6 seconds (longer than level up since there's more info)
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 500) // Wait for fade out animation
    }, 6000)

    return () => clearTimeout(timer)
  }, [onClose])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 500)
  }

  const getPerkIcon = (category: string) => {
    switch (category) {
      case 'avatar': return '👤'
      case 'badge': return '🏆' 
      case 'theme': return '🎨'
      case 'booster': return '⚡'
      case 'cosmetic': return '✨'
      default: return '🎁'
    }
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        backgroundColor: 'var(--color-accent, #9C27B0)',
        color: 'white',
        padding: 'var(--spacing-lg, 1rem)',
        borderRadius: 'var(--border-radius, 8px)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.5s ease-in-out',
        maxWidth: '350px',
        minWidth: '300px'
      }}
    >
      {/* Confetti effect */}
      {showConfetti && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          overflow: 'hidden'
        }}>
          {[...Array(25)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: '8px',
                height: '8px',
                background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #feca57, #a8e6cf)',
                left: `${Math.random() * 100}%`,
                animation: `confettiFall 3s linear infinite`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      )}

      {/* Close button */}
      <button
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'none',
          border: 'none',
          color: 'white',
          fontSize: '18px',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        ×
      </button>

      {/* Perk unlock content */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 'var(--spacing-md, 0.75rem)' }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: 'var(--spacing-sm, 0.5rem)' }}>🎁</span>
          <h3 style={{ margin: '0 0 var(--spacing-sm, 0.5rem) 0', fontSize: '1.2rem' }}>
            {t('notification.perksUnlocked')}
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm, 0.5rem)', marginBottom: 'var(--spacing-md, 0.75rem)' }}>
          <span style={{ fontSize: '1.5rem' }}>
            {(() => {
              const svgPath = avatarService.getAvatarSvgPath(notification.character)
              return svgPath
                ? <img src={svgPath} alt={notification.character} width={24} height={24} style={{ verticalAlign: 'middle' }} />
                : avatarService.getAvatarEmoji(notification.character)
            })()}
          </span>
          <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{notification.username}</span>
        </div>

        {/* List of unlocked perks */}
        <div style={{ textAlign: 'left', marginBottom: 'var(--spacing-md, 0.75rem)', maxHeight: '120px', overflowY: 'auto' }}>
          {notification.unlockedPerks.map((userPerk, index) => (
            <div
              key={userPerk.id || index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm, 0.5rem)',
                padding: 'var(--spacing-xs, 0.25rem) 0',
                borderBottom: index < notification.unlockedPerks.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>
                {getPerkIcon(userPerk.perk?.category || 'cosmetic')}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '2px' }}>
                  {userPerk.perk?.title || userPerk.perk?.name || t('notification.unknownPerk')}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t('notification.level', { level: userPerk.perk?.level_required || 0 })} • {userPerk.perk?.category || t('notification.cosmetic')}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)', fontStyle: 'italic' }}>
          {t('notification.visitPerks')}
        </div>
      </div>

      <style>{`
        @keyframes confettiFall {
          0% {
            transform: translateY(-100px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(120px) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}