import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { characterDB } from "../database";
import { validateSeason } from "../middleware/validation";
import { config, logger as mainLogger } from "../config";
import CharacterStatParser from "../utils/character-stats";
import { autoCache } from "../middleware/auto-cache";
import {
  getCacheValue,
  setCacheValue,
  deleteCachePattern,
} from "../utils/cache";
import { calculateTotalSkills } from "../utils/skill-calculator";
import BuildOptimizer from "../utils/build-optimizer";
import { CharacterResponse } from "../types";
import fetch from "node-fetch";

const logger = mainLogger.createNamedLogger("API");
const router = Router();

const characterRefreshLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many character refresh requests. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/characters - Get filtered characters
router.get(
  "/",
  validateSeason,
  autoCache(900),
  async (req: Request, res: Response) => {
    try {
      const {
        gameMode = "softcore",
        page = "1",
        pageSize = "50",
        minLevel,
        maxLevel,
        classes,
        items,
        skills,
        mercTypes,
        mercItems,
        season,
      } = req.query;

      const filter: Record<string, unknown> & {
        levelRange?: { min?: number; max?: number };
      } = {};

      if (minLevel || maxLevel) {
        filter.levelRange = {};
        if (minLevel) filter.levelRange.min = parseInt(minLevel as string, 10);
        if (maxLevel) filter.levelRange.max = parseInt(maxLevel as string, 10);
      }

      if (classes) {
        filter.requiredClasses = (classes as string).split(",");
      }

      if (items) {
        filter.requiredItems = (items as string).split(",");
      }
      if (skills) {
        try {
          const skillsData = JSON.parse(decodeURIComponent(skills as string));
          if (
            Array.isArray(skillsData) &&
            skillsData.every(
              (skill) =>
                typeof skill === "object" &&
                typeof skill.name === "string" &&
                typeof skill.minLevel === "number"
            )
          ) {
            filter.requiredSkills = skillsData;
          }
        } catch {
          // Invalid skills format, ignore
        }
      }
      if (mercTypes) {
        filter.requiredMercTypes = (mercTypes as string).split(",");
      }
      if (mercItems) {
        filter.requiredMercItems = (mercItems as string).split(",");
      }
      if (season) {
        filter.season = parseInt(season as string, 10);
      } else {
        filter.season = config.currentSeason;
      }

      const result = await characterDB.getFilteredCharacters(
        gameMode as string,
        filter,
        parseInt(page as string, 10),
        parseInt(pageSize as string, 10)
      );

      res.json(result);
    } catch (error: unknown) {
      logger.error("Error fetching characters", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { message: "Failed to fetch characters" },
      });
    }
  }
);

// GET /api/characters/:name - Get character by name
router.get(
  "/:name",
  validateSeason,
  autoCache(900),
  async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { gameMode = "softcore", season } = req.query;

      const seasonNumber = season
        ? parseInt(season as string, 10)
        : config.currentSeason;
      const MODES = ["hardcore", "softcore"];

      let character = await characterDB.getCharacterByName(
        gameMode as string,
        name,
        seasonNumber
      );

      // If not found in requested gameMode, try all other modes as fallback
      if (!character) {
        for (const otherGameMode of MODES) {
          if (otherGameMode === gameMode) continue; // Skip already-checked mode
          character = await characterDB.getCharacterByName(
            otherGameMode,
            name,
            seasonNumber
          );
          if (character) break;
        }
      }

      //TODO: pass season param and remove this
      if (!character) {
        for (const gm of MODES) {
          character = await characterDB.getCharacterByName(
            gm,
            name,
            seasonNumber - 1
          );
          if (character) break;
        }
      }

      if (!character) {
        res.status(404).json({ error: { message: "Character not found" } });
        return;
      }

      // Calculate realStats from items before returning
      if (character.items && character.items.length > 0) {
        // @ts-expect-error - character structure is validated by DB
        const statParser = new CharacterStatParser(character);
        character.realStats = statParser.parseAndGetCharStats();
      }

      res.json(character);
    } catch (error: unknown) {
      logger.error("Error fetching character", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { message: "Failed to fetch character" },
      });
    }
  }
);

