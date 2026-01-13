import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CharacterService } from '../CharacterService.js';
import { PerksManager, Perk } from '../PerksManager.js';
import { DatabaseService } from '../DatabaseService.js';

// Mock dependencies
jest.mock('../DatabaseService.js');
jest.mock('../PerksManager.js');

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

    characterService = new CharacterService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('awardExperience - Perk Integration', () => {
    it('should check and unlock perks when user levels up', async () => {
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

      const newlyUnlockedPerks = [
        {
          id: 1,
          user_id: userId,
          perk_id: 1,
          is_unlocked: true,
          is_active: false,
          configuration: {},
          updated_at: new Date(),
          perk: buildMockPerk({
            id: 1,
            name: 'starter_badge',
            title: 'Starter Badge',
            level_required: 5
          })
        }
      ];

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

      // Mock perk unlocking
      mockPerksManager.checkAndUnlockPerksForLevel.mockResolvedValue(newlyUnlockedPerks);

      const result = await characterService.awardExperience(userId, experienceGained);

      expect(result).toMatchObject({
        newLevel,
        levelUp: true,
        oldLevel,
        newlyUnlockedPerks,
        user: expect.objectContaining({
          experiencePoints: updatedXp,
          characterLevel: newLevel
        })
      });

      // Verify perk check was called with correct level
      expect(mockPerksManager.checkAndUnlockPerksForLevel).toHaveBeenCalledWith(userId, newLevel);
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
        user: expect.objectContaining({
          experiencePoints: updatedXp,
          characterLevel: resultingLevel
        })
      });

      // Verify perk check was NOT called
      expect(mockPerksManager.checkAndUnlockPerksForLevel).not.toHaveBeenCalled();
    });

    it('should handle multiple level ups with perk unlocks', async () => {
      const userId = 1;
      const startingLevel = 1;
      const targetLevel = 8;
      const currentXp = 0;
      const experienceGained = characterService.getTotalExperienceForLevel(targetLevel - 1) + 1000;
      const newLevel = characterService.calculateLevel(currentXp + experienceGained);

      jest.spyOn((characterService as any).gameProfileService, 'getOrCreateProfile')
        .mockResolvedValue(buildProfile(userId, startingLevel, currentXp));

      const newlyUnlockedPerks = [
        {
          id: 1,
          user_id: userId,
          perk_id: 1,
          is_unlocked: true,
          is_active: false,
          configuration: {},
          updated_at: new Date(),
          perk: buildMockPerk({
            id: 1,
            name: 'level_3_perk',
            title: 'Level 3 Perk',
            level_required: 3
          })
        },
        {
          id: 2,
          user_id: userId,
          perk_id: 2,
          is_unlocked: true,
          is_active: false,
          configuration: {},
          updated_at: new Date(),
          perk: buildMockPerk({
            id: 2,
            name: 'level_5_perk',
            title: 'Level 5 Perk',
            level_required: 5
          })
        },
        {
          id: 3,
          user_id: userId,
          perk_id: 3,
          is_unlocked: true,
          is_active: false,
          configuration: {},
          updated_at: new Date(),
          perk: buildMockPerk({
            id: 3,
            name: 'level_8_perk',
            title: 'Level 8 Perk',
            level_required: 8
          })
        }
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

      // Mock multiple perk unlocks
      mockPerksManager.checkAndUnlockPerksForLevel.mockResolvedValue(newlyUnlockedPerks);

      const result = await characterService.awardExperience(userId, experienceGained);

      expect(result.levelUp).toBe(true);
      expect(result.newLevel).toBe(newLevel);
      expect(result.newlyUnlockedPerks).toEqual(newlyUnlockedPerks);
      expect(result.newlyUnlockedPerks.length).toBe(3);

      // Verify perk check was called with final level
      expect(mockPerksManager.checkAndUnlockPerksForLevel).toHaveBeenCalledWith(userId, newLevel);
    });

    it('should handle perk unlock errors gracefully', async () => {
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

      // Mock perk manager error
      mockPerksManager.checkAndUnlockPerksForLevel.mockRejectedValue(
        new Error('Perk unlock failed')
      );

      const result = await characterService.awardExperience(userId, experienceGained);

      // Should still return successful experience addition, but with no newly unlocked perks
      expect(result).toMatchObject({
        newLevel,
        levelUp: true,
        oldLevel,
        newlyUnlockedPerks: [], // Empty due to error
        user: expect.objectContaining({
          experiencePoints: updatedXp,
          characterLevel: newLevel
        })
      });

      expect(mockPerksManager.checkAndUnlockPerksForLevel).toHaveBeenCalledWith(userId, newLevel);
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
        user: expect.objectContaining({
          experiencePoints: updatedXp,
          characterLevel: maxLevel
        })
      });

      // Should not check for perks since level didn't change
      expect(mockPerksManager.checkAndUnlockPerksForLevel).not.toHaveBeenCalled();
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

      // Should not check for perks when user doesn't exist
      expect(mockPerksManager.checkAndUnlockPerksForLevel).not.toHaveBeenCalled();
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

  describe('Perk-Related Error Scenarios', () => {
    it('should handle database transaction rollback when perk operations fail', async () => {
      const userId = 1;
      const currentLevel = 4;
      const currentXp = characterService.getTotalExperienceForLevel(currentLevel - 1) + 10;
      const nextLevelThreshold = characterService.getTotalExperienceForLevel(currentLevel);
      const experienceGained = (nextLevelThreshold - currentXp) + 40;
      const updatedXp = currentXp + experienceGained;

      jest.spyOn((characterService as any).gameProfileService, 'getOrCreateProfile')
        .mockResolvedValue(buildProfile(userId, currentLevel, currentXp));

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          auth_user_id: userId,
          selected_character: 'student',
          character_level: currentLevel + 1,
          experience_points: updatedXp,
          preferences: {},
          created_at: new Date(),
          updated_at: new Date()
        }]
      } as any);

      // Mock perk manager throwing an error
      mockPerksManager.checkAndUnlockPerksForLevel.mockRejectedValue(
        new Error('Database constraint violation')
      );

      const result = await characterService.awardExperience(userId, experienceGained);

      // Should still succeed with experience gain, even if perk unlock fails
      expect(result.newLevel).toBe(currentLevel + 1);
      expect(result.newlyUnlockedPerks).toEqual([]);
    });

    it('should handle partial perk unlocks correctly', async () => {
      const userId = 1;
      const startLevel = 3;
      const targetLevel = 7;
      const currentXp = characterService.getTotalExperienceForLevel(startLevel - 1) + 20;
      const experienceGained = characterService.getTotalExperienceForLevel(targetLevel - 1) - currentXp + 5000;
      const updatedXp = currentXp + experienceGained;

      jest.spyOn((characterService as any).gameProfileService, 'getOrCreateProfile')
        .mockResolvedValue(buildProfile(userId, startLevel, currentXp));

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          auth_user_id: userId,
          selected_character: 'student',
          character_level: targetLevel,
          experience_points: updatedXp,
          preferences: {},
          created_at: new Date(),
          updated_at: new Date()
        }]
      } as any);

      // Mock some perks unlocking successfully, some failing
      const partiallyUnlockedPerks = [
        {
          id: 1,
          user_id: userId,
          perk_id: 1,
          is_unlocked: true,
          is_active: false,
          configuration: {},
          updated_at: new Date(),
          perk: buildMockPerk({
            id: 1,
            name: 'perk_1',
            title: 'Perk 1',
            level_required: 5
          })
        }
        // Note: Only one perk even though user went from level 3 to 7
        // This simulates partial failures or conditional unlocks
      ];

      mockPerksManager.checkAndUnlockPerksForLevel.mockResolvedValue(partiallyUnlockedPerks);

      const result = await characterService.awardExperience(userId, experienceGained);

      expect(result.newlyUnlockedPerks).toEqual(partiallyUnlockedPerks);
      expect(result.newlyUnlockedPerks.length).toBe(1);
    });
  });
});
