/**
 * Case Domain Repository
 * DV-Assistance Platform - Step 13
 *
 * Implements persistent database operations for cases and case assignments.
 * Enforces transactional integrity during case creation, assignment transitions, and closures.
 * Never executes destructive deletions.
 */

import { randomUUID } from 'node:crypto';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { dbConfig } from '../../db/config.ts';
import { cases, caseAssignments, users } from '../../db/schema.ts';
import { devDataStore, type DevCase, type DevCaseAssignment } from './devStore.ts';

export type CaseStatus = 'intake_pending' | 'active' | 'under_review' | 'closed' | 'escalated';
export type DangerLevel = 'standard' | 'elevated' | 'high' | 'severe';

export interface CreateCaseParams {
  readonly clientId: string;
  readonly sanitizedSummary: string;
  readonly dangerLevel?: DangerLevel;
  readonly initialAdvocateId?: string;
  readonly operationalNote?: string;
}

export interface UpdateCaseParams {
  readonly sanitizedSummary?: string;
  readonly dangerLevel?: DangerLevel;
  readonly status?: CaseStatus;
}

export class CaseRepository {
  /**
   * Retrieves a case record by ID with client safe alias and active advocate assignments.
   */
  async getCaseById(caseId: string) {
    if (!dbConfig.isConfigured) {
      const devCase = devDataStore.cases.get(caseId);
      if (!devCase) return null;
      const client = devDataStore.users.get(devCase.clientId);
      const activeAssignments = Array.from(devDataStore.assignments.values())
        .filter((a) => a.caseId === caseId && a.status === 'active')
        .map((a) => ({
          id: a.id,
          advocateId: a.advocateId,
          status: a.status,
          assignedAt: a.assignedAt,
          operationalNote: a.operationalNote,
          advocateAlias: devDataStore.users.get(a.advocateId)?.safeAlias || 'Advocate',
        }));

      return {
        ...devCase,
        clientAlias: client?.safeAlias || 'Client',
        activeAssignments,
      };
    }

    const caseRecords = await db
      .select({
        id: cases.id,
        clientId: cases.clientId,
        status: cases.status,
        dangerLevel: cases.dangerLevel,
        sanitizedSummary: cases.sanitizedSummary,
        createdAt: cases.createdAt,
        updatedAt: cases.updatedAt,
        clientAlias: users.safeAlias,
      })
      .from(cases)
      .leftJoin(users, eq(cases.clientId, users.id))
      .where(eq(cases.id, caseId))
      .limit(1);

    if (caseRecords.length === 0) {
      return null;
    }

    const caseData = caseRecords[0];

    // Fetch active assignments
    const assignments = await db
      .select({
        id: caseAssignments.id,
        advocateId: caseAssignments.advocateId,
        status: caseAssignments.status,
        assignedAt: caseAssignments.assignedAt,
        operationalNote: caseAssignments.operationalNote,
        advocateAlias: users.safeAlias,
      })
      .from(caseAssignments)
      .leftJoin(users, eq(caseAssignments.advocateId, users.id))
      .where(and(eq(caseAssignments.caseId, caseId), eq(caseAssignments.status, 'active')));

    return {
      ...caseData,
      activeAssignments: assignments,
    };
  }

