/**
 * Anonymous / Public Dashboard View
 * DV-Assistance Platform - Phase 1 Step 7
 *
 * Public landing overview for visitors seeking immediate crisis assistance
 * or confidential intake. Strictly contains zero client records, zero case data,
 * and zero administrative information.
 */

import React from 'react';
import { DashboardCard } from '../DashboardCard.tsx';

export interface AnonymousDashboardProps {
  readonly onNavigate: (targetId: string) => void;
}

export const AnonymousDashboard: React.FC<AnonymousDashboardProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-6">
      {/* Public Banner */}
      <section className="rounded-xl border border-rose-200 bg-rose-50/70 p-5 sm:p-6 text-rose-950 space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-rose-600 animate-pulse" />
          <h1 className="font-bold text-rose-900 text-sm sm:text-base">
            Immediate Help & Crisis Assistance Portal
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-rose-800 leading-relaxed">
          If you are in immediate danger, please call <strong>911</strong> or contact emergency services immediately.
          This public portal allows you to access verified 24/7 hotlines or submit a confidential intake request
          without creating a persistent account.
        </p>
        <p className="text-[11px] text-rose-700/90 pt-1">
          <strong>Safe Browsing:</strong> You can hit the red <strong>Quick Escape</strong> button or press the <kbd className="px-1 py-0.5 rounded bg-white text-rose-900 border border-rose-300 font-mono text-[10px]">Esc</kbd> key at any second to instantly switch to a neutral screen.
        </p>
      </section>

      {/* Grid of Public Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <DashboardCard
          title="24/7 Crisis Hotlines & Shelters"
          description="Access vetted emergency crisis numbers, shelter locations, and text lines."
          iconName="ShieldAlert"
          statusBadge={{ text: 'Available 24/7', variant: 'success' }}
          primaryMetric={{ value: 'Public Directory', label: 'Emergency Support Available' }}
          action={{
            label: 'View Emergency Contacts',
            navTarget: 'crisis',
          }}
          onNavigate={onNavigate}
          footerNotice="No login or credentials required to access emergency contacts."
        />

        <DashboardCard
          title="Confidential Intake Screening"
          description="Submit a confidential inquiry for domestic violence advocacy and assistance."
          iconName="FileText"
          statusBadge={{ text: 'Confidential', variant: 'info' }}
          primaryMetric={{ value: 'Online Request', label: 'Secure Initial Screening' }}
          action={{
            label: 'Begin Confidential Intake',
            navTarget: 'intake',
          }}
          onNavigate={onNavigate}
          footerNotice="Intake submissions are treated as highly confidential."
        />
      </div>
    </div>
  );
};

export default AnonymousDashboard;
