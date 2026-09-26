/**
 * Role-Based Access Control (RBAC) Type Definitions
 * DV-Assistance Platform
 *
 * Defines candidate roles, granular permissions, and scope boundaries.
 * No permission evaluation or runtime enforcement logic is implemented here.
 */

/**
 * Approved conceptual roles for the DV-Assistance platform.
 * Conforms to the Architecture Baseline Gate:
 * - Anonymous / Public
 * - Client / Survivor
 * - Advocate / Case Worker
 * - Legal / Medical Partner
 * - System Administrator
 */
export type RoleId =
  | 'anonymous' // Public / Anonymous crisis seeker
  | 'client'    // Survivor / Client accessing own support & safety plan
  | 'advocate'  // Case worker / Advocate managing assigned cases
  | 'partner'   // Legal / Medical Partner (Approved conceptual partner role)
  | 'admin';    // System Administrator (System configuration & audit logs; strictly no PII case notes)

/**
 * PROPOSED / NOT FINAL: Granular partner specialization variants.
 * Preserved as an architectural proposal if separate legal and medical roles are formally authorized later.
 */
export type CandidatePartnerSpecialization = 'legal' | 'medical';

/**
 * Granular permission identifiers.
 */
export type PermissionId =
  // Public & Emergency
  | 'emergency:view'
  | 'intake:create'

  // Survivor / Client Permissions
  | 'client:read_own'
  | 'client:write_own'
  | 'safety_plan:read'
  | 'safety_plan:write'
  | 'messages:client'

  // Advocate / Case Worker Permissions
  | 'intake:review'
  | 'cases:read_assigned'
  | 'cases:create'
  | 'cases:edit_assigned'
  | 'cases:close'
  | 'messages:advocate'

  // Specialized Partner Permissions
  | 'legal:read'
  | 'legal:manage'
  | 'medical:read'

  // Common Messaging & Document Permissions
  | 'messages:send'
  | 'messages:read'
  | 'docs:upload'
  | 'docs:view'

  // Administrative & Security Boundaries
  | 'admin:access'
  | 'rbac:manage'
  | 'config:manage'
  | 'audit:read';

/**
 * Declarative description of a role and its permitted scope.
 */
export interface RoleDefinition {
  readonly id: RoleId;
  readonly name: string;
  readonly description: string;
  readonly permissions: ReadonlyArray<PermissionId>;
}

/**
 * User role assignment record.
 */
export interface RoleAssignment {
  readonly userId: string;
  readonly roleId: RoleId;
  readonly assignedAt: string;
  readonly assignedByUserId?: string;
}

/**
 * Contextual scope restriction (e.g. advocate restricted to assigned cases).
 */
export interface AccessScope {
  readonly roleId: RoleId;
  readonly allowedResourceIds?: ReadonlyArray<string>;
  readonly isRestrictedToAssignedOnly: boolean;
}