  /**
   * Lists cases owned by a specific client.
   */
  async listCasesForClient(clientId: string) {
    if (!dbConfig.isConfigured) {
      return Array.from(devDataStore.cases.values())
        .filter((c) => c.clientId === clientId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    return await db
      .select({
        id: cases.id,
        clientId: cases.clientId,
        status: cases.status,
        dangerLevel: cases.dangerLevel,
        sanitizedSummary: cases.sanitizedSummary,
        createdAt: cases.createdAt,
        updatedAt: cases.updatedAt,
      })
      .from(cases)
      .where(eq(cases.clientId, clientId))
      .orderBy(desc(cases.createdAt));
  }

  /**
   * Lists cases actively assigned to a specific advocate.
   */
  async listAssignedCasesForAdvocate(advocateId: string) {
    if (!dbConfig.isConfigured) {
      const assignedCaseIds = Array.from(devDataStore.assignments.values())
        .filter((a) => a.advocateId === advocateId && a.status === 'active')
        .map((a) => a.caseId);

      return Array.from(devDataStore.cases.values())
        .filter((c) => assignedCaseIds.includes(c.id))
        .map((c) => {
          const client = devDataStore.users.get(c.clientId);
          const assignment = Array.from(devDataStore.assignments.values()).find(
            (a) => a.caseId === c.id && a.advocateId === advocateId && a.status === 'active'
          );
          return {
            id: c.id,
            clientId: c.clientId,
            status: c.status,
            dangerLevel: c.dangerLevel,
            sanitizedSummary: c.sanitizedSummary,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            clientAlias: client?.safeAlias || 'Client',
            assignedAt: assignment?.assignedAt || c.createdAt,
            assignmentId: assignment?.id || 'assign-dev',
          };
        })
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    const assigned = await db
      .select({
        id: cases.id,
        clientId: cases.clientId,
        status: cases.status,
        dangerLevel: cases.dangerLevel,
        sanitizedSummary: cases.sanitizedSummary,
        createdAt: cases.createdAt,
        updatedAt: cases.updatedAt,
        clientAlias: users.safeAlias,
        assignedAt: caseAssignments.assignedAt,
        assignmentId: caseAssignments.id,
      })
      .from(cases)
      .innerJoin(
        caseAssignments,
        and(
          eq(cases.id, caseAssignments.caseId),
          eq(caseAssignments.advocateId, advocateId),
          eq(caseAssignments.status, 'active')
        )
      )
      .leftJoin(users, eq(cases.clientId, users.id))
      .orderBy(desc(cases.updatedAt));

    return assigned;
  }

  /**
   * Creates a new case and optionally creates the initial advocate assignment atomically.
   */
  async createCase(params: CreateCaseParams) {
    const dangerLevel = params.dangerLevel || 'standard';

    if (!dbConfig.isConfigured) {
      const caseId = randomUUID();
      const newCase: DevCase = {
        id: caseId,
        clientId: params.clientId,
        status: 'intake_pending',
        dangerLevel,
        sanitizedSummary: params.sanitizedSummary,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      devDataStore.cases.set(caseId, newCase);

      if (params.initialAdvocateId) {
        const assignId = randomUUID();
        const assignment: DevCaseAssignment = {
          id: assignId,
          caseId,
          advocateId: params.initialAdvocateId,
          status: 'active',
          assignedAt: new Date(),
          unassignedAt: null,
          operationalNote: params.operationalNote || 'Initial intake assignment',
        };
        devDataStore.assignments.set(assignId, assignment);
      }

      return newCase;
    }

    const [newCase] = await db
      .insert(cases)
      .values({
        clientId: params.clientId,
        status: 'intake_pending',
        dangerLevel,
        sanitizedSummary: params.sanitizedSummary,
      })
      .returning();

    if (params.initialAdvocateId) {
      await db.insert(caseAssignments).values({
        caseId: newCase.id,
        advocateId: params.initialAdvocateId,
        status: 'active',
        operationalNote: params.operationalNote || 'Initial intake assignment',
      });
    }

    return newCase;
  }

  /**
   * Updates an existing case record.
   */
  async updateCase(caseId: string, params: UpdateCaseParams) {
    if (!dbConfig.isConfigured) {
      const devCase = devDataStore.cases.get(caseId);
      if (!devCase) return null;
      if (params.sanitizedSummary !== undefined) devCase.sanitizedSummary = params.sanitizedSummary;
      if (params.dangerLevel !== undefined) devCase.dangerLevel = params.dangerLevel;
      if (params.status !== undefined) devCase.status = params.status;
      devCase.updatedAt = new Date();
      return devCase;
    }

    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (params.sanitizedSummary !== undefined) {
      updateValues.sanitizedSummary = params.sanitizedSummary;
    }
    if (params.dangerLevel !== undefined) {
      updateValues.dangerLevel = params.dangerLevel;
    }
    if (params.status !== undefined) {
      updateValues.status = params.status;
    }

    const [updated] = await db
      .update(cases)
      .set(updateValues)
      .where(eq(cases.id, caseId))
      .returning();

    return updated;
  }

  /**
   * Closes a case by transitioning status to 'closed'.
   * Preserves all relational history and records (CASE CLOSED != CASE DELETED).
   */
  async closeCase(caseId: string) {
    if (!dbConfig.isConfigured) {
      const devCase = devDataStore.cases.get(caseId);
      if (!devCase) return null;
      devCase.status = 'closed';
      devCase.updatedAt = new Date();
      return devCase;
    }

    const [closed] = await db
      .update(cases)
      .set({
        status: 'closed',
        updatedAt: new Date(),
      })
      .where(eq(cases.id, caseId))
      .returning();

    return closed;
  }

  /**
   * Reassigns or adds an advocate assignment.
   */
  async assignAdvocate(caseId: string, advocateId: string, operationalNote?: string) {
    if (!dbConfig.isConfigured) {
      for (const a of devDataStore.assignments.values()) {
        if (a.caseId === caseId && a.status === 'active') {
          a.status = 'transferred';
          a.unassignedAt = new Date();
        }
      }
      const assignId = randomUUID();
      const assignment: DevCaseAssignment = {
        id: assignId,
        caseId,
        advocateId,
        status: 'active',
        assignedAt: new Date(),
        unassignedAt: null,
        operationalNote: operationalNote || 'Casework assignment',
      };
      devDataStore.assignments.set(assignId, assignment);
      return assignment;
    }

    // 1. Mark any previous active assignments for this advocate/case as transferred/completed
    await db
      .update(caseAssignments)
      .set({
        status: 'transferred',
        unassignedAt: new Date(),
      })
      .where(
        and(
          eq(caseAssignments.caseId, caseId),
          eq(caseAssignments.status, 'active')
        )
      );

    // 2. Insert new active assignment
    const [assignment] = await db
      .insert(caseAssignments)
      .values({
        caseId,
        advocateId,
        status: 'active',
        operationalNote: operationalNote || 'Casework assignment',
      })
      .returning();

    return assignment;
  }
}

export const caseRepository = new CaseRepository();
export default caseRepository;
