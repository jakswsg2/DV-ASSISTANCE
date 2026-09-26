/**
 * Volatile State Purger
 * DV-Assistance Platform - Safety Core
 *
 * In-memory registry for application-owned volatile state.
 * Enables deterministic purging of registered sensitive state during Quick Escape
 * or session reset. Operates strictly on application-registered callbacks;
 * makes zero claims of wiping arbitrary device or OS memory.
 */

import type { VolatileStateCategory } from '../types/safety.ts';

type PurgeHandler = () => void;

interface RegisteredHandler {
  readonly id: string;
  readonly category: VolatileStateCategory;
  readonly handler: PurgeHandler;
}

class VolatileStateRegistry {
  private handlers = new Map<string, RegisteredHandler>();

  /**
   * Register an application-owned purge handler.
   * Returns an unregister function for component unmount cleanup.
   */
  public register(
    id: string,
    category: VolatileStateCategory,
    handler: PurgeHandler
  ): () => void {
    this.handlers.set(id, { id, category, handler });
    return () => {
      this.handlers.delete(id);
    };
  }

  /**
   * Execute purge handlers for a specified category or 'all'.
   * Defensive execution: failure in one handler does not abort subsequent handlers.
   */
  public purge(targetCategory: VolatileStateCategory = 'all'): {
    executedCount: number;
    errorCount: number;
  } {
    let executedCount = 0;
    let errorCount = 0;

    for (const [id, entry] of this.handlers.entries()) {
      if (targetCategory === 'all' || entry.category === 'all' || entry.category === targetCategory) {
        try {
          entry.handler();
          executedCount++;
        } catch (err) {
          errorCount++;
          // Log defensively without exposing sensitive payloads
          console.error(`[SafetyCore:Purge] Error executing purge handler "${id}":`, err);
        }
      }
    }

    return { executedCount, errorCount };
  }

  /**
   * Current number of registered handlers.
   */
  public get count(): number {
    return this.handlers.size;
  }
}

// Singleton registry instance for application-controlled memory management
export const volatileStateRegistry = new VolatileStateRegistry();
