import { create } from 'zustand'
import { Character, CharacterProfile } from '../types'
import { apiService } from '../services/apiService'

interface CharacterState {
  // Character data
  characters: Character[]
  currentCharacter: Character | null
  availableCharacters: Character[]
  
  // Level and experience
  level: number
  experience: number
  progress: {
    currentLevel: number
    progress: number
    expInLevel: number
    expForNextLevel: number
  } | null
  
  // Loading states
  isLoading: boolean
  isUpdating: boolean
  
  // Actions
  loadCharacters: () => Promise<void>
  loadCharacterProfile: () => Promise<void>
  updateCharacter: (characterId: string) => Promise<boolean>
  awardExperience: (experiencePoints: number) => Promise<{
    levelUp: boolean
    newLevel: number
    oldLevel: number
  } | null>
  reset: () => void
}

export const useCharacterStore = create<CharacterState>((set, _get) => ({
  // Initial state
  characters: [],
  currentCharacter: null,
  availableCharacters: [],
  level: 1,
  experience: 0,
  progress: null,
  isLoading: false,
  isUpdating: false,

  // Load all available characters
  loadCharacters: async () => {
    set({ isLoading: true })
    try {
      const response = await apiService.getAllCharacters()
      if (response.success && response.data) {
        set({ 
          characters: response.data,
          // Expose all characters as available in unauthenticated contexts
          availableCharacters: response.data
        })
      } else {
        console.error('Failed to load characters:', response.error)
      }
    } catch (error) {
      console.error('Error loading characters:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  // Load user's character profile
  loadCharacterProfile: async () => {
    set({ isLoading: true })
    try {
      const response = await apiService.getCharacterProfile()
      if (response.success && response.data) {
        const profile: CharacterProfile = response.data
        set({
          currentCharacter: profile.character,
          availableCharacters: profile.availableCharacters,
          level: profile.level,
          experience: profile.experience,
          progress: profile.progress
        })
      } else {
        console.error('Failed to load character profile:', response.error)
      }
    } catch (error) {
      console.error('Error loading character profile:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  // Update user's selected character
  updateCharacter: async (characterId: string) => {
    set({ isUpdating: true })
    try {
      const response = await apiService.updateCharacter(characterId)
      if (response.success && response.data) {
        const { characterInfo } = response.data
        set({
          currentCharacter: characterInfo.character,
          availableCharacters: characterInfo.availableCharacters,
          level: characterInfo.level,
          experience: characterInfo.experience,
          progress: characterInfo.progress
        })
        return true
      } else {
        console.error('Failed to update character:', response.error)
        return false
      }
    } catch (error) {
      console.error('Error updating character:', error)
      return false
    } finally {
      set({ isUpdating: false })
    }
  },

  // Award experience points (typically after game completion)
  awardExperience: async (experiencePoints: number) => {
    try {
      const response = await apiService.awardExperience(experiencePoints)
      if (response.success && response.data) {
        const { levelUp, newLevel, oldLevel, progress } = response.data
        
        // Update state with new experience and level
        set({
          level: newLevel,
          experience: response.data.user.experience_points,
          progress
        })

        // If level up, also update available characters
        if (levelUp) {
          const profileResponse = await apiService.getCharacterProfile()
          if (profileResponse.success && profileResponse.data) {
            set({
              availableCharacters: profileResponse.data.availableCharacters
            })
          }
        }

        return { levelUp, newLevel, oldLevel }
      } else {
        console.error('Failed to award experience:', response.error)
        return null
      }
    } catch (error) {
      console.error('Error awarding experience:', error)
      return null
    }
  },

  // Reset store state
  reset: () => {
    set({
      characters: [],
      currentCharacter: null,
      availableCharacters: [],
      level: 1,
      experience: 0,
      progress: null,
      isLoading: false,
      isUpdating: false
    })
  }
}))

// Selector hooks for easier access to specific state
export const useCurrentCharacter = () => useCharacterStore(state => state.currentCharacter)
export const useCharacterLevel = () => useCharacterStore(state => state.level)
export const useCharacterExperience = () => useCharacterStore(state => state.experience)
export const useCharacterProgress = () => useCharacterStore(state => state.progress)
export const useAvailableCharacters = () => useCharacterStore(state => state.availableCharacters)
export const useCharacterLoading = () => useCharacterStore(state => state.isLoading)
export const useCharacterUpdating = () => useCharacterStore(state => state.isUpdating) 
