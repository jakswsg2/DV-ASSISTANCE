/**
 * Case Domain API Router
 * DV-Assistance Platform - Step 13
 *
 * Implements:
 * - GET  /api/v1/cases: List accessible cases (Client: own cases; Advocate: assigned cases)
 * - GET  /api/v1/cases/:id: Detailed case access (Enforces authorizeCaseAccess)
 * - POST /api/v1/cases: Case creation (Advocate with cases:create)
 * - PATCH /api/v1/cases/:id: Case update (Assigned Advocate with cases:edit_assigned)
 * - POST /api/v1/cases/:id/close: Case closure status transition (Assigned Advocate with cases:close)
 * - POST /api/v1/cases/:id/assign: Advocate assignment/reassignment
 *
 * Admin Data Wall: Admin role strictly blocked from all case routes.
 */

import { Router, type Request, type Response } from 'express';
import { ApiError } from '../middleware/errorHandler.ts';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { requirePermission, authorizeCaseAccess } from '../auth/authorization.ts';
import { caseRepository, type DangerLevel, type CaseStatus } from '../repositories/caseRepository.ts';
import { recordAuditEvent } from '../audit/auditLogger.ts';
import { db } from '../../db/index.ts';
import { dbConfig } from '../../db/config.ts';
import { users } from '../../db/schema.ts';
import { devDataStore } from '../repositories/devStore.ts';
import { eq } from 'drizzle-orm';

export const casesRouter = Router();

const VALID_DANGER_LEVELS: ReadonlyArray<DangerLevel> = ['standard', 'elevated', 'high', 'severe'];
const VALID_STATUSES: ReadonlyArray<CaseStatus> = ['intake_pending', 'active', 'under_review', 'closed', 'escalated'];

/**
 * GET /api/v1/cases
 * Returns cases scoped to the authenticated caller's role.
 */
casesRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;
    if (!user || user.isAnonymous) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    }

    // Admin Data Wall
    if (user.role === 'admin') {
      recordAuditEvent({
        action: 'security:admin_case_list_blocked',
        outcome: 'denied',
        actorUserId: user.id,
        actorRole: 'admin',
        resourceType: 'cases_list',
        requestId: req.requestId,
      });
      throw new ApiError(403, 'FORBIDDEN', 'Administrative accounts are strictly barred from accessing survivor case records.');
    }

    if (user.role === 'client') {
      const clientCases = await caseRepository.listCasesForClient(user.id);
      return res.status(200).json({ cases: clientCases });
    }

    if (user.role === 'advocate') {
      const assignedCases = await caseRepository.listAssignedCasesForAdvocate(user.id);
      return res.status(200).json({ cases: assignedCases });
    }

    // Partner or other roles have no general case access
    res.status(200).json({ cases: [] });
  })
);

/**
 * GET /api/v1/cases/:id
 * Retrieves case dossier. Strictly scoped via authorizeCaseAccess.
 */
casesRouter.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { caseRecord } = await authorizeCaseAccess(req.user, req.params.id, req.requestId);
    const caseDetails = await caseRepository.getCaseById(caseRecord.id);

    recordAuditEvent({
      action: 'cases:viewed',
      outcome: 'success',
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || 'client',
      resourceType: 'case',
      resourceId: caseRecord.id,
      requestId: req.requestId,
    });

    res.status(200).json({
      case: caseDetails,
    });
  })
);

/**
 * POST /api/v1/cases
 * Case onboarding creation. Requires cases:create permission (Advocate).
 */
casesRouter.post(
  '/',
  requirePermission('cases:create'),
  asyncHandler(async (req: Request, res: Response) => {
    const { clientId, sanitizedSummary, dangerLevel, operationalNote } = req.body || {};

    if (!clientId || typeof clientId !== 'string') {
      throw new ApiError(400, 'INVALID_INPUT', 'A valid client UUID is required.');
    }

    if (!sanitizedSummary || typeof sanitizedSummary !== 'string' || sanitizedSummary.trim().length === 0) {
      throw new ApiError(400, 'INVALID_INPUT', 'Sanitized case summary is required.');
    }

    if (dangerLevel && !VALID_DANGER_LEVELS.includes(dangerLevel)) {
      throw new ApiError(400, 'INVALID_INPUT', `Danger level must be one of: ${VALID_DANGER_LEVELS.join(', ')}`);
    }

    // Verify target client exists
    if (!dbConfig.isConfigured) {
      const devClient = devDataStore.users.get(clientId);
      if (!devClient) {
        throw new ApiError(404, 'NOT_FOUND', 'The target client account was not found.');
      }
    } else {
      const clientUser = await db.select().from(users).where(eq(users.id, clientId)).limit(1);
      if (clientUser.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'The target client account was not found.');
      }
    }

    const newCase = await caseRepository.createCase({
      clientId,
      sanitizedSummary: sanitizedSummary.trim(),
      dangerLevel: dangerLevel || 'standard',
      initialAdvocateId: req.user?.id,
      operationalNote,
    });

    recordAuditEvent({
      action: 'cases:created',
      outcome: 'success',
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || 'advocate',
      resourceType: 'case',
      resourceId: newCase.id,
      requestId: req.requestId,
    });

    res.status(201).json({
      case: newCase,
      message: 'Case record created and assigned successfully.',
    });
  })
);

