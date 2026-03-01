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

  describe('extractInfoEffects', () => {
    it('should return empty object when no info perks are active', () => {
      const modifiers = PerkEffectEngine.getDefaultModifiers();
      const effects = PerkEffectEngine.extractInfoEffects(modifiers);
      expect(effects).toEqual({});
    });

    it('should include showCategory when true', () => {
      const modifiers = PerkEffectEngine.getDefaultModifiers();
      modifiers.showCategory = true;
      const effects = PerkEffectEngine.extractInfoEffects(modifiers);
      expect(effects).toEqual({ showCategory: true });
    });

    it('should include showDifficulty when true', () => {
      const modifiers = PerkEffectEngine.getDefaultModifiers();
      modifiers.showDifficulty = true;
      const effects = PerkEffectEngine.extractInfoEffects(modifiers);
      expect(effects).toEqual({ showDifficulty: true });
    });

    it('should include showAnswerStats when true', () => {
      const modifiers = PerkEffectEngine.getDefaultModifiers();
      modifiers.showAnswerStats = true;
      const effects = PerkEffectEngine.extractInfoEffects(modifiers);
      expect(effects).toEqual({ showAnswerStats: true });
    });

    it('should include all info effects when all are active', () => {
      const modifiers = PerkEffectEngine.getDefaultModifiers();
      modifiers.showCategory = true;
      modifiers.showDifficulty = true;
      modifiers.showAnswerStats = true;
      const effects = PerkEffectEngine.extractInfoEffects(modifiers);
      expect(effects).toEqual({
        showCategory: true,
        showDifficulty: true,
        showAnswerStats: true,
      });
    });

    it('should include only active info effects (mixed)', () => {
      const modifiers = PerkEffectEngine.getDefaultModifiers();
      modifiers.showCategory = true;
      modifiers.showDifficulty = false;
      modifiers.showAnswerStats = true;
      const effects = PerkEffectEngine.extractInfoEffects(modifiers);
      expect(effects).toEqual({
        showCategory: true,
        showAnswerStats: true,
      });
    });

    it('should work with modifiers built from perks', () => {
      const modifiers = PerkEffectEngine.buildModifiers([
        {
          id: 1,
          name: 'Category Reveal',
          description: 'Shows the question category',
          category: 'information',
          type: 'gameplay',
          title: 'Category Reveal',
          tier: 1,
          effect_type: 'show_category',
          effect_config: { showDifficulty: true },
        },
      ]);
      const effects = PerkEffectEngine.extractInfoEffects(modifiers);
      expect(effects).toEqual({
        showCategory: true,
        showDifficulty: true,
      });
    });
  });
});
