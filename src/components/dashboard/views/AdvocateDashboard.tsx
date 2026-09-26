/**
 * Advocate / Case Worker Dashboard View
 * DV-Assistance Platform - Phase 1 Step 7
 *
 * Dedicated dashboard for caseworkers managing assigned survivor caseloads,
 * reviewing incoming intake submissions, and coordinating client care.
 * Uses honest empty states; contains zero fabricated cases or narratives.
 */

import React from 'react';
import { DashboardCard } from '../DashboardCard.tsx';

export interface AdvocateDashboardProps {
  readonly onNavigate: (targetId: string) => void;
}

export const AdvocateDashboard: React.FC<AdvocateDashboardProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-6">
      {/* Advocate Workspace Banner */}
      <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-5 text-blue-950 space-y-2">
        <h1 className="text-base sm:text-lg font-bold tracking-tight text-blue-950">
          Casework & Triage Center
        </h1>
        <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
          Welcome to the caseworker management workspace. You have access to review incoming confidential intake
          submissions, manage active survivor caseloads, and exchange secure messages with assigned clients.
        </p>
        <div className="text-[11px] text-blue-700 pt-1">
          <strong>Access Restriction:</strong> Caseworkers only access records within their assigned caseload.
        </div>
      </section>

      {/* Grid of Advocate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <DashboardCard
          title="Assigned Caseload"
          description="Active survivor clients currently assigned for direct advocacy and support."
          iconName="Users"
          statusBadge={{ text: 'Casework', variant: 'info' }}
          emptyStateText="0 active cases assigned in development memory."
          action={{
            label: 'View Caseload',
            navTarget: 'advocate_cases',
          }}
          onNavigate={onNavigate}
          footerNotice="Caseload assignments will link to relational database records in future phases."
        />

        <DashboardCard
          title="Intake Triage Queue"
          description="Incoming confidential inquiries and safety requests awaiting initial review."
          iconName="ClipboardCheck"
          statusBadge={{ text: 'Triage', variant: 'warning' }}
          emptyStateText="0 pending intake submissions awaiting triage."
          action={{
            label: 'Open Intake Queue',
            navTarget: 'intake_review',
          }}
          onNavigate={onNavigate}
          footerNotice="Intake reviews evaluate danger scores and appropriate service referrals."
        />

        <DashboardCard
          title="Casework Messages"
          description="Direct secure communication channels with active clients."
          iconName="MessageSquare"
          statusBadge={{ text: 'Confidential', variant: 'neutral' }}
          emptyStateText="0 unread caseworker messages in memory."
          action={{
            label: 'View Messages',
            navTarget: 'advocate_messages',
          }}
          onNavigate={onNavigate}
          footerNotice="All communications are bound to assigned case numbers."
        />

        <DashboardCard
          title="Case Document Vault"
          description="Evidence files, police reports, and court protective orders."
          iconName="FolderLock"
          statusBadge={{ text: 'Evidence Vault', variant: 'neutral' }}
          emptyStateText="0 case documents on file in development memory."
          action={{
            label: 'Browse Case Files',
            navTarget: 'advocate_docs',
          }}
          onNavigate={onNavigate}
          footerNotice="Files are restricted strictly to authorized caseworkers."
        />
      </div>
    </div>
  );
};

export default AdvocateDashboard;
