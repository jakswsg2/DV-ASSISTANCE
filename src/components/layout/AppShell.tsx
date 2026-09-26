import React from 'react';

export interface AppShellProps {
  children?: React.ReactNode;
  headerSlot?: React.ReactNode;
  sidebarSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  headerSlot,
  sidebarSlot,
  footerSlot,
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased">
      {/* Accessible skip link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md focus:shadow-md focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Structural Header Container / Slot */}
      <header className="w-full border-b border-slate-200 bg-white sticky top-0 z-30">
        {headerSlot ?? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                DV
              </div>
              <span className="text-lg font-semibold tracking-tight text-slate-900">
                DV-Assistance
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Platform Shell
            </div>
          </div>
        )}
      </header>

      {/* Main Layout Area: Responsive Container with optional Sidebar Slot */}
      {sidebarSlot ? (
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
          <aside className="hidden md:block w-64 shrink-0">
            {sidebarSlot}
          </aside>
          <main
            id="main-content"
            className="flex-1 min-w-0 focus:outline-none"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
      ) : (
        <main
          id="main-content"
          className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 focus:outline-none"
          tabIndex={-1}
        >
          {children}
        </main>
      )}

      {/* Structural Footer Container / Slot */}
      <footer className="w-full border-t border-slate-200 bg-white py-6 mt-auto">
        {footerSlot ?? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              &copy; {new Date().getFullYear()} DV-Assistance. All rights reserved.
            </div>
            <div>
              Confidential Support & Assistance Platform Foundation
            </div>
          </div>
        )}
      </footer>
    </div>
  );
};

export default AppShell;
