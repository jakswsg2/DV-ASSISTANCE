/**
 * Centralized Authorization Engine & Resource Scope Evaluator
 * DV-Assistance Platform - Step 13
 *
 * Implements authoritative backend authorization:
 * Authenticated Identity -> Application Role -> Permission -> Resource Scope -> Domain Boundary
 *
 * Enforces:
 * - Admin Data Wall: Admins are strictly forbidden from accessing survivor case records,
 *   safety plans, intake narratives, or personal profiles.
 * - Client Scope: Clients may only access their own cases and safety plans.
 * - Advocate Scope: Advocates may only access cases actively assigned to them in case_assignments.
 * - IDOR Protection: Generic 404 NOT_FOUND returned on unauthorized resource attempts
 *   to prevent leaking resource existence.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { dbConfig } from '../../db/config.ts';
import { cases, caseAssignments, safetyPlans } from '../../db/schema.ts';
import { ApiError } from '../middleware/errorHandler.ts';
import { recordAuditEvent } from '../audit/auditLogger.ts';
import { hasPermission, ROLE_DEFINITIONS } from '../../rbac/rbacPolicy.ts';
import type { PermissionId } from '../../types/rbac.ts';
import type { AppUserSession } from './sessionManager.ts';
import { devDataStore, type DevCase } from '../repositories/devStore.ts';

/**
 * Middleware factory: Requires an authenticated user to possess a specific RBAC permission.
 * Automatically checks the authoritative ROLE_DEFINITIONS against the user's role from PostgreSQL.
 */
export function requirePermission(permission: PermissionId): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;

    // 1. If user is anonymous or session is missing, evaluate against anonymous role
    if (!user) {
      const isAnonAllowed = hasPermission(null, permission);
      if (!isAnonAllowed) {
        recordAuditEvent({
          action: 'auth:permission_denied',
          outcome: 'denied',
          actorRole: 'anonymous',
          resourceType: 'permission',
          resourceId: permission,
          requestId: req.requestId,
          metadata: { permission, reason: 'UNAUTHENTICATED' },
        });
        throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required for this operation.');
      }
      return next();
    }

    // 2. Evaluate permissions against authenticated principal
    const authUser = {
      id: user.id,
      safeAlias: user.safeAlias,
      role: user.role,
      permissions: ROLE_DEFINITIONS[user.role]?.permissions || [],
      isAnonymous: user.isAnonymous,
    };

    if (!hasPermission(authUser, permission)) {
      recordAuditEvent({
        action: 'auth:permission_denied',
        outcome: 'denied',
        actorUserId: user.id,
        actorRole: user.role,
        resourceType: 'permission',
        resourceId: permission,
        requestId: req.requestId,
        metadata: { permission, role: user.role },
      });
      throw new ApiError(403, 'FORBIDDEN', `You do not have the required permission (${permission}) to perform this action.`);
    }

    next();
  };
}

export interface AuthorizeCaseResult {
  readonly authorized: boolean;
  readonly caseRecord: {
    id: string;
    clientId: string;
    status: string;
    dangerLevel: string;
    sanitizedSummary: string;
  };
  readonly isClientOwner: boolean;
  readonly isAssignedAdvocate: boolean;
}

/**
 * Evaluates whether the authenticated user has access to a specific case.
 * Enforces:
 * - Admin Data Wall: Returns 404 immediately for Admin role.
 * - Client Scope: Client ID must match case.clientId.
 * - Advocate Scope: Active assignment must exist in case_assignments.
 */
