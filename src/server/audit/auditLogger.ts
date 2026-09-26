/**
 * Security Audit Logger Engine
 * DV-Assistance Platform - Step 12
 *
 * Implements persistent security event logging into the security_audit_events table.
 * Adheres strictly to Step 12 requirements:
 * - Non-blocking asynchronous execution (logging failures never break the primary flow)
 * - Zero raw IP collection; ip_hash remains NULL (policy-dependent and open)
 * - Zero logging of passwords, tokens, session secrets, private keys, or message payloads
 * - Minimal, structured metadata only
 * - Captures actor user ID, role, action, outcome, and request correlation ID
 */

import { db } from '../../db/index.ts';
import { dbConfig } from '../../db/config.ts';
import { securityAuditEvents } from '../../db/schema.ts';
import { config } from '../config.ts';
import { devDataStore } from '../repositories/devStore.ts';
import { randomUUID } from 'node:crypto';

export interface AuditEventParams {
  readonly action: string;
  readonly outcome: 'success' | 'denied' | 'error';
  readonly actorUserId?: string | null;
  readonly actorRole?: string;
  readonly resourceType: string;
  readonly resourceId?: string | null;
  readonly requestId?: string | null;
  readonly metadata?: Record<string, unknown>;
}

// Keys that are forbidden from appearing anywhere inside audit event metadata
const SENSITIVE_METADATA_KEYS = new Set([
  'password',
  'token',
  'idtoken',
  'accesstoken',
  'refreshtoken',
  'secret',
  'cookie',
  'sessionsecret',
  'privatekey',
  'authorization',
  'payload',
  'message',
  'narrative',
]);

/**
 * Sanitizes metadata to ensure no sensitive parameters or credential substrings are persisted.
 */
function sanitizeAuditMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, '');
    if (SENSITIVE_METADATA_KEYS.has(normalizedKey)) {
      continue; // Filter out sensitive keys completely
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (value === null) {
      sanitized[key] = null;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Records a security audit event into the database.
 * Executes asynchronously and will never throw to the caller.
 */
export async function recordAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    const actorRole = params.actorRole || 'anonymous';
    const metadata = sanitizeAuditMetadata(params.metadata);

    // Development diagnostic log (non-sensitive)
    if (config.isDev) {
      console.log(
        `[Audit] [${params.requestId || 'no-req-id'}] ${params.action} -> ${params.outcome} (Actor: ${params.actorUserId || 'none'}, Role: ${actorRole})`
      );
    }

    if (!dbConfig.isConfigured) {
      devDataStore.auditEvents.push({
        id: randomUUID(),
        timestamp: new Date(),
        actorUserId: params.actorUserId || null,
        actorRole,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId || null,
        outcome: params.outcome,
        requestId: params.requestId || null,
        ipHash: null,
        metadata,
      });
      return;
    }

    await db.insert(securityAuditEvents).values({
      actorUserId: params.actorUserId || null,
      actorRole,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId || null,
      outcome: params.outcome,
      requestId: params.requestId || null,
      ipHash: null, // Explicitly NULL per Step 12 specification (Policy remains OPEN)
      metadata,
    });
  } catch (error) {
    // Audit write failures must never crash the application or prevent legitimate actions
    console.error('[Audit] Failed to persist security audit event:', error instanceof Error ? error.message : error);
  }
}

export default recordAuditEvent;
