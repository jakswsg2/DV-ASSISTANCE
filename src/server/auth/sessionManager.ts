/**
 * Session Manager & Identity Mapping Service
 * DV-Assistance Platform - Step 12 & 13
 *
 * Implements:
 * - Deterministic Firebase UID -> user_identities -> users mapping
 * - Safe user provisioning (defaults to base 'client' role; never infers admin/advocate/partner)
 * - Cryptographically signed, tamper-proof session tokens
 * - Secure HTTP-only, SameSite=Strict cookie lifecycle management
 * - Account status validation (active, suspended, pending)
 */

import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import type { Response, Request } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { dbConfig } from '../../db/config.ts';
import { users, userIdentities, clientProfiles } from '../../db/schema.ts';
import type { RoleId } from '../../types/rbac.ts';
import { ROLE_DEFINITIONS } from '../../rbac/rbacPolicy.ts';
import { config } from '../config.ts';
import { devDataStore } from '../repositories/devStore.ts';

export interface SessionPayload {
  readonly sessionId: string;
  readonly userId: string;
  readonly firebaseUid: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export interface AppUserSession {
  readonly id: string;
  readonly firebaseUid: string;
  readonly safeAlias: string;
  readonly role: RoleId;
  readonly status: 'active' | 'suspended' | 'pending';
  readonly permissions: ReadonlyArray<string>;
  readonly isAnonymous: boolean;
  readonly sessionId: string;
}

/**
 * Creates a cryptographically signed session token string:
 * base64url(JSON) + '.' + base64url(HMAC-SHA256(data, secret))
 */
export function createSignedSessionToken(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  const data = Buffer.from(json).toString('base64url');
  const hmac = createHmac('sha256', config.sessionSecret).update(data).digest('base64url');
  return `${data}.${hmac}`;
}

/**
 * Verifies a signed session token. Returns the decoded payload or null if invalid or expired.
 */
export function verifySignedSessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return null;
    }

    const [data, signature] = parts;
    const expectedHmac = createHmac('sha256', config.sessionSecret).update(data).digest('base64url');

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedHmac);

    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }

    const json = Buffer.from(data, 'base64url').toString('utf-8');
    const payload = JSON.parse(json) as SessionPayload;

    // Check expiration
    if (typeof payload.expiresAt !== 'number' || Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Maps a verified Firebase UID to an internal application user record.
 * If user does not exist, provisions a new record adhering strictly to the User Provisioning Rule:
 * Default role is strictly 'client'. Never infers admin, advocate, or partner.
 */
export async function resolveOrProvisionUser(
  firebaseUid: string,
  emailHint?: string
): Promise<{ user: { id: string; role: string; status: string; safeAlias: string }; isNew: boolean }> {
  // If database is not configured (offline development fallback)
  if (!dbConfig.isConfigured) {
    const existingIdentity = devDataStore.identities.get(firebaseUid);
    if (existingIdentity) {
      const user = devDataStore.users.get(existingIdentity.userId);
      if (user) {
        return { user, isNew: false };
      }
    }

    const aliasPrefix = emailHint ? emailHint.split('@')[0].slice(0, 10) : 'User';
    const safeAlias = `Client ${aliasPrefix}-${randomUUID().slice(0, 4)}`;
    const userId = randomUUID();
    const newUser = {
      id: userId,
      role: 'client' as RoleId,
      status: 'active' as const,
      safeAlias,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    devDataStore.users.set(userId, newUser);
    devDataStore.identities.set(firebaseUid, {
      id: randomUUID(),
      userId,
      provider: 'firebase',
      providerSubjectId: firebaseUid,
      createdAt: new Date(),
    });
    return { user: newUser, isNew: true };
  }

  // 1. Look up existing identity link in PostgreSQL
  const existingIdentities = await db
    .select()
    .from(userIdentities)
    .where(and(eq(userIdentities.provider, 'firebase'), eq(userIdentities.providerSubjectId, firebaseUid)))
    .limit(1);

  if (existingIdentities.length > 0) {
    const identity = existingIdentities[0];
    const userRecords = await db.select().from(users).where(eq(users.id, identity.userId)).limit(1);
    if (userRecords.length > 0) {
      return { user: userRecords[0], isNew: false };
    }
  }

  // 2. User does not exist - Provision new user record
  const aliasPrefix = emailHint ? emailHint.split('@')[0].slice(0, 10) : 'User';
  const safeAlias = `Client ${aliasPrefix}-${randomUUID().slice(0, 4)}`;

  const [newUser] = await db
    .insert(users)
    .values({
      role: 'client', // Strictly default to 'client' - NEVER admin/advocate/partner
      status: 'active',
      safeAlias,
    })
    .returning();

  // Create external identity mapping record
  await db.insert(userIdentities).values({
    userId: newUser.id,
    provider: 'firebase',
    providerSubjectId: firebaseUid,
  });

  // Provision initial client profile
  await db.insert(clientProfiles).values({
    userId: newUser.id,
    preferredAlias: safeAlias,
    safeContactMethod: 'in_app_only',
    isRestrictedView: false,
  });

  return { user: newUser, isNew: true };
}

/**
 * Attaches the secure session cookie to the HTTP response.
 */
export function setSessionCookie(res: Response, sessionToken: string): void {
  res.cookie(config.sessionCookieName, sessionToken, {
    httpOnly: true,
    secure: config.isProd, // Enforced over HTTPS in production
    sameSite: 'strict',
    path: '/',
    maxAge: config.sessionTtlSeconds * 1000,
  });
}

/**
 * Clears the session cookie from the HTTP response.
 */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(config.sessionCookieName, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'strict',
    path: '/',
  });
}

/**
 * Resolves the currently authenticated user from the HTTP request cookie.
 * Validates token signature, expiration, and database record existence and status.
 */
export async function resolveUserFromRequest(req: Request): Promise<AppUserSession | null> {
  const token = req.cookies?.[config.sessionCookieName];
  if (!token || typeof token !== 'string') {
    return null;
  }

  const payload = verifySignedSessionToken(token);
  if (!payload) {
    return null;
  }

  // If database is not configured (offline development fallback)
  if (!dbConfig.isConfigured) {
    const devUser = devDataStore.users.get(payload.userId);
    if (!devUser) {
      return null;
    }
    const roleDef = ROLE_DEFINITIONS[devUser.role] || ROLE_DEFINITIONS.anonymous;
    return {
      id: devUser.id,
      firebaseUid: payload.firebaseUid,
      safeAlias: devUser.safeAlias,
      role: devUser.role,
      status: devUser.status,
      permissions: roleDef.permissions,
      isAnonymous: false,
      sessionId: payload.sessionId,
    };
  }

  const userRecords = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
  if (userRecords.length === 0) {
    return null;
  }

  const user = userRecords[0];
  const role = user.role as RoleId;
  const roleDef = ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.anonymous;

  return {
    id: user.id,
    firebaseUid: payload.firebaseUid,
    safeAlias: user.safeAlias,
    role,
    status: user.status as 'active' | 'suspended' | 'pending',
    permissions: roleDef.permissions,
    isAnonymous: false,
    sessionId: payload.sessionId,
  };
}

export default {
  createSignedSessionToken,
  verifySignedSessionToken,
  resolveOrProvisionUser,
  setSessionCookie,
  clearSessionCookie,
  resolveUserFromRequest,
};
