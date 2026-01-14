import { CharacterData, CharStats } from "../types";
import {
  CLASS_BREAKPOINTS,
  RESISTANCE_THRESHOLDS,
  STAT_PRIORITIES,
  findBreakpointTier,
  Breakpoint,
} from "../data/breakpoints";

export interface ResistanceAnalysis {
  fire: { current: number; max: number; capped: boolean; deficit: number };
  cold: { current: number; max: number; capped: boolean; deficit: number };
  lightning: {
    current: number;
    max: number;
    capped: boolean;
    deficit: number;
  };
  poison: { current: number; max: number; capped: boolean; deficit: number };
  allCapped: boolean;
  totalDeficit: number;
}

export interface BreakpointAnalysis {
  ias: {
    current: number;
    tier: Breakpoint;
    next: Breakpoint | null;
    progress: number;
    toNextBreakpoint: number;
  };
  fcr: {
    current: number;
    tier: Breakpoint;
    next: Breakpoint | null;
    progress: number;
    toNextBreakpoint: number;
  };
  fhr: {
    current: number;
    tier: Breakpoint;
    next: Breakpoint | null;
    progress: number;
    toNextBreakpoint: number;
  };
}

export interface StatAnalysis {
  strength: number;
  dexterity: number;
  vitality: number;
  energy: number;
  life: number;
  mana: number;
}

export interface ItemUsageComparison {
  itemName: string;
  slot?: string;
  metaUsagePercent: number;
  isMetaChoice: boolean;
}

export interface Recommendation {
  priority: "critical" | "high" | "medium" | "low";
  category:
    | "resistances"
    | "breakpoints"
    | "gear"
    | "stats"
    | "skills"
    | "general";
  title: string;
  description: string;
  specificItems?: string[];
  impact: string;
}

export interface BuildOptimization {
  characterName: string;
  className: string;
  level: number;
  resistances: ResistanceAnalysis;
  breakpoints: BreakpointAnalysis;
  stats: StatAnalysis;
  itemComparison?: ItemUsageComparison[];
  recommendations: Recommendation[];
  overallScore: number; // 0-100
  strengths: string[];
  weaknesses: string[];
}

export default class BuildOptimizer {
  private character: CharacterData;
  private stats: CharStats;
  private className: string;

  constructor(character: CharacterData, stats: CharStats) {
    this.character = character;
    this.stats = stats;
    this.className = this.normalizeClassName(character.character.class.name);
  }

  private normalizeClassName(className: string): string {
    const normalized = className.toLowerCase().trim();
    const classMap: Record<string, string> = {
      amazon: "Amazon",
      sorceress: "Sorceress",
      necromancer: "Necromancer",
      paladin: "Paladin",
      barbarian: "Barbarian",
      druid: "Druid",
      assassin: "Assassin",
    };
    return classMap[normalized] || className;
  }

  public async optimize(
    metaItemUsage?: Record<string, number>
  ): Promise<BuildOptimization> {
    const resistances = this.analyzeResistances();
    const breakpoints = this.analyzeBreakpoints();
    const stats = this.analyzeStats();
    const recommendations = this.generateRecommendations(
      resistances,
      breakpoints,
      stats
    );
    const overallScore = this.calculateOverallScore(
      resistances,
      breakpoints,
      stats
    );
    const { strengths, weaknesses } = this.identifyStrengthsWeaknesses(
      resistances,
      breakpoints,
      stats
    );
    const itemComparison = metaItemUsage
      ? this.compareToMeta(metaItemUsage)
      : undefined;

    return {
      characterName: this.character.character.name,
      className: this.className,
      level: this.character.character.level,
      resistances,
      breakpoints,
      stats,
      itemComparison,
      recommendations,
      overallScore,
      strengths,
      weaknesses,
    };
  }

