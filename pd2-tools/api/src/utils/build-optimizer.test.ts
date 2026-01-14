import BuildOptimizer from "./build-optimizer";
import { CharacterData, CharStats } from "../types";

describe("BuildOptimizer", () => {
  const createMockCharacter = (
    className: string,
    level: number = 85
  ): CharacterData => ({
    character: {
      name: "TestChar",
      status: {
        is_hardcore: false,
        is_dead: false,
        is_expansion: true,
        is_ladder: true,
      },
      class: { id: 1, name: className },
      attributes: {
        strength: 100,
        dexterity: 100,
        vitality: 200,
        energy: 50,
      },
      gold: { character: 1000, stash: 50000, total: 51000 },
      points: { stat: 0, skill: 0 },
      life: 1200,
      mana: 400,
      stamina: 200,
      experience: 100000000,
      level,
      skills: [],
      season: 12,
    },
    items: [],
  });

  const createMockStats = (overrides?: Partial<CharStats>): CharStats => ({
    fireRes: 75,
    maxFireRes: 75,
    coldRes: 75,
    maxColdRes: 75,
    lightningRes: 75,
    maxLightningRes: 75,
    poisonRes: 75,
    maxPoisonRes: 75,
    strength: 120,
    dexterity: 110,
    vitality: 220,
    energy: 60,
    fcr: 0,
    ias: 0,
    mf: 0,
    gf: 0,
    frw: 0,
    pdr: 0,
    fhr: 0,
    lAbsorbPct: 0,
    lAbsorbFlat: 0,
    cAbsorbPct: 0,
    cAbsorbFlat: 0,
    fAbsorbPct: 0,
    fAbsorbFlat: 0,
    ...overrides,
  });

  describe("Resistance Analysis", () => {
    it("should identify capped resistances", async () => {
      const character = createMockCharacter("Sorceress");
      const stats = createMockStats({
        fireRes: 75,
        coldRes: 75,
        lightningRes: 75,
        poisonRes: 75,
      });

      const optimizer = new BuildOptimizer(character, stats);
      const result = await optimizer.optimize();

      expect(result.resistances.allCapped).toBe(true);
      expect(result.resistances.totalDeficit).toBe(0);
      expect(result.resistances.fire.capped).toBe(true);
    });

    it("should identify uncapped resistances and calculate deficit", async () => {
      const character = createMockCharacter("Sorceress");
      const stats = createMockStats({
        fireRes: 50,
        coldRes: 60,
        lightningRes: 75,
        poisonRes: 30,
      });

      const optimizer = new BuildOptimizer(character, stats);
      const result = await optimizer.optimize();

      expect(result.resistances.allCapped).toBe(false);
      expect(result.resistances.fire.deficit).toBe(25);
      expect(result.resistances.cold.deficit).toBe(15);
      expect(result.resistances.lightning.deficit).toBe(0);
      expect(result.resistances.poison.deficit).toBe(45);
      expect(result.resistances.totalDeficit).toBe(85);
    });

    it("should recommend resistance gear for uncapped resists", async () => {
      const character = createMockCharacter("Paladin");
      const stats = createMockStats({
        fireRes: 50,
        coldRes: 50,
        lightningRes: 50,
        poisonRes: 50,
      });

      const optimizer = new BuildOptimizer(character, stats);
      const result = await optimizer.optimize();

      const resRec = result.recommendations.find(
        (r) => r.category === "resistances"
      );
      expect(resRec).toBeDefined();
      expect(resRec?.priority).toBe("critical");
      expect(resRec?.title).toContain("Resistance");
    });
  });

  describe("Breakpoint Analysis", () => {
    it("should correctly identify FCR breakpoints for Sorceress", async () => {
      const character = createMockCharacter("Sorceress");
      const stats = createMockStats({ fcr: 63 });

      const optimizer = new BuildOptimizer(character, stats);
      const result = await optimizer.optimize();

      expect(result.breakpoints.fcr.current).toBe(63);
      expect(result.breakpoints.fcr.tier.value).toBe(63);
      expect(result.breakpoints.fcr.tier.frames).toBe(9);
      expect(result.breakpoints.fcr.next?.value).toBe(105);
    });

    it("should correctly identify IAS breakpoints for Barbarian", async () => {
      const character = createMockCharacter("Barbarian");
      const stats = createMockStats({ ias: 58 });

      const optimizer = new BuildOptimizer(character, stats);
      const result = await optimizer.optimize();

      expect(result.breakpoints.ias.current).toBe(58);
      expect(result.breakpoints.ias.tier.value).toBe(58);
      expect(result.breakpoints.ias.tier.frames).toBe(12);
    });

    it("should recommend breakpoint upgrades when close", async () => {
      const character = createMockCharacter("Sorceress");
      const stats = createMockStats({
        fcr: 58, // Only 5% away from 63% breakpoint
        fireRes: 75,
        coldRes: 75,
        lightningRes: 75,
        poisonRes: 75,
      });

      const optimizer = new BuildOptimizer(character, stats);
      const result = await optimizer.optimize();

      const fcrRec = result.recommendations.find((r) =>
        r.title.includes("FCR")
      );
      expect(fcrRec).toBeDefined();
      expect(fcrRec?.priority).toBe("high");
    });

    it("should not recommend breakpoint when at max tier", async () => {
      const character = createMockCharacter("Sorceress");
      const stats = createMockStats({
        fcr: 200, // Max breakpoint
        fireRes: 75,
        coldRes: 75,
        lightningRes: 75,
        poisonRes: 75,
      });

      const optimizer = new BuildOptimizer(character, stats);
      const result = await optimizer.optimize();

      expect(result.breakpoints.fcr.next).toBeNull();
      const fcrRec = result.recommendations.find((r) =>
        r.title.includes("FCR")
      );
      expect(fcrRec).toBeUndefined();
    });
  });

  describe("Overall Score Calculation", () => {
    it("should give high score for well-optimized build", async () => {
      const character = createMockCharacter("Sorceress", 90);
      const stats = createMockStats({
        fireRes: 75,
        coldRes: 75,
        lightningRes: 75,
        poisonRes: 75,
        fcr: 105,
        fhr: 60,
      });
      character.character.life = 1800;

      const optimizer = new BuildOptimizer(character, stats);
      const result = await optimizer.optimize();

      expect(result.overallScore).toBeGreaterThan(85);
    });

    it("should give low score for poorly optimized build", async () => {
      const character = createMockCharacter("Sorceress", 85);
      const stats = createMockStats({
        fireRes: 30,
        coldRes: 40,
        lightningRes: 50,
        poisonRes: 20,
        fcr: 10,
        fhr: 5,
      });
      character.character.life = 600;

      const optimizer = new BuildOptimizer(character, stats);
      const result = await optimizer.optimize();

      expect(result.overallScore).toBeLessThan(60);
    });
  });

  describe("Strengths and Weaknesses", () => {
    it("should identify strengths correctly", async () => {
      const character = createMockCharacter("Amazon");
      const stats = createMockStats({
        fireRes: 75,
        coldRes: 75,
        lightningRes: 75,
        poisonRes: 75,
        ias: 95,
        fhr: 99,
      });
      character.character.life = 2000;

      const optimizer = new BuildOptimizer(character, stats);
      const result = await optimizer.optimize();

      expect(result.strengths.length).toBeGreaterThan(0);
      expect(result.strengths.some((s) => s.includes("resistance"))).toBe(true);
      expect(result.strengths.some((s) => s.includes("IAS") || s.includes("hit recovery"))).toBe(
        true
      );
    });

    it("should identify weaknesses correctly", async () => {
      const character = createMockCharacter("Paladin", 85);
      const stats = createMockStats({
        fireRes: 40,
        coldRes: 50,
        lightningRes: 60,
        poisonRes: 30,
        ias: 5,
        fhr: 5,
      });
      character.character.life = 700;

      const optimizer = new BuildOptimizer(character, stats);
      const result = await optimizer.optimize();

      expect(result.weaknesses.length).toBeGreaterThan(0);
      expect(
        result.weaknesses.some((w) => w.toLowerCase().includes("resistance"))
      ).toBe(true);
      expect(result.weaknesses.some((w) => w.includes("life"))).toBe(true);
    });
  });

  describe("Meta Comparison", () => {
    it("should compare items against meta usage", async () => {
      const character = createMockCharacter("Sorceress");
      const stats = createMockStats();
      character.items = [
        {
          name: "Shako",
          // @ts-expect-error - simplified mock item
          location: { equipment: "Head" },
          quality: { name: "Unique" },
          properties: [],
        },
        {
          name: "Enigma",
          // @ts-expect-error - simplified mock item
          location: { equipment: "Torso" },
          quality: { name: "Runeword" },
          properties: [],
        },
      ];

      const metaItemUsage = {
        Shako: 45.5, // 45.5% of Sorcs use Shako
        Enigma: 12.3,
        "Stone of Jordan": 67.8,
      };

      const optimizer = new BuildOptimizer(character, stats);
      const result = await optimizer.optimize(metaItemUsage);

      expect(result.itemComparison).toBeDefined();
      expect(result.itemComparison?.length).toBe(2);

      const shakoComparison = result.itemComparison?.find(
        (i) => i.itemName === "Shako"
      );
      expect(shakoComparison?.metaUsagePercent).toBe(45.5);
      expect(shakoComparison?.isMetaChoice).toBe(true);
    });
  });

  describe("Class-Specific Analysis", () => {
    it("should provide FCR-focused recommendations for Sorceress", async () => {
      const character = createMockCharacter("Sorceress");
      const stats = createMockStats({
        fcr: 30,
        ias: 5,
        fireRes: 75,
        coldRes: 75,
        lightningRes: 75,
        poisonRes: 75,
      });

      const optimizer = new BuildOptimizer(character, stats);
      const result = await optimizer.optimize();

      const fcrRec = result.recommendations.find((r) =>
        r.title.toLowerCase().includes("fcr")
      );
      expect(fcrRec).toBeDefined();
    });

    it("should provide IAS-focused recommendations for physical classes", async () => {
      const character = createMockCharacter("Barbarian");
      const stats = createMockStats({
        fcr: 10,
        ias: 25,
        fireRes: 75,
        coldRes: 75,
        lightningRes: 75,
        poisonRes: 75,
      });

      const optimizer = new BuildOptimizer(character, stats);
      const result = await optimizer.optimize();

      const iasRec = result.recommendations.find((r) =>
        r.title.toLowerCase().includes("ias")
      );
      expect(iasRec).toBeDefined();
    });
  });

  describe("Life Pool Recommendations", () => {
    it("should recommend life increase for low-life high-level characters", async () => {
      const character = createMockCharacter("Amazon", 90);
      const stats = createMockStats({
        fireRes: 75,
        coldRes: 75,
        lightningRes: 75,
        poisonRes: 75,
      });
      character.character.life = 850;

      const optimizer = new BuildOptimizer(character, stats);
      const result = await optimizer.optimize();

      const lifeRec = result.recommendations.find((r) =>
        r.title.toLowerCase().includes("life")
      );
      expect(lifeRec).toBeDefined();
      expect(lifeRec?.priority).toBe("high");
    });

    it("should not recommend life for characters with adequate life", async () => {
      const character = createMockCharacter("Paladin", 85);
      const stats = createMockStats({
        fireRes: 75,
        coldRes: 75,
        lightningRes: 75,
        poisonRes: 75,
      });
      character.character.life = 2200;

      const optimizer = new BuildOptimizer(character, stats);
      const result = await optimizer.optimize();

      const lifeRec = result.recommendations.find(
        (r) => r.title.toLowerCase().includes("life") && r.priority === "high"
      );
      expect(lifeRec).toBeUndefined();
    });
  });
});
