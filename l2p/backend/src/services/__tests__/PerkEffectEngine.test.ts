import { PerkEffectEngine } from '../PerkEffectEngine.js';

describe('PerkEffectEngine', () => {
  describe('applyEndGameBonuses', () => {
    it('should add perfectGameBonus for perfect games', () => {
      const modifiers = PerkEffectEngine.getDefaultModifiers();
      modifiers.perfectGameBonus = 500;
      const result = PerkEffectEngine.applyEndGameBonuses(1000, modifiers, {
        correctAnswers: 10,
        totalQuestions: 10,
      });
      expect(result).toBe(1500);
    });

    it('should NOT add bonus for imperfect games', () => {
      const modifiers = PerkEffectEngine.getDefaultModifiers();
      modifiers.perfectGameBonus = 500;
      const result = PerkEffectEngine.applyEndGameBonuses(1000, modifiers, {
        correctAnswers: 9,
        totalQuestions: 10,
      });
      expect(result).toBe(1000);
    });

    it('should return base score when no bonus configured', () => {
      const modifiers = PerkEffectEngine.getDefaultModifiers();
      const result = PerkEffectEngine.applyEndGameBonuses(1000, modifiers, {
        correctAnswers: 10,
        totalQuestions: 10,
      });
      expect(result).toBe(1000);
    });
  });
});
