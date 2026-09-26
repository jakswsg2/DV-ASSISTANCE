/**
 * Centralized Navigation Configuration
 * DV-Assistance Platform - Phase 1 Step 6
 *
 * Defines all navigation items, their logical groupings, and required permissions.
 * Navigation visibility is strictly derived from the authoritative RBAC system;
 * no role-based hardcoding exists in component markup.
 */

import type { PermissionId } from '../types/rbac.ts';

export type NavGroupId = 'public' | 'client' | 'advocate' | 'partner' | 'admin';

export interface NavItemConfig {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly requiredPermission: PermissionId;
  readonly groupId: NavGroupId;
  readonly iconName: string;
}

export interface NavGroupConfig {
  readonly id: NavGroupId;
  readonly label: string;
  readonly description: string;
}

export const NAV_GROUPS: ReadonlyArray<NavGroupConfig> = [
  {
    id: 'public',
    label: 'Immediate Help & Crisis',
    description: 'Emergency resources and confidential intake assistance.',
  },
  {
    id: 'client',
    label: 'Survivor Services',
    description: 'Personalized safety planning, support status, and safe messages.',
  },
  {
    id: 'advocate',
    label: 'Casework Management',
    description: 'Assigned caseload reviews and intake triage.',
  },
  {
    id: 'partner',
    label: 'Specialized Consulting',
    description: 'Legal protective orders and medical advisory guidance.',
  },
  {
    id: 'admin',
    label: 'System Governance',
    description: 'System configuration, role management, and security audit logs.',
  },
];

export const NAV_ITEMS: ReadonlyArray<NavItemConfig> = [
  // Public Group
  {
    id: 'crisis',
    label: 'Crisis & Hotlines',
    description: '24/7 emergency hotlines and verified shelter directories',
    requiredPermission: 'emergency:view',
    groupId: 'public',
    iconName: 'ShieldAlert',
  },
  {
    id: 'intake',
    label: 'Confidential Intake',
    description: 'Confidential request for assistance and incident submission',
    requiredPermission: 'intake:create',
    groupId: 'public',
    iconName: 'FileText',
  },

  // Client Group
  {
    id: 'client_support',
    label: 'My Support & Case',
    description: 'Personal case status and advocate contact details',
    requiredPermission: 'client:read_own',
    groupId: 'client',
    iconName: 'HeartHandshake',
  },
  {
    id: 'safety_plan',
    label: 'Safety Plan',
    description: 'Interactive danger checklist and emergency action steps',
    requiredPermission: 'safety_plan:read',
    groupId: 'client',
    iconName: 'ShieldCheck',
  },
  {
    id: 'client_messages',
    label: 'Safe Messages',
    description: 'Encrypted, discreet in-app communication with assigned advocate',
    requiredPermission: 'messages:client',
    groupId: 'client',
    iconName: 'MessageSquare',
  },
  {
    id: 'client_docs',
    label: 'Document Vault',
    description: 'Vaulted protective orders, evidence, and records',
    requiredPermission: 'docs:view',
    groupId: 'client',
    iconName: 'FolderLock',
  },

  // Advocate Group
  {
    id: 'advocate_cases',
    label: 'Assigned Caseload',
    description: 'Active client cases and coordinated service tracking',
    requiredPermission: 'cases:read_assigned',
    groupId: 'advocate',
    iconName: 'Users',
  },
  {
    id: 'intake_review',
    label: 'Intake Triage',
    description: 'Review incoming intake reports and initiate case files',
    requiredPermission: 'intake:review',
    groupId: 'advocate',
    iconName: 'ClipboardCheck',
  },
  {
    id: 'advocate_messages',
    label: 'Casework Messages',
    description: 'Secure client communications and crisis threads',
    requiredPermission: 'messages:advocate',
    groupId: 'advocate',
    iconName: 'MessageSquare',
  },
  {
    id: 'advocate_docs',
    label: 'Case Documents',
    description: 'Review client evidence and legal filings',
    requiredPermission: 'docs:view',
    groupId: 'advocate',
    iconName: 'FolderLock',
  },

  // Partner Group
  {
    id: 'partner_legal',
    label: 'Legal Advisory',
    description: 'Protective orders, court calendars, and legal aid filings',
    requiredPermission: 'legal:read',
    groupId: 'partner',
    iconName: 'Scale',
  },
  {
    id: 'partner_medical',
    label: 'Medical Guidance',
    description: 'Forensic documentation and trauma medical guidance',
    requiredPermission: 'medical:read',
    groupId: 'partner',
    iconName: 'Stethoscope',
  },
  {
    id: 'partner_messages',
    label: 'Consultation Threads',
    description: 'Case worker consultations and advisory notes',
    requiredPermission: 'messages:read',
    groupId: 'partner',
    iconName: 'MessageSquare',
  },

  // Admin Group
  {
    id: 'admin_overview',
    label: 'System Overview',
    description: 'Platform health metrics and system performance',
    requiredPermission: 'admin:access',
    groupId: 'admin',
    iconName: 'Settings',
  },
  {
    id: 'admin_rbac',
    label: 'Access & Roles',
    description: 'Staff account provisioning and permission assignments',
    requiredPermission: 'rbac:manage',
    groupId: 'admin',
    iconName: 'KeyRound',
  },
  {
    id: 'admin_config',
    label: 'Platform Settings',
    description: 'System feature flags and operational configurations',
    requiredPermission: 'config:manage',
    groupId: 'admin',
    iconName: 'Sliders',
  },
  {
    id: 'admin_audit',
    label: 'Security Audit Log',
    description: 'Immutable forensic security and access trail',
    requiredPermission: 'audit:read',
    groupId: 'admin',
    iconName: 'ScrollText',
  },
];
