/**
 * Intake Domain Repository
 * DV-Assistance Platform - Step 13
 *
 * Implements persistent database operations for intake incident reports.
 * Allows anonymous/client intake submission.
 * Restricts intake triage review to authorized casework advocates.
 */

import { randomUUID } from 'node:crypto';
import { eq, desc } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { dbConfig } from '../../db/config.ts';
import { incidentReports } from '../../db/schema.ts';
import { devDataStore, type DevIncidentReport } from './devStore.ts';

export interface CreateIntakeParams {
  readonly caseId?: string | null;
  readonly incidentDateApproximate: string;
  readonly incidentType: string;
  readonly sanitizedNarrative: string;
  readonly policeReportFiled?: boolean;
  readonly policeReportReference?: string | null;
}

export class IntakeRepository {
  /**
   * Creates an intake incident submission.
   */
  async createIntakeReport(params: CreateIntakeParams) {
    if (!dbConfig.isConfigured) {
      const id = randomUUID();
      const report: DevIncidentReport = {
        id,
        caseId: params.caseId || null,
        incidentDateApproximate: params.incidentDateApproximate,
        incidentType: params.incidentType,
        sanitizedNarrative: params.sanitizedNarrative,
        policeReportFiled: params.policeReportFiled ?? false,
        policeReportReference: params.policeReportReference || null,
        submittedAt: new Date(),
        createdAt: new Date(),
      };
      devDataStore.incidentReports.set(id, report);
      return report;
    }

    const [report] = await db
      .insert(incidentReports)
      .values({
        caseId: params.caseId || null,
        incidentDateApproximate: params.incidentDateApproximate,
        incidentType: params.incidentType,
        sanitizedNarrative: params.sanitizedNarrative,
        policeReportFiled: params.policeReportFiled ?? false,
        policeReportReference: params.policeReportReference || null,
      })
      .returning();

    return report;
  }

  /**
   * Lists intake reports for advocate triage.
   */
  async listIntakeReports(limit = 50) {
    if (!dbConfig.isConfigured) {
      return Array.from(devDataStore.incidentReports.values())
        .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
        .slice(0, limit);
    }

    return await db
      .select({
        id: incidentReports.id,
        caseId: incidentReports.caseId,
        incidentDateApproximate: incidentReports.incidentDateApproximate,
        incidentType: incidentReports.incidentType,
        sanitizedNarrative: incidentReports.sanitizedNarrative,
        policeReportFiled: incidentReports.policeReportFiled,
        policeReportReference: incidentReports.policeReportReference,
        submittedAt: incidentReports.submittedAt,
        createdAt: incidentReports.createdAt,
      })
      .from(incidentReports)
      .orderBy(desc(incidentReports.submittedAt))
      .limit(limit);
  }

  /**
   * Retrieves an intake report by ID for advocate review.
   */
  async getIntakeReportById(id: string) {
    if (!dbConfig.isConfigured) {
      return devDataStore.incidentReports.get(id) || null;
    }

    const reports = await db
      .select()
      .from(incidentReports)
      .where(eq(incidentReports.id, id))
      .limit(1);

    return reports.length > 0 ? reports[0] : null;
  }
}

export const intakeRepository = new IntakeRepository();
export default intakeRepository;
