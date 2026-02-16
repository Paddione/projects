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
});
