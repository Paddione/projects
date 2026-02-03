import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { LobbyService, CreateLobbyRequest, JoinLobbyRequest } from '../services/LobbyService.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
const lobbyService = new LobbyService();

// Validation schemas
const createLobbySchema = Joi.object({
  questionCount: Joi.number().integer().min(1).max(100).default(10),
  questionSetIds: Joi.array().items(Joi.number().integer().positive()).default([]),
  settings: Joi.object({
    timeLimit: Joi.number().integer().min(10).max(300).default(60),
    allowReplay: Joi.boolean().default(true)
  }).unknown(true).default({})
});

const joinLobbySchema = Joi.object({
  lobbyCode: Joi.string().length(6).pattern(/^[A-Z0-9]+$/).required()
    .messages({
      'string.length': 'Lobby code must be exactly 6 characters',
      'string.pattern.base': 'Lobby code must contain only uppercase letters and numbers'
    })
});

const updatePlayerSchema = Joi.object({
  isReady: Joi.boolean(),
  isConnected: Joi.boolean(),
  character: Joi.string().min(1).max(50)
}).min(1);

const updateSettingsSchema = Joi.object({
  questionCount: Joi.number().integer().min(1).max(100),
  questionSetIds: Joi.array().items(Joi.number().integer().positive()),
  timeLimit: Joi.number().integer().min(10).max(300),
  allowReplay: Joi.boolean()
}).min(1);

const updateQuestionSetsSchema = Joi.object({
  questionSetIds: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
  questionCount: Joi.number().integer().min(5).max(100).required()
});

/**
 * POST /api/lobbies
 * Create a new lobby
 */
router.post('/', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'User must be authenticated to create a lobby'
    });
    return;
  }

  // Validate request body
  const { error, value } = createLobbySchema.validate(req.body);
  if (error) {
    res.status(400).json({
      error: 'Validation failed',
      message: error.details[0]?.message || 'Invalid request data',
      details: error.details
    });
    return;
  }

  try {
    const createRequest: CreateLobbyRequest = {
      hostId: req.user.userId,
      username: req.user.username,
      selectedCharacter: req.user.selectedCharacter,
      characterLevel: req.user.characterLevel,
      questionCount: value.questionCount,
      questionSetIds: value.questionSetIds,
      settings: value.settings
    };

    const lobby = await lobbyService.createLobby(createRequest);

    res.status(201).json({
      message: 'Lobby created successfully',
      lobby
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Host user not found') {
        res.status(404).json({
          error: 'User not found',
          message: 'Host user does not exist'
        });
        return;
      }

      if (error.message.includes('Failed to generate unique lobby code')) {
        res.status(500).json({
          error: 'Lobby creation failed',
          message: 'Unable to generate unique lobby code. Please try again.'
        });
        return;
      }
    }

    console.error('Create lobby error:', error);
    res.status(500).json({
      error: 'Lobby creation failed',
      message: 'An unexpected error occurred while creating the lobby'
    });
  }
}));

/**
 * POST /api/lobbies/join
 * Join an existing lobby
 */
router.post('/join', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'User must be authenticated to join a lobby'
    });
    return;
  }
  // Validate request body
  const { error, value } = joinLobbySchema.validate(req.body);
  if (error) {
    res.status(400).json({
      error: 'Validation failed',
      message: error.details[0]?.message || 'Invalid request data',
      details: error.details
    });
    return;
  }

  try {
    const joinRequest: JoinLobbyRequest = {
      lobbyCode: value.lobbyCode.toUpperCase(),
      player: {
        id: req.user.userId.toString(), // Use authenticated user ID
        username: req.user.username, // Use authenticated user username
        character: req.user.selectedCharacter || 'student', // Use authenticated user character
        characterLevel: req.user.characterLevel || 1, // Use authenticated user character level
        isReady: false,
        isConnected: true
      }
    };

    const lobby = await lobbyService.joinLobby(joinRequest);

    res.status(200).json({
      message: 'Successfully joined lobby',
      lobby
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Lobby not found') {
        res.status(404).json({
          error: 'Lobby not found',
          message: 'No lobby found with the provided code'
        });
        return;
      }

      if (error.message === 'Lobby is not accepting new players') {
        res.status(409).json({
          error: 'Lobby unavailable',
          message: 'This lobby is not currently accepting new players'
        });
        return;
      }

      if (error.message === 'Lobby is full') {
        res.status(409).json({
          error: 'Lobby full',
          message: 'This lobby has reached the maximum number of players (8)'
        });
        return;
      }
    }

    console.error('Join lobby error:', error);
    res.status(500).json({
      error: 'Failed to join lobby',
      message: 'An unexpected error occurred while joining the lobby'
    });
  }
}));

