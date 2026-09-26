/**
 * Authentication Context & State Machine
 * DV-Assistance Platform - Step 12 Production Identity & Session Integration
 *
 * Exposes the active user principal, role checking, production Firebase session login,
 * and development-only persona switching.
 * Integrates with the Safety Core to ensure volatile session state is purged upon Quick Escape,
 * accompanied by an asynchronous best-effort server session revocation beacon.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { AuthenticatedUser, AuthenticationState } from '../types/auth.ts';
import type { AccessScope, PermissionId, RoleId } from '../types/rbac.ts';
import { devAuthService, DEV_PERSONAS } from './devAuthService.ts';
import { hasPermission, ROLE_DEFINITIONS } from '../rbac/rbacPolicy.ts';
import { volatileStateRegistry } from '../safety/volatileStatePurger.ts';
import { clientSignOut } from './firebaseClient.ts';

export interface AuthContextValue {
  readonly currentUser: AuthenticatedUser;
  readonly authState: AuthenticationState;
  readonly isProductionAuth: boolean;
  readonly switchRole: (role: RoleId) => Promise<void>;
  readonly loginWithFirebaseToken: (idToken: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly checkPermission: (permission: PermissionId, scope?: AccessScope) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  readonly children: React.ReactNode;
  readonly initialRole?: RoleId;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  initialRole = 'anonymous',
}) => {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser>(DEV_PERSONAS[initialRole]);
  const [isProductionAuth, setIsProductionAuth] = useState<boolean>(false);
  const [authState, setAuthState] = useState<AuthenticationState>({
    status: 'authenticated',
    session: {
      sessionId: `dev-session-init`,
      user: DEV_PERSONAS[initialRole],
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
    user: DEV_PERSONAS[initialRole],
  });

  // Verify server session on initial mount
  useEffect(() => {
    let isMounted = true;

    async function checkServerSession() {
      try {
        const response = await fetch('/api/v1/auth/me', {
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (!isMounted) return;

        if (data.user) {
          const serverUser: AuthenticatedUser = {
            id: data.user.id,
            safeAlias: data.user.safeAlias,
            role: data.user.role,
            permissions: data.user.permissions || ROLE_DEFINITIONS[data.user.role as RoleId]?.permissions || [],
            isAnonymous: false,
          };
          setCurrentUser(serverUser);
          setIsProductionAuth(true);
          setAuthState({
            status: 'authenticated',
            session: {
              sessionId: `server-session-${data.user.id}`,
              user: serverUser,
              issuedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 28800000).toISOString(),
            },
            user: serverUser,
          });
        }
      } catch {
        // Server unavailable or offline in development; retain in-memory state
      }
    }

    checkServerSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Login with verified Firebase ID token
  const loginWithFirebaseToken = useCallback(async (idToken: string) => {
    setAuthState({ status: 'authenticating' });

    try {
      const response = await fetch('/api/v1/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const message = errData?.error?.message || 'Authentication failed.';
        setAuthState({ status: 'error', errorMessage: message });
        throw new Error(message);
      }

      const data = await response.json();
      const serverUser: AuthenticatedUser = {
        id: data.user.id,
        safeAlias: data.user.safeAlias,
        role: data.user.role,
        permissions: data.user.permissions || ROLE_DEFINITIONS[data.user.role as RoleId]?.permissions || [],
        isAnonymous: false,
      };

      setCurrentUser(serverUser);
      setIsProductionAuth(true);
      setAuthState({
        status: 'authenticated',
        session: {
          sessionId: `server-session-${serverUser.id}`,
          user: serverUser,
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 28800000).toISOString(),
        },
        user: serverUser,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed.';
      setAuthState({ status: 'error', errorMessage: message });
      throw err;
    }
  }, []);

  // Switch role in development (strictly disabled in production)
  const switchRole = useCallback(async (role: RoleId) => {
    if (!import.meta.env.DEV) {
      console.warn('[AuthContext] switchRole is strictly disabled in production builds.');
      return;
    }

    try {
      // Sync with backend dev session endpoint
      const response = await fetch('/api/v1/auth/dev-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ role }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          const syncedUser: AuthenticatedUser = {
            id: data.user.id,
            safeAlias: data.user.safeAlias,
            role: data.user.role,
            permissions: data.user.permissions,
            isAnonymous: false,
          };
          setCurrentUser(syncedUser);
          setAuthState({
            status: 'authenticated',
            session: {
              sessionId: `dev-session-${syncedUser.id}`,
              user: syncedUser,
              issuedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
            user: syncedUser,
          });
          return;
        }
      }
    } catch {
      // Backend offline: fall back to local devAuthService in-memory persona
    }

    const updatedUser = await devAuthService.switchRoleForDevelopment(role);
    const updatedState = await devAuthService.getCurrentState();
    setCurrentUser(updatedUser);
    setAuthState(updatedState);
  }, []);

  // Sign out / reset to anonymous
  const signOut = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
    } catch {
      // Ignore network errors during logout
    }

    await clientSignOut().catch(() => {});
    await devAuthService.clearSession();

    const updatedUser = DEV_PERSONAS.anonymous;
    const updatedState = await devAuthService.getCurrentState();
    setCurrentUser(updatedUser);
    setIsProductionAuth(false);
    setAuthState(updatedState);
  }, []);

  // Pure deterministic permission check
  const checkPermission = useCallback(
    (permission: PermissionId, scope?: AccessScope) => {
      return hasPermission(currentUser, permission, scope);
    },
    [currentUser]
  );

  // Safety Core integration: Register volatile state purge on Quick Escape
  useEffect(() => {
    const unregister = volatileStateRegistry.register('auth_session_purger', 'auth_session', () => {
      // 1. Purge active user session and reset in-memory identity to anonymous synchronously
      devAuthService.clearSession();
      setCurrentUser(DEV_PERSONAS.anonymous);
      setIsProductionAuth(false);
      setAuthState({
        status: 'authenticated',
        session: {
          sessionId: `dev-session-purged-${Date.now()}`,
          user: DEV_PERSONAS.anonymous,
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        user: DEV_PERSONAS.anonymous,
      });

      // 2. Asynchronous best-effort server revocation beacon (never blocks UI or Quick Escape)
      try {
        fetch('/api/v1/auth/quick-escape-revoke', {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          keepalive: true,
        }).catch(() => {});
      } catch {
        // Silently continue - Quick Escape must remain 100% resilient regardless of network
      }
    });

    return unregister;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      authState,
      isProductionAuth,
      switchRole,
      loginWithFirebaseToken,
      signOut,
      checkPermission,
    }),
    [currentUser, authState, isProductionAuth, switchRole, loginWithFirebaseToken, signOut, checkPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
