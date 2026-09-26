/**
 * Development Permission Inspector & Access Control Demonstration
 * DV-Assistance Platform - Development Auth
 *
 * Demonstrates deterministic RBAC permission evaluation for the active persona.
 * Crucially visualizes the ethical and architectural boundary separating
 * System Administrators from confidential client/case data.
 */

import React from 'react';
import { useAuth } from '../../auth/AuthContext.tsx';
import type { PermissionId } from '../../types/rbac.ts';

interface PermissionCheckItem {
  readonly id: PermissionId;
  readonly label: string;
  readonly domain: 'public' | 'client' | 'advocate' | 'partner' | 'admin';
}

const DEMO_PERMISSIONS: ReadonlyArray<PermissionCheckItem> = [
  { id: 'emergency:view', label: 'View Emergency Hotlines & Crisis Directory', domain: 'public' },
  { id: 'intake:create', label: 'Submit Confidential Intake Form', domain: 'public' },
  { id: 'safety_plan:read', label: 'Read Personal Safety Plan', domain: 'client' },
  { id: 'safety_plan:write', label: 'Edit Personal Safety Plan', domain: 'client' },
  { id: 'client:read_own', label: 'Read Personal Survivor Case Record', domain: 'client' },
  { id: 'cases:read_assigned', label: 'Read Assigned Survivor Caseload', domain: 'advocate' },
  { id: 'intake:review', label: 'Review & Triage Incoming Intakes', domain: 'advocate' },
  { id: 'legal:manage', label: 'Manage Legal Advisory & Protective Orders', domain: 'partner' },
  { id: 'medical:read', label: 'Read Medical / Forensic Advisory Guidance', domain: 'partner' },
  { id: 'admin:access', label: 'Access System Administrative Settings', domain: 'admin' },
  { id: 'audit:read', label: 'Inspect System Security Audit Logs', domain: 'admin' },
];

export const DevPermissionInspector: React.FC = () => {
  const { currentUser, checkPermission } = useAuth();

  // Strictly disabled in production builds
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <section
      aria-label="Development RBAC Permission Matrix"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            RBAC Permission Evaluation Matrix
          </h3>
          <p className="text-xs text-slate-500">
            Real-time evaluation of granted permissions for role:{' '}
            <span className="font-mono font-bold text-slate-800 uppercase">{currentUser.role}</span>
          </p>
        </div>
        <span className="text-[11px] text-slate-400 font-medium">
          Pure In-Memory Evaluator
        </span>
      </div>

      {/* Admin Ethical Wall Banner */}
      {currentUser.role === 'admin' && (
        <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="h-2 w-2 rounded-full bg-rose-600" />
            Admin Ethical Wall Enforced
          </div>
          <p className="text-[11px] text-rose-800 leading-relaxed">
            As a System Administrator, you possess system configuration and audit inspection permissions,
            but are <strong>structurally denied</strong> access to survivor profiles, case notes, and safety plans.
          </p>
        </div>
      )}

      {/* Permission Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400 font-medium">
              <th className="py-2 pr-4">Permission Name</th>
              <th className="py-2 px-4">Domain Category</th>
              <th className="py-2 pl-4 text-right">Access Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {DEMO_PERMISSIONS.map((item) => {
              // Note: safety_plan:manage is verified via safety_plan:read
              const permKey = item.id === ('safety_plan:manage' as PermissionId) ? 'safety_plan:read' : item.id;
              const isAllowed = checkPermission(permKey);

              return (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 pr-4 text-slate-800 font-medium">
                    {item.label}
                    <div className="font-mono text-[10px] text-slate-400">{item.id}</div>
                  </td>
                  <td className="py-2.5 px-4 text-slate-500 capitalize">
                    {item.domain}
                  </td>
                  <td className="py-2.5 pl-4 text-right">
                    {isAllowed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Granted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Denied
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default DevPermissionInspector;
