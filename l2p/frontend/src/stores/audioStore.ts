import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { audioManager } from '../services/audioManager'

export interface AudioState {
  // Volume settings
  musicVolume: number
  soundVolume: number
  masterVolume: number
  
  // Audio state
  isMuted: boolean
  isPlaying: boolean
  currentTrack: string | null
  
  // Actions
  setMusicVolume: (volume: number) => void
  setSoundVolume: (volume: number) => void
  setMasterVolume: (volume: number) => void
  setIsMuted: (muted: boolean) => void
  setIsPlaying: (playing: boolean) => void
  setCurrentTrack: (track: string | null) => void
  toggleMute: () => void
  playSound: (soundName: string) => void
  stopSound: () => void
  
  // Audio Manager integration
  playCorrectAnswer: (streak: number) => void
  playWrongAnswer: () => void
  playButtonClick: () => void
  playButtonHover: () => void
  playPlayerJoin: () => void
  playPlayerLeave: () => void
  playTimerWarning: () => void
  playTimerUrgent: () => void
  playGameStart: () => void
  playGameEnd: () => void
  playQuestionStart: () => void
  playLobbyCreated: () => void
  playLobbyJoined: () => void
  playApplause: () => void
  playHighScore: () => void
  playPerfectScore: () => void
  playMultiplierUp: () => void
  playMultiplierReset: () => void
  playScorePoints: () => void
  playScoreBonus: () => void
  playLobbyMusic: (loop?: boolean) => void
  playNotification: () => void
  playSuccess: () => void
  playError: () => void
  playTick: () => void
  playCountdown: () => void
  playMenuSelect: () => void
  playMenuConfirm: () => void
  playMenuCancel: () => void
  playVolumeChange: () => void
  playLanguageChange: () => void
  playThemeChange: () => void
  stopAllSounds: () => void
  resumeAudioContext: () => void
  isAudioSupported: () => boolean
}

const initialState = {
  musicVolume: 0.7,
  soundVolume: 0.8,
  masterVolume: 1.0,
  isMuted: false,
  isPlaying: false,
  currentTrack: null,
}

export const useAudioStore = create<AudioState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        
        setMusicVolume: (volume) => {
          const clamped = Math.max(0, Math.min(1, volume))
          audioManager.setMusicVolume(clamped)
          set({ musicVolume: clamped })
        },
        setSoundVolume: (volume) => {
          const clamped = Math.max(0, Math.min(1, volume))
          audioManager.setSoundVolume(clamped)
          set({ soundVolume: clamped })
        },
        setMasterVolume: (volume) => {
          const clamped = Math.max(0, Math.min(1, volume))
          audioManager.setMasterVolume(clamped)
          set({ masterVolume: clamped })
        },
        setIsMuted: (muted) => {
          audioManager.setMuted(muted)
          set({ isMuted: muted })
        },
        setIsPlaying: (playing) => set({ isPlaying: playing }),
        setCurrentTrack: (track) => set({ currentTrack: track }),
        toggleMute: () => {
          const next = !get().isMuted
          audioManager.setMuted(next)
          set({ isMuted: next })
        },
        playSound: (soundName) => {
          try {
            audioManager.playSound(soundName)
          } catch (error) {
            console.warn("Audio playback error:", error)
          }
        },
        stopSound: () => {
          audioManager.stopAllSounds()
        },
        
        // Audio Manager integration methods
        playCorrectAnswer: (streak) => audioManager.playCorrectAnswer(streak),
        playWrongAnswer: () => audioManager.playWrongAnswer(),
        playButtonClick: () => audioManager.playButtonClick(),
        playButtonHover: () => audioManager.playButtonHover(),
        playPlayerJoin: () => audioManager.playPlayerJoin(),
        playPlayerLeave: () => audioManager.playPlayerLeave(),
        playTimerWarning: () => audioManager.playTimerWarning(),
        playTimerUrgent: () => audioManager.playTimerUrgent(),
        playGameStart: () => audioManager.playGameStart(),
        playGameEnd: () => audioManager.playGameEnd(),
        playQuestionStart: () => audioManager.playQuestionStart(),
        playLobbyCreated: () => audioManager.playLobbyCreated(),
        playLobbyJoined: () => audioManager.playLobbyJoined(),
        playApplause: () => audioManager.playApplause(),
        playHighScore: () => audioManager.playHighScore(),
        playPerfectScore: () => audioManager.playPerfectScore(),
        playMultiplierUp: () => audioManager.playMultiplierUp(),
        playMultiplierReset: () => audioManager.playMultiplierReset(),
        playScorePoints: () => audioManager.playScorePoints(),
        playScoreBonus: () => audioManager.playScoreBonus(),
        playLobbyMusic: (loop) => audioManager.playLobbyMusic(loop),
        playNotification: () => audioManager.playNotification(),
        playSuccess: () => audioManager.playSuccess(),
        playError: () => audioManager.playError(),
        playTick: () => audioManager.playTick(),
        playCountdown: () => audioManager.playCountdown(),
        playMenuSelect: () => audioManager.playMenuSelect(),
        playMenuConfirm: () => audioManager.playMenuConfirm(),
        playMenuCancel: () => audioManager.playMenuCancel(),
        playVolumeChange: () => audioManager.playVolumeChange(),
        playLanguageChange: () => audioManager.playLanguageChange(),
        playThemeChange: () => audioManager.playThemeChange(),
        stopAllSounds: () => audioManager.stopAllSounds(),
        resumeAudioContext: () => audioManager.resumeAudioContext(),
        isAudioSupported: () => audioManager.isAudioSupported(),
      }),
      {
        name: 'audio-storage',
        partialize: (state) => ({
          musicVolume: state.musicVolume,
          soundVolume: state.soundVolume,
          masterVolume: state.masterVolume,
          isMuted: state.isMuted,
        }),
        onRehydrateStorage: () => (state) => {
          try {
            if (state) {
              audioManager.setMusicVolume(state.musicVolume ?? initialState.musicVolume)
              audioManager.setSoundVolume(state.soundVolume ?? initialState.soundVolume)
              audioManager.setMasterVolume(state.masterVolume ?? initialState.masterVolume)
              audioManager.setMuted(state.isMuted ?? initialState.isMuted)
            }
          } catch (e) {
            console.warn('Failed to rehydrate audio settings:', e)
          }
        }
      }
    ),
    {
      name: 'audio-store',
    }
  )
) 