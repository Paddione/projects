import React from 'react'
import { useAudio } from '../hooks/useAudio'
import { useLocalization } from '../hooks/useLocalization'
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
  const { t } = useLocalization()

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
        <h3>{t('audio.settingsTitle')}</h3>
        <div className={styles.warning}>
          {t('audio.notSupportedMessage')}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container} data-testid="audio-settings">
      <h3>{t('audio.settingsTitle')}</h3>

      <div className={styles.section}>
        <h4>{t('audio.masterControls')}</h4>
        <div className={styles.control}>
          <label>
            <input
              type="checkbox"
              checked={isMuted}
              onChange={toggleMute}
            />
            {t('audio.muteAll')}
          </label>
        </div>
        
        <div className={styles.control}>
          <label>{t('audio.masterVolumeLabel')} {Math.round(masterVolume * 100)}%</label>
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
        <h4>{t('audio.volumeControls')}</h4>
        
        <div className={styles.control}>
          <label>{t('audio.musicVolumeLabel')} {Math.round(musicVolume * 100)}%</label>
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
          <label>{t('audio.soundVolumeLabel')} {Math.round(soundVolume * 100)}%</label>
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
        <h4>{t('audio.testing')}</h4>
        
        <div className={styles.testButtons}>
          <button
            onClick={handleTestSound}
            onMouseEnter={handleButtonHover}
            className={styles.testButton}
          >
            {t('audio.testButton')}
          </button>
          
          <button
            onClick={handleTestMusic}
            onMouseEnter={handleButtonHover}
            className={styles.testButton}
          >
            {t('audio.testMusic')}
          </button>
          
          <button
            onClick={handleTestStreak}
            onMouseEnter={handleButtonHover}
            className={styles.testButton}
          >
            {t('audio.testStreak')}
          </button>
          
          <button
            onClick={handleTestWrong}
            onMouseEnter={handleButtonHover}
            className={styles.testButton}
          >
            {t('audio.testWrong')}
          </button>
          
          <button
            onClick={handleTestNotification}
            onMouseEnter={handleButtonHover}
            className={styles.testButton}
          >
            {t('audio.testNotification')}
          </button>
          
          <button
            onClick={handleTestSuccess}
            onMouseEnter={handleButtonHover}
            className={styles.testButton}
          >
            {t('audio.testSuccess')}
          </button>
          
          <button
            onClick={handleTestError}
            onMouseEnter={handleButtonHover}
            className={styles.testButton}
          >
            {t('audio.testError')}
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h4>{t('audio.statusTitle')}</h4>
        <div className={styles.status}>
          <p>{t('audio.supportedLabel')} {isAudioSupported() ? t('audio.yes') : t('audio.no')}</p>
          <p>{t('audio.mutedLabel')} {isMuted ? t('audio.yes') : t('audio.no')}</p>
          <p>{t('audio.masterVolumeLabel')} {Math.round(masterVolume * 100)}%</p>
          <p>{t('audio.musicVolumeLabel')} {Math.round(musicVolume * 100)}%</p>
          <p>{t('audio.soundVolumeLabel')} {Math.round(soundVolume * 100)}%</p>
        </div>
      </div>
    </div>
  )
} 