  private analyzeResistances(): ResistanceAnalysis {
    const cap = RESISTANCE_THRESHOLDS.recommended;

    const fire = {
      current: Math.min(this.stats.fireRes, this.stats.maxFireRes),
      max: this.stats.maxFireRes,
      capped: this.stats.fireRes >= cap,
      deficit: Math.max(0, cap - this.stats.fireRes),
    };

    const cold = {
      current: Math.min(this.stats.coldRes, this.stats.maxColdRes),
      max: this.stats.maxColdRes,
      capped: this.stats.coldRes >= cap,
      deficit: Math.max(0, cap - this.stats.coldRes),
    };

    const lightning = {
      current: Math.min(this.stats.lightningRes, this.stats.maxLightningRes),
      max: this.stats.maxLightningRes,
      capped: this.stats.lightningRes >= cap,
      deficit: Math.max(0, cap - this.stats.lightningRes),
    };

    const poison = {
      current: Math.min(this.stats.poisonRes, this.stats.maxPoisonRes),
      max: this.stats.maxPoisonRes,
      capped: this.stats.poisonRes >= cap,
      deficit: Math.max(0, cap - this.stats.poisonRes),
    };

    const allCapped = fire.capped && cold.capped && lightning.capped && poison.capped;
    const totalDeficit = fire.deficit + cold.deficit + lightning.deficit + poison.deficit;

    return {
      fire,
      cold,
      lightning,
      poison,
      allCapped,
      totalDeficit,
    };
  }

  private analyzeBreakpoints(): BreakpointAnalysis {
    const classBreakpoints = CLASS_BREAKPOINTS[this.className];

    if (!classBreakpoints) {
      throw new Error(`No breakpoint data for class: ${this.className}`);
    }

    const iasTier = findBreakpointTier(classBreakpoints.ias, this.stats.ias);
    const fcrTier = findBreakpointTier(classBreakpoints.fcr, this.stats.fcr);
    const fhrTier = findBreakpointTier(classBreakpoints.fhr, this.stats.fhr);

    return {
      ias: {
        current: this.stats.ias,
        tier: iasTier.current,
        next: iasTier.next,
        progress: iasTier.progress,
        toNextBreakpoint: iasTier.next
          ? iasTier.next.value - this.stats.ias
          : 0,
      },
      fcr: {
        current: this.stats.fcr,
        tier: fcrTier.current,
        next: fcrTier.next,
        progress: fcrTier.progress,
        toNextBreakpoint: fcrTier.next
          ? fcrTier.next.value - this.stats.fcr
          : 0,
      },
      fhr: {
        current: this.stats.fhr,
        tier: fhrTier.current,
        next: fhrTier.next,
        progress: fhrTier.progress,
        toNextBreakpoint: fhrTier.next
          ? fhrTier.next.value - this.stats.fhr
          : 0,
      },
    };
  }

  private analyzeStats(): StatAnalysis {
    return {
      strength: this.stats.strength,
      dexterity: this.stats.dexterity,
      vitality: this.stats.vitality,
      energy: this.stats.energy,
      life: this.character.character.life,
      mana: this.character.character.mana,
    };
  }

  private compareToMeta(
    metaItemUsage: Record<string, number>
  ): ItemUsageComparison[] {
    const comparisons: ItemUsageComparison[] = [];

    for (const item of this.character.items) {
      const metaUsage = metaItemUsage[item.name] || 0;
      const isMetaChoice = metaUsage >= 10; // Consider "meta" if used by 10%+ of builds

      comparisons.push({
        itemName: item.name,
        slot: item.location.equipment,
        metaUsagePercent: metaUsage,
        isMetaChoice,
      });
    }

    return comparisons.sort((a, b) => b.metaUsagePercent - a.metaUsagePercent);
  }

