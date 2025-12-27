import React from 'react'
import { useAudio } from '../hooks/useAudio'
import styles from '../styles/AudioSettings.module.css'

export const AudioSettings: React.FC = () => {
  const {
    musicVolume,
    soundVolume,
    masterVolume,
    isMuted,
    setMusicVolume,
    setSoundVolume,
    setMasterVolume,
    toggleMute,
    handleButtonClick,
    handleButtonHover,
    handleVolumeChange,
    handleNotification,
    handleSuccess,
    handleError,
    isAudioSupported
  } = useAudio()

  const handleVolumeSliderChange = (type: 'music' | 'sound' | 'master', value: number) => {
    switch (type) {
      case 'music':
        setMusicVolume(value)
        break
      case 'sound':
        setSoundVolume(value)
        break
      case 'master':
        setMasterVolume(value)
        break
    }
    handleVolumeChange()
  }

  const handleTestSound = () => {
    handleButtonClick()
  }

  const handleTestMusic = () => {
    // This would play background music for testing
    console.log('Testing background music...')
  }

  const handleTestStreak = () => {
    // Test streak sounds
    for (let i = 1; i <= 5; i++) {
      setTimeout(() => {
        // This would play streak sound i
        console.log(`Testing streak sound ${i}...`)
      }, i * 1000)
    }
  }

  const handleTestWrong = () => {
    // This would play wrong answer sound
    console.log('Testing wrong answer sound...')
  }

  const handleTestNotification = () => {
    handleNotification()
  }

  const handleTestSuccess = () => {
    handleSuccess()
  }

  const handleTestError = () => {
    handleError()
  }

  if (!isAudioSupported()) {
    return (
      <div className={styles.container}>
        <h3>Audio Settings</h3>
        <div className={styles.warning}>
          Audio is not supported in this browser
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container} data-testid="audio-settings">
      <h3>Audio Settings</h3>
      
      <div className={styles.section}>
        <h4>Master Controls</h4>
        <div className={styles.control}>
          <label>
            <input
              type="checkbox"
              checked={isMuted}
              onChange={toggleMute}
            />
            Mute All Audio
          </label>
        </div>
        
        <div className={styles.control}>
          <label>Master Volume: {Math.round(masterVolume * 100)}%</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={masterVolume}
            onChange={(e) => handleVolumeSliderChange('master', parseFloat(e.target.value))}
            className={styles.slider}
          />
        </div>
      </div>

      <div className={styles.section}>
        <h4>Volume Controls</h4>
        
        <div className={styles.control}>
          <label>Music Volume: {Math.round(musicVolume * 100)}%</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={musicVolume}
            onChange={(e) => handleVolumeSliderChange('music', parseFloat(e.target.value))}
            className={styles.slider}
          />
        </div>
        
        <div className={styles.control}>
          <label>Sound Effects Volume: {Math.round(soundVolume * 100)}%</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={soundVolume}
            onChange={(e) => handleVolumeSliderChange('sound', parseFloat(e.target.value))}
            className={styles.slider}
          />
        </div>
      </div>

      <div className={styles.section}>
        <h4>Audio Testing</h4>
        
        <div className={styles.testButtons}>
          <button
            onClick={handleTestSound}
            onMouseEnter={handleButtonHover}
            className={styles.testButton}
          >
            Test Button Click
          </button>
          
          <button
            onClick={handleTestMusic}
            onMouseEnter={handleButtonHover}
            className={styles.testButton}
          >
            Test Background Music
          </button>
          
          <button
            onClick={handleTestStreak}
            onMouseEnter={handleButtonHover}
            className={styles.testButton}
          >
            Test Streak Sounds
          </button>
          
          <button
            onClick={handleTestWrong}
            onMouseEnter={handleButtonHover}
            className={styles.testButton}
          >
            Test Wrong Answer
          </button>
          
          <button
            onClick={handleTestNotification}
            onMouseEnter={handleButtonHover}
            className={styles.testButton}
          >
            Test Notification
          </button>
          
          <button
            onClick={handleTestSuccess}
            onMouseEnter={handleButtonHover}
            className={styles.testButton}
          >
            Test Success
          </button>
          
          <button
            onClick={handleTestError}
            onMouseEnter={handleButtonHover}
            className={styles.testButton}
          >
            Test Error
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h4>Audio Status</h4>
        <div className={styles.status}>
          <p>Audio Supported: {isAudioSupported() ? 'Yes' : 'No'}</p>
          <p>Audio Muted: {isMuted ? 'Yes' : 'No'}</p>
          <p>Master Volume: {Math.round(masterVolume * 100)}%</p>
          <p>Music Volume: {Math.round(musicVolume * 100)}%</p>
          <p>Sound Volume: {Math.round(soundVolume * 100)}%</p>
        </div>
      </div>
    </div>
  )
} 