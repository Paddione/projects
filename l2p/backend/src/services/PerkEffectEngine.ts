import { DraftPerk } from './PerkDraftService.js';

export interface GameplayModifiers {
  // Time perks
  bonusSeconds: number;
  timerSpeedMultiplier: number;
  speedThresholdSeconds: number;
  speedBonusPoints: number;

  // Scoring perks
  baseScoreMultiplier: number;
  maxStreakMultiplier: number;
  streakGrowthRate: number;
  speedBonusMultiplier: number;
  perfectGameBonus: number;
  closerBonusPercentage: number;
  lastQuestionsCount: number;

  // Recovery perks
  freeWrongAnswers: number;
  partialCreditRate: number;
  bounceBackBonus: number;
  baseMultiplier: number;
  comebackThreshold: number;
  comebackMultiplier: number;
  phoenixThreshold: number;
  phoenixMultiplier: number;

  // Information perks
  eliminateWrongUses: number;
  eliminateWrongCount: number;
  showCategory: boolean;
  showDifficulty: boolean;
  showHint: boolean;
  hintUsesPerGame: number;
  showAnswerStats: boolean;

  // XP perks
  xpMultiplier: number;
  studyBonusRate: number;
  completionBonus: number;
  accuracyThreshold: number;
  accuracyXpBonus: number;
  streakXpPerStreak: number;
  maxStreakXp: number;
  masteryXpBonus: number;
  masteryPerfectRequired: boolean;
}

export interface ScoreContext {
  questionIndex: number;
  totalQuestions: number;
  playerAccuracy: number;
  wrongAnswersUsed: number;
  lastWrongStreak: number;
  isLastWrong: boolean;
}

export class PerkEffectEngine {
  /**
   * Build modifiers from a list of active perks
   */
  static buildModifiers(activePerks: DraftPerk[]): GameplayModifiers {
    const m = PerkEffectEngine.getDefaultModifiers();

    for (const perk of activePerks) {
      const config = perk.effect_config || {};

      switch (perk.effect_type) {
        // Time
        case 'bonus_seconds':
          m.bonusSeconds += config.bonusSeconds || 0;
          break;
        case 'timer_speed':
          m.timerSpeedMultiplier *= config.timerSpeedMultiplier || 1;
          break;
        case 'speed_threshold':
          // Use the best (most generous) speed threshold bonus
          if ((config.speedBonusPoints || 0) > m.speedBonusPoints) {
            m.speedThresholdSeconds = config.speedThresholdSeconds || 0;
            m.speedBonusPoints = config.speedBonusPoints || 0;
          }
          break;

        // Scoring
        case 'base_score_multiplier':
          m.baseScoreMultiplier *= config.baseScoreMultiplier || 1;
          break;
        case 'max_streak_multiplier':
          m.maxStreakMultiplier = Math.max(m.maxStreakMultiplier, config.maxStreakMultiplier || 5);
          if (config.streakGrowthRate) {
            m.streakGrowthRate = Math.max(m.streakGrowthRate, config.streakGrowthRate);
          }
          break;
        case 'streak_growth':
          m.streakGrowthRate = Math.max(m.streakGrowthRate, config.streakGrowthRate || 1);
          break;
        case 'speed_bonus_multiplier':
          m.speedBonusMultiplier *= config.speedBonusMultiplier || 1;
          break;
        case 'perfect_bonus':
          m.perfectGameBonus += config.perfectGameBonus || 0;
          break;
        case 'closer_bonus':
          m.closerBonusPercentage = Math.max(m.closerBonusPercentage, config.closerBonusPercentage || 0);
          m.lastQuestionsCount = Math.max(m.lastQuestionsCount, config.lastQuestionsCount || 0);
          break;

        // Recovery
        case 'free_wrong_answers':
          m.freeWrongAnswers += config.freeWrongAnswers || 0;
          if (config.partialCreditRate) {
            m.partialCreditRate = Math.max(m.partialCreditRate, config.partialCreditRate);
          }
          break;
        case 'partial_credit':
          m.partialCreditRate = Math.max(m.partialCreditRate, config.partialCreditRate || 0);
          break;
        case 'bounce_back':
          m.bounceBackBonus += config.bounceBackBonus || 0;
          break;
        case 'base_multiplier':
          m.baseMultiplier = Math.max(m.baseMultiplier, config.baseMultiplier || 1);
          break;
        case 'comeback':
          m.comebackThreshold = config.comebackThreshold || 0.5;
          m.comebackMultiplier = Math.max(m.comebackMultiplier, config.comebackMultiplier || 1);
          break;
        case 'phoenix':
          m.phoenixThreshold = config.phoenixThreshold || 3;
          m.phoenixMultiplier = Math.max(m.phoenixMultiplier, config.phoenixMultiplier || 1);
          break;

        // Information
        case 'eliminate_wrong':
          m.eliminateWrongCount = Math.max(m.eliminateWrongCount, config.eliminateCount || 0);
          m.eliminateWrongUses += config.usesPerGame || 0;
          break;
        case 'show_category':
          m.showCategory = true;
          if (config.showDifficulty) m.showDifficulty = true;
          break;
        case 'show_difficulty':
          m.showDifficulty = true;
          break;
        case 'show_hint':
          m.showHint = true;
          m.hintUsesPerGame += config.usesPerGame || 0;
          break;
        case 'show_answer_stats':
          m.showAnswerStats = true;
          break;

        // XP
        case 'xp_multiplier':
          m.xpMultiplier *= config.xpMultiplier || 1;
          break;
        case 'study_bonus':
          m.studyBonusRate += config.studyBonusRate || 0;
          break;
        case 'completion_bonus':
          m.completionBonus += config.completionBonus || 0;
          break;
        case 'accuracy_xp':
          m.accuracyThreshold = config.accuracyThreshold || 0.8;
          m.accuracyXpBonus += config.accuracyXpBonus || 0;
          break;
        case 'streak_xp':
          m.streakXpPerStreak += config.streakXpPerStreak || 0;
          m.maxStreakXp += config.maxStreakXp || 0;
          break;
        case 'mastery_xp':
          m.masteryXpBonus += config.masteryXpBonus || 0;
          m.masteryPerfectRequired = config.perfectRequired ?? true;
          break;
      }
    }

    return m;
  }

