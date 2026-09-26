/**
 * Intake Domain API Router
 * DV-Assistance Platform - Step 13
 *
 * Implements:
 * - POST /api/v1/intake: Confidential intake submission (Public / Anonymous / Client)
 * - GET  /api/v1/intake: Triage listing (Advocate with intake:review only)
 * - GET  /api/v1/intake/:id: Intake inspection (Advocate with intake:review only)
 *
 * Admin Data Wall: Admin accounts strictly receive 403 FORBIDDEN when attempting triage review.
 */

import { Router, type Request, type Response } from 'express';
import { ApiError } from '../middleware/errorHandler.ts';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { requirePermission } from '../auth/authorization.ts';
import { intakeRepository } from '../repositories/intakeRepository.ts';
import { recordAuditEvent } from '../audit/auditLogger.ts';

export const intakeRouter = Router();

/**
 * POST /api/v1/intake
 * Confidential submission endpoint. Accessible to anonymous visitors and clients.
 */
intakeRouter.post(
  '/',
  requirePermission('intake:create'),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      incidentDateApproximate,
      incidentType,
      sanitizedNarrative,
      policeReportFiled,
      policeReportReference,
    } = req.body || {};

    if (!incidentDateApproximate || typeof incidentDateApproximate !== 'string') {
      throw new ApiError(400, 'INVALID_INPUT', 'Approximate incident date is required.');
    }

    if (!incidentType || typeof incidentType !== 'string') {
      throw new ApiError(400, 'INVALID_INPUT', 'Incident type category is required.');
    }

    if (!sanitizedNarrative || typeof sanitizedNarrative !== 'string' || sanitizedNarrative.trim().length === 0) {
      throw new ApiError(400, 'INVALID_INPUT', 'Sanitized narrative statement is required.');
    }

    const report = await intakeRepository.createIntakeReport({
      incidentDateApproximate: incidentDateApproximate.trim(),
      incidentType: incidentType.trim(),
      sanitizedNarrative: sanitizedNarrative.trim(),
      policeReportFiled: Boolean(policeReportFiled),
      policeReportReference: policeReportReference ? String(policeReportReference).trim() : null,
    });

    recordAuditEvent({
      action: 'intake:submitted',
      outcome: 'success',
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || 'anonymous',
      resourceType: 'intake_report',
      resourceId: report.id,
      requestId: req.requestId,
      metadata: { incidentType: report.incidentType },
    });

    res.status(201).json({
      id: report.id,
      submittedAt: report.submittedAt,
      message: 'Confidential intake report received successfully.',
    });
  })
);

/**
 * GET /api/v1/intake
 * Triage queue listing. Accessible ONLY to advocates with intake:review permission.
 */
intakeRouter.get(
  '/',
  requirePermission('intake:review'),
  asyncHandler(async (req: Request, res: Response) => {
    const reports = await intakeRepository.listIntakeReports(50);

    recordAuditEvent({
      action: 'intake:triage_queue_viewed',
      outcome: 'success',
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || 'advocate',
      resourceType: 'intake_queue',
      requestId: req.requestId,
      metadata: { count: reports.length },
    });

    res.status(200).json({
      reports,
    });
  })
);

/**
 * GET /api/v1/intake/:id
 * Individual intake inspection. Accessible ONLY to advocates with intake:review permission.
 */
intakeRouter.get(
  '/:id',
  requirePermission('intake:review'),
  asyncHandler(async (req: Request, res: Response) => {
    const report = await intakeRepository.getIntakeReportById(req.params.id);
    if (!report) {
      throw new ApiError(404, 'NOT_FOUND', 'The requested intake report was not found.');
    }

    recordAuditEvent({
      action: 'intake:report_inspected',
      outcome: 'success',
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || 'advocate',
      resourceType: 'intake_report',
      resourceId: report.id,
      requestId: req.requestId,
    });

    res.status(200).json({
      report,
    });
  })
);

export default intakeRouter;
