import { renderHook, act } from '@testing-library/react'
import { useCharacterStore } from '../characterStore'
import { Character, CharacterProfile } from '../../types'
import { apiService } from '../../services/apiService'

// Mock the API service
jest.mock('../../services/apiService', () => ({
  apiService: {
    getAllCharacters: jest.fn(),
    getCharacterProfile: jest.fn(),
    updateCharacter: jest.fn(),
    awardExperience: jest.fn(),
  }
}))

const mockApiService = apiService as jest.Mocked<typeof apiService>

// Mock data
const mockCharacters: Character[] = [
  {
    id: 'char1',
    name: 'Warrior',
    emoji: '⚔️',
    description: 'A brave warrior',
    unlockLevel: 1
  },
  {
    id: 'char2',
    name: 'Mage',
    emoji: '🔮',
    description: 'A powerful mage',
    unlockLevel: 5
  },
  {
    id: 'char3',
    name: 'Archer',
    emoji: '🏹',
    description: 'A skilled archer',
    unlockLevel: 10
  }
]

const mockCharacterProfile: CharacterProfile = {
  character: mockCharacters[0],
  level: 3,
  experience: 150,
  progress: {
    currentLevel: 3,
    progress: 50,
    expInLevel: 50,
    expForNextLevel: 100
  },
  availableCharacters: [mockCharacters[0], mockCharacters[1]]
}

