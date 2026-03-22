import { jest } from 'vitest'

const mockUseAudio = {
  handleButtonClick: vi.fn(),
  handleButtonHover: vi.fn(),
  handleMenuSelect: vi.fn(),
  handleMenuConfirm: vi.fn(),
  handleMenuCancel: vi.fn(),
  handleVolumeChange: vi.fn(),
  handleLanguageChange: vi.fn(),
  handleThemeChange: vi.fn(),
  handleModalOpen: vi.fn(),
  handleModalClose: vi.fn(),
  handleCorrectAnswer: vi.fn(),
  handleWrongAnswer: vi.fn(),
  handlePlayerJoin: vi.fn(),
  handlePlayerLeave: vi.fn(),
  handleTimerWarning: vi.fn(),
  handleTimerUrgent: vi.fn(),
  handleGameStart: vi.fn(),
  handleGameEnd: vi.fn(),
  handleQuestionStart: vi.fn(),
  handleLobbyCreated: vi.fn(),
  handleLobbyJoined: vi.fn(),
  handleApplause: vi.fn(),
  handleHighScore: vi.fn(),
  handlePerfectScore: vi.fn(),
  handleMultiplierUp: vi.fn(),
  handleMultiplierReset: vi.fn(),
  handleScorePoints: vi.fn(),
  handleScoreBonus: vi.fn(),
  handleLobbyMusic: vi.fn(),
  handleNotification: vi.fn(),
  handleSuccess: vi.fn(),
  handleError: vi.fn(),
  handleTick: vi.fn(),
  handleCountdown: vi.fn(),
  handleStopAllSounds: vi.fn(),
  
  // Properties
  musicVolume: 0.5,
  soundVolume: 0.5,
  masterVolume: 0.5,
  isMuted: false,
  isPlaying: false,
  currentTrack: null,
  
  // Methods
  setMusicVolume: vi.fn(),
  setSoundVolume: vi.fn(),
  setMasterVolume: vi.fn(),
  setIsMuted: vi.fn(),
  toggleMute: vi.fn(),
  isAudioSupported: vi.fn(() => true),
}

export const useAudio = vi.fn(() => mockUseAudio)
export { mockUseAudio }
