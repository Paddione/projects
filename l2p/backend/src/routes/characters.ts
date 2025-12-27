import express, { Request, Response } from 'express';
import Joi from 'joi';
import { CharacterService } from '../services/CharacterService.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const characterService = new CharacterService();

// Validation schemas
const updateCharacterSchema = Joi.object({
  characterId: Joi.string()
    .valid('professor', 'student', 'librarian', 'researcher', 'dean', 'graduate', 'lab_assistant', 'teaching_assistant')
    .required()
    .messages({
      'any.only': 'Invalid character ID',
      'any.required': 'Character ID is required'
    })
});

const awardExperienceSchema = Joi.object({
  experiencePoints: Joi.number()
    .integer()
    .min(1)
    .max(10000)
    .required()
    .messages({
      'number.base': 'Experience points must be a number',
      'number.integer': 'Experience points must be an integer',
      'number.min': 'Experience points must be at least 1',
      'number.max': 'Experience points cannot exceed 10,000',
      'any.required': 'Experience points are required'
    })
});

/**
 * GET /api/characters
 * Get all available characters
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const characters = characterService.getAllCharacters();
    
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=7200, stale-while-revalidate=86400');
    res.json({
      success: true,
      data: characters,
      message: 'Characters retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting characters:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve characters',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/characters/available
 * Get available characters for the authenticated user based on their level
 */
router.get('/available', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
      return;
    }

    const userInfo = await characterService.getUserCharacterInfo(userId);
    if (!userInfo) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'User information not available'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        availableCharacters: userInfo.availableCharacters,
        currentCharacter: userInfo.character,
        level: userInfo.level,
        experience: userInfo.experience,
        progress: userInfo.progress
      },
      message: 'Available characters retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting available characters:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve available characters',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/characters/profile
 * Get the authenticated user's character information
 */
router.get('/profile', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
      return;
    }

    const userInfo = await characterService.getUserCharacterInfo(userId);
    if (!userInfo) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'User information not available'
      });
      return;
    }

    res.json({
      success: true,
      data: userInfo,
      message: 'Character profile retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting character profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve character profile',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * PUT /api/characters/select
 * Update user's selected character
 */
router.put('/select', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
      return;
    }

    // Validate request body
    const { error, value } = updateCharacterSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: error.details[0]?.message || 'Validation error',
        details: error.details
      });
      return;
    }

    const { characterId } = value;

    // Update user's character
    const updatedUser = await characterService.updateCharacter(userId, characterId);
    if (!updatedUser) {
      res.status(404).json({
        success: false,
        error: 'Update failed',
        message: 'Failed to update character selection'
      });
      return;
    }

    // Get updated character info
    const userInfo = await characterService.getUserCharacterInfo(userId);

    res.json({
      success: true,
      data: {
        user: updatedUser,
        characterInfo: userInfo
      },
      message: 'Character updated successfully'
    });
  } catch (error) {
    console.error('Error updating character:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid character ID')) {
        res.status(400).json({
          success: false,
          error: 'Invalid character',
          message: error.message
        });
        return;
      }
      
      if (error.message.includes('Character requires level')) {
        res.status(403).json({
          success: false,
          error: 'Character locked',
          message: error.message
        });
        return;
      }
      
      if (error.message.includes('User not found')) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          message: error.message
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update character',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/characters/experience/award
 * Award experience points to a user (typically called after game completion)
 */
router.post('/experience/award', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
      return;
    }

    // Validate request body
    const { error, value } = awardExperienceSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: error.details[0]?.message || 'Validation error',
        details: error.details
      });
      return;
    }

    const { experiencePoints } = value;

    // Award experience points
    const result = await characterService.awardExperience(userId, experiencePoints);

    res.json({
      success: true,
      data: result,
      message: 'Experience awarded successfully'
    });
  } catch (error) {
    console.error('Error awarding experience:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to award experience',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/characters/experience/calculate
 * Calculate experience requirements for levels
 */
router.get('/experience/calculate', async (req: Request, res: Response): Promise<void> => {
  try {
    const levelParam = (req.query as Record<string, unknown>)['level'] as string | undefined;
    const targetLevel = levelParam ? parseInt(levelParam, 10) : 10;

    if (isNaN(targetLevel) || targetLevel < 1 || targetLevel > 1000) {
      res.status(400).json({
        success: false,
        error: 'Invalid level',
        message: 'Level must be a number between 1 and 1000'
      });
      return;
    }

    const experienceData: Array<{ level: number; experienceRequired: number; experienceTotal: number }> = [];
    for (let i = 1; i <= targetLevel; i++) {
      const expForLevel = characterService.calculateLevelExperience(i);
      const totalExp = characterService.getTotalExperienceForLevel(i);
      experienceData.push({
        level: i,
        experienceRequired: expForLevel,
        experienceTotal: totalExp
      });
    }

    res.json({
      success: true,
      data: experienceData,
      message: 'Experience requirements calculated successfully'
    });
  } catch (error) {
    console.error('Error calculating experience requirements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate experience requirements',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

export default router; 
