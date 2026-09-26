/**
 * Safety Plan Domain API Router
 * DV-Assistance Platform - Step 13
 *
 * Implements:
 * - GET /api/v1/safety-plans: Get active safety plan (Client: own; Advocate: assigned via case)
 * - GET /api/v1/safety-plans/:id: Get specific safety plan (Scoped by authorizeSafetyPlanAccess)
 * - PUT /api/v1/safety-plans: Create/Update safety plan (Client with safety_plan:write)
 *
 * Admin Data Wall: Admin accounts strictly blocked.
 */

import { Router, type Request, type Response } from 'express';
import { ApiError } from '../middleware/errorHandler.ts';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { requirePermission, authorizeSafetyPlanAccess } from '../auth/authorization.ts';
import { safetyPlanRepository } from '../repositories/safetyPlanRepository.ts';
import { recordAuditEvent } from '../audit/auditLogger.ts';

export const safetyPlansRouter = Router();

/**
 * GET /api/v1/safety-plans
 * Returns caller's active safety plan.
 */
safetyPlansRouter.get(
  '/',
  requirePermission('safety_plan:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;
    if (!user || user.isAnonymous) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.');
    }

    if (user.role === 'admin') {
      recordAuditEvent({
        action: 'security:admin_safety_plan_list_blocked',
        outcome: 'denied',
        actorUserId: user.id,
        actorRole: 'admin',
        resourceType: 'safety_plan',
        requestId: req.requestId,
      });
      throw new ApiError(403, 'FORBIDDEN', 'Administrative accounts are barred from safety plan access.');
    }

    const plan = await safetyPlanRepository.getSafetyPlanByClientId(user.id);

    recordAuditEvent({
      action: 'safety_plan:viewed',
      outcome: 'success',
      actorUserId: user.id,
      actorRole: user.role,
      resourceType: 'safety_plan',
      resourceId: plan?.id || null,
      requestId: req.requestId,
    });

    res.status(200).json({
      plan: plan || null,
    });
  })
);

/**
 * GET /api/v1/safety-plans/:id
 * Retrieves specific safety plan. Enforces authorizeSafetyPlanAccess.
 */
safetyPlansRouter.get(
  '/:id',
  requirePermission('safety_plan:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const { plan } = await authorizeSafetyPlanAccess(req.user, req.params.id, req.requestId);

    recordAuditEvent({
      action: 'safety_plan:inspected',
      outcome: 'success',
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || 'client',
      resourceType: 'safety_plan',
      resourceId: plan.id,
      requestId: req.requestId,
    });

    res.status(200).json({
      plan,
    });
  })
);

/**
 * PUT /api/v1/safety-plans
 * Creates or updates survivor's safety plan. Client self-service only.
 */
safetyPlansRouter.put(
  '/',
  requirePermission('safety_plan:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;
    if (!user || user.role !== 'client') {
      throw new ApiError(403, 'FORBIDDEN', 'Only client accounts may update personal safety plans.');
    }

    const { safeLocations, emergencyContacts, essentialItems, safeCodeWord, caseId } = req.body || {};

    const updatedPlan = await safetyPlanRepository.upsertSafetyPlan({
      clientId: user.id,
      caseId: typeof caseId === 'string' ? caseId : undefined,
      safeLocations: Array.isArray(safeLocations) ? safeLocations : [],
      emergencyContacts: Array.isArray(emergencyContacts) ? emergencyContacts : [],
      essentialItems: Array.isArray(essentialItems) ? essentialItems : [],
      safeCodeWord: typeof safeCodeWord === 'string' ? safeCodeWord.trim() : null,
    });

    recordAuditEvent({
      action: 'safety_plan:updated',
      outcome: 'success',
      actorUserId: user.id,
      actorRole: 'client',
      resourceType: 'safety_plan',
      resourceId: updatedPlan.id,
      requestId: req.requestId,
      metadata: { version: updatedPlan.version },
    });

    res.status(200).json({
      plan: updatedPlan,
      message: 'Safety plan saved successfully.',
    });
  })
);

export default safetyPlansRouter;
