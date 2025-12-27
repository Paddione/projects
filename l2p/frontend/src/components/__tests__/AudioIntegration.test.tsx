import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useAudio } from '../../hooks/useAudio'
import React, { useEffect } from 'react'

// Mock the audio store
const mockAudioStore = {
  // State
  musicVolume: 0.7,
  soundVolume: 0.8,
  masterVolume: 1.0,
  isMuted: false,
  isPlaying: false,
  currentTrack: null,
  
  // State setters
  setMusicVolume: jest.fn(),
  setSoundVolume: jest.fn(),
  setMasterVolume: jest.fn(),
  setIsMuted: jest.fn(),
  setIsPlaying: jest.fn(),
  setCurrentTrack: jest.fn(),
  toggleMute: jest.fn(),
  
  // Basic audio controls
  playSound: jest.fn(),
  stopSound: jest.fn(),
  stopAllSounds: jest.fn(),
  resumeAudioContext: jest.fn(),
  isAudioSupported: jest.fn(() => true),
  
  // Game audio methods
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
  playThemeChange: jest.fn()
}

jest.mock('../../stores/audioStore', () => ({
  useAudioStore: () => mockAudioStore,
}))

// Test component that uses audio
const TestAudioComponent: React.FC = () => {
  const audio = useAudio()
  
  return (
    <div>
      <button 
        onClick={audio.handleButtonClick}
        onMouseEnter={audio.handleButtonHover}
        data-testid="audio-button"
      >
        Click Me
      </button>
      <button 
        onClick={() => audio.handleCorrectAnswer(2)}
        data-testid="correct-answer-button"
      >
        Correct Answer
      </button>
      <button 
        onClick={audio.handleWrongAnswer}
        data-testid="wrong-answer-button"
      >
        Wrong Answer
      </button>
      <button 
        onClick={() => audio.setMusicVolume(0.5)}
        data-testid="volume-button"
      >
        Set Volume
      </button>
      <button 
        onClick={audio.toggleMute}
        data-testid="mute-button"
      >
        Toggle Mute
      </button>
      <div data-testid="volume-display">
        Music: {audio.musicVolume}, Sound: {audio.soundVolume}, Muted: {audio.isMuted.toString()}
      </div>
    </div>
  )
}

// Game simulation component
const GameSimulationComponent: React.FC = () => {
  const audio = useAudio()
  
  const simulateGame = () => {
    audio.handleGameStart()
    setTimeout(() => audio.handleCorrectAnswer(1), 100)
    setTimeout(() => audio.handleMultiplierUp(), 200)
    setTimeout(() => audio.handleScorePoints(), 300)
    setTimeout(() => audio.handleGameEnd(), 400)
  }
  
  return (
    <div>
      <button onClick={simulateGame} data-testid="simulate-game">
        Simulate Game
      </button>
    </div>
  )
}

