/**
 * System Governance & Administrative Domain API Router
 * DV-Assistance Platform - Step 16
 *
 * Implements:
 * - GET   /api/v1/admin/overview: System aggregate statistics & health
 * - GET   /api/v1/admin/audit-logs: Filtered, paginated security audit query
 * - GET   /api/v1/admin/users: Staff & system account governance list
 * - PATCH /api/v1/admin/users/:id/status: Account status transitions with safeguards
 *
 * Security Guarantees:
 * - Admin Data Wall: Exposes ZERO survivor case data, intake narratives, messages, or documents
 * - Strict RBAC: All endpoints require explicit admin permissions (`admin:access`, `audit:read`, `rbac:manage`)
 * - Non-admin roles (anonymous, client, advocate, partner) are strictly blocked (403 FORBIDDEN)
 * - Self-suspension and last-active-admin lockout protections enforced server-side
 * - Audit logs query responses expose safe allowlist fields only
 */

import { Router, type Request, type Response } from 'express';
import { ApiError } from '../middleware/errorHandler.ts';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { requirePermission } from '../auth/authorization.ts';
import { auditRepository } from '../repositories/auditRepository.ts';
import { userRepository } from '../repositories/userRepository.ts';
import { recordAuditEvent } from '../audit/auditLogger.ts';

export const adminRouter = Router();

/**
 * GET /api/v1/admin/overview
 * Returns system-governance aggregate metrics.
 */
adminRouter.get(
  '/overview',
  requirePermission('admin:access'),
  asyncHandler(async (req: Request, res: Response) => {
    const userStats = await userRepository.getUserOverviewStats();
    const auditStats = await auditRepository.getAuditOverviewStats();

    recordAuditEvent({
      action: 'admin:overview_viewed',
      outcome: 'success',
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || 'admin',
      resourceType: 'system_overview',
      requestId: req.requestId,
    });

    res.status(200).json({
      overview: {
        accounts: userStats,
        securityAudit: auditStats,
        systemHealth: 'HEALTHY',
        serverTime: new Date().toISOString(),
      },
    });
  })
);

/**
 * GET /api/v1/admin/audit-logs
 * Queries security audit events with server-validated filters and strict pagination.
 */
adminRouter.get(
  '/audit-logs',
  requirePermission('audit:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const action = typeof req.query.action === 'string' ? req.query.action.trim() : undefined;
    const outcomeRaw = typeof req.query.outcome === 'string' ? req.query.outcome.trim() : undefined;
    const fromDateRaw = typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined;
    const toDateRaw = typeof req.query.toDate === 'string' ? req.query.toDate : undefined;

    let outcome: 'success' | 'denied' | 'error' | undefined;
    if (outcomeRaw === 'success' || outcomeRaw === 'denied' || outcomeRaw === 'error') {
      outcome = outcomeRaw;
    }

    let fromDate: Date | undefined;
    if (fromDateRaw) {
      const parsedFrom = new Date(fromDateRaw);
      if (!Number.isNaN(parsedFrom.getTime())) {
        fromDate = parsedFrom;
      }
    }

    let toDate: Date | undefined;
    if (toDateRaw) {
      const parsedTo = new Date(toDateRaw);
      if (!Number.isNaN(parsedTo.getTime())) {
        toDate = parsedTo;
      }
    }

    const limitParsed = parseInt(typeof req.query.limit === 'string' ? req.query.limit : '50', 10);
    const offsetParsed = parseInt(typeof req.query.offset === 'string' ? req.query.offset : '0', 10);

    const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? Math.min(limitParsed, 100) : 50;
    const offset = Number.isFinite(offsetParsed) && offsetParsed >= 0 ? offsetParsed : 0;

    const { events, total } = await auditRepository.queryAuditEvents({
      action,
      outcome,
      fromDate,
      toDate,
      limit,
      offset,
    });

    // Record audit of audit inspection without causing infinite query recursion
    recordAuditEvent({
      action: 'admin:audit_logs_viewed',
      outcome: 'success',
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || 'admin',
      resourceType: 'audit_log',
      requestId: req.requestId,
      metadata: { queryLimit: limit, queryOffset: offset, totalMatched: total },
    });

    res.status(200).json({
      events,
      total,
      limit,
      offset,
    });
  })
);

/**
 * GET /api/v1/admin/users
 * Lists staff and system accounts for administrative review.
 */
adminRouter.get(
  '/users',
  requirePermission('rbac:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const usersList = await userRepository.listUsersForGovernance();

    recordAuditEvent({
      action: 'admin:users_viewed',
      outcome: 'success',
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || 'admin',
      resourceType: 'user_directory',
      requestId: req.requestId,
      metadata: { count: usersList.length },
    });

    res.status(200).json({
      users: usersList,
      count: usersList.length,
    });
  })
);

/**
 * PATCH /api/v1/admin/users/:id/status
 * Transitions user account status between 'active' and 'suspended'.
 */
adminRouter.patch(
  '/users/:id/status',
  requirePermission('rbac:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const targetUserId = req.params.id;
    const actorUser = req.user;

    if (!actorUser) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.');
    }

    const { status } = req.body || {};

    if (status !== 'active' && status !== 'suspended') {
      throw new ApiError(400, 'INVALID_INPUT', "Status must be either 'active' or 'suspended'.");
    }

    const updatedUser = await userRepository.updateUserStatus(targetUserId, status, actorUser.id);

    recordAuditEvent({
      action: status === 'suspended' ? 'admin:user_suspended' : 'admin:user_reactivated',
      outcome: 'success',
      actorUserId: actorUser.id,
      actorRole: actorUser.role,
      resourceType: 'user',
      resourceId: targetUserId,
      requestId: req.requestId,
      metadata: { newStatus: status },
    });

    res.status(200).json({
      user: updatedUser,
      message: `User account status successfully updated to '${status}'.`,
    });
  })
);

export default adminRouter;
