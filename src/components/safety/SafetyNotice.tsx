/**
 * Safety Notice Component
 * DV-Assistance Platform - Safety Core
 *
 * Truthful, transparent overview of safety capabilities and limitations.
 * Explicitly separates what the web application can control versus
 * browser/OS and environmental constraints.
 */

import React from 'react';
import { useSafety } from '../../safety/SafetyContext.tsx';

export const SafetyNotice: React.FC = () => {
  const { safetyState, toggleStealthMode } = useSafety();

  return (
    <section
      aria-labelledby="safety-notice-title"
      className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 sm:p-6 text-amber-950 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white font-bold text-xs" aria-hidden="true">
            !
          </div>
          <h2 id="safety-notice-title" className="text-base font-semibold tracking-tight text-amber-900">
            Privacy & Browsing Safety Boundaries
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleStealthMode()}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100/50 focus:outline-none focus:ring-1 focus:ring-amber-500"
            aria-pressed={safetyState.stealthModeEnabled}
          >
            <span>Tab Disguise:</span>
            <span className="font-semibold">{safetyState.stealthModeEnabled ? 'Active (Notes)' : 'Off (Default)'}</span>
          </button>
        </div>
      </div>

      <p className="text-xs sm:text-sm leading-relaxed text-amber-800">
        Your safety is the highest priority. This web application provides active in-app safeguards,
        but cannot override device or browser operating system controls.
      </p>

      {/* Safety Matrix Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-1.5">
          <span className="font-semibold text-emerald-900 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            Application-Controlled (What We Do)
          </span>
          <ul className="list-disc list-inside text-emerald-800 space-y-1">
            <li>Immediate switch to benign neutral screen via <strong>Esc</strong> key or button</li>
            <li>In-memory volatile state purger resets active form drafts and session views</li>
            <li>Sanitizes address bar to strip query parameters and sensitive URL fragments</li>
            <li>Zero survivor PII stored in permanent browser storage (localStorage)</li>
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-1.5">
          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
            Device & Environment Limitations (What We Cannot Control)
          </span>
          <ul className="list-disc list-inside text-slate-600 space-y-1">
            <li><strong>Browser History:</strong> Web pages cannot delete browser history logs</li>
            <li><strong>Device Monitoring:</strong> Cannot block keyloggers, screen recording, or spyware</li>
            <li><strong>Network Logs:</strong> Wi-Fi router and ISP traffic remain visible to network owners</li>
            <li><strong>Downloads:</strong> Saved files cannot be automatically erased from device storage</li>
          </ul>
        </div>
      </div>

      <div className="text-[11px] text-amber-700/90 border-t border-amber-200/80 pt-3">
        <strong>Important Advice:</strong> If you suspect your phone or computer is monitored, please access this platform from a safe, uncompromised device (such as a library computer, trusted friend&apos;s phone, or work terminal) using private browsing mode.
      </div>
    </section>
  );
};

export default SafetyNotice;