// GET /api/accounts/:accountName - Get all characters for an account
router.get(
  "/accounts/:accountName",
  validateSeason,
  autoCache(900),
  async (req: Request, res: Response) => {
    try {
      const { accountName } = req.params;
      const { season } = req.query;

      const seasonNumber = season
        ? parseInt(season as string, 10)
        : config.currentSeason;

      const characters = await characterDB.getCharactersByAccount(
        accountName,
        seasonNumber
      );

      if (!characters || characters.length === 0) {
        res.status(404).json({
          error: { message: "No characters found for this account" },
        });
        return;
      }

      res.json({ characters, total: characters.length });
    } catch (error: unknown) {
      logger.error("Error fetching characters by account", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { message: "Failed to fetch characters by account" },
      });
    }
  }
);

// GET /api/characters/:name/snapshots - Get all snapshots for a character
router.get(
  "/:name/snapshots",
  validateSeason,
  autoCache(900),
  async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { gameMode = "softcore", season } = req.query;

      const seasonNumber = season
        ? parseInt(season as string, 10)
        : config.currentSeason;

      const snapshots = await characterDB.getCharacterSnapshots(
        gameMode as string,
        name,
        seasonNumber
      );

      if (!snapshots || snapshots.length === 0) {
        res.status(404).json({
          error: { message: "No snapshots found for this character" },
        });
        return;
      }

      // Return lightweight list (no full_response_json, just metadata)
      const snapshotList = snapshots.map((snapshot) => ({
        snapshot_id: snapshot.snapshot_id,
        snapshot_timestamp: snapshot.snapshot_timestamp,
        level: snapshot.level,
        experience: snapshot.experience,
      }));

      res.json({ snapshots: snapshotList, total: snapshots.length });
    } catch (error: unknown) {
      logger.error("Error fetching character snapshots", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { message: "Failed to fetch character snapshots" },
      });
    }
  }
);

// GET /api/characters/:name/snapshots/:snapshotId - Get specific snapshot
router.get(
  "/:name/snapshots/:snapshotId",
  autoCache(900),
  async (req: Request, res: Response) => {
    try {
      const { snapshotId } = req.params;
      const snapshotIdNumber = parseInt(snapshotId, 10);

      if (isNaN(snapshotIdNumber)) {
        res.status(400).json({
          error: { message: "Invalid snapshot ID" },
        });
        return;
      }

      const snapshot = await characterDB.getCharacterSnapshot(snapshotIdNumber);

      if (!snapshot) {
        res.status(404).json({
          error: { message: "Snapshot not found" },
        });
        return;
      }

      // Calculate realStats from items before returning
      if (snapshot.items && snapshot.items.length > 0) {
        // @ts-expect-error - snapshot structure is validated by DB
        const statParser = new CharacterStatParser(snapshot);
        snapshot.realStats = statParser.parseAndGetCharStats();
      }

      res.json(snapshot);
    } catch (error: unknown) {
      logger.error("Error fetching character snapshot", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { message: "Failed to fetch character snapshot" },
      });
    }
  }
);

// GET /api/characters/stats/level-distribution - Get level distribution
router.get(
  "/stats/level-distribution",
  validateSeason,
  autoCache(900),
  async (_req: Request, res: Response) => {
    try {
      const { season } = _req.query;
      const seasonNumber = season ? parseInt(season as string, 10) : undefined;

      const distribution =
        await characterDB.getLevelDistributions(seasonNumber);
      res.json(distribution);
    } catch (error: unknown) {
      logger.error("Error fetching level distribution", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { message: "Failed to fetch level distribution" },
      });
    }
  }
);

