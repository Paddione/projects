import { jest } from '@jest/globals'

const mockUseAudio = {
  handleButtonClick: jest.fn(),
  handleButtonHover: jest.fn(),
  handleMenuSelect: jest.fn(),
  handleMenuConfirm: jest.fn(),
  handleMenuCancel: jest.fn(),
  handleVolumeChange: jest.fn(),
  handleLanguageChange: jest.fn(),
  handleThemeChange: jest.fn(),
  handleModalOpen: jest.fn(),
  handleModalClose: jest.fn(),
  handleCorrectAnswer: jest.fn(),
  handleWrongAnswer: jest.fn(),
  handlePlayerJoin: jest.fn(),
  handlePlayerLeave: jest.fn(),
  handleTimerWarning: jest.fn(),
  handleTimerUrgent: jest.fn(),
  handleGameStart: jest.fn(),
  handleGameEnd: jest.fn(),
  handleQuestionStart: jest.fn(),
  handleLobbyCreated: jest.fn(),
  handleLobbyJoined: jest.fn(),
  handleApplause: jest.fn(),
  handleHighScore: jest.fn(),
  handlePerfectScore: jest.fn(),
  handleMultiplierUp: jest.fn(),
  handleMultiplierReset: jest.fn(),
  handleScorePoints: jest.fn(),
  handleScoreBonus: jest.fn(),
  handleLobbyMusic: jest.fn(),
  handleNotification: jest.fn(),
  handleSuccess: jest.fn(),
  handleError: jest.fn(),
  handleTick: jest.fn(),
  handleCountdown: jest.fn(),
  handleStopAllSounds: jest.fn(),
  
  // Properties
  musicVolume: 0.5,
  soundVolume: 0.5,
  masterVolume: 0.5,
  isMuted: false,
  isPlaying: false,
  currentTrack: null,
  
  // Methods
  setMusicVolume: jest.fn(),
  setSoundVolume: jest.fn(),
  setMasterVolume: jest.fn(),
  setIsMuted: jest.fn(),
  toggleMute: jest.fn(),
  isAudioSupported: jest.fn(() => true),
}

export const useAudio = jest.fn(() => mockUseAudio)
export { mockUseAudio }
