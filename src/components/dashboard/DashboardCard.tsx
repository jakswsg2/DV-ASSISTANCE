/**
 * Dashboard Card Component
 * DV-Assistance Platform - Phase 1 Step 7
 *
 * Reusable, accessible presentation card for role-specific dashboard views.
 * Supports metrics, honest empty-state messages, status badges, and quick actions.
 */

import React from 'react';
import { NavIcon } from '../navigation/NavIcon.tsx';

export interface DashboardCardAction {
  readonly label: string;
  readonly navTarget?: string;
  readonly isUnavailable?: boolean;
  readonly unavailableReason?: string;
}

export interface DashboardCardProps {
  readonly title: string;
  readonly description: string;
  readonly iconName: string;
  readonly statusBadge?: {
    readonly text: string;
    readonly variant: 'neutral' | 'success' | 'warning' | 'info';
  };
  readonly emptyStateText?: string;
  readonly primaryMetric?: {
    readonly value: string | number;
    readonly label: string;
  };
  readonly action?: DashboardCardAction;
  readonly onNavigate?: (targetId: string) => void;
  readonly footerNotice?: string;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  description,
  iconName,
  statusBadge,
  emptyStateText,
  primaryMetric,
  action,
  onNavigate,
  footerNotice,
}) => {
  const getBadgeClass = (variant: 'neutral' | 'success' | 'warning' | 'info') => {
    switch (variant) {
      case 'success':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'warning':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'info':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'neutral':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const handleActionClick = () => {
    if (action?.navTarget && onNavigate && !action.isUnavailable) {
      onNavigate(action.navTarget);
    }
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors">
      <div className="space-y-3">
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-slate-700 shrink-0">
              <NavIcon iconName={iconName} className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-slate-900">
                {title}
              </h3>
              <p className="text-xs text-slate-500 leading-snug">
                {description}
              </p>
            </div>
          </div>
          {statusBadge && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getBadgeClass(
                statusBadge.variant
              )}`}
            >
              {statusBadge.text}
            </span>
          )}
        </div>

        {/* Primary Metric or Honest Empty State */}
        {primaryMetric && (
          <div className="pt-2">
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {primaryMetric.value}
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {primaryMetric.label}
            </div>
          </div>
        )}

        {emptyStateText && (
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs text-slate-500 italic">
            {emptyStateText}
          </div>
        )}
      </div>

      {/* Card Footer: Action & Notice */}
      <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
        {action && (
          <div className="flex items-center justify-between gap-2">
            {action.isUnavailable ? (
              <span className="text-[11px] text-slate-400 italic">
                {action.unavailableReason || 'Unavailable in development'}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleActionClick}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded py-0.5"
              >
                <span>{action.label}</span>
                <span aria-hidden="true">&rarr;</span>
              </button>
            )}
          </div>
        )}

        {footerNotice && (
          <p className="text-[10px] text-slate-400 leading-normal">
            {footerNotice}
          </p>
        )}
      </div>
    </article>
  );
};

export default DashboardCard;