// GET /api/characters/stats/item-usage - Get item usage statistics
router.get(
  "/stats/item-usage",
  validateSeason,
  autoCache(900),
  async (req: Request, res: Response) => {
    try {
      const {
        gameMode = "softcore",
        minLevel,
        maxLevel,
        classes,
        items,
        skills,
        mercTypes,
        mercItems,
        season,
      } = req.query;

      const filter: Record<string, unknown> & {
        levelRange?: { min?: number; max?: number };
      } = {};

      if (minLevel || maxLevel) {
        filter.levelRange = {};
        if (minLevel) filter.levelRange.min = parseInt(minLevel as string, 10);
        if (maxLevel) filter.levelRange.max = parseInt(maxLevel as string, 10);
      }

      if (classes) {
        filter.requiredClasses = (classes as string).split(",");
      }

      if (items) {
        filter.requiredItems = (items as string)
          .split(",")
          .map((item) => item.trim());
      }

      if (skills) {
        try {
          const skillsData = JSON.parse(decodeURIComponent(skills as string));
          if (
            Array.isArray(skillsData) &&
            skillsData.every(
              (skill) =>
                typeof skill === "object" &&
                typeof skill.name === "string" &&
                typeof skill.minLevel === "number"
            )
          ) {
            filter.requiredSkills = skillsData;
          }
        } catch {
          // Invalid skills format, ignore
        }
      }

      if (mercTypes) {
        filter.requiredMercTypes = (mercTypes as string).split(",");
      }

      if (mercItems) {
        filter.requiredMercItems = (mercItems as string).split(",");
      }

      if (season) {
        filter.season = parseInt(season as string, 10);
      } else {
        filter.season = config.currentSeason;
      }

      const itemUsage = await characterDB.analyzeItemUsage(
        gameMode as string,
        filter
      );
      res.json(itemUsage);
    } catch (error: unknown) {
      logger.error("Error analyzing item usage", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { message: "Failed to analyze item usage" },
      });
    }
  }
);

// GET /api/characters/stats/skill-usage - Get skill usage statistics
router.get(
  "/stats/skill-usage",
  validateSeason,
  autoCache(900),
  async (req: Request, res: Response) => {
    try {
      const {
        gameMode = "softcore",
        minLevel,
        maxLevel,
        classes,
        items,
        skills,
        mercTypes,
        mercItems,
        season,
      } = req.query;

      const filter: Record<string, unknown> & {
        levelRange?: { min?: number; max?: number };
      } = {};

      if (minLevel || maxLevel) {
        filter.levelRange = {};
        if (minLevel) filter.levelRange.min = parseInt(minLevel as string, 10);
        if (maxLevel) filter.levelRange.max = parseInt(maxLevel as string, 10);
      }

      if (classes) {
        filter.requiredClasses = (classes as string).split(",");
      }

      if (items) {
        filter.requiredItems = (items as string)
          .split(",")
          .map((item) => item.trim());
      }

      if (skills) {
        try {
          const skillsData = JSON.parse(decodeURIComponent(skills as string));
          if (
            Array.isArray(skillsData) &&
            skillsData.every(
              (skill) =>
                typeof skill === "object" &&
                typeof skill.name === "string" &&
                typeof skill.minLevel === "number"
            )
          ) {
            filter.requiredSkills = skillsData;
          }
        } catch {
          // Invalid skills format, ignore
        }
      }

      if (mercTypes) {
        filter.requiredMercTypes = (mercTypes as string).split(",");
      }

      if (mercItems) {
        filter.requiredMercItems = (mercItems as string).split(",");
      }

      if (season) {
        filter.season = parseInt(season as string, 10);
      } else {
        filter.season = config.currentSeason;
      }

      const skillUsage = await characterDB.analyzeSkillUsage(
        gameMode as string,
        filter
      );
      res.json(skillUsage);
    } catch (error: unknown) {
      logger.error("Error analyzing skill usage", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { message: "Failed to analyze skill usage" },
      });
    }
  }
);

// GET /api/characters/stats/merc-type-usage - Get mercenary type usage statistics
router.get(
  "/stats/merc-type-usage",
  validateSeason,
  autoCache(900),
  async (req: Request, res: Response) => {
    try {
      const {
        gameMode = "softcore",
        minLevel,
        maxLevel,
        classes,
        items,
        skills,
        mercTypes,
        mercItems,
        season,
      } = req.query;

      const filter: Record<string, unknown> & {
        levelRange?: { min?: number; max?: number };
      } = {};

      if (minLevel || maxLevel) {
        filter.levelRange = {};
        if (minLevel) filter.levelRange.min = parseInt(minLevel as string, 10);
        if (maxLevel) filter.levelRange.max = parseInt(maxLevel as string, 10);
      }

      if (classes) filter.requiredClasses = (classes as string).split(",");
      if (items) filter.requiredItems = (items as string).split(",");
      if (mercTypes)
        filter.requiredMercTypes = (mercTypes as string).split(",");
      if (mercItems)
        filter.requiredMercItems = (mercItems as string).split(",");

      if (skills) {
        try {
          const skillsData = JSON.parse(decodeURIComponent(skills as string));
          if (
            Array.isArray(skillsData) &&
            skillsData.every(
              (skill) =>
                typeof skill === "object" &&
                typeof skill.name === "string" &&
                typeof skill.minLevel === "number"
            )
          ) {
            filter.requiredSkills = skillsData;
          }
        } catch {
          // Invalid skills format, ignore
        }
      }

      if (season) {
        filter.season = parseInt(season as string, 10);
      } else {
        filter.season = config.currentSeason;
      }

      const mercTypeUsage = await characterDB.analyzeMercTypeUsage(
        gameMode as string,
        filter
      );
      res.json(mercTypeUsage);
    } catch (error: unknown) {
      logger.error("Error analyzing merc type usage", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { message: "Failed to analyze merc type usage" },
      });
    }
  }
);

