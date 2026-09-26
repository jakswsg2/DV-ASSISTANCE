/**
 * Safety & Privacy Type Definitions
 * DV-Assistance Platform
 *
 * Defines safety state models, data classifications, and control boundaries.
 * No runtime safety mechanisms, browser manipulation, or history clearing logic is implemented here.
 */

/**
 * Data classification tiers matching the Architecture Baseline Gate.
 */
export type DataClassification =
  | 'PUBLIC'           // Hotlines, public FAQs, public resource directory
  | 'INTERNAL'         // System health, non-sensitive feature flags, anonymized metrics
  | 'CONFIDENTIAL'     // Staff email addresses, advocate phone numbers, role logs
  | 'HIGHLY_SENSITIVE'; // Survivor real names, abuse logs, danger scores, protective orders

/**
 * Classification of safety mechanism controllability.
 * Strictly reflects the approved four-category architecture:
 * A. Application-controlled
 * B. Browser/OS-controlled
 * C. Environment-dependent
 * D. Security-fixed
 */
export type SafetyControlCategory =
  | 'application_controlled' // Fully controllable by the web app (in-memory wipe, decoy overlay, URL sanitization)
  | 'browser_os_controlled'  // Controlled by browser or operating system (local history, screenshots, autofill)
  | 'environment_dependent'  // Dependent on external environment (network/router logs, shared physical device)
  | 'security_fixed';        // Architectural constraints that cannot be bypassed or overridden (ethical data wall)

/**
 * Types of neutral destinations for Quick Escape.
 */
export type NeutralDestinationType =
  | 'internal_decoy' // Benign internal camouflage view (approved default)
  | 'external_url';  // Configurable external neutral address

/**
 * Specification for the neutral destination displayed on Quick Escape.
 */
export interface NeutralDestination {
  readonly type: NeutralDestinationType;
  readonly targetUrl?: string;
  readonly decoyIdentifier?: string;
  readonly label: string;
}

/**
 * Categories of volatile state to purge during a Quick Escape or session timeout.
 */
export type VolatileStateCategory =
  | 'auth_session'
  | 'form_drafts'
  | 'case_cache'
  | 'message_drafts'
  | 'all';

/**
 * Safety state representing active privacy mechanisms.
 */
export interface SafetyState {
  readonly isDecoyActive: boolean;
  readonly stealthModeEnabled: boolean;
  readonly activeDestination: NeutralDestination;
  readonly lastVolatilePurgeAt: string | null;
}
