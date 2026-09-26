/**
 * Mobile Navigation Drawer Component
 * DV-Assistance Platform - Phase 1 Step 6
 *
 * Slide-over navigation drawer for mobile viewports.
 * Uses capture-phase Escape interception when open to ensure closing the mobile menu
 * does NOT accidentally trigger the global Quick Escape safety action.
 */

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext.tsx';
import { NAV_GROUPS, NAV_ITEMS, type NavItemConfig } from '../../navigation/navConfig.ts';
import { NavIcon } from './NavIcon.tsx';

export interface MobileNavDrawerProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly activeNavId: string;
  readonly onSelectNav: (id: string) => void;
}

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({
  isOpen,
  onClose,
  activeNavId,
  onSelectNav,
}) => {
  const { checkPermission, currentUser } = useAuth();
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management: Focus close button on drawer open
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  // Scoped Escape key interception:
  // When mobile drawer is open, Escape closes the drawer and stops propagation
  // so that Quick Escape is NOT triggered accidentally.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDownCapture = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };

    // Use capture phase so we intercept before bubble listeners
    window.addEventListener('keydown', handleKeyDownCapture, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDownCapture, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter items based on authoritative RBAC permission check
  const permittedItems = NAV_ITEMS.filter((item) =>
    checkPermission(item.requiredPermission)
  );

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: permittedItems.filter((item) => item.groupId === group.id),
  })).filter((group) => group.items.length > 0);

  return (
    <div
      id="mobile-navigation-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation Menu"
      className="fixed inset-0 z-50 md:hidden"
    >
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
      />

      {/* Drawer content */}
      <div
        ref={drawerRef}
        className="fixed inset-y-0 left-0 w-full max-w-xs bg-white shadow-xl flex flex-col z-10 animate-in slide-in-from-left duration-200"
      >
        {/* Drawer header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-semibold text-xs">
              DV
            </div>
            <span className="font-bold text-slate-900 text-sm">
              DV-Assistance Menu
            </span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Current persona info */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-xs flex items-center justify-between">
          <span className="text-slate-500">Active Role:</span>
          <span className="font-mono font-semibold text-indigo-700 bg-white border border-slate-200 rounded px-1.5 py-0.5">
            {currentUser.role}
          </span>
        </div>

        {/* Navigation list */}
        <nav aria-label="Mobile Navigation" className="flex-1 overflow-y-auto p-4 space-y-5">
          {visibleGroups.map((group) => (
            <div key={group.id} className="space-y-1.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-2">
                {group.label}
              </h3>
              <ul className="space-y-1" role="list">
                {group.items.map((item: NavItemConfig) => {
                  const isActive = activeNavId === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectNav(item.id);
                          onClose();
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                          isActive
                            ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/70'
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
        </nav>
      </div>
    </div>
  );
};

export default MobileNavDrawer;
