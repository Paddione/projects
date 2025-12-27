import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { useAudioStore } from '../audioStore'
import { audioManager } from '../../services/audioManager'

// Mock audioManager
jest.mock('../../services/audioManager', () => ({
  audioManager: {
    setMusicVolume: jest.fn(),
    setSoundVolume: jest.fn(),
    setMasterVolume: jest.fn(),
    setMuted: jest.fn(),
    playSound: jest.fn(),
    stopAllSounds: jest.fn(),
    playCorrectAnswer: jest.fn(),
    playWrongAnswer: jest.fn(),
    playButtonClick: jest.fn(),
    playButtonHover: jest.fn(),
    playPlayerJoin: jest.fn(),
    playPlayerLeave: jest.fn(),
    playTimerWarning: jest.fn(),
    playTimerUrgent: jest.fn(),
    playGameStart: jest.fn(),
    playGameEnd: jest.fn(),
    playQuestionStart: jest.fn(),
    playLobbyCreated: jest.fn(),
    playLobbyJoined: jest.fn(),
    playApplause: jest.fn(),
    playHighScore: jest.fn(),
    playPerfectScore: jest.fn(),
    playMultiplierUp: jest.fn(),
    playMultiplierReset: jest.fn(),
    playScorePoints: jest.fn(),
    playScoreBonus: jest.fn(),
    playLobbyMusic: jest.fn(),
    playNotification: jest.fn(),
    playSuccess: jest.fn(),
    playError: jest.fn(),
    playTick: jest.fn(),
    playCountdown: jest.fn(),
    playMenuSelect: jest.fn(),
    playMenuConfirm: jest.fn(),
    playMenuCancel: jest.fn(),
    playVolumeChange: jest.fn(),
    playLanguageChange: jest.fn(),
    playThemeChange: jest.fn(),
    resumeAudioContext: jest.fn(),
    isAudioSupported: jest.fn().mockReturnValue(true),
  },
}))