  private generateRecommendations(
    resistances: ResistanceAnalysis,
    breakpoints: BreakpointAnalysis,
    stats: StatAnalysis
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Resistance recommendations
    if (!resistances.allCapped) {
      const uncappedRes: string[] = [];
      if (!resistances.fire.capped) uncappedRes.push("Fire");
      if (!resistances.cold.capped) uncappedRes.push("Cold");
      if (!resistances.lightning.capped) uncappedRes.push("Lightning");
      if (!resistances.poison.capped) uncappedRes.push("Poison");

      recommendations.push({
        priority: "critical",
        category: "resistances",
        title: `Cap ${uncappedRes.join(", ")} Resistance${uncappedRes.length > 1 ? "s" : ""}`,
        description: `You need ${resistances.totalDeficit} total resistance to cap all resistances at 75%. Uncapped resistances make you extremely vulnerable in Hell difficulty.`,
        specificItems: [
          "Spirit Shield (+35 All Res)",
          "Smoke Armor (+50 All Res)",
          "Anya's Quest reward (+30 All Res)",
          "Rare/Crafted rings with resistances",
        ],
        impact:
          "CRITICAL: Uncapped resistances drastically increase incoming elemental damage",
      });
    }

    // Breakpoint recommendations
    const priorities = STAT_PRIORITIES[this.className];
    const primaryStats = priorities.primary.map((s) =>
      s.toLowerCase()
    ) as string[];

    if (primaryStats.includes("fcr") && breakpoints.fcr.next) {
      if (breakpoints.fcr.toNextBreakpoint <= 15) {
        recommendations.push({
          priority: "high",
          category: "breakpoints",
          title: `Reach Next FCR Breakpoint (${breakpoints.fcr.next.value}%)`,
          description: `You're only ${breakpoints.fcr.toNextBreakpoint}% FCR away from the next breakpoint (${breakpoints.fcr.next.frames} frames). This is very achievable!`,
          specificItems: [
            "Spirit Weapon (+35% FCR)",
            "Magefist Gloves (+20% FCR)",
            "Arachnid Mesh Belt (+20% FCR)",
            "Faster Cast Rate rings/amulet",
          ],
          impact: `Faster casts = more spells per second = higher effective DPS`,
        });
      }
    }

    if (primaryStats.includes("ias") && breakpoints.ias.next) {
      if (breakpoints.ias.toNextBreakpoint <= 20) {
        recommendations.push({
          priority: "high",
          category: "breakpoints",
          title: `Reach Next IAS Breakpoint (${breakpoints.ias.next.value}%)`,
          description: `You need ${breakpoints.ias.toNextBreakpoint}% more IAS to reach ${breakpoints.ias.next.frames} frame attacks. Consider weapon/glove swaps.`,
          specificItems: [
            "IAS Jewels in helmet/weapon",
            "Laying of Hands Gloves (+20% IAS)",
            "Highlord's Wrath Amulet (+20% IAS)",
          ],
          impact: `Faster attacks = higher physical DPS and better proc rates`,
        });
      }
    }

    if (breakpoints.fhr.next && breakpoints.fhr.toNextBreakpoint <= 20) {
      recommendations.push({
        priority: "medium",
        category: "breakpoints",
        title: `Improve Hit Recovery (${breakpoints.fhr.next.value}% FHR)`,
        description: `Only ${breakpoints.fhr.toNextBreakpoint}% FHR needed to recover faster from hits.`,
        specificItems: [
          "Spirit Shield/Weapon (+55% FHR total)",
          "Shako Helm (+10% FHR)",
          "FHR Small Charms",
        ],
        impact: `Faster recovery = less time stunned = better survivability`,
      });
    }

    // Life recommendations
    if (stats.life < 1000 && this.character.character.level >= 85) {
      recommendations.push({
        priority: "high",
        category: "stats",
        title: "Increase Life Pool",
        description: `With only ${stats.life} life at level ${this.character.character.level}, you're vulnerable to burst damage. Aim for 1500+ life in Hell.`,
        specificItems: [
          "Invest more points in Vitality",
          "Call to Arms (Battle Orders buff)",
          "+Life Small Charms",
          "Life/Resist Grand Charms",
        ],
        impact: "Higher life pool = survive more mistakes and burst damage",
      });
    }

    // Low-hanging fruit optimizations
    if (
      this.stats.mf < 100 &&
      this.className === "Sorceress" &&
      resistances.allCapped
    ) {
      recommendations.push({
        priority: "low",
        category: "gear",
        title: "Add Magic Find Gear",
        description: `You have resistances capped with only ${this.stats.mf}% MF. You can afford to add MF gear for better drops.`,
        specificItems: [
          "Chance Guards Gloves (+40% MF)",
          "Goldwrap Belt (+30% MF)",
          "Gheed's Fortune Charm (+up to 40% MF)",
          "Ist Rune in weapon/helm (+25% MF)",
        ],
        impact: "More magic find = better loot = faster progression",
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private calculateOverallScore(
    resistances: ResistanceAnalysis,
    breakpoints: BreakpointAnalysis,
    stats: StatAnalysis
  ): number {
    let score = 100;

    // Resistance penalty (up to -40 points)
    if (!resistances.allCapped) {
      score -= Math.min(resistances.totalDeficit / 2, 40);
    }

    // Breakpoint optimization (up to -20 points)
    const priorities = STAT_PRIORITIES[this.className];
    if (priorities.primary.some((s) => s.toLowerCase().includes("fcr"))) {
      // FCR classes
      if (breakpoints.fcr.current < 63) score -= 10;
      if (breakpoints.fhr.current < 30) score -= 5;
    } else {
      // Physical classes
      if (breakpoints.ias.current < 40) score -= 10;
      if (breakpoints.fhr.current < 30) score -= 5;
    }

    // Life pool check (up to -15 points)
    const expectedLife = Math.max(800, this.character.character.level * 12);
    if (stats.life < expectedLife) {
      const lifeDeficit = expectedLife - stats.life;
      score -= Math.min((lifeDeficit / expectedLife) * 15, 15);
    }

    return Math.max(0, Math.round(score));
  }

  private identifyStrengthsWeaknesses(
    resistances: ResistanceAnalysis,
    breakpoints: BreakpointAnalysis,
    stats: StatAnalysis
  ): { strengths: string[]; weaknesses: string[] } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    // Resistance analysis
    if (resistances.allCapped) {
      strengths.push(
        "All resistances capped at 75% - excellent elemental defense"
      );
    } else {
      weaknesses.push(
        `Resistances not capped (${resistances.totalDeficit}% total deficit)`
      );
    }

    // Breakpoint analysis
    const priorities = STAT_PRIORITIES[this.className];
    const primaryStats = priorities.primary.map((s) =>
      s.toLowerCase()
    ) as string[];

    if (primaryStats.includes("fcr")) {
      if (breakpoints.fcr.current >= 105) {
        strengths.push(
          `Excellent FCR (${breakpoints.fcr.current}%) - ${breakpoints.fcr.tier.frames} frame casts`
        );
      } else if (breakpoints.fcr.current < 48) {
        weaknesses.push(`Low FCR (${breakpoints.fcr.current}%) - slow casts`);
      }
    }

    if (primaryStats.includes("ias")) {
      if (breakpoints.ias.current >= 80) {
        strengths.push(
          `Excellent IAS (${breakpoints.ias.current}%) - ${breakpoints.ias.tier.frames} frame attacks`
        );
      } else if (breakpoints.ias.current < 40) {
        weaknesses.push(
          `Low IAS (${breakpoints.ias.current}%) - slow attacks`
        );
      }
    }

    // FHR analysis
    if (breakpoints.fhr.current >= 86) {
      strengths.push(
        `Great hit recovery (${breakpoints.fhr.current}% FHR) - minimal stun time`
      );
    } else if (breakpoints.fhr.current < 20) {
      weaknesses.push(
        `Low hit recovery (${breakpoints.fhr.current}% FHR) - vulnerable to stun-lock`
      );
    }

    // Life analysis
    if (stats.life >= 1500) {
      strengths.push(`Healthy life pool (${stats.life}) - good survivability`);
    } else if (stats.life < 1000 && this.character.character.level >= 80) {
      weaknesses.push(`Low life pool (${stats.life}) for level ${this.character.character.level}`);
    }

    // MF for farming builds
    if (this.stats.mf >= 300) {
      strengths.push(`High magic find (${this.stats.mf}%) - excellent for farming`);
    }

    return { strengths, weaknesses };
  }
}
