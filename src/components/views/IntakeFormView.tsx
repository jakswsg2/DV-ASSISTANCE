import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Send, AlertTriangle, CheckCircle2, Lock, FileText, Calendar, HelpCircle } from 'lucide-react';
import { useSafety } from '../../safety/SafetyContext.tsx';

interface IncidentSubmissionResult {
  readonly id: string;
  readonly caseId?: string;
  readonly submittedAt: string;
  readonly message: string;
}

const INCIDENT_TYPES = [
  { value: 'coercive_control', label: 'Coercive Control & Emotional Abuse' },
  { value: 'physical_abuse', label: 'Physical Violence / Assault' },
  { value: 'stalking', label: 'Stalking or Physical Surveillance' },
  { value: 'cyber_harassment', label: 'Digital Stalking / Cyber Harassment' },
  { value: 'financial_abuse', label: 'Financial Exploitation or Control' },
  { value: 'threats', label: 'Direct Threat of Harm' },
  { value: 'other', label: 'Other Incident Type' },
];

export const IntakeFormView: React.FC = () => {
  const { registerPurgeCallback } = useSafety();

  // Controlled form state
  const [incidentDateApproximate, setIncidentDateApproximate] = useState('');
  const [incidentType, setIncidentType] = useState('coercive_control');
  const [sanitizedNarrative, setSanitizedNarrative] = useState('');
  const [policeReportFiled, setPoliceReportFiled] = useState(false);
  const [policeReportReference, setPoliceReportReference] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<IncidentSubmissionResult | null>(null);

  // Pure state reset handler for Quick Escape or post-submit
  const resetFormState = useCallback(() => {
    setIncidentDateApproximate('');
    setIncidentType('coercive_control');
    setSanitizedNarrative('');
    setPoliceReportFiled(false);
    setPoliceReportReference('');
    setError(null);
  }, []);

  // Register volatile state purge callback with SafetyContext
  useEffect(() => {
    const unregister = registerPurgeCallback('intake-form-view', 'form_drafts', () => {
      resetFormState();
      setSubmittedResult(null);
    });

    return () => {
      unregister();
    };
  }, [registerPurgeCallback, resetFormState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!sanitizedNarrative.trim()) {
      setError('Please provide a brief statement describing the situation.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        incidentDateApproximate: incidentDateApproximate.trim() || new Date().toISOString().split('T')[0],
        incidentType,
        sanitizedNarrative: sanitizedNarrative.trim(),
        policeReportFiled,
        policeReportReference: policeReportFiled && policeReportReference.trim() ? policeReportReference.trim() : undefined,
      };

      const res = await fetch('/api/v1/intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const userMsg = errorData.error?.message || 'Unable to submit incident report. Please try again.';
        throw new Error(userMsg);
      }

      const responseData = await res.json();
      resetFormState();

      setSubmittedResult({
        id: responseData.incident?.id || 'INT-CONFIDENTIAL',
        caseId: responseData.case?.id,
        submittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        message: responseData.message || 'Incident report submitted securely.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while submitting your report.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-900 max-w-3xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Lock className="h-5 w-5 text-emerald-400" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Confidential Incident Intake
            </h1>
            <p className="text-xs text-slate-500">
              Anonymous submission • Zero browser storage • In-memory volatile purge protected
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed pt-1">
          Use this form to document incidents safely. Information submitted here is transmitted securely to authorized victim advocacy staff. You do not need to share real names or exact location details if doing so puts you at risk.
        </p>

        <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200/80 px-3 py-2 rounded-xl">
          <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
          <span>
            Pressing <strong>Escape (Esc)</strong> at any time immediately wipes this form and switches to a neutral disguise tab.
          </span>
        </div>
      </div>

      {/* Success View */}
      {submittedResult ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 space-y-4 text-emerald-950 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-emerald-900">
                Report Submitted Safely
              </h2>
              <p className="text-xs text-emerald-700">
                Submitted at {submittedResult.submittedAt} • Reference ID: <code className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded-xs text-emerald-900">{submittedResult.id}</code>
              </p>
            </div>
          </div>

          <p className="text-sm text-emerald-800 leading-relaxed">
            Your intake submission has been received securely by advocate triage. If you are in immediate physical danger, please use a safe device to call local emergency services or contact a 24/7 hotline.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSubmittedResult(null)}
              className="rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-900 focus:outline-hidden transition-colors"
            >
              Submit Another Statement
            </button>
          </div>
        </div>
      ) : (
        /* Intake Form */
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-900 flex items-start gap-2.5" role="alert">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Incident Type */}
          <div className="space-y-1.5">
            <label htmlFor="incidentType" className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Primary Nature of Incident <span className="text-rose-500">*</span>
            </label>
            <select
              id="incidentType"
              value={incidentType}
              onChange={(e) => setIncidentType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition-colors"
            >
              {INCIDENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Approximate Date */}
          <div className="space-y-1.5">
            <label htmlFor="incidentDate" className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Approximate Date or Timeframe
            </label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                id="incidentDate"
                type="text"
                value={incidentDateApproximate}
                onChange={(e) => setIncidentDateApproximate(e.target.value)}
                placeholder="e.g. Yesterday evening, or 2026-09-24"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              An approximate timeframe is sufficient. Do not worry about exact dates if unremembered.
            </p>
          </div>

          {/* Incident Narrative */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="sanitizedNarrative" className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Incident Description / Statement <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">Sanitized & Safe</span>
            </div>
            <textarea
              id="sanitizedNarrative"
              rows={5}
              value={sanitizedNarrative}
              onChange={(e) => setSanitizedNarrative(e.target.value)}
              placeholder="Describe what occurred, any threats made, or support needed. Avoid specific names or addresses if doing so presents a safety risk..."
              required
              aria-required="true"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition-colors leading-relaxed"
            />
          </div>

          {/* Police Report Checkbox & Field */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2.5">
              <input
                id="policeReportFiled"
                type="checkbox"
                checked={policeReportFiled}
                onChange={(e) => setPoliceReportFiled(e.target.checked)}
                className="h-4 w-4 rounded-xs border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="policeReportFiled" className="text-xs font-semibold text-slate-800 cursor-pointer">
                A police report or protective order petition has been filed
              </label>
            </div>

            {policeReportFiled && (
              <div className="space-y-1.5 pl-6">
                <label htmlFor="policeReference" className="block text-xs font-medium text-slate-700">
                  Optional Report Number or Precinct Reference
                </label>
                <input
                  id="policeReference"
                  type="text"
                  value={policeReportReference}
                  onChange={(e) => setPoliceReportReference(e.target.value)}
                  placeholder="e.g. Case #2026-8941"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* Submission Action */}
          <div className="pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <HelpCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>Form draft automatically clears on Quick Escape</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetFormState}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Clear Form
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !sanitizedNarrative.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Transmitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Submit Confidential Statement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default IntakeFormView;
