/**
 * Verified Support Resources API Router
 * DV-Assistance Platform - Step 16
 *
 * Implements:
 * - GET /api/v1/resources: Public directory of verified domestic violence crisis resources
 *
 * Security Guarantees:
 * - Permission: `emergency:view` (accessible to anonymous, clients, advocates, partners)
 * - Server-side enforcement of `isActive = true` and `verifiedAt IS NOT NULL`
 * - Exposes zero internal database credentials, survivor data, or administrative context
 */

import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { requirePermission } from '../auth/authorization.ts';
import { resourceRepository } from '../repositories/resourceRepository.ts';
import { recordAuditEvent } from '../audit/auditLogger.ts';

export const resourcesRouter = Router();

/**
 * GET /api/v1/resources
 * Returns verified, active domestic violence emergency crisis resources.
 */
resourcesRouter.get(
  '/',
  requirePermission('emergency:view'),
  asyncHandler(async (req: Request, res: Response) => {
    const categoryQuery = typeof req.query.category === 'string' ? req.query.category : undefined;

    const resources = await resourceRepository.listVerifiedResources(categoryQuery);

    recordAuditEvent({
      action: 'resource:viewed',
      outcome: 'success',
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || 'anonymous',
      resourceType: 'support_resources',
      requestId: req.requestId,
      metadata: {
        count: resources.length,
        categoryFilter: categoryQuery || 'all',
      },
    });

    res.status(200).json({
      resources,
      count: resources.length,
    });
  })
);

export default resourcesRouter;
