import React, { useState, useEffect } from 'react'
import { LevelUpNotification as LevelUpNotificationType } from '../stores/gameStore'

interface LevelUpNotificationProps {
  notification: LevelUpNotificationType
  onClose: () => void
}

export const LevelUpNotification: React.FC<LevelUpNotificationProps> = ({ 
  notification, 
  onClose 
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    // Show notification with animation
    setIsVisible(true)
    setShowConfetti(true)

    // Auto-hide after 5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 500) // Wait for fade out animation
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 500)
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        backgroundColor: 'var(--color-success, #4CAF50)',
        color: 'white',
        padding: 'var(--spacing-lg, 1rem)',
        borderRadius: 'var(--border-radius, 8px)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.5s ease-in-out',
        maxWidth: '300px',
        minWidth: '250px'
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
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: '8px',
                height: '8px',
                background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #feca57)',
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

      {/* Level up content */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 'var(--spacing-md, 0.75rem)' }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: 'var(--spacing-sm, 0.5rem)' }}>🎉</span>
          <h3 style={{ margin: '0 0 var(--spacing-sm, 0.5rem) 0', fontSize: '1.2rem' }}>
            Level Up!
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm, 0.5rem)', marginBottom: 'var(--spacing-md, 0.75rem)' }}>
          <span style={{ fontSize: '1.5rem' }}>
            {notification.character === 'professor' && '👨‍🏫'}
            {notification.character === 'student' && '👨‍🎓'}
            {notification.character === 'librarian' && '👩‍💼'}
            {notification.character === 'researcher' && '👨‍🔬'}
            {notification.character === 'dean' && '👩‍⚖️'}
            {notification.character === 'graduate' && '🎓'}
            {notification.character === 'lab_assistant' && '👨‍🔬'}
            {notification.character === 'teaching_assistant' && '👩‍🏫'}
          </span>
          <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{notification.username}</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-md, 0.75rem)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-sm, 0.5rem)', marginBottom: 'var(--spacing-sm, 0.5rem)' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.9rem' }}>Level {notification.oldLevel}</span>
            <span style={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.9)' }}>→</span>
            <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Level {notification.newLevel}</span>
          </div>
          <div style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)' }}>
            +{notification.experienceAwarded} XP gained!
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 'var(--spacing-sm, 0.5rem)' }}>
          <div style={{
            width: '100%',
            height: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div 
              style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, #4ecdc4, #45b7d1)',
                borderRadius: '2px',
                transition: 'width 1s ease-in-out'
              }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes confettiFall {
          0% {
            transform: translateY(-100px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100px) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
} 