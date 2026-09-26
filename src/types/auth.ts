/**
 * Authentication & Session Type Definitions
 * DV-Assistance Platform
 *
 * Defines contracts for identity, session lifecycle, and pluggable auth services.
 * Strictly non-production development contracts. No secrets or credentials are stored.
 */

import type { PermissionId, RoleId } from './rbac.ts';

/**
 * Semantically distinct identifier aliases.
 */
export type UserId = string;
export type SessionId = string;

/**
 * Account lifecycle statuses.
 */
export type UserStatus = 'active' | 'suspended' | 'pending' | 'anonymous';

/**
 * Basic user identity representation.
 */
export interface UserIdentity {
  readonly id: UserId;
  readonly safeAlias: string;
  readonly status: UserStatus;
  readonly createdAt: string;
}

/**
 * Active authenticated principal within the application.
 */
export interface AuthenticatedUser {
  readonly id: UserId;
  readonly safeAlias: string;
  readonly role: RoleId;
  readonly permissions: ReadonlyArray<PermissionId>;
  readonly isAnonymous: boolean;
}

/**
 * Volatile session metadata container.
 */
export interface AuthSession {
  readonly sessionId: SessionId;
  readonly user: AuthenticatedUser;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

/**
 * Discriminated union modeling the state machine of user authentication.
 */
export type AuthenticationState =
  | { readonly status: 'unauthenticated' }
  | { readonly status: 'authenticating' }
  | {
      readonly status: 'authenticated';
      readonly session: AuthSession;
      readonly user: AuthenticatedUser;
    }
  | {
      readonly status: 'error';
      readonly errorMessage: string;
    };

/**
 * Pluggable contract for development or production authentication services.
 * No authentication logic is implemented here.
 */
export interface IAuthService {
  getCurrentState(): Promise<AuthenticationState>;
  switchRoleForDevelopment(role: RoleId): Promise<AuthenticatedUser>;
  clearSession(): Promise<void>;
}
