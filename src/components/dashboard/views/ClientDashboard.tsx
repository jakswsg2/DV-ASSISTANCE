/**
 * Client / Survivor Dashboard View
 * DV-Assistance Platform - Phase 1 Step 7
 *
 * Dedicated dashboard for authenticated survivors managing their personal safety plan,
 * casework status, and secure communications. Uses honest empty states; contains zero
 * fake PII or realistic survivor records.
 */

import React from 'react';
import { DashboardCard } from '../DashboardCard.tsx';

export interface ClientDashboardProps {
  readonly onNavigate: (targetId: string) => void;
}

export const ClientDashboard: React.FC<ClientDashboardProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-6">
      {/* Client Welcome Banner */}
      <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5 text-indigo-950 space-y-2">
        <h1 className="text-base sm:text-lg font-bold tracking-tight text-indigo-950">
          Survivor Support Overview
        </h1>
        <p className="text-xs sm:text-sm text-indigo-800 leading-relaxed">
          Welcome to your confidential support center. From this dashboard, you can review your safety plan,
          communicate safely with your assigned advocate, and access vaulted protective documents.
        </p>
        <div className="text-[11px] text-indigo-700 pt-1">
          <strong>Privacy Note:</strong> All session data lives strictly in transient browser memory during development.
        </div>
      </section>

      {/* Grid of Client Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <DashboardCard
          title="Interactive Safety Plan"
          description="Action steps, safe locations, and emergency contacts tailored to your safety."
          iconName="ShieldCheck"
          statusBadge={{ text: 'Actionable', variant: 'warning' }}
          emptyStateText="No safety plan drafted yet for this development session."
          action={{
            label: 'Open Safety Planner',
            navTarget: 'safety_plan',
          }}
          onNavigate={onNavigate}
          footerNotice="Safety plans can be edited, reviewed, or shredded at any time."
        />

        <DashboardCard
          title="My Support & Case Status"
          description="Status of your ongoing assistance and advocate coordination."
          iconName="HeartHandshake"
          statusBadge={{ text: 'Confidential', variant: 'neutral' }}
          emptyStateText="No active support records connected to this demo persona."
          action={{
            label: 'View Case Status',
            navTarget: 'client_support',
          }}
          onNavigate={onNavigate}
          footerNotice="Accessible only to you and your assigned advocate."
        />

        <DashboardCard
          title="Safe Messages"
          description="Discreet in-app messaging with your assigned case worker."
          iconName="MessageSquare"
          statusBadge={{ text: 'Encrypted', variant: 'neutral' }}
          emptyStateText="0 messages. Conversations are retained temporarily in volatile memory."
          action={{
            label: 'Open Inbox',
            navTarget: 'client_messages',
          }}
          onNavigate={onNavigate}
          footerNotice="In-app messaging never sends lock-screen SMS notifications."
        />

        <DashboardCard
          title="Document Vault"
          description="Confidential storage for protective orders, evidence, and vital documents."
          iconName="FolderLock"
          statusBadge={{ text: 'Vaulted', variant: 'neutral' }}
          emptyStateText="0 vaulted documents uploaded."
          action={{
            label: 'Open Document Vault',
            navTarget: 'client_docs',
          }}
          onNavigate={onNavigate}
          footerNotice="Files in development are stored in memory without server persistence."
        />
      </div>
    </div>
  );
};

export default ClientDashboard;
