/**
 * Role-Based Access Control (RBAC) Authoritative Policy & Evaluator
 * DV-Assistance Platform
 *
 * Defines centralized role-permission mappings and pure deterministic
 * permission evaluation. Strictly enforces that System Administrators
 * cannot access confidential client case files or safety plans.
 */

import type { AccessScope, PermissionId, RoleDefinition, RoleId } from '../types/rbac.ts';
import type { AuthenticatedUser } from '../types/auth.ts';

/**
 * Authoritative role-permission mappings.
 * Single source of truth for development and production RBAC.
 */
export const ROLE_DEFINITIONS: Readonly<Record<RoleId, RoleDefinition>> = {
  anonymous: {
    id: 'anonymous',
    name: 'Anonymous / Public Seeker',
    description: 'Public visitor seeking immediate crisis support or initiating confidential intake.',
    permissions: [
      'emergency:view',
      'intake:create',
    ],
  },
  client: {
    id: 'client',
    name: 'Client / Survivor',
    description: 'Authenticated survivor managing their personal safety plan, case progress, and safe messages.',
    permissions: [
      'emergency:view',
      'client:read_own',
      'client:write_own',
      'safety_plan:read',
      'safety_plan:write',
      'messages:client',
      'messages:send',
      'messages:read',
      'docs:upload',
      'docs:view',
    ],
  },
  advocate: {
    id: 'advocate',
    name: 'Advocate / Case Worker',
    description: 'Casework staff managing assigned survivor caseloads and conducting intake reviews.',
    permissions: [
      'emergency:view',
      'intake:review',
      'cases:read_assigned',
      'cases:create',
      'cases:edit_assigned',
      'cases:close',
      'messages:advocate',
      'messages:send',
      'messages:read',
      'docs:upload',
      'docs:view',
    ],
  },
  partner: {
    id: 'partner',
    name: 'Legal / Medical Partner',
    description: 'Specialized consultant supporting protective order legalities or forensic medical advice.',
    permissions: [
      'emergency:view',
      'legal:read',
      'legal:manage',
      'medical:read',
      'messages:send',
      'messages:read',
      'docs:upload',
      'docs:view',
    ],
  },
  admin: {
    id: 'admin',
    name: 'System Administrator',
    description: 'Platform administrator managing system configuration, staff roles, and security audit logs. Strictly segregated from confidential client case notes.',
    permissions: [
      'admin:access',
      'rbac:manage',
      'config:manage',
      'audit:read',
    ],
  },
};

/**
 * Pure, deterministic permission evaluator.
 * Tests if the given user possesses the requested permission.
 *
 * @param user The active authenticated user principal.
 * @param permission The permission identifier to test.
 * @param scope Optional contextual scope restriction.
 * @returns boolean True if authorized, false otherwise.
 */
export function hasPermission(
  user: AuthenticatedUser | null | undefined,
  permission: PermissionId,
  scope?: AccessScope
): boolean {
  if (!user) {
    // If no user, evaluate against the anonymous public role
    return ROLE_DEFINITIONS.anonymous.permissions.includes(permission);
  }

  // 1. Direct permission check on user principal
  const hasDirectPermission = user.permissions.includes(permission);
  if (!hasDirectPermission) {
    return false;
  }

  // 2. Access scope evaluation (e.g. advocate restricted to assigned resources only)
  if (scope) {
    if (scope.roleId !== user.role) {
      return false;
    }
  }

  return true;
}

/**
 * Get the formal role definition for any RoleId.
 */
export function getRoleDefinition(roleId: RoleId): RoleDefinition {
  return ROLE_DEFINITIONS[roleId] ?? ROLE_DEFINITIONS.anonymous;
}
