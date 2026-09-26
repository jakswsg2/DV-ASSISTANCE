/**
 * Security Audit Query Repository
 * DV-Assistance Platform - Step 16
 *
 * Implements server-side querying of security audit events for administrators.
 * Security Guarantees:
 * - Read-only query capability (audit trail is strictly append-only and immutable)
 * - Safe response fields only (zero sensitive credentials, keys, or survivor PII exposed)
 * - Strict server-side pagination (limit clamped to MAX_PAGE_SIZE = 100)
 * - Filter validation against SQL injection and query expansion
 */

import { desc, eq, gte, lte, and, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { dbConfig } from '../../db/config.ts';
import { securityAuditEvents } from '../../db/schema.ts';
import { devDataStore, type DevAuditEvent } from './devStore.ts';

export const MAX_AUDIT_PAGE_SIZE = 100;
export const DEFAULT_AUDIT_PAGE_SIZE = 50;

export interface AuditQueryFilters {
  action?: string;
  outcome?: 'success' | 'denied' | 'error';
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface SafeAuditEventRecord {
  id: string;
  timestamp: Date;
  actorRole: string;
  action: string;
  resourceType: string;
  outcome: string;
  requestId: string | null;
}

export class AuditRepository {
  /**
   * Queries security audit events with server-side filters and strict pagination.
   */
  async queryAuditEvents(filters: AuditQueryFilters): Promise<{ events: SafeAuditEventRecord[]; total: number }> {
    const rawLimit = Number.isInteger(filters.limit) ? (filters.limit as number) : DEFAULT_AUDIT_PAGE_SIZE;
    // Normalize: if <= 0 or not positive, use default; clamp upper bound to MAX_AUDIT_PAGE_SIZE (100)
    const limit = rawLimit > 0 ? Math.min(rawLimit, MAX_AUDIT_PAGE_SIZE) : DEFAULT_AUDIT_PAGE_SIZE;
    const rawOffset = Number.isInteger(filters.offset) ? (filters.offset as number) : 0;
    const offset = rawOffset >= 0 ? rawOffset : 0;

    if (!dbConfig.isConfigured) {
      let filtered = [...devDataStore.auditEvents];

      if (filters.action && filters.action.trim().length > 0) {
        filtered = filtered.filter((e) => e.action === filters.action?.trim());
      }

      if (filters.outcome) {
        filtered = filtered.filter((e) => e.outcome === filters.outcome);
      }

      if (filters.fromDate) {
        const fromTime = filters.fromDate.getTime();
        filtered = filtered.filter((e) => e.timestamp.getTime() >= fromTime);
      }

      if (filters.toDate) {
        const toTime = filters.toDate.getTime();
        filtered = filtered.filter((e) => e.timestamp.getTime() <= toTime);
      }

      // Sort descending by timestamp
      filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const total = filtered.length;
      const paged: SafeAuditEventRecord[] = filtered.slice(offset, offset + limit).map((e) => ({
        id: e.id,
        timestamp: e.timestamp,
        actorRole: e.actorRole,
        action: e.action,
        resourceType: e.resourceType,
        outcome: e.outcome,
        requestId: e.requestId,
      }));

      return { events: paged, total };
    }

    // Build SQL query conditions
    const conditions = [];

    if (filters.action && filters.action.trim().length > 0) {
      conditions.push(eq(securityAuditEvents.action, filters.action.trim()));
    }

    if (filters.outcome) {
      conditions.push(eq(securityAuditEvents.outcome, filters.outcome));
    }

    if (filters.fromDate) {
      conditions.push(gte(securityAuditEvents.timestamp, filters.fromDate));
    }

    if (filters.toDate) {
      conditions.push(lte(securityAuditEvents.timestamp, filters.toDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(securityAuditEvents)
      .where(whereClause);

    const total = Number(countResult?.count || 0);

    const rows = await db
      .select({
        id: securityAuditEvents.id,
        timestamp: securityAuditEvents.timestamp,
        actorRole: securityAuditEvents.actorRole,
        action: securityAuditEvents.action,
        resourceType: securityAuditEvents.resourceType,
        outcome: securityAuditEvents.outcome,
        requestId: securityAuditEvents.requestId,
      })
      .from(securityAuditEvents)
      .where(whereClause)
      .orderBy(desc(securityAuditEvents.timestamp))
      .limit(limit)
      .offset(offset);

    return {
      events: rows,
      total,
    };
  }

  /**
   * Returns aggregate audit event counts for the system overview dashboard.
   */
  async getAuditOverviewStats(): Promise<{ totalEvents: number; recentErrorCount: number }> {
    if (!dbConfig.isConfigured) {
      const totalEvents = devDataStore.auditEvents.length;
      const recentErrorCount = devDataStore.auditEvents.filter((e) => e.outcome === 'error' || e.outcome === 'denied').length;
      return { totalEvents, recentErrorCount };
    }

    const [totalRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(securityAuditEvents);

    const [errorRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(securityAuditEvents)
      .where(eq(securityAuditEvents.outcome, 'denied'));

    return {
      totalEvents: Number(totalRes?.count || 0),
      recentErrorCount: Number(errorRes?.count || 0),
    };
  }
}

export const auditRepository = new AuditRepository();
export default auditRepository;
