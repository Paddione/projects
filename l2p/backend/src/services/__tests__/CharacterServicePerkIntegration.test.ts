import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CharacterService } from '../CharacterService.js';
import { PerksManager, Perk } from '../PerksManager.js';
import { PerkDraftService, DraftOffer } from '../PerkDraftService.js';
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
      generateDraftOffer: jest.fn(),
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
    it('should generate draft offers when user levels up', async () => {
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

      const draftOffer: DraftOffer = {
        level: newLevel,
        perks: [
          {
            id: 1,
            name: 'starter_perk',
            category: 'scoring',
            type: 'gameplay',
            effect_type: 'score_bonus',
            effect_config: {},
            tier: 1,
            title: 'Starter Perk',
            description: 'A starter perk'
          }
        ],
        drafted: false,
        dumped: false
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

      // Mock draft offer generation
      mockPerkDraftService.generateDraftOffer.mockResolvedValue(draftOffer);

      const result = await characterService.awardExperience(userId, experienceGained);

      expect(result).toMatchObject({
        newLevel,
        levelUp: true,
        oldLevel,
        newlyUnlockedPerks: [], // Always empty in draft system
        user: expect.objectContaining({
          experiencePoints: updatedXp,
          characterLevel: newLevel
        })
      });

      // Verify draft offer was generated for the new level
      expect(result.pendingDrafts).toEqual([draftOffer]);
      expect(mockPerkDraftService.generateDraftOffer).toHaveBeenCalledWith(userId, newLevel);

      // Verify legacy perk check was NOT called (draft system replaces it)
      expect(mockPerksManager.checkAndUnlockPerksForLevel).not.toHaveBeenCalled();
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

    it('should generate draft offers for each level on multiple level ups', async () => {
      const userId = 1;
      const startingLevel = 1;
      const targetLevel = 8;
      const currentXp = 0;
      const experienceGained = characterService.getTotalExperienceForLevel(targetLevel - 1) + 1000;
      const newLevel = characterService.calculateLevel(currentXp + experienceGained);

      jest.spyOn((characterService as any).gameProfileService, 'getOrCreateProfile')
        .mockResolvedValue(buildProfile(userId, startingLevel, currentXp));

      // Create draft offers for each level from 2 to newLevel (capped at 30)
      const buildDraftOffer = (level: number): DraftOffer => ({
        level,
        perks: [
          {
            id: level * 10,
            name: `level_${level}_perk`,
            category: 'scoring',
            type: 'gameplay',
            effect_type: 'score_bonus',
            effect_config: {},
            tier: 1,
            title: `Level ${level} Perk`,
            description: `A perk for level ${level}`
          }
        ],
        drafted: false,
        dumped: false
      });

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

      // Mock draft offer generation for each level
      for (let lvl = startingLevel + 1; lvl <= Math.min(newLevel, 30); lvl++) {
        mockPerkDraftService.generateDraftOffer.mockResolvedValueOnce(buildDraftOffer(lvl));
      }

      const result = await characterService.awardExperience(userId, experienceGained);

      expect(result.levelUp).toBe(true);
      expect(result.newLevel).toBe(newLevel);
      expect(result.newlyUnlockedPerks).toEqual([]); // Always empty in draft system

      // Verify draft offers were generated for each new level
      const expectedLevels = Math.min(newLevel, 30) - startingLevel;
      expect(result.pendingDrafts.length).toBe(expectedLevels);
      expect(mockPerkDraftService.generateDraftOffer).toHaveBeenCalledTimes(expectedLevels);

      // Verify each level was called
      for (let lvl = startingLevel + 1; lvl <= Math.min(newLevel, 30); lvl++) {
        expect(mockPerkDraftService.generateDraftOffer).toHaveBeenCalledWith(userId, lvl);
      }

      // Verify legacy perk check was NOT called
      expect(mockPerksManager.checkAndUnlockPerksForLevel).not.toHaveBeenCalled();
    });

    it('should handle draft offer generation errors gracefully', async () => {
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

      // Mock draft service error
      mockPerkDraftService.generateDraftOffer.mockRejectedValue(
        new Error('Draft generation failed')
      );

      const result = await characterService.awardExperience(userId, experienceGained);

      // Should still return successful experience addition, but with no pending drafts
      expect(result).toMatchObject({
        newLevel,
        levelUp: true,
        oldLevel,
        newlyUnlockedPerks: [], // Always empty in draft system
        pendingDrafts: [], // Empty due to error
        user: expect.objectContaining({
          experiencePoints: updatedXp,
          characterLevel: newLevel
        })
      });

      expect(mockPerkDraftService.generateDraftOffer).toHaveBeenCalledWith(userId, newLevel);
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
    it('should handle draft service errors gracefully during level up', async () => {
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

      // Mock database update for users table sync
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      // Mock draft service throwing an error (e.g., database constraint violation)
      mockPerkDraftService.generateDraftOffer.mockRejectedValue(
        new Error('Database constraint violation')
      );

      const result = await characterService.awardExperience(userId, experienceGained);

      // Should still succeed with experience gain, even if draft generation fails
      expect(result.newLevel).toBe(currentLevel + 1);
      expect(result.newlyUnlockedPerks).toEqual([]);
      expect(result.pendingDrafts).toEqual([]);
    });

    it('should handle partial draft offers correctly when some levels have no perks', async () => {
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

      // Mock database update for users table sync
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      // Mock draft offers: some levels have perks available, some have empty pools or are already drafted
      const draftWithPerks: DraftOffer = {
        level: 4,
        perks: [{ id: 1, name: 'perk_1', category: 'scoring', type: 'gameplay', effect_type: 'score_bonus', effect_config: {}, tier: 1, title: 'Perk 1', description: 'A perk' }],
        drafted: false,
        dumped: false
      };
      const draftAlreadyDrafted: DraftOffer = {
        level: 5,
        perks: [{ id: 2, name: 'perk_2', category: 'time', type: 'gameplay', effect_type: 'time_bonus', effect_config: {}, tier: 1, title: 'Perk 2', description: 'Another perk' }],
        drafted: true, // Already drafted, should not be included in pendingDrafts
        dumped: false
      };
      const draftEmptyPool: DraftOffer = {
        level: 6,
        perks: [], // No perks available, should not be included
        drafted: false,
        dumped: false
      };
      const draftWithPerks7: DraftOffer = {
        level: 7,
        perks: [{ id: 3, name: 'perk_3', category: 'xp', type: 'gameplay', effect_type: 'xp_bonus', effect_config: {}, tier: 1, title: 'Perk 3', description: 'Yet another perk' }],
        drafted: false,
        dumped: false
      };

      // Mock generateDraftOffer for levels 4, 5, 6, 7
      mockPerkDraftService.generateDraftOffer
        .mockResolvedValueOnce(draftWithPerks)      // level 4
        .mockResolvedValueOnce(draftAlreadyDrafted)  // level 5
        .mockResolvedValueOnce(draftEmptyPool)        // level 6
        .mockResolvedValueOnce(draftWithPerks7);      // level 7

      const result = await characterService.awardExperience(userId, experienceGained);

      // newlyUnlockedPerks is always empty in draft system
      expect(result.newlyUnlockedPerks).toEqual([]);

      // Only drafts with perks.length > 0 AND drafted === false are included
      expect(result.pendingDrafts.length).toBe(2);
      expect(result.pendingDrafts).toEqual([draftWithPerks, draftWithPerks7]);
    });
  });
});
