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
  ownedCharacters: string[]
  respectBalance: number
  purchaseCharacter: (characterId: string) => Promise<{ success: boolean; error?: string }>

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
  ownedCharacters: ['student'],
  respectBalance: 0,

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

        // Fetch character ownership from auth service
        try {
          const authUrl = (window as any).__IMPORT_META_ENV__?.VITE_AUTH_SERVICE_URL || import.meta.env.VITE_AUTH_SERVICE_URL || '';
          if (authUrl) {
            const catalogRes = await fetch(`${authUrl}/api/catalog/characters`, { credentials: 'include' });
            if (catalogRes.ok) {
              const catalog = await catalogRes.json();
              const owned = ['student', ...catalog.ownedCharacterIds.map((id: string) => id.replace('character_', ''))];
              set({ ownedCharacters: owned, respectBalance: catalog.respectBalance });
            }
          }
        } catch (e) {
          console.warn('Failed to fetch character ownership, defaulting to student only');
          set({ ownedCharacters: ['student'], respectBalance: 0 });
        }
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

  // Purchase a character from the auth service catalog
  purchaseCharacter: async (characterId: string) => {
    try {
      const authUrl = (window as any).__IMPORT_META_ENV__?.VITE_AUTH_SERVICE_URL || import.meta.env.VITE_AUTH_SERVICE_URL || '';
      const res = await fetch(`${authUrl}/api/catalog/purchase`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: `character_${characterId}` }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        set((state) => ({
          ownedCharacters: [...state.ownedCharacters, characterId],
          respectBalance: data.newBalance,
        }));
        return { success: true };
      }
      return { success: false, error: data.error || 'Purchase failed' };
    } catch {
      return { success: false, error: 'Network error' };
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
      isUpdating: false,
      ownedCharacters: ['student'],
      respectBalance: 0,
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
export const useOwnedCharacters = () => useCharacterStore(state => state.ownedCharacters)
export const useRespectBalance = () => useCharacterStore(state => state.respectBalance)
