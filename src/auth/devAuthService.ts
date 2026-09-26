/**
 * In-Memory Development Authentication Service
 * DV-Assistance Platform - Development Auth
 *
 * Implements the IAuthService contract using transient in-memory test personas.
 * Strictly for local development, UX validation, and RBAC testing.
 * Contains ZERO real credentials, ZERO real PII, and ZERO persistent storage.
 */

import type { AuthenticatedUser, AuthenticationState, AuthSession, IAuthService } from '../types/auth.ts';
import type { RoleId } from '../types/rbac.ts';
import { ROLE_DEFINITIONS } from '../rbac/rbacPolicy.ts';

/**
 * Development test personas.
 * Completely fictional mock identities for exercising workflow boundaries.
 */
export const DEV_PERSONAS: Readonly<Record<RoleId, AuthenticatedUser>> = {
  anonymous: {
    id: 'dev-user-anon',
    safeAlias: 'Anonymous Public Visitor',
    role: 'anonymous',
    permissions: ROLE_DEFINITIONS.anonymous.permissions,
    isAnonymous: true,
  },
  client: {
    id: 'dev-user-client-01',
    safeAlias: 'Survivor Demo Persona (Client)',
    role: 'client',
    permissions: ROLE_DEFINITIONS.client.permissions,
    isAnonymous: false,
  },
  advocate: {
    id: 'dev-user-advocate-01',
    safeAlias: 'Caseworker Demo Persona (Advocate)',
    role: 'advocate',
    permissions: ROLE_DEFINITIONS.advocate.permissions,
    isAnonymous: false,
  },
  partner: {
    id: 'dev-user-partner-01',
    safeAlias: 'Legal/Medical Consultant Persona',
    role: 'partner',
    permissions: ROLE_DEFINITIONS.partner.permissions,
    isAnonymous: false,
  },
  admin: {
    id: 'dev-user-admin-01',
    safeAlias: 'System Administrator Persona',
    role: 'admin',
    permissions: ROLE_DEFINITIONS.admin.permissions,
    isAnonymous: false,
  },
};

export class DevAuthService implements IAuthService {
  private currentRole: RoleId = 'anonymous';

  public async getCurrentState(): Promise<AuthenticationState> {
    const user = DEV_PERSONAS[this.currentRole];
    const session: AuthSession = {
      sessionId: `dev-session-${Date.now()}`,
      user,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };

    return {
      status: 'authenticated',
      session,
      user,
    };
  }

  public async switchRoleForDevelopment(role: RoleId): Promise<AuthenticatedUser> {
    this.currentRole = role;
    return DEV_PERSONAS[role];
  }

  public async clearSession(): Promise<void> {
    // Reset to anonymous state in memory
    this.currentRole = 'anonymous';
  }

  public getActiveRole(): RoleId {
    return this.currentRole;
  }
}

// Singleton development authentication service instance
export const devAuthService = new DevAuthService();
