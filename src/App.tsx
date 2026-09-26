import React, { useEffect, useState, useMemo } from 'react';
import { AppShell } from './components/layout/AppShell.tsx';
import { SafetyProvider, useSafety } from './safety/SafetyContext.tsx';
import { AuthProvider, useAuth } from './auth/AuthContext.tsx';
import { DecoyScreen } from './components/safety/DecoyScreen.tsx';
import { SafetyNotice } from './components/safety/SafetyNotice.tsx';
import { DevRoleSwitcher } from './components/auth/DevRoleSwitcher.tsx';
import { DevPermissionInspector } from './components/auth/DevPermissionInspector.tsx';
import { AppHeader } from './components/navigation/AppHeader.tsx';
import { AppSidebar } from './components/navigation/AppSidebar.tsx';
import { MobileNavDrawer } from './components/navigation/MobileNavDrawer.tsx';
import { DashboardFoundation } from './components/dashboard/DashboardFoundation.tsx';
import { NAV_ITEMS, type NavItemConfig } from './navigation/navConfig.ts';
import { NavIcon } from './components/navigation/NavIcon.tsx';

// Import 6 standalone workspace views
import { PublicResourcesView } from './components/views/PublicResourcesView.tsx';
import { IntakeFormView } from './components/views/IntakeFormView.tsx';
import { SafetyPlanView } from './components/views/SafetyPlanView.tsx';
import { MessagesView } from './components/views/MessagesView.tsx';
import { DocumentVaultView } from './components/views/DocumentVaultView.tsx';
import { AdminGovernanceView } from './components/views/AdminGovernanceView.tsx';

function AppContent() {
  const { safetyState, registerPurgeCallback } = useSafety();
  const { currentUser, checkPermission } = useAuth();
  const [testFormDraft, setTestFormDraft] = useState('');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [activeNavId, setActiveNavId] = useState<string>('crisis');

  // Register in-memory test draft to verify volatile purge functionality
  useEffect(() => {
    const unregister = registerPurgeCallback('demo_test_draft', 'form_drafts', () => {
      setTestFormDraft('');
    });
    return unregister;
  }, [registerPurgeCallback]);

  // Compute permitted navigation items for current user
  const permittedItems = useMemo(
    () => NAV_ITEMS.filter((item) => checkPermission(item.requiredPermission)),
    [checkPermission]
  );

  // Automatically adjust activeNavId if current selection becomes unauthorized after role switch
  useEffect(() => {
    const isCurrentActivePermitted = permittedItems.some((item) => item.id === activeNavId);
    if (!isCurrentActivePermitted && permittedItems.length > 0) {
      setActiveNavId(permittedItems[0].id);
    }
  }, [permittedItems, activeNavId]);

  const activeItemConfig: NavItemConfig | undefined = permittedItems.find(
    (item) => item.id === activeNavId
  );

  const renderActiveWorkspace = () => {
    switch (activeNavId) {
      case 'crisis':
        return <PublicResourcesView />;
      case 'intake':
        return <IntakeFormView />;
      case 'safety_plan':
        return <SafetyPlanView />;
      case 'client_messages':
      case 'advocate_messages':
      case 'partner_messages':
        return <MessagesView />;
      case 'client_docs':
      case 'advocate_docs':
        return <DocumentVaultView />;
      case 'admin_overview':
      case 'admin_config':
        return <AdminGovernanceView initialTab="overview" />;
      case 'admin_rbac':
        return <AdminGovernanceView initialTab="users" />;
      case 'admin_audit':
        return <AdminGovernanceView initialTab="audit" />;
      default:
        return null;
    }
  };

  if (safetyState.isDecoyActive) {
    return <DecoyScreen />;
  }

  const customHeader = (
    <AppHeader
      onOpenMobileNav={() => setIsMobileNavOpen(true)}
      isMobileNavOpen={isMobileNavOpen}
    />
  );

  const customSidebar = (
    <AppSidebar
      activeNavId={activeNavId}
      onSelectNav={(id) => setActiveNavId(id)}
    />
  );

  return (
    <AppShell headerSlot={customHeader} sidebarSlot={customSidebar}>
      <div className="space-y-6">
        {/* Mobile Navigation Slide-Over Drawer */}
        <MobileNavDrawer
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
          activeNavId={activeNavId}
          onSelectNav={(id) => setActiveNavId(id)}
        />

        {/* Safety Core Notice */}
        <SafetyNotice />

        {/* Role-Based Dashboard Foundation */}
        <DashboardFoundation onNavigate={(targetId) => setActiveNavId(targetId)} />

        {/* Active Workspace View Region */}
        <div className="pt-2">
          {renderActiveWorkspace()}
        </div>

        {/* Active Navigation Context Landmark Card */}
        {activeItemConfig && (
          <section
            aria-label="Active Section Context"
            className="rounded-xl border border-indigo-200 bg-white p-5 shadow-xs space-y-2"
          >
            <div className="flex items-center gap-2.5 text-indigo-700">
              <span className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                <NavIcon iconName={activeItemConfig.iconName} className="w-5 h-5 text-indigo-600" />
              </span>
              <div>
                <h2 className="text-base font-bold tracking-tight text-slate-900">
                  {activeItemConfig.label}
                </h2>
                <p className="text-xs text-slate-500">
                  {activeItemConfig.description}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                <span>Required Permission:</span>
                <span className="font-semibold text-indigo-700">{activeItemConfig.requiredPermission}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Access Authorized for {currentUser.role}
              </span>
            </div>
          </section>
        )}

        {/* Development Auth Role Switcher */}
        <DevRoleSwitcher />

        {/* Development RBAC Permission Inspector */}
        <DevPermissionInspector />

        {/* Test Volatile Purger Sandbox */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold tracking-tight text-slate-900">
            Platform Foundation Sandbox
          </h2>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            The Dashboard foundation dynamically reflects your active role while strictly
            preserving the Admin data segregation boundary. Triggering{' '}
            <strong>Quick Escape</strong> (button or <kbd className="rounded bg-slate-100 border border-slate-300 px-1 py-0.5 text-xs font-mono">Esc</kbd> key)
            will camouflage the screen, reset active session memory back to anonymous, and purge all volatile drafts.
          </p>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
            <label htmlFor="test-scratchpad" className="text-xs font-semibold text-slate-700 block">
              Volatile Memory Sandbox (Testing Purge on Escape)
            </label>
            <input
              id="test-scratchpad"
              type="text"
              value={testFormDraft}
              onChange={(e) => setTestFormDraft(e.target.value)}
              placeholder="Type test text here; triggering Quick Escape will purge it immediately..."
              className="w-full text-xs sm:text-sm border border-slate-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-500">
              Status:{' '}
              {testFormDraft ? (
                <span className="text-amber-700 font-medium">Draft present in volatile memory</span>
              ) : (
                <span className="text-emerald-700 font-medium">Volatile memory clear</span>
              )}
              {safetyState.lastVolatilePurgeAt && (
                <span className="ml-2 text-slate-400">
                  (Last purged: {new Date(safetyState.lastVolatilePurgeAt).toLocaleTimeString()})
                </span>
              )}
            </p>
          </div>

          <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
              Phase 1 · Step 7: Dashboard Foundation & Role-Based Views
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function App() {
  return (
    <SafetyProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafetyProvider>
  );
}
