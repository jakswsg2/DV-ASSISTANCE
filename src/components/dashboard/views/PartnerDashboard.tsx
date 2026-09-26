/**
 * Partner Dashboard View
 * DV-Assistance Platform - Phase 1 Step 7
 *
 * Dedicated dashboard for legal and medical partner consultants providing specialized
 * guidance on protective orders, court filings, and forensic trauma documentation.
 * Uses honest empty states; contains zero fabricated legal or medical records.
 */

import React from 'react';
import { DashboardCard } from '../DashboardCard.tsx';

export interface PartnerDashboardProps {
  readonly onNavigate: (targetId: string) => void;
}

export const PartnerDashboard: React.FC<PartnerDashboardProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-6">
      {/* Partner Overview Banner */}
      <section className="rounded-xl border border-purple-200 bg-purple-50/60 p-5 text-purple-950 space-y-2">
        <h1 className="text-base sm:text-lg font-bold tracking-tight text-purple-950">
          Specialized Partner Advisory Center
        </h1>
        <p className="text-xs sm:text-sm text-purple-800 leading-relaxed">
          Welcome to the partner consultation portal. Legal and medical partners provide specialized advisory
          services for emergency protective orders (EPO/TRO), court accompaniment, and medical forensic coordination.
        </p>
        <div className="text-[11px] text-purple-700 pt-1">
          <strong>Architectural Note:</strong> Partner operates as a unified conceptual primary role with legal and medical advisory capabilities.
        </div>
      </section>

      {/* Grid of Partner Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <DashboardCard
          title="Legal Advisory & Protective Orders"
          description="Temporary restraining order petitions, court date coordination, and legal filings."
          iconName="Scale"
          statusBadge={{ text: 'Legal Portal', variant: 'info' }}
          emptyStateText="0 active protective order filings or legal requests assigned."
          action={{
            label: 'Open Legal Advisory',
            navTarget: 'partner_legal',
          }}
          onNavigate={onNavigate}
          footerNotice="Provides legal consultation without storing sensitive survivor case diaries."
        />

        <DashboardCard
          title="Medical & Forensic Guidance"
          description="Forensic trauma documentation and clinical medical guidance for referred clients."
          iconName="Stethoscope"
          statusBadge={{ text: 'Clinical', variant: 'info' }}
          emptyStateText="0 forensic examination guidance requests pending."
          action={{
            label: 'Open Medical Center',
            navTarget: 'partner_medical',
          }}
          onNavigate={onNavigate}
          footerNotice="Medical partner access is restricted strictly to authorized consultations."
        />

        <DashboardCard
          title="Consultation Threads"
          description="Direct confidential threads with case workers regarding referred clients."
          iconName="MessageSquare"
          statusBadge={{ text: 'Consultations', variant: 'neutral' }}
          emptyStateText="0 active consultation threads in development memory."
          action={{
            label: 'Open Consultations',
            navTarget: 'partner_messages',
          }}
          onNavigate={onNavigate}
          footerNotice="Threads are maintained in volatile memory during development."
        />

        <DashboardCard
          title="Shared Documents & Orders"
          description="Court orders, legal waivers, and medical release authorizations."
          iconName="FolderLock"
          statusBadge={{ text: 'Consultant Vault', variant: 'neutral' }}
          emptyStateText="0 shared legal or medical documents available."
          action={{
            label: 'View Vault',
            navTarget: 'partner_legal',
          }}
          onNavigate={onNavigate}
          footerNotice="Subject to strict confidentiality agreements."
        />
      </div>
    </div>
  );
};

export default PartnerDashboard;
