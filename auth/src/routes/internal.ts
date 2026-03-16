import crypto from 'crypto';
import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { internalAuth } from '../middleware/internalAuth.js';
import { ProfileService } from '../services/ProfileService.js';
import { RespectService } from '../services/RespectService.js';
import { db } from '../config/database.js';
import { matchEscrow } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = express.Router();
const profileService = new ProfileService();
const respectService = new RespectService();

// Validation schemas
const respectCreditSchema = z.object({
  userId: z.number().int().positive(),
  amount: z.number().int().positive(),
  metadata: z.record(z.unknown()).optional(),
});

const respectDebitSchema = z.object({
  userId: z.number().int().positive(),
  amount: z.number().int().positive(),
  metadata: z.record(z.unknown()).optional(),
});

const xpAwardSchema = z.object({
  userId: z.number().int().positive(),
  amount: z.number().int().positive(),
});

const matchEscrowCreateSchema = z.object({
  playerIds: z.array(z.number().int().positive()).min(1),
  escrowedXp: z.record(z.number()),
  matchConfig: z.record(z.unknown()).optional(),
});

const matchSettleSchema = z.object({
  token: z.string().min(1),
  winnerId: z.number().int().positive(),
});

/**
 * POST /api/internal/respect/credit
 * Credit respect to a user's balance (service-to-service only)
 */
router.post('/internal/respect/credit', internalAuth, async (req: Request, res: Response) => {
  try {
    const { userId, amount, metadata } = respectCreditSchema.parse(req.body);
    const result = await respectService.creditRespect(userId, amount, metadata);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to credit respect' });
  }
});

/**
 * POST /api/internal/respect/debit
 * Debit respect from a user's balance (service-to-service only)
 */
router.post('/internal/respect/debit', internalAuth, async (req: Request, res: Response) => {
  try {
    const { userId, amount, metadata } = respectDebitSchema.parse(req.body);
    const result = await respectService.debitRespect(userId, amount, metadata);
    if ('status' in result && result.status === 402) {
      res.status(402).json({ error: result.error });
      return;
    }
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to debit respect' });
  }
});

/**
 * POST /api/internal/xp/award
 * Award XP to a user and recalculate level (service-to-service only)
 */
router.post('/internal/xp/award', internalAuth, async (req: Request, res: Response) => {
  try {
    const { userId, amount } = xpAwardSchema.parse(req.body);
    const updated = await profileService.awardXp(userId, amount);
    res.status(200).json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to award XP' });
  }
});

/**
 * POST /api/internal/match/escrow
 * Create a match escrow record with pending status (service-to-service only)
 */
router.post('/internal/match/escrow', internalAuth, async (req: Request, res: Response) => {
  try {
    const { playerIds, escrowedXp, matchConfig } = matchEscrowCreateSchema.parse(req.body);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    await db.insert(matchEscrow).values({
      token,
      player_ids: playerIds,
      escrowed_xp: escrowedXp,
      match_config: matchConfig ?? null,
      status: 'pending',
      expires_at: expiresAt,
    });

    res.status(201).json({ token, expiresAt });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to create match escrow' });
  }
});

/**
 * GET /api/internal/match/escrow/:token
 * Retrieve a match escrow record by token (service-to-service only)
 */
router.get('/internal/match/escrow/:token', internalAuth, async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const rows = await db
      .select()
      .from(matchEscrow)
      .where(eq(matchEscrow.token, token))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: 'Escrow not found' });
      return;
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch match escrow' });
  }
});

/**
 * POST /api/internal/match/settle
 * Settle a match escrow: award XP + Respect to the winner (service-to-service only)
 */
router.post('/internal/match/settle', internalAuth, async (req: Request, res: Response) => {
  try {
    const { token, winnerId } = matchSettleSchema.parse(req.body);

    // Fetch the escrow record
    const rows = await db
      .select()
      .from(matchEscrow)
      .where(eq(matchEscrow.token, token))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: 'Escrow not found' });
      return;
    }

    const escrow = rows[0];

    if (escrow.status !== 'pending' && escrow.status !== 'active') {
      res.status(409).json({ error: `Cannot settle escrow with status '${escrow.status}'` });
      return;
    }

    // Mark escrow as settled
    await db
      .update(matchEscrow)
      .set({ status: 'settled', settled_at: new Date() })
      .where(eq(matchEscrow.token, token));

    // Calculate total escrowed XP for all players
    const escrowedXp = escrow.escrowed_xp as Record<string, number>;
    const totalXp = Object.values(escrowedXp).reduce((sum, xp) => sum + xp, 0);
    const flatRespect = 50;

    // Award XP and Respect to winner
    await profileService.awardXp(winnerId, totalXp);
    await respectService.creditRespect(winnerId, flatRespect, {
      reason: 'match_win',
      matchToken: token,
    });

    res.status(200).json({
      settled: true,
      winnerId,
      xpAwarded: totalXp,
      respectAwarded: flatRespect,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to settle match' });
  }
});

export default router;