describe('audioStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useAudioStore.getState()
    store.setMusicVolume(0.7)
    store.setSoundVolume(0.8)
    store.setMasterVolume(1.0)
    store.setIsMuted(false)
    store.setIsPlaying(false)
    store.setCurrentTrack(null)

    // Clear all mocks
    jest.clearAllMocks()
  })

  describe('Initial state', () => {
    it('should have correct initial values', () => {
      const state = useAudioStore.getState()

      expect(state.musicVolume).toBeCloseTo(0.7)
      expect(state.soundVolume).toBeCloseTo(0.8)
      expect(state.masterVolume).toBeCloseTo(1.0)
      expect(state.isMuted).toBe(false)
      expect(state.isPlaying).toBe(false)
      expect(state.currentTrack).toBeNull()
    })
  })

  describe('setMusicVolume', () => {
    it('should set music volume', () => {
      useAudioStore.getState().setMusicVolume(0.5)

      const state = useAudioStore.getState()
      expect(state.musicVolume).toBe(0.5)
      expect(audioManager.setMusicVolume).toHaveBeenCalledWith(0.5)
    })

    it('should clamp volume to 0-1 range (lower bound)', () => {
      useAudioStore.getState().setMusicVolume(-0.5)

      const state = useAudioStore.getState()
      expect(state.musicVolume).toBe(0)
      expect(audioManager.setMusicVolume).toHaveBeenCalledWith(0)
    })

    it('should clamp volume to 0-1 range (upper bound)', () => {
      useAudioStore.getState().setMusicVolume(1.5)

      const state = useAudioStore.getState()
      expect(state.musicVolume).toBe(1)
      expect(audioManager.setMusicVolume).toHaveBeenCalledWith(1)
    })
  })

  describe('setSoundVolume', () => {
    it('should set sound volume', () => {
      useAudioStore.getState().setSoundVolume(0.6)

      const state = useAudioStore.getState()
      expect(state.soundVolume).toBe(0.6)
      expect(audioManager.setSoundVolume).toHaveBeenCalledWith(0.6)
    })

    it('should clamp volume to 0-1 range (lower bound)', () => {
      useAudioStore.getState().setSoundVolume(-1)

      const state = useAudioStore.getState()
      expect(state.soundVolume).toBe(0)
      expect(audioManager.setSoundVolume).toHaveBeenCalledWith(0)
    })

    it('should clamp volume to 0-1 range (upper bound)', () => {
      useAudioStore.getState().setSoundVolume(2)

      const state = useAudioStore.getState()
      expect(state.soundVolume).toBe(1)
      expect(audioManager.setSoundVolume).toHaveBeenCalledWith(1)
    })
  })

  describe('setMasterVolume', () => {
    it('should set master volume', () => {
      useAudioStore.getState().setMasterVolume(0.9)

      const state = useAudioStore.getState()
      expect(state.masterVolume).toBe(0.9)
      expect(audioManager.setMasterVolume).toHaveBeenCalledWith(0.9)
    })

    it('should clamp volume to 0-1 range (lower bound)', () => {
      useAudioStore.getState().setMasterVolume(-0.1)

      const state = useAudioStore.getState()
      expect(state.masterVolume).toBe(0)
      expect(audioManager.setMasterVolume).toHaveBeenCalledWith(0)
    })

    it('should clamp volume to 0-1 range (upper bound)', () => {
      useAudioStore.getState().setMasterVolume(1.1)

      const state = useAudioStore.getState()
      expect(state.masterVolume).toBe(1)
      expect(audioManager.setMasterVolume).toHaveBeenCalledWith(1)
    })
  })

  describe('setIsMuted', () => {
    it('should set muted state to true', () => {
      useAudioStore.getState().setIsMuted(true)

      const state = useAudioStore.getState()
      expect(state.isMuted).toBe(true)
      expect(audioManager.setMuted).toHaveBeenCalledWith(true)
    })

    it('should set muted state to false', () => {
      useAudioStore.getState().setIsMuted(false)

      const state = useAudioStore.getState()
      expect(state.isMuted).toBe(false)
      expect(audioManager.setMuted).toHaveBeenCalledWith(false)
    })
  })

  describe('toggleMute', () => {
    it('should toggle mute from false to true', () => {
      useAudioStore.getState().setIsMuted(false)
      useAudioStore.getState().toggleMute()

      const state = useAudioStore.getState()
      expect(state.isMuted).toBe(true)
      expect(audioManager.setMuted).toHaveBeenCalledWith(true)
    })

    it('should toggle mute from true to false', () => {
      useAudioStore.getState().setIsMuted(true)
      useAudioStore.getState().toggleMute()

      const state = useAudioStore.getState()
      expect(state.isMuted).toBe(false)
      expect(audioManager.setMuted).toHaveBeenCalledWith(false)
    })
  })

  describe('setIsPlaying', () => {
    it('should set playing state', () => {
      useAudioStore.getState().setIsPlaying(true)

      const state = useAudioStore.getState()
      expect(state.isPlaying).toBe(true)
    })
  })

  describe('setCurrentTrack', () => {
    it('should set current track', () => {
      useAudioStore.getState().setCurrentTrack('lobby-music')

      const state = useAudioStore.getState()
      expect(state.currentTrack).toBe('lobby-music')
    })

    it('should clear current track', () => {
      useAudioStore.getState().setCurrentTrack('lobby-music')
      useAudioStore.getState().setCurrentTrack(null)

      const state = useAudioStore.getState()
      expect(state.currentTrack).toBeNull()
    })
  })

  describe('playSound', () => {
    it('should play sound via audioManager', () => {
      useAudioStore.getState().playSound('click')

      expect(audioManager.playSound).toHaveBeenCalledWith('click')
    })

    it('should handle errors gracefully', () => {
      jest.mocked(audioManager.playSound).mockImplementationOnce(() => {
        throw new Error('Audio error')
      })

      // Should not throw
      expect(() => useAudioStore.getState().playSound('error')).not.toThrow()
    })
  })

  describe('stopSound', () => {
    it('should stop all sounds', () => {
      useAudioStore.getState().stopSound()

      expect(audioManager.stopAllSounds).toHaveBeenCalled()
    })
  })

  describe('Audio Manager integration methods', () => {
    it('should call playCorrectAnswer with streak', () => {
      useAudioStore.getState().playCorrectAnswer(3)
      expect(audioManager.playCorrectAnswer).toHaveBeenCalledWith(3)
    })

    it('should call playWrongAnswer', () => {
      useAudioStore.getState().playWrongAnswer()
      expect(audioManager.playWrongAnswer).toHaveBeenCalled()
    })

    it('should call playButtonClick', () => {
      useAudioStore.getState().playButtonClick()
      expect(audioManager.playButtonClick).toHaveBeenCalled()
    })

    it('should call playButtonHover', () => {
      useAudioStore.getState().playButtonHover()
      expect(audioManager.playButtonHover).toHaveBeenCalled()
    })

    it('should call playPlayerJoin', () => {
      useAudioStore.getState().playPlayerJoin()
      expect(audioManager.playPlayerJoin).toHaveBeenCalled()
    })

    it('should call playPlayerLeave', () => {
      useAudioStore.getState().playPlayerLeave()
      expect(audioManager.playPlayerLeave).toHaveBeenCalled()
    })

    it('should call playTimerWarning', () => {
      useAudioStore.getState().playTimerWarning()
      expect(audioManager.playTimerWarning).toHaveBeenCalled()
    })

    it('should call playTimerUrgent', () => {
      useAudioStore.getState().playTimerUrgent()
      expect(audioManager.playTimerUrgent).toHaveBeenCalled()
    })

    it('should call playGameStart', () => {
      useAudioStore.getState().playGameStart()
      expect(audioManager.playGameStart).toHaveBeenCalled()
    })

    it('should call playGameEnd', () => {
      useAudioStore.getState().playGameEnd()
      expect(audioManager.playGameEnd).toHaveBeenCalled()
    })

    it('should call playQuestionStart', () => {
      useAudioStore.getState().playQuestionStart()
      expect(audioManager.playQuestionStart).toHaveBeenCalled()
    })

    it('should call playLobbyCreated', () => {
      useAudioStore.getState().playLobbyCreated()
      expect(audioManager.playLobbyCreated).toHaveBeenCalled()
    })

    it('should call playLobbyJoined', () => {
      useAudioStore.getState().playLobbyJoined()
      expect(audioManager.playLobbyJoined).toHaveBeenCalled()
    })

    it('should call playApplause', () => {
      useAudioStore.getState().playApplause()
      expect(audioManager.playApplause).toHaveBeenCalled()
    })

    it('should call playHighScore', () => {
      useAudioStore.getState().playHighScore()
      expect(audioManager.playHighScore).toHaveBeenCalled()
    })

    it('should call playPerfectScore', () => {
      useAudioStore.getState().playPerfectScore()
      expect(audioManager.playPerfectScore).toHaveBeenCalled()
    })

    it('should call playMultiplierUp', () => {
      useAudioStore.getState().playMultiplierUp()
      expect(audioManager.playMultiplierUp).toHaveBeenCalled()
    })

    it('should call playMultiplierReset', () => {
      useAudioStore.getState().playMultiplierReset()
      expect(audioManager.playMultiplierReset).toHaveBeenCalled()
    })

    it('should call playScorePoints', () => {
      useAudioStore.getState().playScorePoints()
      expect(audioManager.playScorePoints).toHaveBeenCalled()
    })

    it('should call playScoreBonus', () => {
      useAudioStore.getState().playScoreBonus()
      expect(audioManager.playScoreBonus).toHaveBeenCalled()
    })

    it('should call playLobbyMusic with loop parameter', () => {
      useAudioStore.getState().playLobbyMusic(true)
      expect(audioManager.playLobbyMusic).toHaveBeenCalledWith(true)
    })

    it('should call playNotification', () => {
      useAudioStore.getState().playNotification()
      expect(audioManager.playNotification).toHaveBeenCalled()
    })

    it('should call playSuccess', () => {
      useAudioStore.getState().playSuccess()
      expect(audioManager.playSuccess).toHaveBeenCalled()
    })

    it('should call playError', () => {
      useAudioStore.getState().playError()
      expect(audioManager.playError).toHaveBeenCalled()
    })

    it('should call playTick', () => {
      useAudioStore.getState().playTick()
      expect(audioManager.playTick).toHaveBeenCalled()
    })

    it('should call playCountdown', () => {
      useAudioStore.getState().playCountdown()
      expect(audioManager.playCountdown).toHaveBeenCalled()
    })

    it('should call playMenuSelect', () => {
      useAudioStore.getState().playMenuSelect()
      expect(audioManager.playMenuSelect).toHaveBeenCalled()
    })

    it('should call playMenuConfirm', () => {
      useAudioStore.getState().playMenuConfirm()
      expect(audioManager.playMenuConfirm).toHaveBeenCalled()
    })

    it('should call playMenuCancel', () => {
      useAudioStore.getState().playMenuCancel()
      expect(audioManager.playMenuCancel).toHaveBeenCalled()
    })

    it('should call playVolumeChange', () => {
      useAudioStore.getState().playVolumeChange()
      expect(audioManager.playVolumeChange).toHaveBeenCalled()
    })

    it('should call playLanguageChange', () => {
      useAudioStore.getState().playLanguageChange()
      expect(audioManager.playLanguageChange).toHaveBeenCalled()
    })

    it('should call playThemeChange', () => {
      useAudioStore.getState().playThemeChange()
      expect(audioManager.playThemeChange).toHaveBeenCalled()
    })

    it('should call stopAllSounds', () => {
      useAudioStore.getState().stopAllSounds()
      expect(audioManager.stopAllSounds).toHaveBeenCalled()
    })

    it('should call resumeAudioContext', () => {
      useAudioStore.getState().resumeAudioContext()
      expect(audioManager.resumeAudioContext).toHaveBeenCalled()
    })

    it('should call isAudioSupported', () => {
      jest.mocked(audioManager.isAudioSupported).mockReturnValue(true)

      const result = useAudioStore.getState().isAudioSupported()
      expect(result).toBe(true)
      expect(audioManager.isAudioSupported).toHaveBeenCalled()
    })
  })

  describe('Complex scenarios', () => {
    it('should handle complete audio setup', () => {
      useAudioStore.getState().setMusicVolume(0.5)
      useAudioStore.getState().setSoundVolume(0.7)
      useAudioStore.getState().setMasterVolume(0.9)
      useAudioStore.getState().setIsMuted(false)

      const state = useAudioStore.getState()
      expect(state.musicVolume).toBe(0.5)
      expect(state.soundVolume).toBe(0.7)
      expect(state.masterVolume).toBe(0.9)
      expect(state.isMuted).toBe(false)
    })

    it('should handle game audio sequence', () => {
      useAudioStore.getState().playGameStart()
      useAudioStore.getState().playQuestionStart()
      useAudioStore.getState().playCorrectAnswer(1)
      useAudioStore.getState().playCorrectAnswer(2)
      useAudioStore.getState().playMultiplierUp()
      useAudioStore.getState().playGameEnd()

      expect(audioManager.playGameStart).toHaveBeenCalled()
      expect(audioManager.playQuestionStart).toHaveBeenCalled()
      expect(audioManager.playCorrectAnswer).toHaveBeenCalledTimes(2)
      expect(audioManager.playMultiplierUp).toHaveBeenCalled()
      expect(audioManager.playGameEnd).toHaveBeenCalled()
    })
  })
})