// GET /api/characters/stats/merc-item-usage - Get mercenary item usage statistics
router.get(
  "/stats/merc-item-usage",
  validateSeason,
  autoCache(900),
  async (req: Request, res: Response) => {
    try {
      const {
        gameMode = "softcore",
        minLevel,
        maxLevel,
        classes,
        items,
        skills,
        mercTypes,
        mercItems,
        season,
      } = req.query;

      const filter: Record<string, unknown> & {
        levelRange?: { min?: number; max?: number };
      } = {};

      if (minLevel || maxLevel) {
        filter.levelRange = {};
        if (minLevel) filter.levelRange.min = parseInt(minLevel as string, 10);
        if (maxLevel) filter.levelRange.max = parseInt(maxLevel as string, 10);
      }

      if (classes) filter.requiredClasses = (classes as string).split(",");
      if (items) filter.requiredItems = (items as string).split(",");
      if (mercTypes)
        filter.requiredMercTypes = (mercTypes as string).split(",");
      if (mercItems)
        filter.requiredMercItems = (mercItems as string).split(",");

      if (skills) {
        try {
          const skillsData = JSON.parse(decodeURIComponent(skills as string));
          if (
            Array.isArray(skillsData) &&
            skillsData.every(
              (skill) =>
                typeof skill === "object" &&
                typeof skill.name === "string" &&
                typeof skill.minLevel === "number"
            )
          ) {
            filter.requiredSkills = skillsData;
          }
        } catch {
          // Invalid skills format, ignore
        }
      }

      if (season) {
        filter.season = parseInt(season as string, 10);
      } else {
        filter.season = config.currentSeason;
      }

      const mercItemUsage = await characterDB.analyzeMercItemUsage(
        gameMode as string,
        filter
      );
      res.json(mercItemUsage);
    } catch (error: unknown) {
      logger.error("Error analyzing merc item usage", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { message: "Failed to analyze merc item usage" },
      });
    }
  }
);

// POST /api/characters/:name/refresh - Manually refresh character data
router.post("/:name/refresh", characterRefreshLimiter, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const now = Date.now();
    const cacheKey = `refresh:character:${name.toLowerCase()}`;

    // Check 15-minute rate limit from Redis
    const lastRefresh = await getCacheValue<number>(cacheKey);

    // Check 15-minute rate limit
    if (lastRefresh && now - lastRefresh < 15 * 60 * 1000) {
      const retryAfter = Math.ceil(
        (15 * 60 * 1000 - (now - lastRefresh)) / 1000
      );
      return res.status(429).json({
        error: "Character was refreshed recently. Please try again later.",
        retryAfter,
      });
    }

    // Fetch character data from PD2 API
    logger.info(`Manual refresh requested for character: ${name}`);
    const response = await fetch(
      `https://api.projectdiablo2.com/game/character/${name}`
    );

    if (!response.ok) {
      return res.status(404).json({
        error: "Character not found or API unavailable",
      });
    }

    const charData: any = await response.json();

    if (!charData?.character) {
      return res.status(404).json({
        error: "Invalid character data received",
      });
    }

    // Determine game mode
    const gameMode = charData.character.status?.is_hardcore
      ? "hardcore"
      : "softcore";

    // Get season from request or use current season
    const season = charData.character.season || config.currentSeason;

    // Get existing character to preserve accountName
    const existingChar = await characterDB.getCharacterByName(
      gameMode,
      name,
      season
    );
    const accountName = existingChar?.accountName;

    // Set lastUpdated and calculate realSkills (same as scraper does)
    charData.lastUpdated = now;
    charData.realSkills = calculateTotalSkills(
      charData as unknown as CharacterResponse
    );

    // Ingest character data with preserved accountName
    await characterDB.ingestCharacter(charData, gameMode, season, accountName);

    // Update rate limit cache in Redis (TTL: 15 minutes = 900 seconds)
    await setCacheValue(cacheKey, now, 900);

    // Invalidate API cache for this character (cache keys are auto:/:name:<hash>)
    const deletedKeys = await deleteCachePattern(`auto:/${name}:*`);
    logger.debug(
      `Invalidated ${deletedKeys} cache keys for character: ${name}`
    );

    // Fetch and return updated character
    const updatedChar = await characterDB.getCharacterByName(
      gameMode,
      name,
      season
    );

    if (!updatedChar) {
      return res.status(500).json({
        error: "Character refreshed but failed to retrieve updated data",
      });
    }

    // Calculate realStats from items (same as GET endpoint does)
    if (updatedChar.items && updatedChar.items.length > 0) {
      // @ts-expect-error - character structure is validated by DB
      const statParser = new CharacterStatParser(updatedChar);
      updatedChar.realStats = statParser.parseAndGetCharStats();
    }

    logger.info(`Character ${name} successfully refreshed`);

    // Return same format as GET endpoint (character directly, not wrapped)
    return res.json(updatedChar);
  } catch (error: unknown) {
    logger.error("Error refreshing character", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: "Failed to refresh character data",
    });
  }
});