export async function authorizeCaseAccess(
  user: AppUserSession | null | undefined,
  caseId: string,
  requestId?: string | null
): Promise<AuthorizeCaseResult> {
  if (!user || user.isAnonymous) {
    throw new ApiError(404, 'NOT_FOUND', 'The requested case does not exist or you do not have access.');
  }

  // ADMIN DATA WALL: System administrators cannot access confidential case records
  if (user.role === 'admin') {
    recordAuditEvent({
      action: 'security:admin_case_access_blocked',
      outcome: 'denied',
      actorUserId: user.id,
      actorRole: 'admin',
      resourceType: 'case',
      resourceId: caseId,
      requestId,
      metadata: { reason: 'ADMIN_DATA_WALL_ENFORCED' },
    });
    throw new ApiError(404, 'NOT_FOUND', 'The requested case does not exist or you do not have access.');
  }

  // Fallback for unconfigured dev environment
  if (!dbConfig.isConfigured) {
    const targetCase = devDataStore.cases.get(caseId);
    if (!targetCase) {
      throw new ApiError(404, 'NOT_FOUND', 'The requested case does not exist or you do not have access.');
    }

    if (user.role === 'client') {
      if (targetCase.clientId === user.id) {
        return {
          authorized: true,
          caseRecord: targetCase,
          isClientOwner: true,
          isAssignedAdvocate: false,
        };
      }
      recordAuditEvent({
        action: 'security:idor_case_access_denied',
        outcome: 'denied',
        actorUserId: user.id,
        actorRole: user.role,
        resourceType: 'case',
        resourceId: caseId,
        requestId,
      });
      throw new ApiError(404, 'NOT_FOUND', 'The requested case does not exist or you do not have access.');
    }

    if (user.role === 'advocate') {
      const isAssigned = Array.from(devDataStore.assignments.values()).some(
        (a) => a.caseId === caseId && a.advocateId === user.id && a.status === 'active'
      );
      if (isAssigned) {
        return {
          authorized: true,
          caseRecord: targetCase,
          isClientOwner: false,
          isAssignedAdvocate: true,
        };
      }
      recordAuditEvent({
        action: 'security:unassigned_case_access_denied',
        outcome: 'denied',
        actorUserId: user.id,
        actorRole: user.role,
        resourceType: 'case',
        resourceId: caseId,
        requestId,
      });
      throw new ApiError(404, 'NOT_FOUND', 'The requested case does not exist or you do not have access.');
    }

    throw new ApiError(404, 'NOT_FOUND', 'The requested case does not exist or you do not have access.');
  }

  // PostgreSQL Database Query
  const caseRecords = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
  if (caseRecords.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'The requested case does not exist or you do not have access.');
  }

  const targetCase = caseRecords[0];

  // 1. Client Ownership Check
  if (user.role === 'client') {
    if (targetCase.clientId === user.id) {
      return {
        authorized: true,
        caseRecord: targetCase,
        isClientOwner: true,
        isAssignedAdvocate: false,
      };
    }
    // IDOR protection: return 404 instead of 403
    recordAuditEvent({
      action: 'security:idor_case_access_denied',
      outcome: 'denied',
      actorUserId: user.id,
      actorRole: user.role,
      resourceType: 'case',
      resourceId: caseId,
      requestId,
    });
    throw new ApiError(404, 'NOT_FOUND', 'The requested case does not exist or you do not have access.');
  }

  // 2. Advocate Assignment Check
  if (user.role === 'advocate') {
    const activeAssignments = await db
      .select()
      .from(caseAssignments)
      .where(
        and(
          eq(caseAssignments.caseId, caseId),
          eq(caseAssignments.advocateId, user.id),
          eq(caseAssignments.status, 'active')
        )
      )
      .limit(1);

    if (activeAssignments.length > 0) {
      return {
        authorized: true,
        caseRecord: targetCase,
        isClientOwner: false,
        isAssignedAdvocate: true,
      };
    }

    recordAuditEvent({
      action: 'security:unassigned_case_access_denied',
      outcome: 'denied',
      actorUserId: user.id,
      actorRole: user.role,
      resourceType: 'case',
      resourceId: caseId,
      requestId,
    });
    throw new ApiError(404, 'NOT_FOUND', 'The requested case does not exist or you do not have access.');
  }

  throw new ApiError(404, 'NOT_FOUND', 'The requested case does not exist or you do not have access.');
}

/**
 * Evaluates whether the authenticated user has access to a specific safety plan.
 * Enforces Outcome A: Strictly restricted to the client owner possessing safety_plan:read.
 * Advocates, partners, admins, and anonymous callers are strictly denied access.
 */
export async function authorizeSafetyPlanAccess(
  user: AppUserSession | null | undefined,
  planId: string,
  requestId?: string | null
): Promise<{ authorized: boolean; plan: any }> {
  if (!user || user.isAnonymous) {
    throw new ApiError(404, 'NOT_FOUND', 'The requested safety plan does not exist or you do not have access.');
  }

  // Safety plans are strictly client-owned documents
  if (user.role !== 'client') {
    recordAuditEvent({
      action: 'security:non_client_safety_plan_access_blocked',
      outcome: 'denied',
      actorUserId: user.id,
      actorRole: user.role,
      resourceType: 'safety_plan',
      resourceId: planId,
      requestId,
      metadata: { role: user.role, reason: 'CLIENT_OWNERSHIP_MANDATED' },
    });
    throw new ApiError(404, 'NOT_FOUND', 'The requested safety plan does not exist or you do not have access.');
  }

  // Fallback for unconfigured dev environment
  if (!dbConfig.isConfigured) {
    const plan = devDataStore.safetyPlans.get(planId);
    if (!plan || plan.clientId !== user.id) {
      recordAuditEvent({
        action: 'security:unauthorized_safety_plan_access_denied',
        outcome: 'denied',
        actorUserId: user.id,
        actorRole: user.role,
        resourceType: 'safety_plan',
        resourceId: planId,
        requestId,
      });
      throw new ApiError(404, 'NOT_FOUND', 'The requested safety plan does not exist or you do not have access.');
    }

    return { authorized: true, plan };
  }

  const plans = await db.select().from(safetyPlans).where(eq(safetyPlans.id, planId)).limit(1);
  if (plans.length === 0 || plans[0].clientId !== user.id) {
    recordAuditEvent({
      action: 'security:unauthorized_safety_plan_access_denied',
      outcome: 'denied',
      actorUserId: user.id,
      actorRole: user.role,
      resourceType: 'safety_plan',
      resourceId: planId,
      requestId,
    });
    throw new ApiError(404, 'NOT_FOUND', 'The requested safety plan does not exist or you do not have access.');
  }

  return { authorized: true, plan: plans[0] };
}

export default {
  requirePermission,
  authorizeCaseAccess,
  authorizeSafetyPlanAccess,
};
