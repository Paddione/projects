import { Router, Request, Response } from "express";
import { characterDB } from "../database";
import { logger as mainLogger } from "../config";
import { autoCache } from "../middleware/auto-cache";

const logger = mainLogger.createNamedLogger("API");
const router = Router();

// GET /api/statistics/online-players - Get online players history
router.get(
  "/online-players",
  autoCache(900),
  async (_req: Request, res: Response) => {
    try {
      const history = await characterDB.getOnlinePlayersHistory();
      res.json(history);
    } catch (error: unknown) {
      logger.error("Error fetching online players history", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { message: "Failed to fetch online players history" },
      });
    }
  }
);

// GET /api/statistics/online-players-last - Get latest online player count
router.get(
  "/online-players-last",
  autoCache(900),
  async (_req: Request, res: Response) => {
    try {
      // Fetch from database
      const latest = await characterDB.getOnlinePlayersLast();

      res.json(latest);
    } catch (error: unknown) {
      logger.error("Error fetching latest online players", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { message: "Failed to fetch latest online players" },
      });
    }
  }
);

// GET /api/statistics/character-counts - Get character counts by game mode
router.get(
  "/character-counts",
  autoCache(900),
  async (_req: Request, res: Response) => {
    try {
      // Fetch from database
      const counts = await characterDB.getCharacterCounts();

      res.json(counts);
    } catch (error: unknown) {
      logger.error("Error fetching character counts", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { message: "Failed to fetch character counts" },
      });
    }
  }
);

export default router;
