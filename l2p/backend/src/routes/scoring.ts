import express, { Request, Response } from 'express';
import Joi from 'joi';
import { ScoringService } from '../services/ScoringService.js';
import { authenticate } from '../middleware/auth.js';
import { ValidationMiddleware } from '../middleware/validation.js';

const router = express.Router();
const scoringService = new ScoringService();

/**
 * GET /api/scoring/leaderboard
 * Get leaderboard for a question set
 */
router.get('/leaderboard', 
  ValidationMiddleware.validate({
    query: Joi.object({
      questionSetId: Joi.number().integer().positive().required(),
      limit: Joi.number().integer().min(1).max(100).default(10)
    })
  }),
  async (req: Request, res: Response) => {
    try {
      const { questionSetId, limit } = req.query;
      
      const leaderboard = await scoringService.getLeaderboard(
        parseInt(questionSetId as string),
        parseInt(limit as string) || 10
      );

      res.json({
        success: true,
        data: leaderboard
      });
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get leaderboard'
      });
    }
  }
);

/**
 * GET /api/scoring/statistics/:userId
 * Get player statistics
 */
router.get('/statistics/:userId',
  authenticate,
  ValidationMiddleware.validate({
    params: Joi.object({
      userId: Joi.number().integer().positive().required()
    })
  }),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }
      
      const statistics = await scoringService.getPlayerStatistics(parseInt(userId));

      return res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Error getting player statistics:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get player statistics'
      });
    }
  }
);

/**
 * POST /api/scoring/validate-hall-of-fame
 * Validate if a game session qualifies for Hall of Fame
 */
router.post('/validate-hall-of-fame',
  ValidationMiddleware.validate({
    body: Joi.object({
      gameSessionId: Joi.number().integer().positive().required(),
      totalQuestions: Joi.number().integer().positive().required(),
      completedQuestions: Joi.number().integer().min(0).required()
    })
  }),
  async (req: Request, res: Response) => {
    try {
      const { gameSessionId, totalQuestions, completedQuestions } = req.body;
      
      const isEligible = scoringService.validateHallOfFameEligibility(
        gameSessionId,
        totalQuestions,
        completedQuestions
      );

      return res.json({
        success: true,
        data: {
          isEligible,
          completionRate: (completedQuestions / totalQuestions) * 100
        }
      });
    } catch (error) {
      console.error('Error validating Hall of Fame eligibility:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to validate Hall of Fame eligibility'
      });
    }
  }
);

/**
 * GET /api/scoring/performance-rating
 * Get performance rating based on score and accuracy
 */
router.get('/performance-rating',
  ValidationMiddleware.validate({
    query: Joi.object({
      score: Joi.number().integer().min(0).required(),
      accuracy: Joi.number().integer().min(0).max(100).required(),
      maxMultiplier: Joi.number().integer().min(1).max(5).required()
    })
  }),
  async (req: Request, res: Response) => {
    try {
      const { score, accuracy, maxMultiplier } = req.query;
      
      const rating = scoringService.getPerformanceRating(
        parseInt(score as string),
        parseInt(accuracy as string),
        parseInt(maxMultiplier as string)
      );

      return res.json({
        success: true,
        data: { rating }
      });
    } catch (error) {
      console.error('Error getting performance rating:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get performance rating'
      });
    }
  }
);

export default router; 