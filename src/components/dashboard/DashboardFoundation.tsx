/**
 * Dashboard Foundation Router Component
 * DV-Assistance Platform - Phase 1 Step 7
 *
 * Resolves and renders the appropriate role-specific dashboard overview
 * based on the active principal's authenticated role in AuthContext.
 * Strictly adheres to the Admin Ethical Wall and honest empty-state guidelines.
 */

import React from 'react';
import { useAuth } from '../../auth/AuthContext.tsx';
import { AnonymousDashboard } from './views/AnonymousDashboard.tsx';
import { ClientDashboard } from './views/ClientDashboard.tsx';
import { AdvocateDashboard } from './views/AdvocateDashboard.tsx';
import { PartnerDashboard } from './views/PartnerDashboard.tsx';
import { AdminDashboard } from './views/AdminDashboard.tsx';

export interface DashboardFoundationProps {
  readonly onNavigate: (targetId: string) => void;
}

export const DashboardFoundation: React.FC<DashboardFoundationProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();

  const renderRoleDashboard = () => {
    switch (currentUser.role) {
      case 'client':
        return <ClientDashboard onNavigate={onNavigate} />;
      case 'advocate':
        return <AdvocateDashboard onNavigate={onNavigate} />;
      case 'partner':
        return <PartnerDashboard onNavigate={onNavigate} />;
      case 'admin':
        return <AdminDashboard onNavigate={onNavigate} />;
      case 'anonymous':
      default:
        return <AnonymousDashboard onNavigate={onNavigate} />;
    }
  };

  return (
    <section aria-label="Role Dashboard Workspace" className="space-y-6">
      {renderRoleDashboard()}
    </section>
  );
};

export default DashboardFoundation;
