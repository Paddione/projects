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
    it('should return all active perks ordered by level', async () => {
      const mockPerks = [
        { id: 1, name: 'starter_badge', category: 'cosmetic', type: 'badge', level_required: 3, title: 'Starter Badge' },
        { id: 2, name: 'custom_avatars', category: 'cosmetic', type: 'avatar', level_required: 5, title: 'Character Collection' }
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
    it('should return perks available for specified level', async () => {
      const mockPerks = [
        { id: 1, name: 'starter_badge', level_required: 3 },
        { id: 2, name: 'custom_avatars', level_required: 5 }
      ];

      mockDb.query.mockResolvedValue({ rows: mockPerks } as any);

      const result = await perksManager.getPerksForLevel(5);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE level_required <= $1'),
        [5]
      );
      expect(result).toEqual(mockPerks);
    });
  });

  describe('canUnlockPerk', () => {
    it('should return true when user level meets requirement and perk not unlocked', async () => {
      // Mock user level
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ character_level: 5 }] } as any) // User query
        .mockResolvedValueOnce({ rows: [{ level_required: 5 }] } as any) // Perk query
        .mockResolvedValueOnce({ rows: [] } as any); // Already unlocked check

      const result = await perksManager.canUnlockPerk(1, 2);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });

    it('should return false when user level is too low', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ character_level: 3 }] } as any) // User query
        .mockResolvedValueOnce({ rows: [{ level_required: 5 }] } as any) // Perk query
        .mockResolvedValueOnce({ rows: [] } as any); // Already unlocked check

      const result = await perksManager.canUnlockPerk(1, 2);

      expect(result).toBe(false);
    });

    it('should return false when perk already unlocked', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ character_level: 5 }] } as any) // User query
        .mockResolvedValueOnce({ rows: [{ level_required: 5 }] } as any) // Perk query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any); // Already unlocked

      const result = await perksManager.canUnlockPerk(1, 2);

      expect(result).toBe(false);
    });

    it('should return false when user does not exist', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any); // User not found

      const result = await perksManager.canUnlockPerk(999, 2);

      expect(result).toBe(false);
    });

    it('should return false when perk does not exist', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ character_level: 5 }] } as any) // User query
        .mockResolvedValueOnce({ rows: [] } as any); // Perk not found

      const result = await perksManager.canUnlockPerk(1, 999);

      expect(result).toBe(false);
    });
  });

  describe('unlockPerk', () => {
    it('should unlock perk when requirements are met', async () => {
      // Mock canUnlockPerk to return true
      jest.spyOn(perksManager as any, 'canUnlockPerk').mockResolvedValue(true);
      
      mockDb.query.mockResolvedValue({ rows: [{ id: 1 }] } as any);

      const result = await perksManager.unlockPerk(1, 2);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_perks'),
        [1, 2]
      );
    });

    it('should not unlock perk when requirements are not met', async () => {
      jest.spyOn(perksManager as any, 'canUnlockPerk').mockResolvedValue(false);

      const result = await perksManager.unlockPerk(1, 2);

      expect(result).toBe(false);
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('activatePerk', () => {
    it('should activate unlocked perk', async () => {
      // Mock perk is unlocked
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any) // Unlocked check
        .mockResolvedValueOnce({ rows: [{ type: 'avatar' }] } as any) // Perk type
        .mockResolvedValueOnce({ rows: [] } as any) // Deactivate others
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any) // Activate perk
        .mockResolvedValueOnce({ rows: [] } as any); // Update user settings

      // Mock updateUserActiveSettings
      jest.spyOn(perksManager as any, 'updateUserActiveSettings').mockResolvedValue(undefined);

      const result = await perksManager.activatePerk(1, 2, { selected_avatar: 'scientist' });

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_perks'),
        [1, 2, JSON.stringify({ selected_avatar: 'scientist' })]
      );
    });

    it('should not activate locked perk', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any); // Not unlocked

      const result = await perksManager.activatePerk(1, 2);

      expect(result).toBe(false);
    });

    it('should deactivate other perks of same type', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any) // Unlocked check
        .mockResolvedValueOnce({ rows: [{ type: 'avatar' }] } as any) // Perk type
        .mockResolvedValueOnce({ rows: [] } as any) // Deactivate others
        .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any) // Activate perk
        .mockResolvedValueOnce({ rows: [] } as any); // Update user settings

      jest.spyOn(perksManager as any, 'updateUserActiveSettings').mockResolvedValue(undefined);

      await perksManager.activatePerk(1, 2);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_perks SET is_active = false'),
        [1, 'avatar']
      );
    });
  });

  describe('deactivatePerk', () => {
    it('should deactivate perk', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 1 }] } as any);

      const result = await perksManager.deactivatePerk(1, 2);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SET is_active = false'),
        [1, 2]
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
        perks_config: { test: 'config' }
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
        perks_config: { test: 'config' },
        active_perks: mockActivePerks
      });
    });

    it('should return null when user not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await perksManager.getUserLoadout(999);

      expect(result).toBeNull();
    });
  });

  describe('checkAndUnlockPerksForLevel', () => {
    it('should unlock perks available for new level with batch insert', async () => {
      const mockAvailablePerks = [
        { id: 1, type: 'badge', name: 'starter_badge', title: 'Starter Badge', description: 'First badge', category: 'cosmetic', level_required: 3, asset_data: {} },
        { id: 2, type: 'avatar', name: 'custom_avatars', title: 'Custom Avatars', description: 'Avatar perks', category: 'cosmetic', level_required: 5, asset_data: {} }
      ];

      const mockInsertResult = [
        { id: 101, user_id: 1, perk_id: 1, is_unlocked: true, is_active: false, configuration: {}, unlocked_at: new Date(), updated_at: new Date() },
        { id: 102, user_id: 1, perk_id: 2, is_unlocked: true, is_active: false, configuration: {}, unlocked_at: new Date(), updated_at: new Date() }
      ];

      // First call returns available perks, second call returns inserted user_perks
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ legacy_user_id: 1 }] } as any)
        .mockResolvedValueOnce({ rows: mockAvailablePerks } as any)
        .mockResolvedValueOnce({ rows: mockInsertResult } as any);

      jest.spyOn(perksManager, 'activatePerk').mockResolvedValue(true);

      const result = await perksManager.checkAndUnlockPerksForLevel(1, 5);

      expect(result).toHaveLength(2);
      expect(result[0].perk_id).toBe(1);
      expect(result[1].perk_id).toBe(2);
      // Should auto-activate non-badge perks (avatar but not badge)
      expect(perksManager.activatePerk).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no perks to unlock', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ legacy_user_id: 1 }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

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
    it('should return perks filtered by category', async () => {
      const mockPerks = [
        { id: 1, category: 'cosmetic', name: 'badge' },
        { id: 2, category: 'cosmetic', name: 'avatar' }
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
    it('should return only unlocked perks for user', async () => {
      const mockPerks = [
        { id: 1, user_id: 1, perk_id: 2, is_unlocked: true, name: 'custom_avatars' }
      ];

      mockDb.query.mockResolvedValue({ rows: mockPerks } as any);

      const result = await perksManager.getUnlockedPerks(1);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND up.is_unlocked = true'),
        [1]
      );
      expect(result).toEqual(mockPerks);
    });
  });

  describe('getActivePerks', () => {
    it('should return only active perks for user', async () => {
      const mockPerks = [
        { id: 1, user_id: 1, perk_id: 2, is_unlocked: true, is_active: true, name: 'custom_avatars' }
      ];

      mockDb.query.mockResolvedValue({ rows: mockPerks } as any);

      const result = await perksManager.getActivePerks(1);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND up.is_active = true'),
        [1]
      );
      expect(result).toEqual(mockPerks);
    });
  });
});
