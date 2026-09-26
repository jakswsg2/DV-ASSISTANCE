/**
 * Safety Plan Domain Repository
 * DV-Assistance Platform - Step 13
 *
 * Implements persistent database operations for survivor safety plans.
 * Manages versioned updates and ownership links.
 */

import { randomUUID } from 'node:crypto';
import { eq, desc } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { dbConfig } from '../../db/config.ts';
import { safetyPlans } from '../../db/schema.ts';
import { devDataStore, type DevSafetyPlan } from './devStore.ts';

export interface EmergencyContact {
  readonly contactName: string;
  readonly relationship: string;
  readonly safePhoneOrNote: string;
  readonly knowsSafeCode: boolean;
}

export interface EssentialItem {
  readonly itemLabel: string;
  readonly isPackedOrSecured: boolean;
  readonly category: string;
}

export interface UpsertSafetyPlanParams {
  readonly clientId: string;
  readonly caseId?: string | null;
  readonly safeLocations: string[];
  readonly emergencyContacts: EmergencyContact[];
  readonly essentialItems: EssentialItem[];
  readonly safeCodeWord?: string | null;
}

export class SafetyPlanRepository {
  /**
   * Retrieves the active safety plan for a client.
   */
  async getSafetyPlanByClientId(clientId: string) {
    if (!dbConfig.isConfigured) {
      const plans = Array.from(devDataStore.safetyPlans.values())
        .filter((p) => p.clientId === clientId)
        .sort((a, b) => b.version - a.version);
      return plans.length > 0 ? plans[0] : null;
    }

    const plans = await db
      .select()
      .from(safetyPlans)
      .where(eq(safetyPlans.clientId, clientId))
      .orderBy(desc(safetyPlans.version))
      .limit(1);

    return plans.length > 0 ? plans[0] : null;
  }

  /**
   * Retrieves a safety plan by ID.
   */
  async getSafetyPlanById(planId: string) {
    if (!dbConfig.isConfigured) {
      return devDataStore.safetyPlans.get(planId) || null;
    }

    const plans = await db
      .select()
      .from(safetyPlans)
      .where(eq(safetyPlans.id, planId))
      .limit(1);

    return plans.length > 0 ? plans[0] : null;
  }

  /**
   * Creates or updates a survivor's safety plan.
   * If existing, increments version and updates timestamp.
   */
  async upsertSafetyPlan(params: UpsertSafetyPlanParams) {
    if (!dbConfig.isConfigured) {
      const existing = await this.getSafetyPlanByClientId(params.clientId);
      if (existing) {
        existing.version += 1;
        existing.caseId = params.caseId || existing.caseId;
        existing.safeLocations = params.safeLocations;
        existing.emergencyContacts = params.emergencyContacts;
        existing.essentialItems = params.essentialItems;
        existing.safeCodeWord = params.safeCodeWord || null;
        existing.lastReviewedAt = new Date();
        existing.updatedAt = new Date();
        return existing;
      }

      const planId = randomUUID();
      const newPlan: DevSafetyPlan = {
        id: planId,
        clientId: params.clientId,
        caseId: params.caseId || null,
        version: 1,
        safeLocations: params.safeLocations,
        emergencyContacts: params.emergencyContacts,
        essentialItems: params.essentialItems,
        safeCodeWord: params.safeCodeWord || null,
        lastReviewedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      devDataStore.safetyPlans.set(planId, newPlan);
      return newPlan;
    }

    const existing = await this.getSafetyPlanByClientId(params.clientId);

    if (existing) {
      const [updated] = await db
        .update(safetyPlans)
        .set({
          version: existing.version + 1,
          caseId: params.caseId || existing.caseId,
          safeLocations: params.safeLocations,
          emergencyContacts: params.emergencyContacts,
          essentialItems: params.essentialItems,
          safeCodeWord: params.safeCodeWord || null,
          lastReviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(safetyPlans.id, existing.id))
        .returning();

      return updated;
    }

    const [newPlan] = await db
      .insert(safetyPlans)
      .values({
        clientId: params.clientId,
        caseId: params.caseId || null,
        version: 1,
        safeLocations: params.safeLocations,
        emergencyContacts: params.emergencyContacts,
        essentialItems: params.essentialItems,
        safeCodeWord: params.safeCodeWord || null,
      })
      .returning();

    return newPlan;
  }
}

export const safetyPlanRepository = new SafetyPlanRepository();
export default safetyPlanRepository;