// NOTE: The generic `/:code` route must be registered AFTER all more specific
// routes (like `/my`, `/stats`, `/question-sets/available`, and multi-segment
// variants like `/:code/settings`) to avoid accidental matching of those paths.

/**
 * DELETE /api/lobbies/:code/leave
 * Leave a lobby
 */
router.delete('/:code/leave', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'User must be authenticated to leave a lobby'
    });
    return;
  }

  const { code } = req.params;
  // Use authenticated user ID; ignore any client-provided playerId
  const playerId = req.user.userId.toString();

  if (!code) {
    res.status(400).json({
      error: 'Missing lobby code',
      message: 'Lobby code is required'
    });
    return;
  }

  // Validate lobby code format
  if (!LobbyService.isValidLobbyCode(code.toUpperCase())) {
    res.status(400).json({
      error: 'Invalid lobby code',
      message: 'Lobby code must be 6 characters containing only letters and numbers'
    });
    return;
  }

  try {
    const lobby = await lobbyService.leaveLobby(code.toUpperCase(), playerId);

    if (lobby === null) {
      res.status(200).json({
        message: 'Lobby was deleted as the last player left',
        lobbyDeleted: true
      });
      return;
    }

    res.status(200).json({
      message: 'Successfully left lobby',
      lobby
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Lobby not found') {
        res.status(404).json({
          error: 'Lobby not found',
          message: 'No lobby found with the provided code'
        });
        return;
      }

      if (error.message === 'Player not found in lobby') {
        res.status(404).json({
          error: 'Player not found',
          message: 'Player is not a member of this lobby'
        });
        return;
      }
    }

    console.error('Leave lobby error:', error);
    res.status(500).json({
      error: 'Failed to leave lobby',
      message: 'An unexpected error occurred while leaving the lobby'
    });
  }
}));

/**
 * PUT /api/lobbies/:code/players/:playerId
 * Update player status in lobby
 */
router.put('/:code/players/:playerId', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'User must be authenticated to update player status'
    });
    return;
  }

  const { code, playerId } = req.params;

  // Verify the authenticated user matches the player being updated
  if (req.user.userId.toString() !== playerId) {
    res.status(403).json({
      error: 'Permission denied',
      message: 'You can only update your own player status'
    });
    return;
  }

  if (!code) {
    res.status(400).json({
      error: 'Missing lobby code',
      message: 'Lobby code is required'
    });
    return;
  }

  if (!playerId) {
    res.status(400).json({
      error: 'Missing player ID',
      message: 'Player ID is required'
    });
    return;
  }

  // Validate lobby code format
  if (!LobbyService.isValidLobbyCode(code.toUpperCase())) {
    res.status(400).json({
      error: 'Invalid lobby code',
      message: 'Lobby code must be 6 characters containing only letters and numbers'
    });
    return;
  }

  // Validate request body
  const { error, value } = updatePlayerSchema.validate(req.body);
  if (error) {
    res.status(400).json({
      error: 'Validation failed',
      message: error.details[0]?.message || 'Invalid request data',
      details: error.details
    });
    return;
  }

  try {
    let lobby;

    // Handle different update types
    if (value.hasOwnProperty('isReady')) {
      lobby = await lobbyService.updatePlayerReady(code.toUpperCase(), playerId, value.isReady);
    } else if (value.hasOwnProperty('isConnected')) {
      lobby = await lobbyService.updatePlayerConnection(code.toUpperCase(), playerId, value.isConnected);
    } else {
      // For other updates, we'd need to extend the service
      res.status(400).json({
        error: 'Unsupported update',
        message: 'Only isReady and isConnected updates are currently supported'
      });
      return;
    }

    res.status(200).json({
      message: 'Player status updated successfully',
      lobby
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Lobby not found') {
        res.status(404).json({
          error: 'Lobby not found',
          message: 'No lobby found with the provided code'
        });
        return;
      }

      if (error.message === 'Player not found in lobby') {
        res.status(404).json({
          error: 'Player not found',
          message: 'Player is not a member of this lobby'
        });
        return;
      }
    }

    console.error('Update player error:', error);
    res.status(500).json({
      error: 'Failed to update player',
      message: 'An unexpected error occurred while updating player status'
    });
  }
}));