describe('characterStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset store to initial state
    useCharacterStore.setState({
      characters: [],
      currentCharacter: null,
      availableCharacters: [],
      level: 1,
      experience: 0,
      progress: null,
      isLoading: false,
      isUpdating: false
    })
  })

  describe('initial state', () => {
    it('has correct initial values', () => {
      const { result } = renderHook(() => useCharacterStore())
      
      expect(result.current.characters).toEqual([])
      expect(result.current.currentCharacter).toBeNull()
      expect(result.current.availableCharacters).toEqual([])
      expect(result.current.level).toBe(1)
      expect(result.current.experience).toBe(0)
      expect(result.current.progress).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isUpdating).toBe(false)
    })
  })

  describe('loadCharacters', () => {
    it('loads all characters successfully', async () => {
      mockApiService.getAllCharacters.mockResolvedValue({
        success: true,
        data: mockCharacters
      })

      const { result } = renderHook(() => useCharacterStore())
      
      await act(async () => {
        await result.current.loadCharacters()
      })
      
      expect(mockApiService.getAllCharacters).toHaveBeenCalledTimes(1)
      expect(result.current.characters).toEqual(mockCharacters)
      expect(result.current.isLoading).toBe(false)
    })

    it('handles API error when loading characters', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockApiService.getAllCharacters.mockResolvedValue({
        success: false,
        error: 'Failed to load characters'
      })

      const { result } = renderHook(() => useCharacterStore())
      
      await act(async () => {
        await result.current.loadCharacters()
      })
      
      expect(mockApiService.getAllCharacters).toHaveBeenCalledTimes(1)
      expect(result.current.characters).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load characters:', 'Failed to load characters')
      
      consoleSpy.mockRestore()
    })

    it('handles network error when loading characters', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockApiService.getAllCharacters.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useCharacterStore())
      
      await act(async () => {
        await result.current.loadCharacters()
      })
      
      expect(mockApiService.getAllCharacters).toHaveBeenCalledTimes(1)
      expect(result.current.characters).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Error loading characters:', new Error('Network error'))
      
      consoleSpy.mockRestore()
    })

    it('sets loading state during character loading', async () => {
      mockApiService.getAllCharacters.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: mockCharacters
        }), 100))
      )

      const { result } = renderHook(() => useCharacterStore())
      
      act(() => {
        result.current.loadCharacters()
      })
      
      expect(result.current.isLoading).toBe(true)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150))
      })
      
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('loadCharacterProfile', () => {
    it('loads character profile successfully', async () => {
      mockApiService.getCharacterProfile.mockResolvedValue({
        success: true,
        data: mockCharacterProfile
      })

      const { result } = renderHook(() => useCharacterStore())
      
      await act(async () => {
        await result.current.loadCharacterProfile()
      })
      
      expect(mockApiService.getCharacterProfile).toHaveBeenCalledTimes(1)
      expect(result.current.currentCharacter).toEqual(mockCharacterProfile.character)
      expect(result.current.availableCharacters).toEqual(mockCharacterProfile.availableCharacters)
      expect(result.current.level).toBe(mockCharacterProfile.level)
      expect(result.current.experience).toBe(mockCharacterProfile.experience)
      expect(result.current.progress).toEqual(mockCharacterProfile.progress)
      expect(result.current.isLoading).toBe(false)
    })

    it('handles API error when loading character profile', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockApiService.getCharacterProfile.mockResolvedValue({
        success: false,
        error: 'Failed to load profile'
      })

      const { result } = renderHook(() => useCharacterStore())
      
      await act(async () => {
        await result.current.loadCharacterProfile()
      })
      
      expect(mockApiService.getCharacterProfile).toHaveBeenCalledTimes(1)
      expect(result.current.currentCharacter).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load character profile:', 'Failed to load profile')
      
      consoleSpy.mockRestore()
    })

    it('handles network error when loading character profile', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockApiService.getCharacterProfile.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useCharacterStore())
      
      await act(async () => {
        await result.current.loadCharacterProfile()
      })
      
      expect(mockApiService.getCharacterProfile).toHaveBeenCalledTimes(1)
      expect(result.current.currentCharacter).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Error loading character profile:', new Error('Network error'))
      
      consoleSpy.mockRestore()
    })
  })

  describe('updateCharacter', () => {
    it('updates character successfully', async () => {
      const updatedProfile: CharacterProfile = {
        ...mockCharacterProfile,
        character: mockCharacters[1]
      }

      mockApiService.updateCharacter.mockResolvedValue({
        success: true,
        data: {
          user: { experience_points: 150 },
          characterInfo: updatedProfile
        }
      })

      const { result } = renderHook(() => useCharacterStore())
      
      await act(async () => {
        const success = await result.current.updateCharacter('char2')
        expect(success).toBe(true)
      })
      
      expect(mockApiService.updateCharacter).toHaveBeenCalledWith('char2')
      expect(result.current.currentCharacter).toEqual(updatedProfile.character)
      expect(result.current.availableCharacters).toEqual(updatedProfile.availableCharacters)
      expect(result.current.level).toBe(updatedProfile.level)
      expect(result.current.experience).toBe(updatedProfile.experience)
      expect(result.current.progress).toEqual(updatedProfile.progress)
      expect(result.current.isUpdating).toBe(false)
    })

    it('handles API error when updating character', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockApiService.updateCharacter.mockResolvedValue({
        success: false,
        error: 'Failed to update character'
      })

      const { result } = renderHook(() => useCharacterStore())
      
      await act(async () => {
        const success = await result.current.updateCharacter('char2')
        expect(success).toBe(false)
      })
      
      expect(mockApiService.updateCharacter).toHaveBeenCalledWith('char2')
      expect(result.current.currentCharacter).toBeNull()
      expect(result.current.isUpdating).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Failed to update character:', 'Failed to update character')
      
      consoleSpy.mockRestore()
    })

    it('handles network error when updating character', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockApiService.updateCharacter.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useCharacterStore())
      
      await act(async () => {
        const success = await result.current.updateCharacter('char2')
        expect(success).toBe(false)
      })
      
      expect(mockApiService.updateCharacter).toHaveBeenCalledWith('char2')
      expect(result.current.currentCharacter).toBeNull()
      expect(result.current.isUpdating).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Error updating character:', new Error('Network error'))
      
      consoleSpy.mockRestore()
    })

    it('sets updating state during character update', async () => {
      mockApiService.updateCharacter.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: {
            user: { experience_points: 150 },
            characterInfo: mockCharacterProfile
          }
        }), 100))
      )

      const { result } = renderHook(() => useCharacterStore())
      
      act(() => {
        result.current.updateCharacter('char2')
      })
      
      expect(result.current.isUpdating).toBe(true)
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150))
      })
      
      expect(result.current.isUpdating).toBe(false)
    })
  })

  describe('awardExperience', () => {
    it('awards experience successfully without level up', async () => {
      const experienceAward = 50
      const newExperience = 200
      const newProgress = {
        currentLevel: 3,
        progress: 100,
        expInLevel: 100,
        expForNextLevel: 100
      }

      mockApiService.awardExperience.mockResolvedValue({
        success: true,
        data: {
          user: { experience_points: newExperience },
          levelUp: false,
          newLevel: 3,
          oldLevel: 3,
          progress: newProgress,
          experienceAwarded: experienceAward
        }
      })

      const { result } = renderHook(() => useCharacterStore())
      
      await act(async () => {
        const awardResult = await result.current.awardExperience(experienceAward)
        expect(awardResult).toEqual({
          levelUp: false,
          newLevel: 3,
          oldLevel: 3
        })
      })
      
      expect(mockApiService.awardExperience).toHaveBeenCalledWith(experienceAward)
      expect(result.current.level).toBe(3)
      expect(result.current.experience).toBe(newExperience)
      expect(result.current.progress).toEqual(newProgress)
    })

    it('awards experience successfully with level up', async () => {
      const experienceAward = 100
      const newExperience = 250
      const newProgress = {
        currentLevel: 4,
        progress: 50,
        expInLevel: 50,
        expForNextLevel: 100
      }

      mockApiService.awardExperience.mockResolvedValue({
        success: true,
        data: {
          user: { experience_points: newExperience },
          levelUp: true,
          newLevel: 4,
          oldLevel: 3,
          progress: newProgress,
          experienceAwarded: experienceAward
        }
      })

      // Mock the profile update after level up
      mockApiService.getCharacterProfile.mockResolvedValue({
        success: true,
        data: {
          ...mockCharacterProfile,
          availableCharacters: [mockCharacters[0], mockCharacters[1], mockCharacters[2]]
        }
      })

      const { result } = renderHook(() => useCharacterStore())
      
      await act(async () => {
        const awardResult = await result.current.awardExperience(experienceAward)
        expect(awardResult).toEqual({
          levelUp: true,
          newLevel: 4,
          oldLevel: 3
        })
      })
      
      expect(mockApiService.awardExperience).toHaveBeenCalledWith(experienceAward)
      expect(mockApiService.getCharacterProfile).toHaveBeenCalledTimes(1)
      expect(result.current.level).toBe(4)
      expect(result.current.experience).toBe(newExperience)
      expect(result.current.progress).toEqual(newProgress)
      expect(result.current.availableCharacters).toEqual([mockCharacters[0], mockCharacters[1], mockCharacters[2]])
    })

    it('handles API error when awarding experience', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockApiService.awardExperience.mockResolvedValue({
        success: false,
        error: 'Failed to award experience'
      })

      const { result } = renderHook(() => useCharacterStore())
      
      await act(async () => {
        const awardResult = await result.current.awardExperience(50)
        expect(awardResult).toBeNull()
      })
      
      expect(mockApiService.awardExperience).toHaveBeenCalledWith(50)
      expect(consoleSpy).toHaveBeenCalledWith('Failed to award experience:', 'Failed to award experience')
      
      consoleSpy.mockRestore()
    })

    it('handles network error when awarding experience', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockApiService.awardExperience.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useCharacterStore())
      
      await act(async () => {
        const awardResult = await result.current.awardExperience(50)
        expect(awardResult).toBeNull()
      })
      
      expect(mockApiService.awardExperience).toHaveBeenCalledWith(50)
      expect(consoleSpy).toHaveBeenCalledWith('Error awarding experience:', new Error('Network error'))
      
      consoleSpy.mockRestore()
    })

    it('handles profile update failure after level up', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      mockApiService.awardExperience.mockResolvedValue({
        success: true,
        data: {
          user: { experience_points: 250 },
          levelUp: true,
          newLevel: 4,
          oldLevel: 3,
          progress: {
            currentLevel: 4,
            progress: 50,
            expInLevel: 50,
            expForNextLevel: 100
          },
          experienceAwarded: 100
        }
      })

      mockApiService.getCharacterProfile.mockResolvedValue({
        success: false,
        error: 'Failed to update profile'
      })

      const { result } = renderHook(() => useCharacterStore())
      
      await act(async () => {
        const awardResult = await result.current.awardExperience(100)
        expect(awardResult).toEqual({
          levelUp: true,
          newLevel: 4,
          oldLevel: 3
        })
      })
      
      expect(mockApiService.awardExperience).toHaveBeenCalledWith(100)
      expect(mockApiService.getCharacterProfile).toHaveBeenCalledTimes(1)
      expect(result.current.level).toBe(4)
      expect(result.current.experience).toBe(250)
      // Note: The current implementation doesn't log errors when getCharacterProfile fails after level up
      // It just silently fails to update availableCharacters
      
      consoleSpy.mockRestore()
    })
  })

  describe('reset', () => {
    it('resets store to initial state', () => {
      const { result } = renderHook(() => useCharacterStore())
      
      // Set some state first
      act(() => {
        useCharacterStore.setState({
          characters: mockCharacters,
          currentCharacter: mockCharacters[0],
          availableCharacters: [mockCharacters[0]],
          level: 5,
          experience: 500,
          progress: mockCharacterProfile.progress,
          isLoading: true,
          isUpdating: true
        })
      })
      
      // Verify state was set
      expect(result.current.characters).toEqual(mockCharacters)
      expect(result.current.currentCharacter).toEqual(mockCharacters[0])
      expect(result.current.level).toBe(5)
      
      // Reset
      act(() => {
        result.current.reset()
      })
      
      // Verify reset
      expect(result.current.characters).toEqual([])
      expect(result.current.currentCharacter).toBeNull()
      expect(result.current.availableCharacters).toEqual([])
      expect(result.current.level).toBe(1)
      expect(result.current.experience).toBe(0)
      expect(result.current.progress).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isUpdating).toBe(false)
    })
  })

  describe('selector hooks', () => {
    it('useCurrentCharacter returns current character', () => {
      const { useCurrentCharacter } = require('../characterStore')
      const { result } = renderHook(() => useCurrentCharacter())
      
      expect(result.current).toBeNull()
      
      act(() => {
        useCharacterStore.setState({ currentCharacter: mockCharacters[0] })
      })
      
      expect(result.current).toEqual(mockCharacters[0])
    })

    it('useCharacterLevel returns current level', () => {
      const { useCharacterLevel } = require('../characterStore')
      const { result } = renderHook(() => useCharacterLevel())
      
      expect(result.current).toBe(1)
      
      act(() => {
        useCharacterStore.setState({ level: 5 })
      })
      
      expect(result.current).toBe(5)
    })

    it('useCharacterExperience returns current experience', () => {
      const { useCharacterExperience } = require('../characterStore')
      const { result } = renderHook(() => useCharacterExperience())
      
      expect(result.current).toBe(0)
      
      act(() => {
        useCharacterStore.setState({ experience: 250 })
      })
      
      expect(result.current).toBe(250)
    })

    it('useCharacterProgress returns current progress', () => {
      const { useCharacterProgress } = require('../characterStore')
      const { result } = renderHook(() => useCharacterProgress())
      
      expect(result.current).toBeNull()
      
      act(() => {
        useCharacterStore.setState({ progress: mockCharacterProfile.progress })
      })
      
      expect(result.current).toEqual(mockCharacterProfile.progress)
    })

    it('useAvailableCharacters returns available characters', () => {
      const { useAvailableCharacters } = require('../characterStore')
      const { result } = renderHook(() => useAvailableCharacters())
      
      expect(result.current).toEqual([])
      
      act(() => {
        useCharacterStore.setState({ availableCharacters: [mockCharacters[0], mockCharacters[1]] })
      })
      
      expect(result.current).toEqual([mockCharacters[0], mockCharacters[1]])
    })

    it('useCharacterLoading returns loading state', () => {
      const { useCharacterLoading } = require('../characterStore')
      const { result } = renderHook(() => useCharacterLoading())
      
      expect(result.current).toBe(false)
      
      act(() => {
        useCharacterStore.setState({ isLoading: true })
      })
      
      expect(result.current).toBe(true)
    })

    it('useCharacterUpdating returns updating state', () => {
      const { useCharacterUpdating } = require('../characterStore')
      const { result } = renderHook(() => useCharacterUpdating())
      
      expect(result.current).toBe(false)
      
      act(() => {
        useCharacterStore.setState({ isUpdating: true })
      })
      
      expect(result.current).toBe(true)
    })
  })

  describe('state persistence and hydration', () => {
    it('maintains state consistency across multiple operations', async () => {
      // Load characters
      mockApiService.getAllCharacters.mockResolvedValue({
        success: true,
        data: mockCharacters
      })

      // Load profile
      mockApiService.getCharacterProfile.mockResolvedValue({
        success: true,
        data: mockCharacterProfile
      })

      // Update character
      const updatedProfile: CharacterProfile = {
        ...mockCharacterProfile,
        character: mockCharacters[1]
      }
      mockApiService.updateCharacter.mockResolvedValue({
        success: true,
        data: {
          user: { experience_points: 150 },
          characterInfo: updatedProfile
        }
      })

      // Award experience
      mockApiService.awardExperience.mockResolvedValue({
        success: true,
        data: {
          user: { experience_points: 200 },
          levelUp: false,
          newLevel: 3,
          oldLevel: 3,
          progress: {
            currentLevel: 3,
            progress: 100,
            expInLevel: 100,
            expForNextLevel: 100
          },
          experienceAwarded: 50
        }
      })

      const { result } = renderHook(() => useCharacterStore())
      
      // Load characters
      await act(async () => {
        await result.current.loadCharacters()
      })
      expect(result.current.characters).toEqual(mockCharacters)
      
      // Load profile
      await act(async () => {
        await result.current.loadCharacterProfile()
      })
      expect(result.current.currentCharacter).toEqual(mockCharacterProfile.character)
      expect(result.current.level).toBe(3)
      
      // Update character
      await act(async () => {
        await result.current.updateCharacter('char2')
      })
      expect(result.current.currentCharacter).toEqual(updatedProfile.character)
      
      // Award experience
      await act(async () => {
        await result.current.awardExperience(50)
      })
      expect(result.current.experience).toBe(200)
      expect(result.current.level).toBe(3)
    })
  })

  describe('error handling edge cases', () => {
    it('handles empty character arrays gracefully', async () => {
      mockApiService.getAllCharacters.mockResolvedValue({
        success: true,
        data: []
      })

      const { result } = renderHook(() => useCharacterStore())
      
      await act(async () => {
        await result.current.loadCharacters()
      })
      
      expect(result.current.characters).toEqual([])
      expect(result.current.isLoading).toBe(false)
    })

    it('handles null profile data gracefully', async () => {
      mockApiService.getCharacterProfile.mockResolvedValue({
        success: false,
        data: undefined,
        error: 'No profile found'
      })

      const { result } = renderHook(() => useCharacterStore())
      
      await act(async () => {
        await result.current.loadCharacterProfile()
      })
      
      expect(result.current.currentCharacter).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })

    it('handles undefined API responses gracefully', async () => {
      mockApiService.getAllCharacters.mockResolvedValue({
        success: true,
        data: undefined
      })

      const { result } = renderHook(() => useCharacterStore())
      
      await act(async () => {
        await result.current.loadCharacters()
      })
      
      expect(result.current.characters).toEqual([])
      expect(result.current.isLoading).toBe(false)
    })
  })
}) 