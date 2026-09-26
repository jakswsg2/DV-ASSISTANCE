/**
 * Application Sidebar Component
 * DV-Assistance Platform - Phase 1 Step 6
 *
 * Renders RBAC-aware desktop navigation groups.
 * Every item's visibility is determined strictly by evaluating the active principal's
 * permissions via checkPermission().
 * Never exposes sensitive survivor data or case identifiers in labels.
 */

import React from 'react';
import { useAuth } from '../../auth/AuthContext.tsx';
import { NAV_GROUPS, NAV_ITEMS, type NavItemConfig } from '../../navigation/navConfig.ts';
import { NavIcon } from './NavIcon.tsx';

export interface AppSidebarProps {
  readonly activeNavId: string;
  readonly onSelectNav: (id: string) => void;
  readonly className?: string;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeNavId,
  onSelectNav,
  className = '',
}) => {
  const { checkPermission, currentUser } = useAuth();

  // Filter items based on authoritative RBAC permission check
  const permittedItems = NAV_ITEMS.filter((item) =>
    checkPermission(item.requiredPermission)
  );

  // Group permitted items into active navigation groups
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: permittedItems.filter((item) => item.groupId === group.id),
  })).filter((group) => group.items.length > 0);

  return (
    <nav
      aria-label="Main Navigation"
      className={`w-full bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-6 ${className}`}
    >
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Navigation
        </h2>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Filtered for role:{' '}
          <span className="font-mono font-semibold text-slate-700">{currentUser.role}</span>
        </p>
      </div>

      <div className="space-y-5">
        {visibleGroups.map((group) => (
          <div key={group.id} className="space-y-1.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-2.5">
              {group.label}
            </h3>
            <ul className="space-y-1" role="list">
              {group.items.map((item: NavItemConfig) => {
                const isActive = activeNavId === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelectNav(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/70 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`shrink-0 ${
                          isActive ? 'text-indigo-600' : 'text-slate-400'
                        }`}
                      >
                        <NavIcon iconName={item.iconName} />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
};

export default AppSidebar;