/**
 * PUT /api/lobbies/:code/settings
 * Update lobby settings (host only)
 */
router.put('/:code/settings', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'User must be authenticated to update lobby settings'
    });
    return;
  }

  const { code } = req.params;

  if (!code) {
    res.status(400).json({
      error: 'Missing lobby code',
      message: 'Lobby code is required'
    });
    return;
  }

  // Validate lobby code format
  if (!LobbyService.isValidLobbyCode(code.toUpperCase())) {
    res.status(400).json({
      error: 'Invalid lobby code',
      message: 'Lobby code must be 6 characters containing only letters and numbers'
    });
    return;
  }

  // Validate request body
  const { error, value } = updateSettingsSchema.validate(req.body);
  if (error) {
    res.status(400).json({
      error: 'Validation failed',
      message: error.details[0]?.message || 'Invalid request data',
      details: error.details
    });
    return;
  }

  try {
    const lobby = await lobbyService.updateLobbySettings(code.toUpperCase(), req.user.userId, value);

    res.status(200).json({
      message: 'Lobby settings updated successfully',
      lobby
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Lobby not found') {
        res.status(404).json({
          error: 'Lobby not found',
          message: 'No lobby found with the provided code'
        });
        return;
      }

      if (error.message === 'Only the host can update lobby settings') {
        res.status(403).json({
          error: 'Permission denied',
          message: 'Only the lobby host can update settings'
        });
        return;
      }

      if (error.message === 'Cannot update settings after game has started') {
        res.status(409).json({
          error: 'Game in progress',
          message: 'Cannot update settings after the game has started'
        });
        return;
      }
    }

    console.error('Update lobby settings error:', error);
    res.status(500).json({
      error: 'Failed to update lobby settings',
      message: 'An unexpected error occurred while updating lobby settings'
    });
  }
}));

/**
 * POST /api/lobbies/:code/start
 * Start a game (host only)
 */
router.post('/:code/start', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'User must be authenticated to start a game'
    });
    return;
  }

  const { code } = req.params;

  if (!code) {
    res.status(400).json({
      error: 'Missing lobby code',
      message: 'Lobby code is required'
    });
    return;
  }

  // Validate lobby code format
  if (!LobbyService.isValidLobbyCode(code.toUpperCase())) {
    res.status(400).json({
      error: 'Invalid lobby code',
      message: 'Lobby code must be 6 characters containing only letters and numbers'
    });
    return;
  }

  try {
    const lobby = await lobbyService.startGame(code.toUpperCase(), req.user.userId);

    res.status(200).json({
      message: 'Game started successfully',
      lobby
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Lobby not found') {
        res.status(404).json({
          error: 'Lobby not found',
          message: 'No lobby found with the provided code'
        });
        return;
      }

      if (error.message === 'Only the host can start the game') {
        res.status(403).json({
          error: 'Permission denied',
          message: 'Only the lobby host can start the game'
        });
        return;
      }

      if (error.message === 'Game has already been started or ended') {
        res.status(409).json({
          error: 'Game unavailable',
          message: 'This game has already been started or ended'
        });
        return;
      }

      if (typeof error.message === 'string' && error.message.includes('All players must be ready')) {
        res.status(409).json({
          error: 'Players not ready',
          message: 'All players must be ready before the game can start'
        });
        return;
      }

      if (typeof error.message === 'string' && error.message.includes('players are required to start the game')) {
        res.status(409).json({
          error: 'Insufficient players',
          message: error.message
        });
        return;
      }
    }

    console.error('Start game error:', error);
    res.status(500).json({
      error: 'Failed to start game',
      message: 'An unexpected error occurred while starting the game'
    });
  }
}));

