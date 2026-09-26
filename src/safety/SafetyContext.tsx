/**
 * Safety Context & State Management
 * DV-Assistance Platform - Safety Core
 *
 * Exposes application-controlled safety operations: Quick Escape,
 * in-memory state purging, stealth document title toggling, and decoy view switching.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { NeutralDestination, SafetyState, VolatileStateCategory } from '../types/safety.ts';
import { volatileStateRegistry } from './volatileStatePurger.ts';

const DEFAULT_NEUTRAL_DESTINATION: NeutralDestination = {
  type: 'internal_decoy',
  decoyIdentifier: 'neutral_notes_utility',
  label: 'Daily Tasks & Notes',
};

const BASE_APP_TITLE = 'DV-Assistance';
const STEALTH_APP_TITLE = 'Daily Tasks & Notes';

export interface SafetyContextValue {
  readonly safetyState: SafetyState;
  readonly triggerQuickEscape: () => void;
  readonly toggleDecoy: (active?: boolean) => void;
  readonly toggleStealthMode: (enabled?: boolean) => void;
  readonly registerPurgeCallback: (
    id: string,
    category: VolatileStateCategory,
    callback: () => void
  ) => () => void;
}

const SafetyContext = createContext<SafetyContextValue | null>(null);

export interface SafetyProviderProps {
  readonly children: React.ReactNode;
  readonly defaultDestination?: NeutralDestination;
}

export const SafetyProvider: React.FC<SafetyProviderProps> = ({
  children,
  defaultDestination = DEFAULT_NEUTRAL_DESTINATION,
}) => {
  const [safetyState, setSafetyState] = useState<SafetyState>({
    isDecoyActive: false,
    stealthModeEnabled: false,
    activeDestination: defaultDestination,
    lastVolatilePurgeAt: null,
  });

  // Orchestrate Quick Escape
  const triggerQuickEscape = useCallback(() => {
    // 1. Purge registered volatile application state
    volatileStateRegistry.purge('all');

    // 2. Sanitize browser URL query params/hash (Application-controlled navigation sanitize)
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      try {
        window.history.replaceState(null, '', window.location.pathname);
      } catch {
        // Fallback silently if restricted
      }
    }

    // 3. Activate benign internal decoy view & record purge timestamp
    setSafetyState((prev) => ({
      ...prev,
      isDecoyActive: true,
      lastVolatilePurgeAt: new Date().toISOString(),
    }));

    // 4. Update document title to stealth disguise
    if (typeof document !== 'undefined') {
      document.title = STEALTH_APP_TITLE;
    }
  }, []);

  // Toggle decoy view explicitly (e.g. exiting decoy in development)
  const toggleDecoy = useCallback((active?: boolean) => {
    setSafetyState((prev) => {
      const nextActive = active !== undefined ? active : !prev.isDecoyActive;
      if (typeof document !== 'undefined') {
        document.title = nextActive || prev.stealthModeEnabled ? STEALTH_APP_TITLE : BASE_APP_TITLE;
      }
      return {
        ...prev,
        isDecoyActive: nextActive,
      };
    });
  }, []);

  // Toggle stealth title mode
  const toggleStealthMode = useCallback((enabled?: boolean) => {
    setSafetyState((prev) => {
      const nextEnabled = enabled !== undefined ? enabled : !prev.stealthModeEnabled;
      if (typeof document !== 'undefined') {
        document.title = nextEnabled || prev.isDecoyActive ? STEALTH_APP_TITLE : BASE_APP_TITLE;
      }
      return {
        ...prev,
        stealthModeEnabled: nextEnabled,
      };
    });
  }, []);

  // Register state purger wrapper
  const registerPurgeCallback = useCallback(
    (id: string, category: VolatileStateCategory, callback: () => void) => {
      return volatileStateRegistry.register(id, category, callback);
    },
    []
  );

  // Global keyboard listener for ESC key to trigger Quick Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        triggerQuickEscape();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [triggerQuickEscape]);

  const value = useMemo<SafetyContextValue>(
    () => ({
      safetyState,
      triggerQuickEscape,
      toggleDecoy,
      toggleStealthMode,
      registerPurgeCallback,
    }),
    [safetyState, triggerQuickEscape, toggleDecoy, toggleStealthMode, registerPurgeCallback]
  );

  return <SafetyContext.Provider value={value}>{children}</SafetyContext.Provider>;
};

export function useSafety(): SafetyContextValue {
  const context = useContext(SafetyContext);
  if (!context) {
    throw new Error('useSafety must be used within a SafetyProvider');
  }
  return context;
}
