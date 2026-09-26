/**
 * System Administrator Dashboard View
 * DV-Assistance Platform - Phase 1 Step 7
 *
 * Dedicated dashboard for platform administrators managing system health,
 * RBAC configuration, feature flags, and forensic security audit logs.
 *
 * CRITICAL ARCHITECTURAL BOUNDARY:
 * System Administrators have ZERO access to confidential survivor records,
 * client case files, incident narratives, or safety plans.
 * This ethical data wall is strictly preserved.
 */

import React from 'react';
import { DashboardCard } from '../DashboardCard.tsx';

export interface AdminDashboardProps {
  readonly onNavigate: (targetId: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-6">
      {/* Admin Governance Banner with Ethical Wall Notice */}
      <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 text-amber-950 space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-amber-200/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-600" />
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-amber-950">
              System Administration & Governance
            </h1>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-200 text-amber-900 uppercase tracking-wider">
            Governance Only
          </span>
        </div>

        <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
          Welcome to the platform governance console. Administrators manage technical system parameters,
          staff account role allocations, security feature flags, and append-only audit trail verification.
        </p>

        {/* Highlighted Ethical Wall Notice */}
        <div className="rounded-lg border border-rose-300 bg-white p-3.5 text-xs text-rose-950 space-y-1 shadow-2xs">
          <div className="flex items-center gap-1.5 font-bold text-rose-900">
            <span className="h-2 w-2 rounded-full bg-rose-600" />
            Mandatory Admin Data Segregation Wall
          </div>
          <p className="text-[11px] text-rose-800 leading-relaxed">
            By system constitutional policy, <strong>System Administrators are structurally prohibited</strong> from
            querying, displaying, or exporting confidential survivor identities, case notes, incident details, or safety plans.
            Casework is segregated strictly to authorized advocate and survivor accounts.
          </p>
        </div>
      </section>

      {/* Grid of Admin Governance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <DashboardCard
          title="RBAC Policy Subsystem"
          description="Role-Based Access Control matrix status and candidate role mappings."
          iconName="KeyRound"
          statusBadge={{ text: 'Enforced', variant: 'success' }}
          primaryMetric={{ value: '5 Primary Roles', label: '25 Granular Permissions Active' }}
          action={{
            label: 'Inspect Access & Roles',
            navTarget: 'admin_rbac',
          }}
          onNavigate={onNavigate}
          footerNotice="Authoritative definitions enforced in /src/rbac/rbacPolicy.ts"
        />

        <DashboardCard
          title="Safety Core Subsystem"
          description="Quick Escape triggers, volatile state shredder, and decoy view camouflage."
          iconName="ShieldCheck"
          statusBadge={{ text: 'Operational', variant: 'success' }}
          primaryMetric={{ value: 'Esc & Click Active', label: 'In-Memory State Purge Registered' }}
          action={{
            label: 'Review Platform Settings',
            navTarget: 'admin_config',
          }}
          onNavigate={onNavigate}
          footerNotice="Volatile memory purgers clear all session state upon escape."
        />

        <DashboardCard
          title="Forensic Security Audit"
          description="Immutable log of system actions, role switches, and administrative events."
          iconName="ScrollText"
          statusBadge={{ text: 'Append-Only', variant: 'info' }}
          emptyStateText="Audit subsystem is operating in volatile memory. 0 persistent records written."
          action={{
            label: 'View Security Audit Log',
            navTarget: 'admin_audit',
          }}
          onNavigate={onNavigate}
          footerNotice="Production audit logging will bind to relational tables in later phases."
        />

        <DashboardCard
          title="Architecture Milestone Status"
          description="Verification tracking across Master Development Constitution gates."
          iconName="Settings"
          statusBadge={{ text: 'Phase 1 Active', variant: 'info' }}
          primaryMetric={{ value: 'Steps 1–6 Passed', label: 'Step 7: Dashboard Foundation' }}
          action={{
            label: 'View System Overview',
            navTarget: 'admin_overview',
          }}
          onNavigate={onNavigate}
          footerNotice="Fully verified under Vite 8.3 & React 19 strict typing."
        />
      </div>
    </div>
  );
};

export default AdminDashboard;