// GET /api/characters/:name/analyze - Analyze character and provide build optimization recommendations
router.get(
  "/:name/analyze",
  validateSeason,
  autoCache(1800), // Cache for 30 minutes
  async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { gameMode = "softcore", season, includeMetaComparison = "true" } = req.query;

      const seasonNumber = season
        ? parseInt(season as string, 10)
        : config.currentSeason;
      const MODES = ["hardcore", "softcore"];

      // Fetch character (same logic as main character endpoint)
      let character = await characterDB.getCharacterByName(
        gameMode as string,
        name,
        seasonNumber
      );

      // Fallback search across modes
      if (!character) {
        for (const otherGameMode of MODES) {
          if (otherGameMode === gameMode) continue;
          character = await characterDB.getCharacterByName(
            otherGameMode,
            name,
            seasonNumber
          );
          if (character) break;
        }
      }

      // Fallback to previous season
      if (!character) {
        for (const gm of MODES) {
          character = await characterDB.getCharacterByName(
            gm,
            name,
            seasonNumber - 1
          );
          if (character) break;
        }
      }

      if (!character) {
        res.status(404).json({ error: { message: "Character not found" } });
        return;
      }

      // Ensure we have items to analyze
      if (!character.items || character.items.length === 0) {
        res.status(400).json({
          error: {
            message:
              "Cannot analyze character: No items found. Character may need to be refreshed.",
          },
        });
        return;
      }

      // Calculate character stats
      // @ts-expect-error - character structure is validated by DB
      const statParser = new CharacterStatParser(character);
      const stats = statParser.parseAndGetCharStats();

      // Optionally fetch meta item usage for comparison
      let metaItemUsage: Record<string, number> | undefined;
      if (includeMetaComparison === "true" && character.character) {
        try {
          const className = character.character.class.name;
          const itemUsageStats = await characterDB.analyzeItemUsage(
            gameMode as string,
            {
              season: seasonNumber,
              requiredClasses: [className],
            }
          );

          // Convert to map of item name -> percentage
          metaItemUsage = {};
          for (const stat of itemUsageStats) {
            // @ts-expect-error - ItemUsageStats structure varies by implementation
            const itemName = stat.itemName || stat.item_name;
            // @ts-expect-error - ItemUsageStats structure varies by implementation
            const percentage = stat.percentage || stat.usage_percentage || 0;
            if (itemName && typeof percentage === "number") {
              metaItemUsage[itemName] = percentage;
            }
          }
        } catch (error) {
          logger.warn("Failed to fetch meta item usage for comparison", {
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue without meta comparison
        }
      }

      // Run build optimization analysis
      // @ts-expect-error - character structure is validated by DB
      const optimizer = new BuildOptimizer(character, stats);
      const optimization = await optimizer.optimize(metaItemUsage);

      res.json(optimization);
    } catch (error: unknown) {
      logger.error("Error analyzing character", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        error: { message: "Failed to analyze character build" },
      });
    }
  }
);

export default router;