/**
 * GET /api/lobbies
 * Get active lobbies (optional limit parameter)
 */
router.get('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const limitVal = (req.query as Record<string, unknown>)['limit'];
  const limit = limitVal ? parseInt(limitVal as string) : undefined;

  if (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100)) {
    res.status(400).json({
      error: 'Invalid limit',
      message: 'Limit must be a number between 1 and 100'
    });
    return;
  }

  try {
    const lobbies = await lobbyService.getActiveLobbies(limit);

    res.status(200).json({
      lobbies,
      count: lobbies.length
    });
  } catch (error) {
    console.error('Get active lobbies error:', error);
    res.status(500).json({
      error: 'Failed to retrieve lobbies',
      message: 'An unexpected error occurred while retrieving active lobbies'
    });
  }
}));

/**
 * GET /api/lobbies/my
 * Get lobbies created by the authenticated user
 */
router.get('/my', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'User must be authenticated to view their lobbies'
    });
    return;
  }

  try {
    const lobbies = await lobbyService.getLobbiesByHost(req.user.userId);

    res.status(200).json({
      lobbies,
      count: lobbies.length
    });
  } catch (error) {
    console.error('Get user lobbies error:', error);
    res.status(500).json({
      error: 'Failed to retrieve lobbies',
      message: 'An unexpected error occurred while retrieving your lobbies'
    });
  }
}));

/**
 * GET /api/lobbies/stats
 * Get lobby statistics
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await lobbyService.getLobbyStats();

    res.status(200).json({
      stats
    });
  } catch (error) {
    console.error('Get lobby stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve lobby statistics',
      message: 'An unexpected error occurred while retrieving lobby statistics'
    });
  }
}));

/**
 * DELETE /api/lobbies/cleanup
 * Clean up old lobbies (admin endpoint)
 */
router.delete('/cleanup', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // This could be extended to check for admin permissions
  const hoursVal = (req.query as Record<string, unknown>)['hours'];
  const hoursOld = hoursVal ? parseInt(hoursVal as string) : 24;

  if (isNaN(hoursOld) || hoursOld < 1) {
    res.status(400).json({
      error: 'Invalid hours parameter',
      message: 'Hours must be a positive number'
    });
    return;
  }

  try {
    const deletedCount = await lobbyService.cleanupOldLobbies(hoursOld);

    res.status(200).json({
      message: `Cleanup completed successfully`,
      deletedLobbies: deletedCount
    });
  } catch (error) {
    console.error('Cleanup lobbies error:', error);
    res.status(500).json({
      error: 'Failed to cleanup lobbies',
      message: 'An unexpected error occurred during cleanup'
    });
  }
}));

/**
 * GET /api/lobbies/question-sets/available
 * Get available question sets for lobby creation
 * Public endpoint - no authentication required for basic question set info
 */
router.get('/question-sets/available', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const questionSets = await lobbyService.getAvailableQuestionSets();

    res.status(200).json({
      questionSets,
      count: questionSets.length
    });
  } catch (error) {
    console.error('Get available question sets error:', error);
    res.status(500).json({
      error: 'Failed to retrieve question sets',
      message: 'An unexpected error occurred while retrieving question sets'
    });
  }
}));

/**
 * PUT /api/lobbies/:code/question-sets
 * Update lobby question set settings (host only)
 */
