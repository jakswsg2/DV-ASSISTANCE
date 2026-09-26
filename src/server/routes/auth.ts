/**
 * Authentication & Session API Router
 * DV-Assistance Platform - Step 12
 *
 * Implements endpoints:
 * - POST /api/v1/auth/session (Verifies Firebase ID token, provisions/maps user, sets HttpOnly cookie)
 * - GET  /api/v1/auth/me (Returns active authenticated principal or anonymous state)
 * - POST /api/v1/auth/logout (Revokes session, clears HttpOnly cookie)
 * - POST /api/v1/auth/quick-escape-revoke (Asynchronous best-effort session purge)
 * - POST /api/v1/auth/dev-session (Strictly development-only test session establishment)
 */

import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../middleware/errorHandler.ts';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { config } from '../config.ts';
import { verifyFirebaseIdToken, isFirebaseAdminConfigured } from '../auth/firebaseAdmin.ts';
import {
  resolveOrProvisionUser,
  createSignedSessionToken,
  setSessionCookie,
  clearSessionCookie,
} from '../auth/sessionManager.ts';
import { recordAuditEvent } from '../audit/auditLogger.ts';
import { ROLE_DEFINITIONS } from '../../rbac/rbacPolicy.ts';
import type { RoleId } from '../../types/rbac.ts';
import { db } from '../../db/index.ts';
import { dbConfig } from '../../db/config.ts';
import { users, userIdentities } from '../../db/schema.ts';
import { devDataStore } from '../repositories/devStore.ts';
import { eq, and } from 'drizzle-orm';

export const authRouter = Router();

/**
 * POST /api/v1/auth/session
 * Verifies a client-supplied Firebase ID token, maps to internal DB user, sets session cookie.
 */
authRouter.post(
  '/session',
  asyncHandler(async (req: Request, res: Response) => {
    const { idToken } = req.body || {};

    if (!idToken || typeof idToken !== 'string') {
      recordAuditEvent({
        action: 'auth:login_failure',
        outcome: 'denied',
        resourceType: 'session',
        requestId: req.requestId,
        metadata: { reason: 'MISSING_ID_TOKEN' },
      });
      throw new ApiError(400, 'MISSING_ID_TOKEN', 'A valid Firebase ID token is required.');
    }

    if (!isFirebaseAdminConfigured()) {
      throw new ApiError(
        503,
        'AUTH_SERVICE_UNCONFIGURED',
        'Firebase Authentication service is not yet configured with server credentials in this environment.'
      );
    }

    try {
      // 1. Verify token server-side via Firebase Admin SDK
      const decodedToken = await verifyFirebaseIdToken(idToken);
      const firebaseUid = decodedToken.uid;
      const email = decodedToken.email;

      // 2. Resolve or provision internal application user record
      const { user, isNew } = await resolveOrProvisionUser(firebaseUid, email);

      // 3. Check account status
      if (user.status === 'suspended') {
        recordAuditEvent({
          action: 'auth:login_failure',
          outcome: 'denied',
          actorUserId: user.id,
          actorRole: user.role,
          resourceType: 'account',
          resourceId: user.id,
          requestId: req.requestId,
          metadata: { reason: 'ACCOUNT_SUSPENDED' },
        });
        throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended.');
      }

      // 4. Generate signed application session token
      const sessionId = randomUUID();
      const now = Date.now();
      const sessionToken = createSignedSessionToken({
        sessionId,
        userId: user.id,
        firebaseUid,
        issuedAt: now,
        expiresAt: now + config.sessionTtlSeconds * 1000,
      });

      // 5. Set HttpOnly, SameSite=Strict session cookie
      setSessionCookie(res, sessionToken);

      // 6. Record audit event
      recordAuditEvent({
        action: isNew ? 'auth:user_provisioned' : 'auth:login_success',
        outcome: 'success',
        actorUserId: user.id,
        actorRole: user.role,
        resourceType: 'session',
        resourceId: sessionId,
        requestId: req.requestId,
        metadata: { isNewUser: isNew },
      });

      const role = user.role as RoleId;
      const roleDef = ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.anonymous;

      res.status(200).json({
        user: {
          id: user.id,
          safeAlias: user.safeAlias,
          role,
          status: user.status,
          permissions: roleDef.permissions,
          isAnonymous: false,
        },
      });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        throw err;
      }

      recordAuditEvent({
        action: 'auth:login_failure',
        outcome: 'error',
        resourceType: 'session',
        requestId: req.requestId,
        metadata: { error: err instanceof Error ? err.message : 'TOKEN_VERIFICATION_FAILED' },
      });

      throw new ApiError(401, 'INVALID_AUTHENTICATION_TOKEN', 'Failed to verify authentication credentials.');
    }
  })
);

/**
 * GET /api/v1/auth/me
 * Returns the currently active authenticated user or anonymous status.
 */
authRouter.get('/me', (req: Request, res: Response) => {
  if (req.user) {
    return res.status(200).json({
      user: {
        id: req.user.id,
        safeAlias: req.user.safeAlias,
        role: req.user.role,
        status: req.user.status,
        permissions: req.user.permissions,
        isAnonymous: false,
      },
      isAnonymous: false,
    });
  }

  res.status(200).json({
    user: null,
    isAnonymous: true,
  });
});

/**
 * POST /api/v1/auth/logout
 * Revokes the application session and clears the HttpOnly cookie.
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  const actorUserId = req.user?.id || null;
  const actorRole = req.user?.role || 'anonymous';
  const sessionId = req.user?.sessionId || null;

  clearSessionCookie(res);

  recordAuditEvent({
    action: 'auth:logout',
    outcome: 'success',
    actorUserId,
    actorRole,
    resourceType: 'session',
    resourceId: sessionId,
    requestId: req.requestId,
  });

  res.status(200).json({ success: true });
});

/**
 * POST /api/v1/auth/quick-escape-revoke
 * Best-effort asynchronous server revocation beacon for Quick Escape.
 */
