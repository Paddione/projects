import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CharacterService } from '../CharacterService.js';
import { PerksManager, Perk } from '../PerksManager.js';
import { PerkDraftService, DraftPerk } from '../PerkDraftService.js';
import { DatabaseService } from '../DatabaseService.js';

// Mock dependencies
jest.mock('../DatabaseService.js');
jest.mock('../PerksManager.js');
jest.mock('../PerkDraftService.js');

const buildMockPerk = (overrides: Partial<Perk> & { id?: number } = {}): Perk => ({
  id: overrides.id ?? 1,
  name: overrides.name ?? 'mock_perk',
  category: overrides.category ?? 'cosmetic',
  type: overrides.type ?? 'badge',
  level_required: overrides.level_required ?? 1,
  title: overrides.title ?? 'Mock Perk',
  description: overrides.description ?? 'Mock perk description',
  config_schema: overrides.config_schema ?? null,
  asset_data: overrides.asset_data ?? null,
  is_active: overrides.is_active ?? true,
  created_at: overrides.created_at ?? new Date(),
  updated_at: overrides.updated_at ?? new Date()
});

describe('CharacterService - Perk Integration', () => {
  let characterService: CharacterService;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockPerksManager: jest.Mocked<PerksManager>;
  let mockPerkDraftService: jest.Mocked<PerkDraftService>;
  const buildProfile = (userId: number, level: number, experiencePoints: number) => ({
    authUserId: userId,
    selectedCharacter: 'student',
    characterLevel: level,
    experiencePoints,
    preferences: {},
    createdAt: new Date(),
    updatedAt: new Date()
  });

  beforeEach(() => {
    // Mock database service
    mockDb = {
      query: jest.fn(),
      getInstance: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      close: jest.fn()
    } as any;

    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDb);

    // Mock perks manager
    mockPerksManager = {
      checkAndUnlockPerksForLevel: jest.fn(),
      getInstance: jest.fn()
    } as any;

    (PerksManager.getInstance as jest.Mock).mockReturnValue(mockPerksManager);

    // Mock perk draft service
    mockPerkDraftService = {
      getNewlyUnlockedPerks: jest.fn(),
      getInstance: jest.fn()
    } as any;

    (PerkDraftService.getInstance as jest.Mock).mockReturnValue(mockPerkDraftService);

    characterService = new CharacterService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('awardExperience - Perk Integration', () => {
    it('should return newly unlocked perks when user levels up', async () => {
      const userId = 1;
      const oldLevel = 4;
      const newLevel = oldLevel + 1;
      const baseXp = characterService.getTotalExperienceForLevel(oldLevel - 1);
      const progressXp = Math.floor(characterService.calculateLevelExperience(oldLevel) / 2);
      const currentXp = baseXp + progressXp;
      const nextLevelThreshold = characterService.getTotalExperienceForLevel(oldLevel);
      const experienceGained = (nextLevelThreshold - currentXp) + 50;
      const updatedXp = currentXp + experienceGained;

      jest.spyOn((characterService as any).gameProfileService, 'getOrCreateProfile')
        .mockResolvedValue(buildProfile(userId, oldLevel, currentXp));

      const unlockedPerk: DraftPerk = {
        id: 5,
        name: 'xp_boost_light',
        category: 'xp',
        type: 'gameplay',
        effect_type: 'xp_bonus',
        effect_config: {},
        tier: 1,
        title: 'XP Boost Light',
        description: 'A small XP boost'
      };

      // Mock database update for experience/level
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            auth_user_id: userId,
            selected_character: 'student',
            character_level: newLevel,
            experience_points: updatedXp,
            preferences: {},
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      } as any);

      // Mock database update for users table sync
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      // Mock newly unlocked perks
      mockPerkDraftService.getNewlyUnlockedPerks.mockResolvedValue([unlockedPerk]);

      const result = await characterService.awardExperience(userId, experienceGained);

      expect(result).toMatchObject({
        newLevel,
        levelUp: true,
        oldLevel,
        user: expect.objectContaining({
          experiencePoints: updatedXp,
          characterLevel: newLevel
        })
      });

      // Verify newly unlocked perks were fetched for the level range
      expect(result.newlyUnlockedPerks).toEqual([unlockedPerk]);
      expect(mockPerkDraftService.getNewlyUnlockedPerks).toHaveBeenCalledWith(oldLevel, newLevel);

      // pendingDrafts should always be empty (backward compat)
      expect(result.pendingDrafts).toEqual([]);
    });

    it('should not check perks when user does not level up', async () => {
      const userId = 1;
      const level = 4;
      const baseXp = characterService.getTotalExperienceForLevel(level - 1);
      const progressXp = Math.floor(characterService.calculateLevelExperience(level) / 5);
      const currentXp = baseXp + progressXp;
      const experienceGained = Math.floor(characterService.calculateLevelExperience(level) / 6);
      const updatedXp = currentXp + experienceGained;
      const resultingLevel = characterService.calculateLevel(updatedXp);

      jest.spyOn((characterService as any).gameProfileService, 'getOrCreateProfile')
        .mockResolvedValue(buildProfile(userId, level, currentXp));

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            auth_user_id: userId,
            selected_character: 'student',
            character_level: resultingLevel,
            experience_points: updatedXp,
            preferences: {},
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      } as any);

      const result = await characterService.awardExperience(userId, experienceGained);

      expect(result).toMatchObject({
        newLevel: resultingLevel,
        levelUp: false,
        oldLevel: level,
        newlyUnlockedPerks: [],
        pendingDrafts: [],
        user: expect.objectContaining({
          experiencePoints: updatedXp,
          characterLevel: resultingLevel
        })
      });

      // Should not fetch perks when no level-up
      expect(mockPerkDraftService.getNewlyUnlockedPerks).not.toHaveBeenCalled();
    });

    it('should return all newly unlocked perks on multiple level ups', async () => {
      const userId = 1;
      const startingLevel = 1;
      const targetLevel = 8;
      const currentXp = 0;
      const experienceGained = characterService.getTotalExperienceForLevel(targetLevel - 1) + 1000;
      const newLevel = characterService.calculateLevel(currentXp + experienceGained);

      jest.spyOn((characterService as any).gameProfileService, 'getOrCreateProfile')
        .mockResolvedValue(buildProfile(userId, startingLevel, currentXp));

      const unlockedPerks: DraftPerk[] = [
        { id: 1, name: 'time_cushion', category: 'time', type: 'gameplay', effect_type: 'time_bonus', effect_config: {}, tier: 1, title: 'Time Cushion', description: 'Extra time' },
        { id: 2, name: 'category_reveal', category: 'information', type: 'gameplay', effect_type: 'info_bonus', effect_config: {}, tier: 1, title: 'Category Reveal', description: 'Shows category' },
        { id: 3, name: 'score_boost', category: 'scoring', type: 'gameplay', effect_type: 'score_bonus', effect_config: {}, tier: 1, title: 'Score Boost', description: 'More points' },
      ];

      // Mock database update
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            auth_user_id: userId,
            selected_character: 'student',
            character_level: newLevel,
            experience_points: currentXp + experienceGained,
            preferences: {},
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      } as any);

      // Mock database update for users table sync
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      // Mock single call to getNewlyUnlockedPerks with the full level range
      mockPerkDraftService.getNewlyUnlockedPerks.mockResolvedValue(unlockedPerks);

      const result = await characterService.awardExperience(userId, experienceGained);

      expect(result.levelUp).toBe(true);
      expect(result.newLevel).toBe(newLevel);

      // All perks unlocked between old and new level returned in a single call
      expect(result.newlyUnlockedPerks).toEqual(unlockedPerks);
      expect(mockPerkDraftService.getNewlyUnlockedPerks).toHaveBeenCalledWith(startingLevel, newLevel);
      expect(mockPerkDraftService.getNewlyUnlockedPerks).toHaveBeenCalledTimes(1);

      // pendingDrafts always empty
      expect(result.pendingDrafts).toEqual([]);
    });

    it('should handle perk lookup errors gracefully', async () => {
      const userId = 1;
      const oldLevel = 4;
      const newLevel = oldLevel + 1;
      const currentXp = characterService.getTotalExperienceForLevel(oldLevel - 1) + 25;
      const nextLevelThreshold = characterService.getTotalExperienceForLevel(oldLevel);
      const experienceGained = (nextLevelThreshold - currentXp) + 25;
      const updatedXp = currentXp + experienceGained;

      jest.spyOn((characterService as any).gameProfileService, 'getOrCreateProfile')
        .mockResolvedValue(buildProfile(userId, oldLevel, currentXp));

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            auth_user_id: userId,
            selected_character: 'student',
            character_level: newLevel,
            experience_points: updatedXp,
            preferences: {},
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      } as any);

      // Mock database update for users table sync
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      // Mock perk service error
      mockPerkDraftService.getNewlyUnlockedPerks.mockRejectedValue(
        new Error('Database error')
      );

      const result = await characterService.awardExperience(userId, experienceGained);

      // Should still return successful experience addition, but with empty perks
      expect(result).toMatchObject({
        newLevel,
        levelUp: true,
        oldLevel,
        newlyUnlockedPerks: [],
        pendingDrafts: [],
        user: expect.objectContaining({
          experiencePoints: updatedXp,
          characterLevel: newLevel
        })
      });

      expect(mockPerkDraftService.getNewlyUnlockedPerks).toHaveBeenCalledWith(oldLevel, newLevel);
    });

    it('should handle edge case where user level is already at max', async () => {
      const userId = 1;
      const maxLevel = 100;
      const currentXp = characterService.getTotalExperienceForLevel(maxLevel - 1);
      const experienceGained = characterService.calculateLevelExperience(maxLevel);
      const updatedXp = currentXp + experienceGained;

      jest.spyOn((characterService as any).gameProfileService, 'getOrCreateProfile')
        .mockResolvedValue(buildProfile(userId, maxLevel, currentXp));

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            auth_user_id: userId,
            selected_character: 'student',
            character_level: maxLevel,
            experience_points: updatedXp,
            preferences: {},
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      } as any);

      const result = await characterService.awardExperience(userId, experienceGained);

      expect(result).toMatchObject({
        newLevel: maxLevel,
        levelUp: false,
        oldLevel: maxLevel,
        newlyUnlockedPerks: [],
        pendingDrafts: [],
        user: expect.objectContaining({
          experiencePoints: updatedXp,
          characterLevel: maxLevel
        })
      });

      // Should not fetch perks since level didn't change
      expect(mockPerkDraftService.getNewlyUnlockedPerks).not.toHaveBeenCalled();
    });

    it('should handle user not found scenario', async () => {
      const userId = 999;
      const experienceGained = 100;

      jest.spyOn((characterService as any).gameProfileService, 'getOrCreateProfile')
        .mockRejectedValue(new Error('Game profile not found'));

      jest.spyOn((characterService as any).userRepository, 'findUserById')
        .mockResolvedValue(null);

      // Should throw error when user not found
      await expect(characterService.awardExperience(userId, experienceGained))
        .rejects.toThrow('User not found');

      // Should not fetch perks when user doesn't exist
      expect(mockPerkDraftService.getNewlyUnlockedPerks).not.toHaveBeenCalled();
    });
  });

  describe('getUserCharacterInfo - Perk Context', () => {
    it('should include character level needed for perk calculations', async () => {
      const userId = 1;
      const level = 10;
      const experience = characterService.getTotalExperienceForLevel(level - 1) + 12345;

      jest.spyOn((characterService as any).gameProfileService, 'getOrCreateProfile')
        .mockResolvedValue(buildProfile(userId, level, experience));

      const result = await characterService.getUserCharacterInfo(userId);

      expect(result).toMatchObject({
        level,
        experience
      });

      // The level information is crucial for perk eligibility checks
      expect(result?.level).toBeGreaterThanOrEqual(1);
    });
  });
});
