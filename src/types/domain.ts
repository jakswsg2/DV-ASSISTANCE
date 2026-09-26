/**
 * Core Domain Entity & Repository Contract Definitions
 * DV-Assistance Platform
 *
 * Defines contracts for Client profiles, Advocate caseloads, Cases, Safety Plans,
 * Resources, Messages, Documents, Notifications, and Audit logs.
 * Pure type definitions; no business logic, storage, or external services.
 */

import type { UserId } from './auth.ts';
import type { RoleId } from './rbac.ts';
import type { DataClassification } from './safety.ts';

// Unique semantic identifiers
export type CaseId = string;
export type IncidentId = string;
export type SafetyPlanId = string;
export type ResourceId = string;
export type MessageId = string;
export type DocumentId = string;
export type AuditLogId = string;

/**
 * Client / Survivor Profile
 * Classification: HIGHLY_SENSITIVE
 */
export interface ClientProfile {
  readonly id: string;
  readonly userId: UserId;
  readonly preferredAlias: string;
  readonly safeContactMethod: 'in_app_only' | 'alternate_phone' | 'trusted_contact';
  readonly safeTimesToContact?: string;
  readonly dangerAssessmentScore?: number;
  readonly isRestrictedView: boolean;
}

/**
 * Advocate / Case Worker Profile
 * Classification: CONFIDENTIAL
 */
export interface AdvocateProfile {
  readonly id: string;
  readonly userId: UserId;
  readonly organizationUnit: string;
  readonly activeCaseloadCount: number;
  readonly maxCaseloadCapacity: number;
}

/**
 * Central Case Unit linking client, advocate, and coordinated services.
 * Classification: HIGHLY_SENSITIVE
 */
export type CaseStatus =
  | 'intake_pending'
  | 'active'
  | 'under_review'
  | 'closed'
  | 'escalated';

export type DangerLevel = 'standard' | 'elevated' | 'high' | 'severe';

export interface Case {
  readonly id: CaseId;
  readonly clientReferenceId: string;
  readonly assignedAdvocateId?: UserId;
  readonly status: CaseStatus;
  readonly dangerLevel: DangerLevel;
  readonly summarySanitized: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly classification: DataClassification;
}

/**
 * Incident / Intake Submission
 * Classification: HIGHLY_SENSITIVE
 */
export interface IncidentReport {
  readonly id: IncidentId;
  readonly caseId?: CaseId;
  readonly incidentDateApproximate: string;
  readonly incidentType: string;
  readonly sanitizedNarrative: string;
  readonly policeReportFiled: boolean;
  readonly policeReportReference?: string;
  readonly submittedAt: string;
}

/**
 * Interactive Safety Plan
 * Classification: HIGHLY_SENSITIVE
 */
export interface EmergencyContactEntry {
  readonly contactName: string;
  readonly relationship: string;
  readonly safePhoneOrNote: string;
  readonly knowsSafeCode: boolean;
}

export interface EssentialItemChecklist {
  readonly itemLabel: string;
  readonly isPackedOrSecured: boolean;
  readonly category: 'documents' | 'medication' | 'keys_money' | 'children_pets';
}

export interface SafetyPlan {
  readonly id: SafetyPlanId;
  readonly caseId?: CaseId;
  readonly safeLocations: ReadonlyArray<string>;
  readonly emergencyContacts: ReadonlyArray<EmergencyContactEntry>;
  readonly essentialItems: ReadonlyArray<EssentialItemChecklist>;
  readonly safeCodeWord?: string;
  readonly lastReviewedAt: string;
}

/**
 * Verified Support Resource
 * Classification: PUBLIC
 */
export type ResourceCategory =
  | 'crisis_hotline'
  | 'emergency_shelter'
  | 'legal_aid'
  | 'medical_advocacy'
  | 'counseling'
  | 'community_support';

export interface SupportResource {
  readonly id: ResourceId;
  readonly name: string;
  readonly category: ResourceCategory;
  readonly description: string;
  readonly is24_7: boolean;
  readonly contactPhone?: string;
  readonly contactText?: string;
  readonly websiteUrl?: string;
  readonly isPhysicalAddressConfidential: boolean;
  readonly generalCityRegion: string;
  readonly languagesSupported: ReadonlyArray<string>;
}

/**
 * Secure In-App Message
 * Classification: HIGHLY_SENSITIVE
 */
export interface SecureMessage {
  readonly id: MessageId;
  readonly threadId: string;
  readonly senderId: UserId;
  readonly recipientId: UserId;
  readonly contentSanitized: string;
  readonly isRead: boolean;
  readonly sentAt: string;
  readonly shredAfterHours?: number;
}

/**
 * Document / Evidence Metadata
 * Classification: HIGHLY_SENSITIVE
 */
export interface DocumentMetadata {
  readonly id: DocumentId;
  readonly caseId?: CaseId;
  readonly sanitizedFileName: string;
  readonly mimeType: string;
  readonly fileSizeBytes: number;
  readonly uploadedAt: string;
  readonly classification: DataClassification;
}

/**
 * In-App Notification (Silent, never pushed via OS/SMS)
 * Classification: INTERNAL
 */
export interface InAppNotification {
  readonly id: string;
  readonly recipientId: UserId;
  readonly title: string;
  readonly message: string;
  readonly isRead: boolean;
  readonly createdAt: string;
}

/**
 * Forensic Security Audit Event
 * Classification: CONFIDENTIAL
 */
export interface SecurityAuditEvent {
  readonly id: AuditLogId;
  readonly timestamp: string;
  readonly actorUserId: UserId;
  readonly actorRole: RoleId;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly outcome: 'success' | 'denied' | 'error';
  readonly classification: DataClassification;
}

/**
 * Administrative Governance Configuration Setting
 * Classification: INTERNAL
 */
export type ConfigGovernanceCategory =
  | 'admin_configurable'
  | 'environment_configurable'
  | 'developer_controlled'
  | 'security_fixed';

export interface AdminConfigSetting {
  readonly key: string;
  readonly label: string;
  readonly category: ConfigGovernanceCategory;
  readonly value: string | boolean | number;
}

/**
 * Common Asynchronous Repository Contracts for In-Memory or Future Database
 */
export interface ICaseRepository {
  getCaseById(id: CaseId): Promise<Case | null>;
  listAssignedCases(advocateId: UserId): Promise<ReadonlyArray<Case>>;
  createCase(newCase: Omit<Case, 'id' | 'createdAt' | 'updatedAt'>): Promise<Case>;
  updateCaseStatus(id: CaseId, status: CaseStatus): Promise<Case>;
}

export interface IResourceRepository {
  listResources(category?: ResourceCategory): Promise<ReadonlyArray<SupportResource>>;
  getResourceById(id: ResourceId): Promise<SupportResource | null>;
}

export interface IAuditRepository {
  recordEvent(event: Omit<SecurityAuditEvent, 'id' | 'timestamp'>): Promise<void>;
  listRecentEvents(limit?: number): Promise<ReadonlyArray<SecurityAuditEvent>>;
}
