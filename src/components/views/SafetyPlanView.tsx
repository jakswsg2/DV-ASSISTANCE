import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Save,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  MapPin,
  Phone,
  Key,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { useSafety } from '../../safety/SafetyContext.tsx';
import type {
  SafetyPlan,
  EmergencyContactEntry,
  EssentialItemChecklist,
} from '../../types/domain.ts';

const DEFAULT_ESSENTIAL_ITEMS: EssentialItemChecklist[] = [
  { itemLabel: 'Identification & Birth Certificates', isPackedOrSecured: false, category: 'documents' },
  { itemLabel: 'Passports, Visas & Social Security Cards', isPackedOrSecured: false, category: 'documents' },
  { itemLabel: 'Prescription Medications & Medical Records', isPackedOrSecured: false, category: 'medication' },
  { itemLabel: 'House & Car Keys (Duplicates)', isPackedOrSecured: false, category: 'keys_money' },
  { itemLabel: 'Emergency Cash & Debit/Credit Cards', isPackedOrSecured: false, category: 'keys_money' },
  { itemLabel: 'Childrens Supplies, Favorite Toys & School Records', isPackedOrSecured: false, category: 'children_pets' },
];

export const SafetyPlanView: React.FC = () => {
  const { registerPurgeCallback } = useSafety();

  // Safety plan form state
  const [safeLocations, setSafeLocations] = useState<string[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContactEntry[]>([]);
  const [essentialItems, setEssentialItems] = useState<EssentialItemChecklist[]>(DEFAULT_ESSENTIAL_ITEMS);
  const [safeCodeWord, setSafeCodeWord] = useState('');

  // Contact modal / inline edit inputs
  const [newLocInput, setNewLocInput] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactRel, setNewContactRel] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactKnowsCode, setNewContactKnowsCode] = useState(false);

  // Status state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Pure purge handler to clear uncommitted in-memory edits
  const purgeInMemDrafts = useCallback(() => {
    setSafeLocations([]);
    setEmergencyContacts([]);
    setEssentialItems(DEFAULT_ESSENTIAL_ITEMS);
    setSafeCodeWord('');
    setNewLocInput('');
    setNewContactName('');
    setNewContactRel('');
    setNewContactPhone('');
    setError(null);
    setSuccessMsg(null);
  }, []);

  // Register with Safety Core purge registry
  useEffect(() => {
    const unregister = registerPurgeCallback('safety-plan-view', 'form_drafts', () => {
      purgeInMemDrafts();
    });

    return () => {
      unregister();
    };
  }, [registerPurgeCallback, purgeInMemDrafts]);

  // Fetch active safety plan on mount
  const fetchSafetyPlan = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/safety-plans', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('Access restricted. Please ensure you are signed into your client account.');
        }
        throw new Error('Failed to load safety plan data.');
      }

      const data = await res.json();
      const plan: SafetyPlan | null = data.plan;

      if (plan) {
        setSafeLocations(Array.isArray(plan.safeLocations) ? [...plan.safeLocations] : []);
        setEmergencyContacts(Array.isArray(plan.emergencyContacts) ? [...plan.emergencyContacts] : []);
        setEssentialItems(
          Array.isArray(plan.essentialItems) && plan.essentialItems.length > 0
            ? [...plan.essentialItems]
            : DEFAULT_ESSENTIAL_ITEMS
        );
        setSafeCodeWord(plan.safeCodeWord || '');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while loading your safety plan.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSafetyPlan();
  }, [fetchSafetyPlan]);

  // Handle Save (PUT /api/v1/safety-plans)
  const handleSavePlan = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        safeLocations,
        emergencyContacts,
        essentialItems,
        safeCodeWord: safeCodeWord.trim() || undefined,
      };

      const res = await fetch('/api/v1/safety-plans', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || 'Failed to save safety plan updates.');
      }

      setSuccessMsg('Safety plan updated securely.');

      // Clear success banner after 4 seconds
      setTimeout(() => {
        setSuccessMsg(null);
      }, 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while saving your safety plan.';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Safe Location management
  const addSafeLocation = () => {
    if (!newLocInput.trim()) return;
    setSafeLocations((prev) => [...prev, newLocInput.trim()]);
    setNewLocInput('');
  };

  const removeSafeLocation = (index: number) => {
    setSafeLocations((prev) => prev.filter((_, i) => i !== index));
  };

  // Emergency Contact management
  const addEmergencyContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    const entry: EmergencyContactEntry = {
      contactName: newContactName.trim(),
      relationship: newContactRel.trim() || 'Trusted Contact',
      safePhoneOrNote: newContactPhone.trim(),
      knowsSafeCode: newContactKnowsCode,
    };
    setEmergencyContacts((prev) => [...prev, entry]);
    setNewContactName('');
    setNewContactRel('');
    setNewContactPhone('');
    setNewContactKnowsCode(false);
  };

  const removeEmergencyContact = (index: number) => {
    setEmergencyContacts((prev) => prev.filter((_, i) => i !== index));
  };

  // Essential Item toggle
  const toggleItemPacked = (index: number) => {
    setEssentialItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, isPackedOrSecured: !item.isPackedOrSecured } : item
      )
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3">
        <div className="h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-medium text-slate-600">Loading confidential safety plan...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-900 max-w-4xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <ShieldAlert className="h-5 w-5 text-emerald-400" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Interactive Personal Safety Plan
              </h1>
              <p className="text-xs text-slate-500">
                Outcome A Client Owned • Confidential Emergency Preparation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSavePlan}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs self-start sm:self-auto"
          >
            {isSaving ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>Saving Plan...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save Safety Plan</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={fetchSafetyPlan}
              className="text-xs font-semibold text-rose-700 underline"
            >
              Retry
            </button>
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Section 1: Safe Code Word */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-slate-900">
          <Key className="h-4 w-4 text-emerald-600" />
          <h2 className="text-base font-bold tracking-tight">Emergency Safe Code Word</h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          A confidential word or phrase shared with trusted contacts to signal immediate distress without alerting an abuser.
        </p>
        <div className="max-w-md">
          <input
            type="text"
            value={safeCodeWord}
            onChange={(e) => setSafeCodeWord(e.target.value)}
            placeholder="e.g. Pineapples, or Code Blue"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Section 2: Safe Locations */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-900">
          <MapPin className="h-4 w-4 text-emerald-600" />
          <h2 className="text-base font-bold tracking-tight">Safe Emergency Locations</h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Places you can go quickly if you need to leave immediately (e.g. local shelter, trusted neighbor&apos;s house, 24/7 public station).
        </p>

        {/* Existing List */}
        {safeLocations.length > 0 && (
          <ul className="space-y-2">
            {safeLocations.map((loc, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between rounded-xl border border-slate-150 bg-slate-50/80 px-3.5 py-2 text-xs font-medium text-slate-800"
              >
                <span>{loc}</span>
                <button
                  type="button"
                  onClick={() => removeSafeLocation(idx)}
                  className="text-slate-400 hover:text-rose-600 p-1"
                  title="Remove location"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add Input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newLocInput}
            onChange={(e) => setNewLocInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSafeLocation())}
            placeholder="Add safe location or sanctuary area..."
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
          />
          <button
            type="button"
            onClick={addSafeLocation}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Section 3: Emergency Contacts */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-900">
          <Phone className="h-4 w-4 text-emerald-600" />
          <h2 className="text-base font-bold tracking-tight">Trusted Emergency Contacts</h2>
        </div>

        {/* Existing List */}
        {emergencyContacts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {emergencyContacts.map((c, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 flex flex-col justify-between gap-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900">{c.contactName}</span>
                    <span className="block text-[11px] text-slate-500">{c.relationship}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEmergencyContact(idx)}
                    className="text-slate-400 hover:text-rose-600 p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="text-xs font-semibold text-emerald-700">{c.safePhoneOrNote}</div>

                {c.knowsSafeCode && (
                  <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full w-fit font-medium">
                    Knows Safe Code
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Contact Form */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
          <span className="text-xs font-bold text-slate-800 block">Add New Emergency Contact</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              placeholder="Name or Alias"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900"
            />
            <input
              type="text"
              value={newContactRel}
              onChange={(e) => setNewContactRel(e.target.value)}
              placeholder="Relationship (e.g. Sister)"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900"
            />
            <input
              type="text"
              value={newContactPhone}
              onChange={(e) => setNewContactPhone(e.target.value)}
              placeholder="Safe Phone or Contact Method"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newContactKnowsCode}
                onChange={(e) => setNewContactKnowsCode(e.target.checked)}
                className="h-3.5 w-3.5 rounded-xs border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Knows emergency code word</span>
            </label>

            <button
              type="button"
              onClick={addEmergencyContact}
              disabled={!newContactName.trim() || !newContactPhone.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Contact</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 4: Essential Items Checklist */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-900">
          <Briefcase className="h-4 w-4 text-emerald-600" />
          <h2 className="text-base font-bold tracking-tight">Essential Escape Checklist</h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Check off items that are already packed or secured in a safe, accessible location.
        </p>

        <div className="space-y-2">
          {essentialItems.map((item, idx) => (
            <div
              key={idx}
              onClick={() => toggleItemPacked(idx)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-xs font-medium cursor-pointer transition-colors ${
                item.isPackedOrSecured
                  ? 'border-emerald-200 bg-emerald-50/60 text-emerald-950'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              {item.isPackedOrSecured ? (
                <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <Square className="h-4 w-4 text-slate-400 shrink-0" />
              )}
              <span className={item.isPackedOrSecured ? 'line-through text-emerald-800' : ''}>
                {item.itemLabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SafetyPlanView;