authRouter.post('/quick-escape-revoke', (req: Request, res: Response) => {
  const actorUserId = req.user?.id || null;
  const actorRole = req.user?.role || 'anonymous';

  clearSessionCookie(res);

  recordAuditEvent({
    action: 'auth:quick_escape_revocation',
    outcome: 'success',
    actorUserId,
    actorRole,
    resourceType: 'session',
    requestId: req.requestId,
  });

  res.status(200).json({ revoked: true });
});

/**
 * POST /api/v1/auth/dev-session
 * STRICTLY DEVELOPMENT-ONLY: Establishes a session for testing role behaviors in local development.
 * Requires BOTH NODE_ENV=development AND an explicit ALLOW_DEV_AUTH=true opt-in.
 * Disabled by default in every environment, including production.
 */
authRouter.post(
  '/dev-session',
  asyncHandler(async (req: Request, res: Response) => {
    /**
     * STRICT DEVELOPMENT-ONLY AUTHENTICATION
     *
     * Dev sessions require BOTH:
     *   1. development environment
     *   2. explicit ALLOW_DEV_AUTH=true
     *
     * ALLOW_DEV_AUTH defaults to false.
     *
     * This prevents accidental exposure of the development
     * authentication endpoint through Cloudflare/public traffic.
     */
    if (!config.isDev || !config.allowDevAuth) {
      recordAuditEvent({
        action: 'security:dev_auth_attempt_in_production',
        outcome: 'denied',
        resourceType: 'endpoint',
        resourceId: req.path,
        requestId: req.requestId,
        metadata: {
          environment: config.nodeEnv,
          allowDevAuth: config.allowDevAuth,
          path: req.path,
          method: req.method,
        },
      });

      throw new ApiError(
        403,
        'DEV_AUTH_DISABLED',
        'Development authentication is disabled.'
      );
    }

    const requestedRole = req.body?.role;

    const allowedRoles = [
      'anonymous',
      'client',
      'advocate',
      'partner',
      'admin',
    ] as const;

    if (
      typeof requestedRole !== 'string' ||
      !allowedRoles.includes(requestedRole as (typeof allowedRoles)[number])
    ) {
      throw new ApiError(
        400,
        'INVALID_DEV_ROLE',
        'A valid development role is required.'
      );
    }

    // `allowedRoles` mirrors the RoleId union, so the guard above is exhaustive.
    const isRoleId = (value: string): value is RoleId =>
      (allowedRoles as readonly string[]).includes(value);

    const role: RoleId = isRoleId(requestedRole) ? requestedRole : 'anonymous';

    if (role === 'anonymous') {
      clearSessionCookie(res);
      return res.status(200).json({ user: null, isAnonymous: true });
    }

    // Create or resolve development test user in database
    const devProviderSub = `dev-${role}-local`;
    let devUser: { id: string; role: RoleId; status: 'active' | 'suspended' | 'pending'; safeAlias: string };

    if (!dbConfig.isConfigured) {
      const devIdentity = devDataStore.identities.get(devProviderSub);
      if (devIdentity) {
        devUser = devDataStore.users.get(devIdentity.userId)!;
      } else {
        const id = `dev-user-${role}-${randomUUID().slice(0, 4)}`;
        devUser = {
          id,
          role,
          status: 'active',
          safeAlias: `Dev ${role.charAt(0).toUpperCase() + role.slice(1)} Persona`,
        };
        devDataStore.users.set(id, devUser as any);
        devDataStore.identities.set(devProviderSub, {
          id: randomUUID(),
          userId: id,
          provider: 'dev_local',
          providerSubjectId: devProviderSub,
          createdAt: new Date(),
        });
      }
    } else {
      const existingIdentities = await db
        .select()
        .from(userIdentities)
        .where(and(eq(userIdentities.provider, 'dev_local'), eq(userIdentities.providerSubjectId, devProviderSub)))
        .limit(1);

      if (existingIdentities.length > 0) {
        const userRecords = await db.select().from(users).where(eq(users.id, existingIdentities[0].userId)).limit(1);
        devUser = userRecords[0] as any;
      } else {
        const [newUser] = await db
          .insert(users)
          .values({
            role,
            status: 'active',
            safeAlias: `Dev ${role.charAt(0).toUpperCase() + role.slice(1)} Persona`,
          })
          .returning();

        await db.insert(userIdentities).values({
          userId: newUser.id,
          provider: 'dev_local',
          providerSubjectId: devProviderSub,
        });

        devUser = newUser as any;
      }
    }

    const sessionId = randomUUID();
    const now = Date.now();
    const sessionToken = createSignedSessionToken({
      sessionId,
      userId: devUser.id,
      firebaseUid: devProviderSub,
      issuedAt: now,
      expiresAt: now + config.sessionTtlSeconds * 1000,
    });

    setSessionCookie(res, sessionToken);

    recordAuditEvent({
      action: 'auth:dev_session_established',
      outcome: 'success',
      actorUserId: devUser.id,
      actorRole: role,
      resourceType: 'dev_session',
      resourceId: sessionId,
      requestId: req.requestId,
    });

    const activeRole = devUser.role as RoleId;
    const roleDef = ROLE_DEFINITIONS[activeRole];

    res.status(200).json({
      user: {
        id: devUser.id,
        safeAlias: devUser.safeAlias,
        role: activeRole,
        status: devUser.status,
        permissions: roleDef.permissions,
        isAnonymous: false,
      },
    });
  })
);

export default authRouter;
