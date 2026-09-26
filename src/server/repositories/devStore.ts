/**
 * Development In-Memory Data Store Fallback
 * DV-Assistance Platform - Step 13
 *
 * Provides a clean in-memory repository store during local development
 * when a live PostgreSQL/Cloud SQL instance is not provisioned.
 * When a real database is configured (DATABASE_URL or SQL_* env vars),
 * repositories directly execute against Drizzle ORM.
 */

import { randomUUID } from 'node:crypto';
import type { RoleId } from '../../types/rbac.ts';
import type { DangerLevel, CaseStatus } from './caseRepository.ts';

export interface DevUser {
  id: string;
  role: RoleId;
  status: 'active' | 'suspended' | 'pending';
  safeAlias: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevUserIdentity {
  id: string;
  userId: string;
  provider: string;
  providerSubjectId: string;
  createdAt: Date;
}

export interface DevCase {
  id: string;
  clientId: string;
  status: CaseStatus;
  dangerLevel: DangerLevel;
  sanitizedSummary: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevCaseAssignment {
  id: string;
  caseId: string;
  advocateId: string;
  status: 'active' | 'transferred' | 'completed';
  assignedAt: Date;
  unassignedAt: Date | null;
  operationalNote: string | null;
}

export interface DevIncidentReport {
  id: string;
  caseId: string | null;
  incidentDateApproximate: string;
  incidentType: string;
  sanitizedNarrative: string;
  policeReportFiled: boolean;
  policeReportReference: string | null;
  submittedAt: Date;
  createdAt: Date;
}

export interface DevSafetyPlan {
  id: string;
  clientId: string;
  caseId: string | null;
  version: number;
  safeLocations: string[];
  emergencyContacts: Array<{
    contactName: string;
    relationship: string;
    safePhoneOrNote: string;
    knowsSafeCode: boolean;
  }>;
  essentialItems: Array<{
    itemLabel: string;
    isPackedOrSecured: boolean;
    category: string;
  }>;
  safeCodeWord: string | null;
  lastReviewedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevSecureMessage {
  id: string;
  caseId: string;
  senderId: string;
  recipientId: string;
  encryptedPayload: string;
  isRead: boolean;
  sentAt: Date;
  retentionPolicyOverrideHours: number | null;
}

export interface DevDocument {
  id: string;
  caseId: string;
  uploaderId: string;
  sanitizedFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storagePath: string;
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'HIGHLY_SENSITIVE';
  uploadedAt: Date;
}

export interface DevAuditEvent {
  id: string;
  timestamp: Date;
  actorUserId: string | null;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: string;
  requestId: string | null;
  ipHash: string | null;
  metadata: Record<string, unknown> | null;
}

export interface DevSupportResource {
  id: string;
  name: string;
  category: string;
  description: string;
  is24_7: boolean;
  contactPhone: string | null;
  contactText: string | null;
  websiteUrl: string | null;
  isPhysicalAddressConfidential: boolean;
  generalCityRegion: string;
  languagesSupported: string[];
  createdAt: Date;
  verifiedAt: Date | null;
  isActive: boolean;
}

class DevDataStore {
  public users = new Map<string, DevUser>();
  public identities = new Map<string, DevUserIdentity>();
  public cases = new Map<string, DevCase>();
  public assignments = new Map<string, DevCaseAssignment>();
  public incidentReports = new Map<string, DevIncidentReport>();
  public safetyPlans = new Map<string, DevSafetyPlan>();
  public messages = new Map<string, DevSecureMessage>();
  public documents = new Map<string, DevDocument>();
  public documentBlobs = new Map<string, Buffer>();
  public auditEvents: DevAuditEvent[] = [];
  public supportResources = new Map<string, DevSupportResource>();

  constructor() {
    // Seed development test accounts
    const roles: RoleId[] = ['anonymous', 'client', 'advocate', 'partner', 'admin'];
    for (const role of roles) {
      const id = `dev-user-${role}-id`;
      const devSub = `dev-${role}-local`;
      const user: DevUser = {
        id,
        role,
        status: 'active',
        safeAlias: `Dev ${role.charAt(0).toUpperCase() + role.slice(1)} Persona`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.set(id, user);
      this.identities.set(devSub, {
        id: randomUUID(),
        userId: id,
        provider: 'dev_local',
        providerSubjectId: devSub,
        createdAt: new Date(),
      });
    }

    // Seed verified public support resources
    const sampleResources: DevSupportResource[] = [
      {
        id: 'res-hotline-national-001',
        name: 'National Domestic Violence Hotline',
        category: 'crisis_hotline',
        description: 'Free, confidential support available 24/7 via phone or text for survivors and advocates.',
        is24_7: true,
        contactPhone: '1-800-799-SAFE (7233)',
        contactText: 'Text START to 88788',
        websiteUrl: 'https://www.thehotline.org',
        isPhysicalAddressConfidential: true,
        generalCityRegion: 'National (USA / UK Support Partners)',
        languagesSupported: ['English', 'Spanish', '200+ via interpretation'],
        createdAt: new Date(),
        verifiedAt: new Date(),
        isActive: true,
      },
      {
        id: 'res-shelter-metro-002',
        name: 'Safe Haven Emergency Crisis Shelter',
        category: 'emergency_shelter',
        description: 'Emergency confidential shelter and trauma-informed support services for survivors and children.',
        is24_7: true,
        contactPhone: '1-800-555-SAFE',
        contactText: null,
        websiteUrl: 'https://www.safehaven-example.org',
        isPhysicalAddressConfidential: true,
        generalCityRegion: 'Metro Region',
        languagesSupported: ['English', 'Spanish'],
        createdAt: new Date(),
        verifiedAt: new Date(),
        isActive: true,
      },
      {
        id: 'res-legal-clinic-003',
        name: 'Protective Order Legal Aid Clinic',
        category: 'legal_aid',
        description: 'Free legal consultation for civil protection orders, emergency custody, and court accompaniment.',
        is24_7: false,
        contactPhone: '1-800-555-LEGAL',
        contactText: null,
        websiteUrl: 'https://www.legalaid-example.org',
        isPhysicalAddressConfidential: false,
        generalCityRegion: 'Regional',
        languagesSupported: ['English', 'Spanish', 'Arabic'],
        createdAt: new Date(),
        verifiedAt: new Date(),
        isActive: true,
      },
      {
        id: 'res-inactive-test-004',
        name: 'Archived Temporary Shelter',
        category: 'emergency_shelter',
        description: 'Closed facility for testing inactive filtering.',
        is24_7: false,
        contactPhone: '1-800-555-0000',
        contactText: null,
        websiteUrl: null,
        isPhysicalAddressConfidential: true,
        generalCityRegion: 'Regional',
        languagesSupported: ['English'],
        createdAt: new Date(),
        verifiedAt: new Date(),
        isActive: false, // Inactive
      },
      {
        id: 'res-unverified-test-005',
        name: 'Pending Verification Clinic',
        category: 'legal_aid',
        description: 'Pending review for testing unverified filtering.',
        is24_7: false,
        contactPhone: '1-800-555-1111',
        contactText: null,
        websiteUrl: null,
        isPhysicalAddressConfidential: true,
        generalCityRegion: 'Regional',
        languagesSupported: ['English'],
        createdAt: new Date(),
        verifiedAt: null, // Unverified
        isActive: true,
      },
    ];

    for (const r of sampleResources) {
      this.supportResources.set(r.id, r);
    }
  }
}

export const devDataStore = new DevDataStore();
export default devDataStore;
