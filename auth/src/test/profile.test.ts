import { describe, it, expect } from 'vitest';
import { ProfileService } from '../services/ProfileService.js';

describe('ProfileService', () => {
  describe('calculateLevel', () => {
    it('should return level 1 for 0 XP', () => {
      expect(ProfileService.calculateLevel(0)).toBe(1);
    });

    it('should return level 1 for negative XP', () => {
      expect(ProfileService.calculateLevel(-100)).toBe(1);
    });

    it('should return level 1 for small XP amounts', () => {
      expect(ProfileService.calculateLevel(100)).toBe(1);
    });

    it('should increase with XP', () => {
      expect(ProfileService.calculateLevel(10000)).toBeGreaterThan(1);
    });

    it('should increase monotonically', () => {
      let prevLevel = 1;
      for (const xp of [0, 500, 1000, 5000, 10000, 50000, 100000]) {
        const level = ProfileService.calculateLevel(xp);
        expect(level).toBeGreaterThanOrEqual(prevLevel);
        prevLevel = level;
      }
    });

    it('should cap at 100', () => {
      expect(ProfileService.calculateLevel(999999999)).toBe(100);
    });

    it('should return level 2 at 500 XP', () => {
      // At exactly 500 XP: floor(pow(1, 1/1.8)) + 1 = floor(1) + 1 = 2
      expect(ProfileService.calculateLevel(500)).toBe(2);
    });
  });

  // Database-dependent tests — require a running PostgreSQL instance
  describe('getOrCreateProfile', () => {
    it.todo('should create a new profile with defaults for a new user');
    it.todo('should return existing profile for a returning user');
    it.todo('should create an empty loadout alongside the profile');
  });

  describe('updateCharacter', () => {
    it.todo('should update selected character and gender');
    it.todo('should update the updated_at timestamp');
    it.todo('should create profile first if it does not exist');
  });

  describe('updateLoadout', () => {
    it.todo('should insert a new loadout if none exists');
    it.todo('should update only provided fields on conflict');
    it.todo('should preserve existing fields when partially updating');
  });

  describe('getProfileWithLoadout', () => {
    it.todo('should return profile, loadout, and inventory together');
    it.todo('should return empty inventory array when user has no items');
    it.todo('should create profile and loadout if they do not exist');
  });

  describe('awardXp', () => {
    it.todo('should increment XP atomically');
    it.todo('should recalculate level after awarding XP');
    it.todo('should not exceed level 100');
  });
});