router.put('/:code/question-sets', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'User must be authenticated to update question sets'
    });
    return;
  }

  const { code } = req.params;

  if (!code) {
    res.status(400).json({
      error: 'Missing lobby code',
      message: 'Lobby code is required'
    });
    return;
  }

  // Validate lobby code format
  if (!LobbyService.isValidLobbyCode(code.toUpperCase())) {
    res.status(400).json({
      error: 'Invalid lobby code format',
      message: 'Lobby code must be exactly 6 characters with uppercase letters and numbers'
    });
    return;
  }

  // Validate request body
  const { error, value } = updateQuestionSetsSchema.validate(req.body);
  if (error) {
    res.status(400).json({
      error: 'Validation failed',
      message: error.details[0]?.message || 'Invalid request data',
      details: error.details
    });
    return;
  }

  try {
    const lobby = await lobbyService.updateLobbyQuestionSets(
      code.toUpperCase(),
      req.user.userId,
      value.questionSetIds,
      value.questionCount
    );

    res.status(200).json({
      message: 'Question set settings updated successfully',
      lobby
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Lobby not found') {
        res.status(404).json({
          error: 'Lobby not found',
          message: 'No lobby found with the provided code'
        });
        return;
      }

      if (error.message === 'Only the host can update question set settings') {
        res.status(403).json({
          error: 'Permission denied',
          message: 'Only the lobby host can update question set settings'
        });
        return;
      }

      if (error.message === 'Cannot update settings after game has started') {
        res.status(409).json({
          error: 'Game already started',
          message: 'Cannot update question set settings after the game has started'
        });
        return;
      }

      if (error.message.includes('Invalid question set selection')) {
        res.status(400).json({
          error: 'Invalid question set selection',
          message: error.message
        });
        return;
      }

      if (error.message.includes('Minimum 5 questions required')) {
        res.status(400).json({
          error: 'Invalid question count',
          message: error.message
        });
        return;
      }

      if (error.message.includes('Maximum')) {
        res.status(400).json({
          error: 'Invalid question count',
          message: error.message
        });
        return;
      }
    }

    console.error('Update question sets error:', error);
    res.status(500).json({
      error: 'Failed to update question set settings',
      message: 'An unexpected error occurred while updating question set settings'
    });
  }
}));

/**
 * GET /api/lobbies/:code/question-sets
 * Get lobby question set information
 */
router.get('/:code/question-sets', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { code } = req.params;

  if (!code) {
    res.status(400).json({
      error: 'Missing lobby code',
      message: 'Lobby code is required'
    });
    return;
  }

  // Validate lobby code format
  if (!LobbyService.isValidLobbyCode(code.toUpperCase())) {
    res.status(400).json({
      error: 'Invalid lobby code format',
      message: 'Lobby code must be exactly 6 characters with uppercase letters and numbers'
    });
    return;
  }

  try {
    const questionSetInfo = await lobbyService.getLobbyQuestionSetInfo(code.toUpperCase());

    if (!questionSetInfo) {
      res.status(404).json({
        error: 'Lobby not found',
        message: 'No lobby found with the provided code'
      });
      return;
    }

    res.status(200).json({
      questionSetInfo
    });
  } catch (error) {
    console.error('Get lobby question set info error:', error);
    res.status(500).json({
      error: 'Failed to retrieve question set information',
      message: 'An unexpected error occurred while retrieving question set information'
    });
  }
}));

/**
 * GET /api/lobbies/:code
 * Get lobby details by code
 * Registered last to avoid shadowing other routes
 */
router.get('/:code', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { code } = req.params;

  if (!code) {
    res.status(400).json({
      error: 'Missing lobby code',
      message: 'Lobby code is required'
    });
    return;
  }

  // Validate lobby code format
  if (!LobbyService.isValidLobbyCode(code.toUpperCase())) {
    res.status(400).json({
      error: 'Invalid lobby code',
      message: 'Lobby code must be 6 characters containing only letters and numbers'
    });
    return;
  }

  try {
    const lobby = await lobbyService.getLobbyByCode(code.toUpperCase());

    if (!lobby) {
      res.status(404).json({
        error: 'Lobby not found',
        message: 'No lobby found with the provided code'
      });
      return;
    }

    // Short-lived cache with revalidation to reduce thrash on repeated GETs
    res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=15');

    res.status(200).json({
      success: true,
      lobby
    });
  } catch (error) {
    console.error('Get lobby error:', error);
    res.status(500).json({
      error: 'Failed to get lobby',
      message: 'An unexpected error occurred while fetching the lobby'
    });
  }
}));

export default router;