/**
 * PATCH /api/v1/cases/:id
 * Updates case metadata. Requires cases:edit_assigned and active advocate assignment.
 */
casesRouter.patch(
  '/:id',
  requirePermission('cases:edit_assigned'),
  asyncHandler(async (req: Request, res: Response) => {
    const { caseRecord } = await authorizeCaseAccess(req.user, req.params.id, req.requestId);

    const { sanitizedSummary, dangerLevel, status } = req.body || {};

    if (dangerLevel && !VALID_DANGER_LEVELS.includes(dangerLevel)) {
      throw new ApiError(400, 'INVALID_INPUT', `Danger level must be one of: ${VALID_DANGER_LEVELS.join(', ')}`);
    }

    if (status && !VALID_STATUSES.includes(status)) {
      throw new ApiError(400, 'INVALID_INPUT', `Status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const updated = await caseRepository.updateCase(caseRecord.id, {
      sanitizedSummary: typeof sanitizedSummary === 'string' ? sanitizedSummary.trim() : undefined,
      dangerLevel,
      status,
    });

    recordAuditEvent({
      action: 'cases:updated',
      outcome: 'success',
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || 'advocate',
      resourceType: 'case',
      resourceId: caseRecord.id,
      requestId: req.requestId,
    });

    res.status(200).json({
      case: updated,
      message: 'Case record updated successfully.',
    });
  })
);

/**
 * POST /api/v1/cases/:id/close
 * Transitions case to closed status. Requires cases:close and active assignment.
 */
casesRouter.post(
  '/:id/close',
  requirePermission('cases:close'),
  asyncHandler(async (req: Request, res: Response) => {
    const { caseRecord } = await authorizeCaseAccess(req.user, req.params.id, req.requestId);

    const closed = await caseRepository.closeCase(caseRecord.id);

    recordAuditEvent({
      action: 'cases:closed',
      outcome: 'success',
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || 'advocate',
      resourceType: 'case',
      resourceId: caseRecord.id,
      requestId: req.requestId,
    });

    res.status(200).json({
      case: closed,
      message: 'Case has been transitioned to closed status.',
    });
  })
);

/**
 * POST /api/v1/cases/:id/assign
 * Reassigns an advocate. Requires cases:edit_assigned.
 */
casesRouter.post(
  '/:id/assign',
  requirePermission('cases:edit_assigned'),
  asyncHandler(async (req: Request, res: Response) => {
    const { caseRecord, isAssignedAdvocate } = await authorizeCaseAccess(req.user, req.params.id, req.requestId);

    if (!isAssignedAdvocate) {
      throw new ApiError(404, 'NOT_FOUND', 'You must be actively assigned to this case to manage assignments.');
    }

    const { advocateId, operationalNote } = req.body || {};

    if (!advocateId || typeof advocateId !== 'string') {
      throw new ApiError(400, 'INVALID_INPUT', 'A valid advocateId UUID is required.');
    }

    // Verify advocate account exists and has advocate role
    if (!dbConfig.isConfigured) {
      const devAdvocate = devDataStore.users.get(advocateId);
      if (!devAdvocate || devAdvocate.role !== 'advocate') {
        throw new ApiError(400, 'INVALID_INPUT', 'The designated user is not a recognized advocate account.');
      }
    } else {
      const advocateUser = await db.select().from(users).where(eq(users.id, advocateId)).limit(1);
      if (advocateUser.length === 0 || advocateUser[0].role !== 'advocate') {
        throw new ApiError(400, 'INVALID_INPUT', 'The designated user is not a recognized advocate account.');
      }
    }

    const assignment = await caseRepository.assignAdvocate(
      caseRecord.id,
      advocateId,
      typeof operationalNote === 'string' ? operationalNote.trim() : undefined
    );

    recordAuditEvent({
      action: 'cases:reassigned',
      outcome: 'success',
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || 'advocate',
      resourceType: 'case_assignment',
      resourceId: assignment.id,
      requestId: req.requestId,
      metadata: { targetAdvocateId: advocateId },
    });

    res.status(200).json({
      assignment,
      message: 'Advocate successfully assigned to case.',
    });
  })
);

export default casesRouter;
