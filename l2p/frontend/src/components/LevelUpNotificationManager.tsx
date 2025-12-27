import React from 'react'
import { useGameStore } from '../stores/gameStore'
import { LevelUpNotification } from './LevelUpNotification'
import { PerkUnlockNotification } from './PerkUnlockNotification'

export const LevelUpNotificationManager: React.FC = () => {
  const { 
    levelUpNotifications, 
    perkUnlockNotifications,
    removeLevelUpNotification, 
    removePerkUnlockNotification 
  } = useGameStore()

  const handleCloseLevelUpNotification = (index: number) => {
    removeLevelUpNotification(index)
  }

  const handleClosePerkUnlockNotification = (index: number) => {
    removePerkUnlockNotification(index)
  }

  const totalNotifications = levelUpNotifications.length + perkUnlockNotifications.length

  if (totalNotifications === 0) {
    return null
  }

  return (
    <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>
      {/* Level up notifications */}
      {levelUpNotifications.map((notification, index) => (
        <div
          key={`levelup-${notification.playerId}-${notification.newLevel}-${index}`}
          style={{
            marginBottom: '10px',
            transform: `translateY(${index * 10}px)`
          }}
        >
          <LevelUpNotification
            notification={notification}
            onClose={() => handleCloseLevelUpNotification(index)}
          />
        </div>
      ))}
      
      {/* Perk unlock notifications */}
      {perkUnlockNotifications.map((notification, index) => (
        <div
          key={`perks-${notification.playerId}-${index}`}
          style={{
            marginBottom: '10px',
            transform: `translateY(${(levelUpNotifications.length + index) * 10}px)`
          }}
        >
          <PerkUnlockNotification
            notification={notification}
            onClose={() => handleClosePerkUnlockNotification(index)}
          />
        </div>
      ))}
    </div>
  )
} 