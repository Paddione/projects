import express, { Request, Response } from 'express';
import Joi from 'joi';
import { HallOfFameService } from '../services/HallOfFameService.js';

import { ValidationMiddleware } from '../middleware/validation.js';

const router = express.Router();
const hallOfFameService = new HallOfFameService();

function setShortCache(res: Response, seconds: number = 30) {
  res.setHeader('Cache-Control', `public, max-age=${seconds}, s-maxage=${seconds * 2}, stale-while-revalidate=${seconds * 2}`);
}

/**
 * POST /api/hall-of-fame/submit
 * Submit a score to the Hall of Fame
 */
router.post('/submit',
  ValidationMiddleware.validate({
    body: Joi.object({
      sessionId: Joi.number().integer().positive().required(),
      username: Joi.string().min(1).max(50).required(),
      characterName: Joi.string().max(50).optional(),
      score: Joi.number().integer().min(0).required(),
      accuracy: Joi.number().min(0).max(100).required(),
      maxMultiplier: Joi.number().integer().min(1).max(5).required(),
      questionSetId: Joi.number().integer().positive().required(),
      questionSetName: Joi.string().min(1).max(100).required()
    })
  }),
  async (req: Request, res: Response) => {
    try {
      const submission = req.body;
      
      const entry = await hallOfFameService.submitScore(submission);

      res.json({
        success: true,
        data: entry,
        message: 'Score successfully submitted to Hall of Fame!'
      });
    } catch (error) {
      console.error('Error submitting score to Hall of Fame:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit score to Hall of Fame'
      });
    }
  }
);

/**
 * GET /api/hall-of-fame/leaderboard/:questionSetId
 * Get leaderboard for a specific question set
 */
router.get('/leaderboard/:questionSetId',
  ValidationMiddleware.validate({
    params: Joi.object({
      questionSetId: Joi.number().integer().positive().required()
    }),
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(100).default(10)
    })
  }),
  async (req: Request, res: Response) => {
    try {
      const { questionSetId } = req.params;
      const { limit } = req.query;
      
      const leaderboard = await hallOfFameService.getQuestionSetLeaderboard(
        parseInt(questionSetId as string),
        parseInt(limit as string) || 10
      );
      setShortCache(res, 30);
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
 * GET /api/hall-of-fame/leaderboards
 * Get all leaderboards for all question sets
 */
router.get('/leaderboards',
  async (req: Request, res: Response) => {
    try {
      const leaderboards = await hallOfFameService.getAllLeaderboards();
      setShortCache(res, 30);
      res.json({
        success: true,
        data: leaderboards
      });
    } catch (error) {
      console.error('Error getting all leaderboards:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get leaderboards'
      });
    }
  }
);

/**
 * GET /api/hall-of-fame/user/:username/best-scores
 * Get user's best scores across all question sets
 */
router.get('/user/:username/best-scores',
  ValidationMiddleware.validate({
    params: Joi.object({
      username: Joi.string().min(1).max(50).required()
    })
  }),
  async (req: Request, res: Response) => {
    try {
      const { username } = req.params;
      
      const bestScores = await hallOfFameService.getUserBestScores(username as string);
      setShortCache(res, 30);
      res.json({
        success: true,
        data: bestScores
      });
    } catch (error) {
      console.error('Error getting user best scores:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user best scores'
      });
    }
  }
);

/**
 * GET /api/hall-of-fame/user/:username/rank/:questionSetId
 * Get user's rank in a specific question set
 */
router.get('/user/:username/rank/:questionSetId',
  ValidationMiddleware.validate({
    params: Joi.object({
      username: Joi.string().min(1).max(50).required(),
      questionSetId: Joi.number().integer().positive().required()
    })
  }),
  async (req: Request, res: Response) => {
    try {
      const { username, questionSetId } = req.params;
      
      const rank = await hallOfFameService.getUserRankInQuestionSet(
        username as string,
        parseInt(questionSetId as string)
      );
      setShortCache(res, 30);
      res.json({
        success: true,
        data: { rank }
      });
    } catch (error) {
      console.error('Error getting user rank:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user rank'
      });
    }
  }
);

/**
 * GET /api/hall-of-fame/recent
 * Get recent Hall of Fame entries
 */
router.get('/recent',
  ValidationMiddleware.validate({
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(100).default(20)
    })
  }),
  async (req: Request, res: Response) => {
    try {
      const { limit } = req.query;
      
      const recentEntries = await hallOfFameService.getRecentEntries(
        parseInt(limit as string) || 20
      );
      setShortCache(res, 30);
      res.json({
        success: true,
        data: recentEntries
      });
    } catch (error) {
      console.error('Error getting recent entries:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get recent entries'
      });
    }
  }
);

/**
 * GET /api/hall-of-fame/statistics
 * Get Hall of Fame statistics
 */
router.get('/statistics',
  async (req: Request, res: Response) => {
    try {
      const statistics = await hallOfFameService.getStatistics();
      setShortCache(res, 60);
      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Error getting Hall of Fame statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get Hall of Fame statistics'
      });
    }
  }
);

/**
 * GET /api/hall-of-fame/search
 * Search Hall of Fame entries
 */
router.get('/search',
  ValidationMiddleware.validate({
    query: Joi.object({
      q: Joi.string().min(1).max(100).required(),
      limit: Joi.number().integer().min(1).max(100).default(50)
    })
  }),
  async (req: Request, res: Response) => {
    try {
      const { q: searchTerm, limit } = req.query;
      
      const searchResults = await hallOfFameService.searchEntries(
        searchTerm as string,
        parseInt(limit as string) || 50
      );
      setShortCache(res, 30);
      res.json({
        success: true,
        data: searchResults
      });
    } catch (error) {
      console.error('Error searching Hall of Fame entries:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search Hall of Fame entries'
      });
    }
  }
);

/**
 * POST /api/hall-of-fame/validate-eligibility
 * Validate if a game session is eligible for Hall of Fame submission
 */
router.post('/validate-eligibility',
  ValidationMiddleware.validate({
    body: Joi.object({
      sessionId: Joi.number().integer().positive().required()
    })
  }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      
      const eligibility = await hallOfFameService.validateEligibility(sessionId);

      res.json({
        success: true,
        data: eligibility
      });
    } catch (error) {
      console.error('Error validating Hall of Fame eligibility:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate Hall of Fame eligibility'
      });
    }
  }
);

export default router; 