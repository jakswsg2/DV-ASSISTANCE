/**
 * Application Header Component
 * DV-Assistance Platform - Phase 1 Step 6
 *
 * Provides brand identity, mobile navigation trigger, dev role indicator,
 * and high-priority Quick Escape safety control.
 * Strictly avoids displaying any sensitive client or case data.
 */

import React from 'react';
import { Menu } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext.tsx';
import { QuickEscapeButton } from '../safety/QuickEscapeButton.tsx';

export interface AppHeaderProps {
  readonly onOpenMobileNav: () => void;
  readonly isMobileNavOpen: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onOpenMobileNav,
  isMobileNavOpen,
}) => {
  const { currentUser } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
      {/* Brand & Mobile Hamburger */}
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="md:hidden inline-flex items-center justify-center p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Open navigation menu"
          aria-expanded={isMobileNavOpen}
          aria-controls="mobile-navigation-drawer"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* Brand identity */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-xs">
            DV
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            DV-Assistance
          </span>
        </div>
      </div>

      {/* Development Persona Indicator & Safety Quick Escape */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Development Auth Role Badge */}
        <div className="hidden sm:flex items-center gap-2 border border-indigo-200 bg-indigo-50/70 rounded-lg px-2.5 py-1 text-xs text-indigo-900">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
            Role:
          </span>
          <span className="font-mono font-semibold">
            {currentUser.role}
          </span>
        </div>

        {/* Always Accessible Quick Escape Control */}
        <QuickEscapeButton />
      </div>
    </div>
  );
};

export default AppHeader;