describe('Audio Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Audio Interactions', () => {
    it('handles button interactions with audio feedback', async () => {
      render(<TestAudioComponent />)
      
      const button = screen.getByTestId('audio-button')
      
      // Test click sound
      fireEvent.click(button)
      expect(mockAudioStore.playButtonClick).toHaveBeenCalledTimes(1)
      
      // Test hover sound
      fireEvent.mouseEnter(button)
      expect(mockAudioStore.playButtonHover).toHaveBeenCalledTimes(1)
    })

    it('handles game answer audio correctly', () => {
      render(<TestAudioComponent />)
      
      // Test correct answer with streak
      fireEvent.click(screen.getByTestId('correct-answer-button'))
      expect(mockAudioStore.playCorrectAnswer).toHaveBeenCalledWith(2)
      
      // Test wrong answer
      fireEvent.click(screen.getByTestId('wrong-answer-button'))
      expect(mockAudioStore.playWrongAnswer).toHaveBeenCalledTimes(1)
    })

    it('handles volume controls', () => {
      render(<TestAudioComponent />)
      
      // Test volume setting
      fireEvent.click(screen.getByTestId('volume-button'))
      expect(mockAudioStore.setMusicVolume).toHaveBeenCalledWith(0.5)
      
      // Test mute toggle
      fireEvent.click(screen.getByTestId('mute-button'))
      expect(mockAudioStore.toggleMute).toHaveBeenCalledTimes(1)
    })

    it('displays current audio state', () => {
      render(<TestAudioComponent />)
      
      const display = screen.getByTestId('volume-display')
      expect(display).toHaveTextContent('Music: 0.7, Sound: 0.8, Muted: false')
    })
  })

  describe('Game Flow Audio Integration', () => {
    it('plays correct sequence during game simulation', async () => {
      render(<GameSimulationComponent />)
      
      fireEvent.click(screen.getByTestId('simulate-game'))
      
      // Wait for async operations
      await waitFor(() => {
        expect(mockAudioStore.playGameStart).toHaveBeenCalledTimes(1)
      }, { timeout: 500 })
      
      await waitFor(() => {
        expect(mockAudioStore.playCorrectAnswer).toHaveBeenCalledWith(1)
        expect(mockAudioStore.playMultiplierUp).toHaveBeenCalledTimes(1)
        expect(mockAudioStore.playScorePoints).toHaveBeenCalledTimes(1)
        expect(mockAudioStore.playGameEnd).toHaveBeenCalledTimes(1)
      }, { timeout: 500 })
    })
  })

  describe('Error Scenarios', () => {
    it('handles audio system failures gracefully', () => {
      // Mock audio support check
      mockAudioStore.isAudioSupported.mockReturnValue(false)
      
      render(<TestAudioComponent />)
      
      // Should still render without errors even if audio is not supported
      expect(screen.getByTestId('audio-button')).toBeInTheDocument()
      
      // Audio calls should still work (might be silent)
      fireEvent.click(screen.getByTestId('audio-button'))
      expect(mockAudioStore.playButtonClick).toHaveBeenCalledTimes(1)
    })

    it('handles invalid volume ranges', () => {
      const TestVolumeComponent: React.FC = () => {
        const audio = useAudio()
        
        return (
          <div>
            <button 
              onClick={() => audio.setMusicVolume(-1)}
              data-testid="invalid-low-volume"
            >
              Set Invalid Low Volume
            </button>
            <button 
              onClick={() => audio.setMusicVolume(2)}
              data-testid="invalid-high-volume"
            >
              Set Invalid High Volume
            </button>
          </div>
        )
      }
      
      render(<TestVolumeComponent />)
      
      // Test boundary conditions
      fireEvent.click(screen.getByTestId('invalid-low-volume'))
      expect(mockAudioStore.setMusicVolume).toHaveBeenCalledWith(-1)
      
      fireEvent.click(screen.getByTestId('invalid-high-volume'))
      expect(mockAudioStore.setMusicVolume).toHaveBeenCalledWith(2)
    })
  })

  describe('Edge Cases', () => {
    it('handles rapid button clicks without audio overlap issues', () => {
      render(<TestAudioComponent />)
      
      const button = screen.getByTestId('audio-button')
      
      // Rapid clicks
      for (let i = 0; i < 5; i++) {
        fireEvent.click(button)
      }
      
      expect(mockAudioStore.playButtonClick).toHaveBeenCalledTimes(5)
    })

    it('handles multiplier progression correctly', () => {
      const MultiplierTestComponent: React.FC = () => {
        const audio = useAudio()
        
        const testMultiplierProgression = () => {
          audio.handleCorrectAnswer(1) // First correct answer
          audio.handleMultiplierUp()
          audio.handleCorrectAnswer(2) // Second correct answer
          audio.handleMultiplierUp()
          audio.handleCorrectAnswer(3) // Third correct answer
          audio.handleWrongAnswer() // Reset multiplier
          audio.handleMultiplierReset()
        }
        
        return (
          <button onClick={testMultiplierProgression} data-testid="multiplier-test">
            Test Multiplier Progression
          </button>
        )
      }
      
      render(<MultiplierTestComponent />)
      
      fireEvent.click(screen.getByTestId('multiplier-test'))
      
      expect(mockAudioStore.playCorrectAnswer).toHaveBeenCalledTimes(3)
      expect(mockAudioStore.playCorrectAnswer).toHaveBeenCalledWith(1)
      expect(mockAudioStore.playCorrectAnswer).toHaveBeenCalledWith(2)
      expect(mockAudioStore.playCorrectAnswer).toHaveBeenCalledWith(3)
      expect(mockAudioStore.playMultiplierUp).toHaveBeenCalledTimes(2)
      expect(mockAudioStore.playWrongAnswer).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playMultiplierReset).toHaveBeenCalledTimes(1)
    })

    it('handles lobby events correctly', () => {
      const LobbyTestComponent: React.FC = () => {
        const audio = useAudio()
        
        const simulateLobbyFlow = () => {
          audio.handleLobbyCreated()
          audio.handlePlayerJoin()
          audio.handlePlayerJoin()
          audio.handlePlayerLeave()
          audio.handleLobbyJoined()
        }
        
        return (
          <button onClick={simulateLobbyFlow} data-testid="lobby-test">
            Test Lobby Flow
          </button>
        )
      }
      
      render(<LobbyTestComponent />)
      
      fireEvent.click(screen.getByTestId('lobby-test'))
      
      expect(mockAudioStore.playLobbyCreated).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playPlayerJoin).toHaveBeenCalledTimes(2)
      expect(mockAudioStore.playPlayerLeave).toHaveBeenCalledTimes(1)
      expect(mockAudioStore.playLobbyJoined).toHaveBeenCalledTimes(1)
    })
  })

  describe('Performance Tests', () => {
    it('maintains stable callback references', () => {
      let renderCount = 0
      const TestCallbackStabilityComponent: React.FC = () => {
        const audio = useAudio()
        renderCount++
        
        useEffect(() => {
          // This should not cause infinite re-renders
          audio.handleButtonClick()
        }, [audio.handleButtonClick])
        
        return <div data-testid="render-count">{renderCount}</div>
      }
      
      render(<TestCallbackStabilityComponent />)
      
      // Should render once and not cause infinite loops
      expect(screen.getByTestId('render-count')).toHaveTextContent('1')
      expect(mockAudioStore.playButtonClick).toHaveBeenCalledTimes(1)
    })
  })
}) 