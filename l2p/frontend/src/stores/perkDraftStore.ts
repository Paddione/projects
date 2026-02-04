import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { apiService } from '../services/apiService'

export interface DraftPerk {
  id: number
  name: string
  description: string
  category: string
  tier: number
  effect_type: string
  effect_config: Record<string, any>
}

export interface DraftOffer {
  level: number
  perks: DraftPerk[]
  drafted: boolean
  dumped: boolean
  chosenPerkId?: number
}

export interface DraftRecord {
  level: number
  offeredPerkIds: number[]
  chosenPerkId: number | null
  dumped: boolean
  draftedAt: string
}

export interface SkillTreeData {
  history: DraftRecord[]
  allPerks: DraftPerk[]
  maxLevel: number
  currentLevel: number
}

interface PerkDraftState {
  // State
  allPerks: DraftPerk[]
  activePerks: DraftPerk[]
  draftHistory: DraftRecord[]
  availablePool: DraftPerk[]
  pendingDrafts: DraftOffer[]
  currentDraftIndex: number
  draftComplete: boolean
  needsRedraft: boolean
  redraftInProgress: boolean
  skillTreeData: SkillTreeData | null
  isLoading: boolean
  error: string | null

  // Actions
  loadAllPerks: () => Promise<void>
  loadActivePerks: () => Promise<void>
  loadDraftHistory: () => Promise<void>
  loadAvailablePool: () => Promise<void>
  loadSkillTreeData: () => Promise<void>
  setPendingDrafts: (drafts: DraftOffer[]) => void
  pickPerk: (level: number, perkId: number) => Promise<boolean>
  dumpOffer: (level: number) => Promise<boolean>
  resetAllDrafts: () => Promise<boolean>
  checkNeedsRedraft: () => Promise<boolean>
  clearRedraftFlag: () => Promise<void>
  advanceDraft: () => void
  clearDrafts: () => void
  setError: (error: string | null) => void
}

export const usePerkDraftStore = create<PerkDraftState>()(
  devtools(
    (set, get) => ({
      allPerks: [],
      activePerks: [],
      draftHistory: [],
      availablePool: [],
      pendingDrafts: [],
      currentDraftIndex: 0,
      draftComplete: false,
      needsRedraft: false,
      redraftInProgress: false,
      skillTreeData: null,
      isLoading: false,
      error: null,

      loadAllPerks: async () => {
        try {
          const res = await apiService.getAllPerks()
          if (res.success && res.data) {
            set({ allPerks: res.data as any })
          }
        } catch (e) {
          console.error('Failed to load all perks:', e)
        }
      },

      loadActivePerks: async () => {
        try {
          const res = await apiService.getActiveGameplayPerks()
          if (res.success && res.data) {
            set({ activePerks: res.data as any })
          }
        } catch (e) {
          console.error('Failed to load active perks:', e)
        }
      },

      loadDraftHistory: async () => {
        try {
          const res = await apiService.getDraftHistory()
          if (res.success && res.data) {
            set({ draftHistory: res.data as any })
          }
        } catch (e) {
          console.error('Failed to load draft history:', e)
        }
      },

      loadAvailablePool: async () => {
        try {
          const res = await apiService.getAvailablePool()
          if (res.success && res.data) {
            set({ availablePool: (res.data as any).pool || [] })
          }
        } catch (e) {
          console.error('Failed to load available pool:', e)
        }
      },

      loadSkillTreeData: async () => {
        try {
          set({ isLoading: true })
          const res = await apiService.getSkillTreeData()
          if (res.success && res.data) {
            set({ skillTreeData: res.data as any })
          }
        } catch (e) {
          console.error('Failed to load skill tree data:', e)
        } finally {
          set({ isLoading: false })
        }
      },

      setPendingDrafts: (drafts) => {
        set({
          pendingDrafts: drafts,
          currentDraftIndex: 0,
          draftComplete: drafts.length === 0,
        })
      },

      pickPerk: async (level, perkId) => {
        try {
          set({ isLoading: true, error: null })
          const res = await apiService.pickDraftPerk(level, perkId)
          if (res.success) {
            // Advance to next draft
            get().advanceDraft()
            return true
          } else {
            set({ error: (res as any).message || 'Failed to pick perk' })
            return false
          }
        } catch (e) {
          set({ error: 'Failed to pick perk' })
          return false
        } finally {
          set({ isLoading: false })
        }
      },

      dumpOffer: async (level) => {
        try {
          set({ isLoading: true, error: null })
          const res = await apiService.dumpDraftOffer(level)
          if (res.success) {
            get().advanceDraft()
            return true
          } else {
            set({ error: (res as any).message || 'Failed to dump offer' })
            return false
          }
        } catch (e) {
          set({ error: 'Failed to dump offer' })
          return false
        } finally {
          set({ isLoading: false })
        }
      },

      resetAllDrafts: async () => {
        try {
          set({ isLoading: true, redraftInProgress: true, error: null })
          const res = await apiService.resetDrafts()
          if (res.success) {
            set({ draftHistory: [], activePerks: [], availablePool: [] })
            return true
          } else {
            set({ error: (res as any).message || 'Failed to reset drafts' })
            return false
          }
        } catch (e) {
          set({ error: 'Failed to reset drafts' })
          return false
        } finally {
          set({ isLoading: false, redraftInProgress: false })
        }
      },

      checkNeedsRedraft: async () => {
        try {
          const res = await apiService.checkNeedsRedraft()
          if (res.success && res.data) {
            const needs = (res.data as any).needsRedraft || false
            set({ needsRedraft: needs })
            return needs
          }
          return false
        } catch (e) {
          console.error('Failed to check redraft status:', e)
          return false
        }
      },

      clearRedraftFlag: async () => {
        try {
          await apiService.clearRedraftFlag()
          set({ needsRedraft: false })
        } catch (e) {
          console.error('Failed to clear redraft flag:', e)
        }
      },

      advanceDraft: () => {
        const { currentDraftIndex, pendingDrafts } = get()
        const nextIndex = currentDraftIndex + 1
        if (nextIndex >= pendingDrafts.length) {
          set({ draftComplete: true, currentDraftIndex: nextIndex })
        } else {
          set({ currentDraftIndex: nextIndex })
        }
      },

      clearDrafts: () => {
        set({
          pendingDrafts: [],
          currentDraftIndex: 0,
          draftComplete: false,
        })
      },

      setError: (error) => set({ error }),
    }),
    { name: 'perk-draft-store' }
  )
)
