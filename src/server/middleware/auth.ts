/**
 * Authentication & Session Resolution Middleware
 * DV-Assistance Platform - Step 12
 *
 * Implements:
 * - Session resolution attaching authenticated principal to req.user
 * - requireAuth guard ensuring valid session and non-suspended status
 * - State-changing CSRF defense header validation
 * - Security audit recording on failed or suspended authentication attempts
 */

import type { Request, Response, NextFunction } from 'express';
import { ApiError } from './errorHandler.ts';
import { resolveUserFromRequest, type AppUserSession } from '../auth/sessionManager.ts';
import { recordAuditEvent } from '../audit/auditLogger.ts';

declare global {
  namespace Express {
    interface Request {
      user?: AppUserSession | null;
    }
  }
}

/**
 * Middleware: Resolves session from HttpOnly cookie and attaches to req.user.
 * Does not block unauthenticated requests (anonymous visitors are supported).
 */
export async function attachAuthSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const userSession = await resolveUserFromRequest(req);
    req.user = userSession;
    next();
  } catch (err) {
    // If session lookup fails, treat as unauthenticated
    req.user = null;
    next();
  }
}

/**
 * Middleware: Requires an active, authenticated, non-suspended user session.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    recordAuditEvent({
      action: 'auth:unauthorized_access_attempt',
      outcome: 'denied',
      resourceType: 'endpoint',
      resourceId: req.path,
      requestId: req.requestId,
      metadata: { path: req.path, method: req.method },
    });
    throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required to access this resource.');
  }

  if (req.user.status === 'suspended') {
    recordAuditEvent({
      action: 'auth:suspended_account_access_attempt',
      outcome: 'denied',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      resourceType: 'account',
      resourceId: req.user.id,
      requestId: req.requestId,
    });
    throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended. Please contact support.');
  }

  if (req.user.status === 'pending') {
    throw new ApiError(403, 'ACCOUNT_PENDING', 'Your account is pending administrative approval.');
  }

  next();
}

/**
 * Middleware: Enforces custom anti-CSRF headers on state-changing API mutations.
 * Protects against cross-site form submissions even when SameSite cookies are present.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!mutatingMethods.includes(req.method)) {
    return next();
  }

  // Exempt public health checks or safe non-session endpoints if necessary
  if (req.path === '/api/v1/health') {
    return next();
  }

  const customHeader = req.header('x-requested-with') || req.header('x-dv-client');
  if (!customHeader) {
    recordAuditEvent({
      action: 'security:csrf_validation_failed',
      outcome: 'denied',
      resourceType: 'request',
      requestId: req.requestId,
      metadata: { path: req.path, method: req.method },
    });
    throw new ApiError(
      403,
      'CSRF_VALIDATION_FAILED',
      'Missing required security header for state-changing request.'
    );
  }

  next();
}

export default {
  attachAuthSession,
  requireAuth,
  csrfProtection,
};
