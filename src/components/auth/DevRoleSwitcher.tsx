/**
 * Development Role Switcher Component
 * DV-Assistance Platform - Development Auth
 *
 * Provides a development-only UI to toggle between approved conceptual roles:
 * - Anonymous / Public Seeker
 * - Client / Survivor
 * - Advocate / Case Worker
 * - Legal / Medical Partner
 * - System Administrator
 *
 * Contains ZERO real credentials and makes ZERO production security claims.
 */

import React from 'react';
import { useAuth } from '../../auth/AuthContext.tsx';
import type { RoleId } from '../../types/rbac.ts';

interface RoleOption {
  readonly id: RoleId;
  readonly label: string;
  readonly badgeColor: string;
}

const ROLES: ReadonlyArray<RoleOption> = [
  { id: 'anonymous', label: 'Anonymous Visitor', badgeColor: 'bg-slate-100 text-slate-700 border-slate-300' },
  { id: 'client', label: 'Client / Survivor', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { id: 'advocate', label: 'Advocate / Caseworker', badgeColor: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: 'partner', label: 'Legal / Medical Partner', badgeColor: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: 'admin', label: 'System Administrator', badgeColor: 'bg-amber-100 text-amber-800 border-amber-300' },
];

export const DevRoleSwitcher: React.FC = () => {
  const { currentUser, switchRole, signOut } = useAuth();

  // Strictly disabled in production builds to prevent any accidental UI exposure
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <section
      aria-label="Development Authentication Persona Switcher"
      className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 sm:p-5 text-indigo-950 space-y-3"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-indigo-200/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
            Dev Auth Only
          </span>
          <h2 className="text-xs sm:text-sm font-semibold text-indigo-900">
            RBAC Testing Persona Switcher
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-indigo-700">Active:</span>
          <span className="font-mono font-semibold bg-white border border-indigo-200 rounded px-2 py-0.5 text-indigo-900">
            {currentUser.role}
          </span>
          {!currentUser.isAnonymous && (
            <button
              type="button"
              onClick={() => signOut()}
              className="ml-2 text-indigo-600 hover:text-indigo-900 underline text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded"
              title="Reset session to anonymous"
            >
              Reset Session
            </button>
          )}
        </div>
      </div>

      <div className="text-xs text-indigo-800">
        Active Persona: <strong className="text-indigo-950">{currentUser.safeAlias}</strong>
      </div>

      <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Select test role">
        {ROLES.map((role) => {
          const isSelected = currentUser.role === role.id;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => switchRole(role.id)}
              aria-pressed={isSelected}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
                isSelected
                  ? 'bg-indigo-700 text-white border-indigo-800 shadow-xs'
                  : 'bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-100/70'
              }`}
            >
              {role.label}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default DevRoleSwitcher;
