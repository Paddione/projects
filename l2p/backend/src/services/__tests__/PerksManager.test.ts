import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PerksManager } from '../PerksManager.js';
import { DatabaseService } from '../DatabaseService.js';

// Mock DatabaseService
jest.mock('../DatabaseService.js');

describe('PerksManager', () => {
  let perksManager: PerksManager;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    // Reset singleton instance
    (PerksManager as any).instance = null;
    
    // Mock database service
    mockDb = {
      query: jest.fn(),
      getInstance: jest.fn(),
    } as any;

    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDb);
    
    perksManager = PerksManager.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = PerksManager.getInstance();
      const instance2 = PerksManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('getAllPerks', () => {
    it('should return all active perks ordered by tier', async () => {
      const mockPerks = [
        { id: 1, name: 'starter_badge', category: 'cosmetic', type: 'badge', tier: 1, title: 'Starter Badge' },
        { id: 2, name: 'custom_avatars', category: 'cosmetic', type: 'avatar', tier: 2, title: 'Character Collection' }
      ];

      mockDb.query.mockResolvedValue({ rows: mockPerks } as any);

      const result = await perksManager.getAllPerks();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM perks')
      );
      expect(result).toEqual(mockPerks);
    });

    it('should only return active perks', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await perksManager.getAllPerks();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_active = true')
      );
    });
  });

  describe('getPerksForLevel', () => {
    it('should return all active perks (draft-based, no level filter)', async () => {
      const mockPerks = [
        { id: 1, name: 'starter_badge', level_required: 0 },
        { id: 2, name: 'custom_avatars', level_required: 0 }
      ];

      mockDb.query.mockResolvedValue({ rows: mockPerks } as any);

      const result = await perksManager.getPerksForLevel(5);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_active = true')
      );
      expect(result).toEqual(mockPerks);
    });
  });

  describe('canUnlockPerk', () => {
    it('should always return false (perks are now draft-based)', async () => {
      // In the draft system, perks are chosen through the draft flow, not unlocked by level
      const result = await perksManager.canUnlockPerk(1, 2);
      expect(result).toBe(false);
    });

    it('should return false regardless of user level', async () => {
      const result = await perksManager.canUnlockPerk(999, 2);
      expect(result).toBe(false);
    });
  });

  describe('unlockPerk', () => {
    it('should always return false (perks are now draft-based)', async () => {
      // canUnlockPerk always returns false in draft system
      const result = await perksManager.unlockPerk(1, 2);
      expect(result).toBe(false);
    });
  });

  describe('activatePerk', () => {
    it('should activate perk unlocked by level', async () => {
      // Mock: perk exists and user level meets requirement
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 2, type: 'avatar', level_required: 1 }] } as any) // Level-based unlock check
        .mockResolvedValueOnce({ rows: [] } as any); // updateUserActiveSettings query

      // Mock updateUserActiveSettings
      jest.spyOn(perksManager as any, 'updateUserActiveSettings').mockResolvedValue(undefined);

      const result = await perksManager.activatePerk(1, 2, { selected_avatar: 'scientist' });

      expect(result).toBe(true);
      // First query should check perks with level_required
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('level_required'),
        [2, 1]
      );
    });

    it('should not activate perk when user level too low', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any); // Level requirement not met

      const result = await perksManager.activatePerk(1, 2);

      expect(result).toBe(false);
    });
  });

  describe('deactivatePerk', () => {
    it('should deactivate an active perk', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ type: 'avatar' }] } as any) // Perk exists check
        .mockResolvedValueOnce({ rows: [] } as any); // updateUserActiveSettings query

      jest.spyOn(perksManager as any, 'updateUserActiveSettings').mockResolvedValue(undefined);

      const result = await perksManager.deactivatePerk(1, 2);

      expect(result).toBe(true);
      // First query should check perks table
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT type FROM perks'),
        [2]
      );
    });

    it('should return false when perk not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await perksManager.deactivatePerk(1, 2);

      expect(result).toBe(false);
    });
  });

  describe('getUserLoadout', () => {
    it('should return user loadout with active perks', async () => {
      const mockUser = {
        active_avatar: 'scientist',
        active_badge: 'perk_1_bronze',
        active_theme: 'dark',
        active_title: null,
        perks_config: { helper: { perk_id: 5, configuration: { highlight_style: 'border' } } }
      };

      const mockActivePerks = [
        { id: 1, perk_id: 2, name: 'custom_avatars', is_active: true }
      ];

      mockDb.query.mockResolvedValue({ rows: [mockUser] } as any);
      jest.spyOn(perksManager, 'getActivePerks').mockResolvedValue(mockActivePerks as any);

      const result = await perksManager.getUserLoadout(1);

      expect(result).toEqual({
        user_id: 1,
        active_avatar: 'scientist',
        active_badge: 'perk_1_bronze',
        active_theme: 'dark',
        active_title: undefined,
        perks_config: mockUser.perks_config,
        active_perks: mockActivePerks,
        active_cosmetic_perks: {
          helper: { perk_id: 5, configuration: { highlight_style: 'border' } }
        }
      });
    });

    it('should return null when user not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await perksManager.getUserLoadout(999);

      expect(result).toBeNull();
    });
  });

  describe('checkAndUnlockPerksForLevel', () => {
    it('should return empty array (perks are now draft-based)', async () => {
      // In the draft system, perks are acquired through PerkDraftService, not level-based unlocking
      const result = await perksManager.checkAndUnlockPerksForLevel(1, 5);
      expect(result).toEqual([]);
    });

    it('should return empty array regardless of level', async () => {
      const result = await perksManager.checkAndUnlockPerksForLevel(1, 1);
      expect(result).toEqual([]);
    });
  });

  describe('validatePerkConfig', () => {
    it('should validate valid configuration object', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ config_schema: null }]
      } as any);

      const result = await perksManager.validatePerkConfig(1, { test: 'config' });

      expect(result.valid).toBe(true);
    });

    it('should reject null configuration', async () => {
      const result = await perksManager.validatePerkConfig(1, null);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Configuration must be a valid object');
    });

    it('should reject non-object configuration', async () => {
      const result = await perksManager.validatePerkConfig(1, 'string');

      expect(result.valid).toBe(false);
    });

    it('should validate enum fields', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          config_schema: {
            theme_name: {
              type: 'enum',
              options: ['default', 'dark', 'blue']
            }
          }
        }]
      } as any);

      const validResult = await perksManager.validatePerkConfig(1, { theme_name: 'dark' });
      expect(validResult.valid).toBe(true);

      const invalidResult = await perksManager.validatePerkConfig(1, { theme_name: 'invalid' });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors?.[0]).toContain('must be one of');
    });

    it('should validate range fields', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          config_schema: {
            volume: {
              type: 'range',
              min: 0,
              max: 100
            }
          }
        }]
      } as any);

      const validResult = await perksManager.validatePerkConfig(1, { volume: 50 });
      expect(validResult.valid).toBe(true);

      const tooHighResult = await perksManager.validatePerkConfig(1, { volume: 150 });
      expect(tooHighResult.valid).toBe(false);
      expect(tooHighResult.errors?.[0]).toContain('must be at most 100');
    });
  });

  describe('getPerksByCategory', () => {
    it('should return perks filtered by category ordered by tier', async () => {
      const mockPerks = [
        { id: 1, category: 'cosmetic', name: 'badge', level_required: 0 },
        { id: 2, category: 'cosmetic', name: 'avatar', level_required: 0 }
      ];

      mockDb.query.mockResolvedValue({ rows: mockPerks } as any);

      const result = await perksManager.getPerksByCategory('cosmetic');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE category = $1'),
        ['cosmetic']
      );
      expect(result).toEqual(mockPerks);
    });
  });

  describe('getUnlockedPerks', () => {
    it('should return perks unlocked by user level', async () => {
      const mockPerks = [
        { id: 1, name: 'time_cushion', category: 'time', type: 'gameplay', level_required: 1, effect_config: {}, updated_at: new Date(), title: 'Time Cushion', description: 'Extra time' }
      ];

      mockDb.query.mockResolvedValue({ rows: mockPerks } as any);

      const result = await perksManager.getUnlockedPerks(1);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('level_required'),
        [1]
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getActivePerks', () => {
    it('should return gameplay perks unlocked by user level', async () => {
      const mockPerks = [
        { id: 1, name: 'time_cushion', category: 'time', type: 'gameplay', level_required: 1, effect_config: {}, updated_at: new Date(), title: 'Time Cushion', description: 'Extra time' }
      ];

      mockDb.query.mockResolvedValue({ rows: mockPerks } as any);

      const result = await perksManager.getActivePerks(1);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('level_required'),
        [1]
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getAllPerks caching', () => {
    it('should return cached perks on second call without querying DB', async () => {
      const mockPerks = [
        { id: 1, name: 'badge_perk', category: 'cosmetic', type: 'badge', tier: 1, title: 'Badge' },
        { id: 2, name: 'avatar_perk', category: 'cosmetic', type: 'avatar', tier: 2, title: 'Avatar' }
      ];

      mockDb.query.mockResolvedValue({ rows: mockPerks } as any);

      const result1 = await perksManager.getAllPerks();
      const result2 = await perksManager.getAllPerks();

      // DB should only be called once — second call uses cache
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockPerks);
      expect(result2).toEqual(mockPerks);
    });

    it('should re-query DB after invalidateCache()', async () => {
      const mockPerks1 = [
        { id: 1, name: 'badge_perk', category: 'cosmetic', type: 'badge', tier: 1, title: 'Badge' }
      ];
      const mockPerks2 = [
        { id: 1, name: 'badge_perk', category: 'cosmetic', type: 'badge', tier: 1, title: 'Badge' },
        { id: 3, name: 'new_perk', category: 'cosmetic', type: 'theme', tier: 1, title: 'New' }
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: mockPerks1 } as any)
        .mockResolvedValueOnce({ rows: mockPerks2 } as any);

      const result1 = await perksManager.getAllPerks();
      expect(result1).toEqual(mockPerks1);

      perksManager.invalidateCache();

      const result2 = await perksManager.getAllPerks();
      expect(result2).toEqual(mockPerks2);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('getUserPerks', () => {
    it('should return all active perks mapped to UserPerk with is_unlocked based on user level', async () => {
      // First query: get user level
      mockDb.query.mockResolvedValueOnce({ rows: [{ level: 3 }] } as any);
      // Second query: get all active perks
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            perk_master_id: 10,
            perk_name: 'time_cushion',
            perk_category: 'time',
            perk_type: 'gameplay',
            perk_tier: 1,
            perk_title: 'Time Cushion',
            perk_description: 'Extra time on answers',
            perk_effect_type: 'bonus_time',
            perk_effect_config: { seconds: 5 },
            perk_asset_data: null,
            perk_level_required: 2,
            perk_created_at: new Date('2025-01-01'),
            perk_updated_at: new Date('2025-01-01')
          },
          {
            perk_master_id: 20,
            perk_name: 'advanced_perk',
            perk_category: 'scoring',
            perk_type: 'gameplay',
            perk_tier: 3,
            perk_title: 'Advanced Perk',
            perk_description: 'High level perk',
            perk_effect_type: 'score_boost',
            perk_effect_config: { multiplier: 2 },
            perk_asset_data: null,
            perk_level_required: 5,
            perk_created_at: new Date('2025-01-01'),
            perk_updated_at: new Date('2025-01-01')
          }
        ]
      } as any);

      const result = await perksManager.getUserPerks(1);

      expect(result).toHaveLength(2);
      // User level 3 >= perk_level_required 2 → unlocked
      expect(result[0]!.is_unlocked).toBe(true);
      expect(result[0]!.is_active).toBe(true);
      expect(result[0]!.perk_id).toBe(10);
      expect(result[0]!.user_id).toBe(1);
      expect(result[0]!.configuration).toEqual({ seconds: 5 });
      expect(result[0]!.perk?.name).toBe('time_cushion');
      // User level 3 < perk_level_required 5 → locked
      expect(result[1]!.is_unlocked).toBe(false);
      expect(result[1]!.is_active).toBe(false);
      expect(result[1]!.perk_id).toBe(20);
    });

    it('should default user level to 0 when no level row found', async () => {
      // First query: no user level found
      mockDb.query.mockResolvedValueOnce({ rows: [{}] } as any);
      // Second query: perk with level_required 0
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            perk_master_id: 5,
            perk_name: 'starter',
            perk_category: 'cosmetic',
            perk_type: 'badge',
            perk_tier: 1,
            perk_title: 'Starter',
            perk_description: 'First badge',
            perk_effect_type: null,
            perk_effect_config: null,
            perk_asset_data: null,
            perk_level_required: 0,
            perk_created_at: new Date('2025-01-01'),
            perk_updated_at: new Date('2025-01-01')
          }
        ]
      } as any);

      const result = await perksManager.getUserPerks(1);

      expect(result).toHaveLength(1);
      // level 0 >= level_required 0 → unlocked
      expect(result[0]!.is_unlocked).toBe(true);
      expect(result[0]!.configuration).toEqual({});
    });
  });

  describe('deactivatePerk with different types', () => {
    it('should clear perks_config slot for helper type', async () => {
      const existingConfig = { helper: { perk_id: 5, configuration: {} }, display: { perk_id: 6, configuration: {} } };

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ type: 'helper' }] } as any) // perk type lookup
        .mockResolvedValueOnce({ rows: [{ perks_config: existingConfig }] } as any) // read current config
        .mockResolvedValueOnce({ rows: [] } as any); // write updated config

      const result = await perksManager.deactivatePerk(1, 5);

      expect(result).toBe(true);
      // Verify the write query was called with helper removed from config
      const writeCall = mockDb.query.mock.calls[2]!;
      const writtenConfig = JSON.parse(writeCall[1]![1] as string);
      expect(writtenConfig).not.toHaveProperty('helper');
      expect(writtenConfig).toHaveProperty('display');
    });

    it('should clear perks_config slot for display type', async () => {
      const existingConfig = { display: { perk_id: 6, configuration: {} } };

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ type: 'display' }] } as any)
        .mockResolvedValueOnce({ rows: [{ perks_config: existingConfig }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await perksManager.deactivatePerk(1, 6);

      expect(result).toBe(true);
      const writeCall = mockDb.query.mock.calls[2]!;
      const writtenConfig = JSON.parse(writeCall[1]![1] as string);
      expect(writtenConfig).not.toHaveProperty('display');
    });

    it('should clear perks_config slot for emote type', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ type: 'emote' }] } as any)
        .mockResolvedValueOnce({ rows: [{ perks_config: { emote: { perk_id: 7 } } }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await perksManager.deactivatePerk(1, 7);

      expect(result).toBe(true);
    });

    it('should clear perks_config slot for sound type', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ type: 'sound' }] } as any)
        .mockResolvedValueOnce({ rows: [{ perks_config: { sound: { perk_id: 8 } } }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await perksManager.deactivatePerk(1, 8);

      expect(result).toBe(true);
    });

    it('should clear perks_config slot for multiplier type', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ type: 'multiplier' }] } as any)
        .mockResolvedValueOnce({ rows: [{ perks_config: { multiplier: { perk_id: 9 } } }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await perksManager.deactivatePerk(1, 9);

      expect(result).toBe(true);
    });

    it('should clear active_title column AND perks_config slot for title type', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ type: 'title' }] } as any) // perk type lookup
        .mockResolvedValueOnce({ rows: [] } as any) // UPDATE users SET active_title = NULL
        .mockResolvedValueOnce({ rows: [{ perks_config: { title: { perk_id: 10 } } }] } as any) // read perks_config
        .mockResolvedValueOnce({ rows: [] } as any); // write perks_config

      const result = await perksManager.deactivatePerk(1, 10);

      expect(result).toBe(true);
      // Verify active_title was set to NULL
      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE users SET active_title = NULL WHERE id = $1',
        [1]
      );
    });

    it('should reset badge to default via updateUserActiveSettings', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ type: 'badge' }] } as any) // perk type lookup
        .mockResolvedValueOnce({ rows: [] } as any); // UPDATE users SET active_badge

      const result = await perksManager.deactivatePerk(1, 11);

      expect(result).toBe(true);
      // Badge reset calls updateUserActiveSettings with default config { badge_style: 'classic' }
      // which builds value `perk_11_classic` and updates active_badge column
      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE users SET active_badge = $2 WHERE id = $1',
        [1, 'perk_11_classic']
      );
    });

    it('should reset theme to default via updateUserActiveSettings', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ type: 'theme' }] } as any) // perk type lookup
        .mockResolvedValueOnce({ rows: [] } as any); // UPDATE users SET active_theme

      const result = await perksManager.deactivatePerk(1, 12);

      expect(result).toBe(true);
      // Theme reset with default config { theme_name: 'default' }
      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE users SET active_theme = $2 WHERE id = $1',
        [1, 'default']
      );
    });
  });

  describe('getActiveCosmeticMultiplierPerkIds', () => {
    it('should return perk IDs from multiplier slot in perks_config', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ perks_config: { multiplier: { perk_id: 42, configuration: {} } } }]
      } as any);

      const result = await perksManager.getActiveCosmeticMultiplierPerkIds(1);

      expect(result).toEqual([42]);
    });

    it('should return empty array when no multiplier configured', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ perks_config: { helper: { perk_id: 5 } } }]
      } as any);

      const result = await perksManager.getActiveCosmeticMultiplierPerkIds(1);

      expect(result).toEqual([]);
    });

    it('should return empty array when user has no perks_config', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ perks_config: null }]
      } as any);

      const result = await perksManager.getActiveCosmeticMultiplierPerkIds(1);

      expect(result).toEqual([]);
    });

    it('should return empty array when user not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      const result = await perksManager.getActiveCosmeticMultiplierPerkIds(999);

      expect(result).toEqual([]);
    });
  });

  describe('getActiveCosmeticGameEffectPerkIds', () => {
    it('should return IDs from both multiplier and helper slots', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          perks_config: {
            multiplier: { perk_id: 42, configuration: {} },
            helper: { perk_id: 55, configuration: {} }
          }
        }]
      } as any);

      const result = await perksManager.getActiveCosmeticGameEffectPerkIds(1);

      expect(result).toEqual([42, 55]);
    });

    it('should return only multiplier ID when helper not configured', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ perks_config: { multiplier: { perk_id: 42 } } }]
      } as any);

      const result = await perksManager.getActiveCosmeticGameEffectPerkIds(1);

      expect(result).toEqual([42]);
    });

    it('should return only helper ID when multiplier not configured', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ perks_config: { helper: { perk_id: 55 } } }]
      } as any);

      const result = await perksManager.getActiveCosmeticGameEffectPerkIds(1);

      expect(result).toEqual([55]);
    });

    it('should return empty array when neither configured', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ perks_config: { display: { perk_id: 10 } } }]
      } as any);

      const result = await perksManager.getActiveCosmeticGameEffectPerkIds(1);

      expect(result).toEqual([]);
    });

    it('should return empty array when user not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      const result = await perksManager.getActiveCosmeticGameEffectPerkIds(999);

      expect(result).toEqual([]);
    });
  });

  describe('getCosmeticEffectConfigs', () => {
    it('should return config entries for configured slots', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          perks_config: {
            helper: { perk_id: 5, perk_name: 'smart_hints', configuration: { highlight_style: 'border' } },
            display: { perk_id: 6, perk_name: 'streak_display', configuration: { position: 'top-right' } },
            multiplier: { perk_id: 42, perk_name: 'xp_boost', configuration: { activation: 'automatic' } }
          },
          active_avatar: 'scientist',
          active_theme: 'dark',
          active_title: null
        }]
      } as any);

      const result = await perksManager.getCosmeticEffectConfigs(1);

      expect(result).toEqual({
        helper: { perk_id: 5, perk_name: 'smart_hints', configuration: { highlight_style: 'border' } },
        display: { perk_id: 6, perk_name: 'streak_display', configuration: { position: 'top-right' } },
        multiplier: { perk_id: 42, perk_name: 'xp_boost', configuration: { activation: 'automatic' } }
      });
    });

    it('should return empty object when user not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      const result = await perksManager.getCosmeticEffectConfigs(999);

      expect(result).toEqual({});
    });

    it('should return empty object when no slots configured', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          perks_config: {},
          active_avatar: 'student',
          active_theme: 'default',
          active_title: null
        }]
      } as any);

      const result = await perksManager.getCosmeticEffectConfigs(1);

      expect(result).toEqual({});
    });

    it('should skip slots without perk_id', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          perks_config: {
            helper: { configuration: {} }, // no perk_id
            sound: { perk_id: 8, configuration: { pack: 'retro' } }
          },
          active_avatar: 'student',
          active_theme: 'default',
          active_title: null
        }]
      } as any);

      const result = await perksManager.getCosmeticEffectConfigs(1);

      expect(result).toEqual({
        sound: { perk_id: 8, configuration: { pack: 'retro' } }
      });
    });
  });

  describe('validatePerkConfig additional branches', () => {
    it('should return error when perk not found in database', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await perksManager.validatePerkConfig(999, { test: 'config' });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Perk not found');
    });

    it('should validate required field and report missing', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          config_schema: {
            theme_name: {
              type: 'string',
              required: true
            }
          }
        }]
      } as any);

      const result = await perksManager.validatePerkConfig(1, {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'theme_name' is required");
    });

    it('should accept valid boolean field', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          config_schema: {
            show_effects: {
              type: 'boolean'
            }
          }
        }]
      } as any);

      const result = await perksManager.validatePerkConfig(1, { show_effects: true });

      expect(result.valid).toBe(true);
    });

    it('should reject invalid boolean field', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          config_schema: {
            show_effects: {
              type: 'boolean'
            }
          }
        }]
      } as any);

      const result = await perksManager.validatePerkConfig(1, { show_effects: 'yes' });

      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('must be a boolean');
    });

    it('should accept valid string field', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          config_schema: {
            label: {
              type: 'string'
            }
          }
        }]
      } as any);

      const result = await perksManager.validatePerkConfig(1, { label: 'My Label' });

      expect(result.valid).toBe(true);
    });

    it('should reject invalid string field', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          config_schema: {
            label: {
              type: 'string'
            }
          }
        }]
      } as any);

      const result = await perksManager.validatePerkConfig(1, { label: 42 });

      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('must be a string');
    });

    it('should reject NaN value for range field', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          config_schema: {
            volume: {
              type: 'range',
              min: 0,
              max: 100
            }
          }
        }]
      } as any);

      const result = await perksManager.validatePerkConfig(1, { volume: 'not-a-number' });

      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('must be a number');
    });

    it('should reject range field below min', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          config_schema: {
            volume: {
              type: 'range',
              min: 0,
              max: 100
            }
          }
        }]
      } as any);

      const result = await perksManager.validatePerkConfig(1, { volume: -5 });

      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('must be at least 0');
    });

    it('should use cached perk when available for validation', async () => {
      // Prime the cache first
      const mockPerks = [
        { id: 1, name: 'cached_perk', category: 'cosmetic', type: 'badge', tier: 1, title: 'Cached', config_schema: null }
      ];
      mockDb.query.mockResolvedValueOnce({ rows: mockPerks } as any);
      await perksManager.getAllPerks();

      // Now validate — should use cache, no additional DB query
      const result = await perksManager.validatePerkConfig(1, { test: 'value' });

      expect(result.valid).toBe(true);
      // Only 1 query total (the getAllPerks call)
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateUserActiveSettings via activatePerk', () => {
    it('should construct perk_{id}_{style} badge value on badge activation', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 15, type: 'badge', level_required: 1 }] } as any) // unlock check
        .mockResolvedValueOnce({ rows: [] } as any); // UPDATE users SET active_badge

      const result = await perksManager.activatePerk(1, 15, { badge_style: 'gold' });

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE users SET active_badge = $2 WHERE id = $1',
        [1, 'perk_15_gold']
      );
    });

    it('should use color fallback for badge when badge_style not provided', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 15, type: 'badge', level_required: 1 }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await perksManager.activatePerk(1, 15, { color: 'silver' });

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE users SET active_badge = $2 WHERE id = $1',
        [1, 'perk_15_silver']
      );
    });

    it('should extract theme_name on theme activation', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 20, type: 'theme', level_required: 1 }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await perksManager.activatePerk(1, 20, { theme_name: 'neon' });

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE users SET active_theme = $2 WHERE id = $1',
        [1, 'neon']
      );
    });

    it('should update active_title column AND perks_config on title activation', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 25, type: 'title', level_required: 1 }] } as any) // unlock check
        .mockResolvedValueOnce({ rows: [] } as any) // UPDATE users SET active_title
        .mockResolvedValueOnce({ rows: [{ name: 'quiz_master' }] } as any) // lookup perk name for perks_config
        .mockResolvedValueOnce({ rows: [{ perks_config: {} }] } as any) // read current perks_config
        .mockResolvedValueOnce({ rows: [] } as any); // write perks_config

      const result = await perksManager.activatePerk(1, 25, { title_text: 'Quiz Master' });

      expect(result).toBe(true);
      // active_title column set
      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE users SET active_title = $2 WHERE id = $1',
        [1, 'Quiz Master']
      );
    });

    it('should store helper perk in perks_config via updatePerksConfig', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 30, type: 'helper', level_required: 1 }] } as any) // unlock check
        .mockResolvedValueOnce({ rows: [{ name: 'smart_hints' }] } as any) // lookup perk name
        .mockResolvedValueOnce({ rows: [{ perks_config: {} }] } as any) // read current config
        .mockResolvedValueOnce({ rows: [] } as any); // write config

      const result = await perksManager.activatePerk(1, 30, { highlight_style: 'glow' });

      expect(result).toBe(true);
      // Verify the written perks_config has the helper slot
      const writeCall = mockDb.query.mock.calls[3]!;
      const writtenConfig = JSON.parse(writeCall[1]![1] as string);
      expect(writtenConfig.helper).toEqual({
        perk_id: 30,
        perk_name: 'smart_hints',
        configuration: { highlight_style: 'glow' }
      });
    });

    it('should store multiplier perk in perks_config via updatePerksConfig', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 35, type: 'multiplier', level_required: 1 }] } as any)
        .mockResolvedValueOnce({ rows: [{ name: 'xp_boost' }] } as any)
        .mockResolvedValueOnce({ rows: [{ perks_config: { helper: { perk_id: 30 } } }] } as any) // existing config
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await perksManager.activatePerk(1, 35, { activation: 'manual' });

      expect(result).toBe(true);
      const writeCall = mockDb.query.mock.calls[3]!;
      const writtenConfig = JSON.parse(writeCall[1]![1] as string);
      // Existing helper slot preserved
      expect(writtenConfig.helper).toEqual({ perk_id: 30 });
      // New multiplier slot added
      expect(writtenConfig.multiplier).toEqual({
        perk_id: 35,
        perk_name: 'xp_boost',
        configuration: { activation: 'manual' }
      });
    });

    it('should store sound perk in perks_config', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 40, type: 'sound', level_required: 0 }] } as any)
        .mockResolvedValueOnce({ rows: [{ name: 'retro_sounds' }] } as any)
        .mockResolvedValueOnce({ rows: [{ perks_config: {} }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await perksManager.activatePerk(1, 40, { pack: 'retro' });

      expect(result).toBe(true);
      const writeCall = mockDb.query.mock.calls[3]!;
      const writtenConfig = JSON.parse(writeCall[1]![1] as string);
      expect(writtenConfig.sound).toEqual({
        perk_id: 40,
        perk_name: 'retro_sounds',
        configuration: { pack: 'retro' }
      });
    });

    it('should store display perk in perks_config', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 45, type: 'display', level_required: 0 }] } as any)
        .mockResolvedValueOnce({ rows: [{ name: 'streak_display' }] } as any)
        .mockResolvedValueOnce({ rows: [{ perks_config: {} }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await perksManager.activatePerk(1, 45, { position: 'bottom-left' });

      expect(result).toBe(true);
      const writeCall = mockDb.query.mock.calls[3]!;
      const writtenConfig = JSON.parse(writeCall[1]![1] as string);
      expect(writtenConfig.display).toEqual({
        perk_id: 45,
        perk_name: 'streak_display',
        configuration: { position: 'bottom-left' }
      });
    });

    it('should store emote perk in perks_config', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 50, type: 'emote', level_required: 0 }] } as any)
        .mockResolvedValueOnce({ rows: [{ name: 'party_emotes' }] } as any)
        .mockResolvedValueOnce({ rows: [{ perks_config: {} }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await perksManager.activatePerk(1, 50, { emote_set: 'party' });

      expect(result).toBe(true);
      const writeCall = mockDb.query.mock.calls[3]!;
      const writtenConfig = JSON.parse(writeCall[1]![1] as string);
      expect(writtenConfig.emote).toEqual({
        perk_id: 50,
        perk_name: 'party_emotes',
        configuration: { emote_set: 'party' }
      });
    });
  });
});
