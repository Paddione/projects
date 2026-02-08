import { apiService } from '../apiService';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ApiService Perks Methods', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the request method to use our token
    (apiService as any).token = mockToken;
    (apiService as any).setMockMode(false);
  });

  afterAll(() => {
    (apiService as any).setMockMode(null);
  });

  describe('getAllPerks', () => {
    it('should fetch all available perks', async () => {
      const mockPerks = [
        {
          id: 1,
          name: 'starter_badge',
          category: 'cosmetic',
          type: 'badge',
          level_required: 5,
          title: 'Starter Badge',
          description: 'Your first badge',
          is_active: true
        }
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockPerks
        })
      });

      const result = await apiService.getAllPerks();

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/perks/all', {
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPerks);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          message: 'Failed to fetch perks'
        })
      });

      const result = await apiService.getAllPerks();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch perks');
    });
  });

  describe('getUserPerks', () => {
    it('should fetch user perks data', async () => {
      const mockUserPerks = {
        perks: [
          {
            id: 1,
            user_id: 1,
            perk_id: 1,
            is_unlocked: true,
            is_active: false,
            configuration: {},
            perk: {
              id: 1,
              name: 'starter_badge',
              title: 'Starter Badge'
            }
          }
        ],
        activePerks: [],
        loadout: {
          user_id: 1,
          active_avatar: 'student',
          active_theme: 'default',
          perks_config: {},
          active_perks: []
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockUserPerks
        })
      });

      const result = await apiService.getUserPerks();

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/perks/user', {
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUserPerks);
    });
  });

  describe('unlockPerk', () => {
    it('should unlock a perk', async () => {
      const perkId = 123;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Perk unlocked successfully'
        })
      });

      const result = await apiService.unlockPerk(perkId);

      expect(mockFetch).toHaveBeenCalledWith(`http://localhost:3001/api/perks/unlock/${perkId}`, {
        credentials: 'include',
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        }
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Perk unlocked successfully');
      expect(result.data).toMatchObject({ success: true, message: 'Perk unlocked successfully' });
    });

    it('should handle unlock errors', async () => {
      const perkId = 123;

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          message: 'Cannot unlock this perk'
        })
      });

      const result = await apiService.unlockPerk(perkId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot unlock this perk');
    });
  });

  describe('activatePerk', () => {
    it('should activate a perk with configuration', async () => {
      const perkId = 123;
      const configuration = { selected_avatar: 'scientist' };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Perk activated successfully'
        })
      });

      const result = await apiService.activatePerk(perkId, configuration);

      expect(mockFetch).toHaveBeenCalledWith(`http://localhost:3001/api/perks/activate/${perkId}`, {
        credentials: 'include',
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
        body: JSON.stringify({ configuration })
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Perk activated successfully');
      expect(result.data).toMatchObject({ success: true, message: 'Perk activated successfully' });
    });

    it('should activate a perk with default empty configuration', async () => {
      const perkId = 123;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Perk activated successfully'
        })
      });

      const result = await apiService.activatePerk(perkId);

      expect(mockFetch).toHaveBeenCalledWith(`http://localhost:3001/api/perks/activate/${perkId}`, {
        credentials: 'include',
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
        body: JSON.stringify({ configuration: {} })
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Perk activated successfully');
    });

    it('should handle activation errors', async () => {
      const perkId = 123;

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          message: 'Cannot activate perk'
        })
      });

      const result = await apiService.activatePerk(perkId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot activate perk');
    });
  });

  describe('deactivatePerk', () => {
    it('should deactivate a perk', async () => {
      const perkId = 123;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Perk deactivated successfully'
        })
      });

      const result = await apiService.deactivatePerk(perkId);

      expect(mockFetch).toHaveBeenCalledWith(`http://localhost:3001/api/perks/deactivate/${perkId}`, {
        credentials: 'include',
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        }
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Perk deactivated successfully');
    });

    it('should handle deactivation errors', async () => {
      const perkId = 123;

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          message: 'Perk not found'
        })
      });

      const result = await apiService.deactivatePerk(perkId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Perk not found');
    });
  });

  describe('getUserLoadout', () => {
    it('should fetch user loadout', async () => {
      const mockLoadout = {
        user_id: 1,
        active_avatar: 'scientist',
        active_badge: 'perk_1_gold',
        active_theme: 'dark',
        perks_config: { theme: 'dark' },
        active_perks: []
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockLoadout
        })
      });

      const result = await apiService.getUserLoadout();

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/perks/loadout', {
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockLoadout);
    });

    it('should handle loadout not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          message: 'User loadout not found'
        })
      });

      const result = await apiService.getUserLoadout();

      expect(result.success).toBe(false);
      expect(result.error).toBe('User loadout not found');
    });
  });

  describe('getPerksByCategory', () => {
    it('should fetch perks by category', async () => {
      const category = 'cosmetic';
      const mockPerks = [
        {
          id: 1,
          name: 'badge_perk',
          category: 'cosmetic',
          type: 'badge',
          title: 'Badge Perk'
        },
        {
          id: 2,
          name: 'avatar_perk',
          category: 'cosmetic',
          type: 'avatar',
          title: 'Avatar Perk'
        }
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockPerks
        })
      });

      const result = await apiService.getPerksByCategory(category);

      expect(mockFetch).toHaveBeenCalledWith(`http://localhost:3001/api/perks/category/${category}`, {
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPerks);
    });
  });

  describe('checkPerkUnlocks', () => {
    it('should check for newly unlocked perks', async () => {
      const mockUnlocks = {
        newlyUnlocked: [
          {
            id: 1,
            user_id: 1,
            perk_id: 1,
            is_unlocked: true,
            perk: {
              id: 1,
              name: 'new_badge',
              title: 'New Badge'
            }
          }
        ],
        totalUnlocked: 1
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockUnlocks,
          message: '1 new perks unlocked!'
        })
      });

      const result = await apiService.checkPerkUnlocks();

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/perks/check-unlocks', {
        credentials: 'include',
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUnlocks);
      expect(result.message).toBe('1 new perks unlocked!');
    });

    it('should handle no new unlocks', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            newlyUnlocked: [],
            totalUnlocked: 0
          },
          message: '0 new perks unlocked!'
        })
      });

      const result = await apiService.checkPerkUnlocks();

      expect(result.data?.newlyUnlocked).toEqual([]);
      expect(result.data?.totalUnlocked).toBe(0);
    });
  });

  describe('Network Error Handling', () => {
    it('should handle network errors for getAllPerks', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await apiService.getAllPerks();

      expect(result).toEqual({
        success: false,
        error: 'Network error'
      });
    });

    it('should handle network errors for activatePerk', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await apiService.activatePerk(123);

      expect(result).toEqual({
        success: false,
        error: 'Connection refused'
      });
    });
  });

  describe('Response Parsing Errors', () => {
    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      const result = await apiService.getAllPerks();

      expect(result).toEqual({
        success: false,
        error: 'Invalid JSON'
      });
    });
  });
});
