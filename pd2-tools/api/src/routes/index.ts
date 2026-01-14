import { Router } from "express";
import healthRoutes from "./health";
import charactersRoutes from "./characters";
import economyRoutes from "./economy";
import statisticsRoutes from "./statistics";
import accountsRoutes from "./accounts";
import leaderboardRoutes from "./leaderboard";

const router = Router();

router.use("/health", healthRoutes);
router.use("/characters", charactersRoutes);
router.use("/economy", economyRoutes);
router.use("/statistics", statisticsRoutes);
router.use("/accounts", accountsRoutes);
router.use("/leaderboard", leaderboardRoutes);

export default router;
