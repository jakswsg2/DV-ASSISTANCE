/**
 * Quick Escape Button Component
 * DV-Assistance Platform - Safety Core
 *
 * Prominent, accessible trigger button for Quick Escape.
 * Provides instant tactile and keyboard access to immediate view camouflage and
 * in-memory state purging.
 */

import React from 'react';
import { useSafety } from '../../safety/SafetyContext.tsx';

export interface QuickEscapeButtonProps {
  readonly variant?: 'header' | 'floating';
  readonly className?: string;
}

export const QuickEscapeButton: React.FC<QuickEscapeButtonProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { triggerQuickEscape } = useSafety();

  if (variant === 'floating') {
    return (
      <button
        type="button"
        onClick={triggerQuickEscape}
        className={`fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:bg-rose-700 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-rose-300 active:scale-95 ${className}`}
        aria-label="Quick Escape: Exit immediately to neutral screen (Shortcut: Esc key)"
        title="Exit to neutral screen immediately (or press Esc)"
      >
        <span className="flex h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
        <span>Quick Escape</span>
        <kbd className="hidden sm:inline-block rounded bg-rose-800 px-1.5 py-0.5 text-[10px] font-mono text-rose-100">
          Esc
        </kbd>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={triggerQuickEscape}
      className={`inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition-colors hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 ${className}`}
      aria-label="Quick Escape: Exit immediately to neutral screen (Shortcut: Esc key)"
      title="Exit to neutral screen immediately (or press Esc)"
    >
      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
      <span>Quick Escape</span>
      <kbd className="hidden sm:inline-block rounded bg-rose-800 px-1.5 py-0.5 text-[10px] font-mono text-rose-100">
        Esc
      </kbd>
    </button>
  );
};

export default QuickEscapeButton;