  /**
   * Get default (neutral) modifiers — no perk effects
   */
  static getDefaultModifiers(): GameplayModifiers {
    return {
      bonusSeconds: 0,
      timerSpeedMultiplier: 1.0,
      speedThresholdSeconds: 0,
      speedBonusPoints: 0,

      baseScoreMultiplier: 1.0,
      maxStreakMultiplier: 5,
      streakGrowthRate: 1.0,
      speedBonusMultiplier: 1.0,
      perfectGameBonus: 0,
      closerBonusPercentage: 0,
      lastQuestionsCount: 0,

      freeWrongAnswers: 0,
      partialCreditRate: 0,
      bounceBackBonus: 0,
      baseMultiplier: 1.0,
      comebackThreshold: 0,
      comebackMultiplier: 1.0,
      phoenixThreshold: 0,
      phoenixMultiplier: 1.0,

      eliminateWrongUses: 0,
      eliminateWrongCount: 0,
      showCategory: false,
      showDifficulty: false,
      showHint: false,
      hintUsesPerGame: 0,
      showAnswerStats: false,

      xpMultiplier: 1.0,
      studyBonusRate: 0,
      completionBonus: 0,
      accuracyThreshold: 0,
      accuracyXpBonus: 0,
      streakXpPerStreak: 0,
      maxStreakXp: 0,
      masteryXpBonus: 0,
      masteryPerfectRequired: true,
    };
  }

  /**
   * Extract INFO perk flags from modifiers for per-player perk effects.
   * Returns only the active (truthy) info flags, e.g. { showCategory: true }.
   */
  static extractInfoEffects(modifiers: GameplayModifiers): Record<string, boolean> {
    const effects: Record<string, boolean> = {};
    if (modifiers.showCategory) effects.showCategory = true;
    if (modifiers.showDifficulty) effects.showDifficulty = true;
    if (modifiers.showAnswerStats) effects.showAnswerStats = true;
    return effects;
  }

  /**
   * Apply end-game score bonuses (e.g. perfectionist perk).
   * Must be called BEFORE XP calculation so the bonus feeds into XP too.
   */
  static applyEndGameBonuses(
    baseScore: number,
    modifiers: GameplayModifiers,
    context: { correctAnswers: number; totalQuestions: number }
  ): number {
    let score = baseScore;
    if (modifiers.perfectGameBonus > 0 && context.correctAnswers === context.totalQuestions) {
      score += modifiers.perfectGameBonus;
    }
    return score;
  }

  /**
   * Calculate modified XP at game end
   */
  static calculateModifiedXP(
    baseXP: number,
    modifiers: GameplayModifiers,
    context: {
      accuracy: number;
      isPerfect: boolean;
      uniqueSetCount: number;
      maxStreak: number;
    }
  ): number {
    let xp = baseXP;

    // Apply XP multiplier
    xp *= modifiers.xpMultiplier;

    // Completion bonus
    xp += modifiers.completionBonus;

    // Study bonus (per unique set)
    xp += baseXP * modifiers.studyBonusRate * context.uniqueSetCount;

    // Accuracy XP bonus
    if (modifiers.accuracyThreshold > 0 && context.accuracy >= modifiers.accuracyThreshold) {
      xp += modifiers.accuracyXpBonus;
    }

    // Streak XP
    if (modifiers.streakXpPerStreak > 0) {
      const streakXp = Math.min(
        context.maxStreak * modifiers.streakXpPerStreak,
        modifiers.maxStreakXp
      );
      xp += streakXp;
    }

    // Mastery XP
    if (modifiers.masteryXpBonus > 0 && (!modifiers.masteryPerfectRequired || context.isPerfect)) {
      xp += modifiers.masteryXpBonus;
    }

    return Math.round(xp);
  }
}
