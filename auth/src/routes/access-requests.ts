import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { and, eq, gte, desc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { accessRequests, apps, users, userAppAccess } from '../db/schema.js';
import { authenticate, requireAdmin } from '../middleware/authenticate.js';

const router = express.Router();

// ============================================================================
// USER ENDPOINTS
// ============================================================================

const createRequestSchema = z.object({
  appId: z.number().int().positive(),
  reason: z.string().max(500).optional(),
});

// Create access request
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const parsed = createRequestSchema.parse(req.body);
    const userId = req.user.userId;

    // Check if app exists
    const [app] = await db
      .select({ id: apps.id, name: apps.name, isActive: apps.is_active })
      .from(apps)
      .where(eq(apps.id, parsed.appId))
      .limit(1);

    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }

    if (!app.isActive) {
      res.status(400).json({ error: 'App is not active' });
      return;
    }

    // Check if user already has access
    const [existingAccess] = await db
      .select({ id: userAppAccess.id })
      .from(userAppAccess)
      .where(and(eq(userAppAccess.user_id, userId), eq(userAppAccess.app_id, parsed.appId)))
      .limit(1);

    if (existingAccess) {
      res.status(400).json({ error: 'You already have access to this app' });
      return;
    }

    // Check for pending request
    const [pendingRequest] = await db
      .select({ id: accessRequests.id })
      .from(accessRequests)
      .where(
        and(
          eq(accessRequests.user_id, userId),
          eq(accessRequests.app_id, parsed.appId),
          eq(accessRequests.status, 'pending')
        )
      )
      .limit(1);

    if (pendingRequest) {
      res.status(400).json({ error: 'You already have a pending request for this app' });
      return;
    }

    // Rate limiting: check if user made a request for this app in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentRequest] = await db
      .select({ id: accessRequests.id })
      .from(accessRequests)
      .where(
        and(
          eq(accessRequests.user_id, userId),
          eq(accessRequests.app_id, parsed.appId),
          gte(accessRequests.created_at, oneDayAgo)
        )
      )
      .limit(1);

    if (recentRequest) {
      res.status(429).json({ error: 'You can only request access to each app once per day' });
      return;
    }

    // Create the request
    const [newRequest] = await db
      .insert(accessRequests)
      .values({
        user_id: userId,
        app_id: parsed.appId,
        reason: parsed.reason || null,
        status: 'pending',
      })
      .returning();

    res.status(201).json({
      request: {
        id: newRequest.id,
        appId: newRequest.app_id,
        appName: app.name,
        reason: newRequest.reason,
        status: newRequest.status,
        createdAt: newRequest.created_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    console.error('Failed to create access request:', error);
    res.status(500).json({ error: 'Failed to create access request' });
  }
});

// Get user's own requests
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const requests = await db
      .select({
        id: accessRequests.id,
        appId: accessRequests.app_id,
        appName: apps.name,
        appKey: apps.key,
        reason: accessRequests.reason,
        status: accessRequests.status,
        adminResponse: accessRequests.admin_response,
        reviewedAt: accessRequests.reviewed_at,
        createdAt: accessRequests.created_at,
      })
      .from(accessRequests)
      .innerJoin(apps, eq(apps.id, accessRequests.app_id))
      .where(eq(accessRequests.user_id, req.user.userId))
      .orderBy(desc(accessRequests.created_at));

    res.status(200).json({ requests });
  } catch (error) {
    console.error('Failed to fetch access requests:', error);
    res.status(500).json({ error: 'Failed to fetch access requests' });
  }
});

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

const reviewRequestSchema = z.object({
  status: z.enum(['approved', 'denied']),
  response: z.string().max(500).optional(),
});

// Get all access requests (admin)
router.get('/admin', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const statusFilter = req.query.status as string;
    const validStatuses = ['pending', 'approved', 'denied', 'all'];
    const status = validStatuses.includes(statusFilter) ? statusFilter : 'pending';

    let query = db
      .select({
        id: accessRequests.id,
        userId: accessRequests.user_id,
        username: users.username,
        userEmail: users.email,
        appId: accessRequests.app_id,
        appName: apps.name,
        appKey: apps.key,
        reason: accessRequests.reason,
        status: accessRequests.status,
        adminResponse: accessRequests.admin_response,
        reviewedAt: accessRequests.reviewed_at,
        createdAt: accessRequests.created_at,
      })
      .from(accessRequests)
      .innerJoin(users, eq(users.id, accessRequests.user_id))
      .innerJoin(apps, eq(apps.id, accessRequests.app_id))
      .orderBy(desc(accessRequests.created_at));

    if (status !== 'all') {
      query = query.where(eq(accessRequests.status, status)) as typeof query;
    }

    const requests = await query;

    res.status(200).json({ requests });
  } catch (error) {
    console.error('Failed to fetch admin access requests:', error);
    res.status(500).json({ error: 'Failed to fetch access requests' });
  }
});

// Review access request (admin)
router.patch('/admin/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId)) {
      res.status(400).json({ error: 'Invalid request ID' });
      return;
    }

    const parsed = reviewRequestSchema.parse(req.body);

    // Get the request
    const [request] = await db
      .select({
        id: accessRequests.id,
        userId: accessRequests.user_id,
        appId: accessRequests.app_id,
        status: accessRequests.status,
      })
      .from(accessRequests)
      .where(eq(accessRequests.id, requestId))
      .limit(1);

    if (!request) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({ error: 'Request has already been reviewed' });
      return;
    }

    await db.transaction(async (tx) => {
      // Update the request
      await tx
        .update(accessRequests)
        .set({
          status: parsed.status,
          admin_response: parsed.response || null,
          reviewed_by: req.user!.userId,
          reviewed_at: new Date(),
        })
        .where(eq(accessRequests.id, requestId));

      // If approved, grant access
      if (parsed.status === 'approved') {
        // Check if access already exists (edge case)
        const [existingAccess] = await tx
          .select({ id: userAppAccess.id })
          .from(userAppAccess)
          .where(
            and(
              eq(userAppAccess.user_id, request.userId),
              eq(userAppAccess.app_id, request.appId)
            )
          )
          .limit(1);

        if (!existingAccess) {
          await tx.insert(userAppAccess).values({
            user_id: request.userId,
            app_id: request.appId,
          });
        }
      }
    });

    // Fetch updated request
    const [updatedRequest] = await db
      .select({
        id: accessRequests.id,
        userId: accessRequests.user_id,
        appId: accessRequests.app_id,
        status: accessRequests.status,
        adminResponse: accessRequests.admin_response,
        reviewedAt: accessRequests.reviewed_at,
      })
      .from(accessRequests)
      .where(eq(accessRequests.id, requestId))
      .limit(1);

    res.status(200).json({
      message: `Request ${parsed.status}`,
      request: updatedRequest,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    console.error('Failed to review access request:', error);
    res.status(500).json({ error: 'Failed to review access request' });
  }
});

export default router;
