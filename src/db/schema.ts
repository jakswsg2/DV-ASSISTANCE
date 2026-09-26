/**
 * Database Schema Definitions (Drizzle ORM)
 * DV-Assistance Platform - Step 11.1 Schema Review & Corrections
 *
 * Implements the relational schema derived from Step 9.1 architecture:
 * - Users & User Identities (Classification: INTERNAL)
 * - Client Profiles (Classification: HIGHLY_SENSITIVE)
 * - Advocate Profiles (Classification: CONFIDENTIAL)
 * - Cases & Case Assignments (Historical audit integrity, Classification: HIGHLY_SENSITIVE / CONFIDENTIAL)
 * - Safety Plans (Versioned, Classification: HIGHLY_SENSITIVE)
 * - Incident Reports (Intake submissions, Classification: HIGHLY_SENSITIVE)
 * - Secure Messages (Payload storage contract, Classification: HIGHLY_SENSITIVE)
 * - Documents (Metadata only; binary files stored in private object storage, Classification: HIGHLY_SENSITIVE)
 * - Security Audit Events (Append-only forensic log, Classification: CONFIDENTIAL)
 * - Verified Support Resources (Public directory, Classification: PUBLIC)
 *
 * All timestamps use withTimezone: true (UTC).
 * Foreign keys strictly preserve referential integrity (RESTRICT on all sensitive case linkages;
 * SET NULL on audit actor to preserve immutable forensic logs upon account purge).
 */

import { relations, sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';

// Enums conforming strictly to Phase 1 / Step 9.1 type definitions
export const userRoleEnum = pgEnum('user_role', [
  'anonymous',
  'client',
  'advocate',
  'partner',
  'admin',
]);

export const caseStatusEnum = pgEnum('case_status', [
  'intake_pending',
  'active',
  'under_review',
  'closed',
  'escalated',
]);

export const dangerLevelEnum = pgEnum('danger_level', [
  'standard',
  'elevated',
  'high',
  'severe',
]);

export const dataClassificationEnum = pgEnum('data_classification', [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'HIGHLY_SENSITIVE',
]);

/**
 * 1. Users Table
 * Base identity entity.
 * Classification: INTERNAL (System account record; devoid of real-world PII, phone, email, or passwords).
 * Primary role model strictly enforces exactly 1 primary role.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    role: userRoleEnum('role').notNull().default('anonymous'),
    status: text('status').notNull().default('active'), // 'active', 'suspended', 'pending'
    safeAlias: text('safe_alias').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_users_role').on(table.role),
    index('idx_users_status').on(table.status),
  ]
);

/**
 * 2. User Identities Table
 * Persistence contract for external identity linking (Step 12).
 * Classification: CONFIDENTIAL
 * Maps external identity provider subject IDs to internal user IDs.
 * Contains zero passwords, access tokens, refresh tokens, or secrets.
 */
export const userIdentities = pgTable(
  'user_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    provider: text('provider').notNull(), // 'firebase', 'google', 'oidc', etc.
    providerSubjectId: text('provider_subject_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_user_identities_provider_sub').on(table.provider, table.providerSubjectId),
    index('idx_user_identities_user_id').on(table.userId),
  ]
);

/**
 * 3. Client Profiles Table
 * Classification: HIGHLY_SENSITIVE
 * Survivor operational profile.
 * Uses RESTRICT on delete to prevent accidental or malicious destruction of survivor records.
 */
export const clientProfiles = pgTable(
  'client_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    preferredAlias: text('preferred_alias').notNull(),
    safeContactMethod: text('safe_contact_method').notNull().default('in_app_only'), // in_app_only, alternate_phone, trusted_contact
    safeTimesToContact: text('safe_times_to_contact'),
    dangerAssessmentScore: integer('danger_assessment_score'),
    isRestrictedView: boolean('is_restricted_view').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_client_profiles_user_id').on(table.userId),
  ]
);

/**
 * 4. Advocate Profiles Table
 * Classification: CONFIDENTIAL
 * Caseworker operational metadata and caseload capacity limits.
 */
export const advocateProfiles = pgTable(
  'advocate_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    organizationUnit: text('organization_unit').notNull(),
    activeCaseloadCount: integer('active_caseload_count').notNull().default(0),
    maxCaseloadCapacity: integer('max_caseload_capacity').notNull().default(20),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_advocate_profiles_user_id').on(table.userId),
    index('idx_advocate_profiles_org_unit').on(table.organizationUnit),
  ]
);

/**
 * 5. Cases Table
 * Classification: HIGHLY_SENSITIVE
 * The core case coordination record linking survivor and services.
 * Uses RESTRICT on clientId to prevent destructive deletion of users with active cases.
 */
export const cases = pgTable(
  'cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    status: caseStatusEnum('status').notNull().default('intake_pending'),
    dangerLevel: dangerLevelEnum('danger_level').notNull().default('standard'),
    sanitizedSummary: text('sanitized_summary').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_cases_client_id').on(table.clientId),
    index('idx_cases_status').on(table.status),
    index('idx_cases_danger_level').on(table.dangerLevel),
  ]
);

/**
 * 6. Case Assignments Table
 * Classification: CONFIDENTIAL
 * Preserves historical and active casework assignments.
 * Never overwrites history destructively.
 * operationalNote is strictly constrained to administrative handover metadata
 * (e.g. "Coverage during medical leave") and MUST NOT contain client trauma narratives or PII.
 */
export const caseAssignments = pgTable(
  'case_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .references(() => cases.id, { onDelete: 'restrict' })
      .notNull(),
    advocateId: uuid('advocate_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    status: text('status').notNull().default('active'), // 'active', 'transferred', 'completed'
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
    unassignedAt: timestamp('unassigned_at', { withTimezone: true }),
    operationalNote: text('operational_note'),
  },
  (table) => [
    index('idx_case_assignments_case_id').on(table.caseId),
    index('idx_case_assignments_advocate_id').on(table.advocateId),
    index('idx_case_assignments_status').on(table.status),
  ]
);

/**
 * 7. Safety Plans Table
 * Classification: HIGHLY_SENSITIVE
 * Emergency action plan with version history.
 * Foreign key to cases uses ON DELETE RESTRICT to prevent destructive deletion of cases
 * while attached safety plans exist. Case closure is a status update, NOT a database deletion.
 */
export const safetyPlans = pgTable(
  'safety_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    caseId: uuid('case_id')
      .references(() => cases.id, { onDelete: 'restrict' }),
    version: integer('version').notNull().default(1),
    safeLocations: jsonb('safe_locations').$type<string[]>().notNull().default([]),
    emergencyContacts: jsonb('emergency_contacts')
      .$type<
        Array<{
          contactName: string;
          relationship: string;
          safePhoneOrNote: string;
          knowsSafeCode: boolean;
        }>
      >()
      .notNull()
      .default([]),
    essentialItems: jsonb('essential_items')
      .$type<
        Array<{
          itemLabel: string;
          isPackedOrSecured: boolean;
          category: string;
        }>
      >()
      .notNull()
      .default([]),
    safeCodeWord: text('safe_code_word'),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_safety_plans_client_id').on(table.clientId),
    index('idx_safety_plans_case_id').on(table.caseId),
  ]
);

/**
 * 8. Incident Reports Table
 * Classification: HIGHLY_SENSITIVE
 * Intake submissions and incident logs.
 * Foreign key to cases uses ON DELETE RESTRICT to guarantee evidence and intake submissions
 * are never silently orphaned or severed by case deletion.
 */
export const incidentReports = pgTable(
  'incident_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .references(() => cases.id, { onDelete: 'restrict' }),
    incidentDateApproximate: text('incident_date_approximate').notNull(),
    incidentType: text('incident_type').notNull(),
    sanitizedNarrative: text('sanitized_narrative').notNull(),
    policeReportFiled: boolean('police_report_filed').notNull().default(false),
    policeReportReference: text('police_report_reference'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_incident_reports_case_id').on(table.caseId),
    index('idx_incident_reports_submitted_at').on(table.submittedAt),
  ]
);

/**
 * 9. Secure Messages Table
 * Classification: HIGHLY_SENSITIVE
 * In-app messaging contract. Stores encrypted payload string.
 * retentionPolicyOverrideHours is a neutral, optional retention metadata placeholder
 * subject to future statutory policy definition (no automated deletion assumed).
 */
export const secureMessages = pgTable(
  'secure_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .references(() => cases.id, { onDelete: 'restrict' })
      .notNull(),
    senderId: uuid('sender_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    recipientId: uuid('recipient_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    encryptedPayload: text('encrypted_payload').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
    retentionPolicyOverrideHours: integer('retention_policy_override_hours'),
  },
  (table) => [
    index('idx_secure_messages_case_id').on(table.caseId),
    index('idx_secure_messages_sender_id').on(table.senderId),
    index('idx_secure_messages_recipient_id').on(table.recipientId),
    index('idx_secure_messages_sent_at').on(table.sentAt),
  ]
);

/**
 * 10. Documents Table
 * Classification: HIGHLY_SENSITIVE
 * Metadata and storage paths for protective orders, evidence, and filings.
 * Actual file binaries are stored in private object storage (GCS), never in PostgreSQL.
 */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .references(() => cases.id, { onDelete: 'restrict' })
      .notNull(),
    uploaderId: uuid('uploader_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    sanitizedFileName: text('sanitized_file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSizeBytes: integer('file_size_bytes').notNull(),
    storagePath: text('storage_path').notNull(),
    classification: dataClassificationEnum('classification')
      .notNull()
      .default('HIGHLY_SENSITIVE'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_documents_case_id').on(table.caseId),
    index('idx_documents_uploader_id').on(table.uploaderId),
  ]
);

/**
 * 11. Security Audit Events Table
 * Classification: CONFIDENTIAL
 * Append-only forensic security log.
 * Actor account deletion uses SET NULL to keep the immutable audit record intact.
 * ipHash is an optional policy-dependent metadata field, retained without active collection.
 * Contains zero sensitive data payloads or unhashed passwords.
 */
export const securityAuditEvents = pgTable(
  'security_audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
    actorUserId: uuid('actor_user_id')
      .references(() => users.id, { onDelete: 'set null' }),
    actorRole: text('actor_role').notNull(),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    outcome: text('outcome').notNull(), // 'success', 'denied', 'error'
    requestId: text('request_id'),
    ipHash: text('ip_hash'), // Policy-dependent, optional salted hash (inactive)
    metadata: jsonb('metadata'), // Strictly sanitized non-sensitive context
  },
  (table) => [
    index('idx_security_audit_timestamp').on(table.timestamp),
    index('idx_security_audit_actor').on(table.actorUserId),
    index('idx_security_audit_action').on(table.action),
    index('idx_security_audit_resource').on(table.resourceType, table.resourceId),
  ]
);

/**
 * 12. Support Resources Table
 * Classification: PUBLIC
 * Directory of verified 24/7 hotlines, shelters, and counseling services.
 * Contains zero client, survivor, or staff personal data.
 */
export const supportResources = pgTable(
  'support_resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    category: text('category').notNull(), // 'crisis_hotline', 'emergency_shelter', etc.
    description: text('description').notNull(),
    is24_7: boolean('is_24_7').notNull().default(false),
    contactPhone: text('contact_phone'),
    contactText: text('contact_text'),
    websiteUrl: text('website_url'),
    isPhysicalAddressConfidential: boolean('is_physical_address_confidential')
      .notNull()
      .default(true),
    generalCityRegion: text('general_city_region').notNull(),
    languagesSupported: jsonb('languages_supported').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_support_resources_category').on(table.category),
    index('idx_support_resources_city').on(table.generalCityRegion),
  ]
);

// ---------------------------------------------------------------------------
// Drizzle Relations Declarations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ one, many }) => ({
  identities: many(userIdentities),
  clientProfile: one(clientProfiles, {
    fields: [users.id],
    references: [clientProfiles.userId],
  }),
  advocateProfile: one(advocateProfiles, {
    fields: [users.id],
    references: [advocateProfiles.userId],
  }),
  clientCases: many(cases, { relationName: 'client_cases' }),
  advocateAssignments: many(caseAssignments),
  safetyPlans: many(safetyPlans),
  sentMessages: many(secureMessages, { relationName: 'sent_messages' }),
  receivedMessages: many(secureMessages, { relationName: 'received_messages' }),
  uploadedDocuments: many(documents),
}));

export const userIdentitiesRelations = relations(userIdentities, ({ one }) => ({
  user: one(users, {
    fields: [userIdentities.userId],
    references: [users.id],
  }),
}));

export const clientProfilesRelations = relations(clientProfiles, ({ one }) => ({
  user: one(users, {
    fields: [clientProfiles.userId],
    references: [users.id],
  }),
}));

export const advocateProfilesRelations = relations(advocateProfiles, ({ one }) => ({
  user: one(users, {
    fields: [advocateProfiles.userId],
    references: [users.id],
  }),
}));

export const casesRelations = relations(cases, ({ one, many }) => ({
  client: one(users, {
    fields: [cases.clientId],
    references: [users.id],
    relationName: 'client_cases',
  }),
  assignments: many(caseAssignments),
  safetyPlans: many(safetyPlans),
  incidentReports: many(incidentReports),
  messages: many(secureMessages),
  documents: many(documents),
}));

export const caseAssignmentsRelations = relations(caseAssignments, ({ one }) => ({
  case: one(cases, {
    fields: [caseAssignments.caseId],
    references: [cases.id],
  }),
  advocate: one(users, {
    fields: [caseAssignments.advocateId],
    references: [users.id],
  }),
}));

export const safetyPlansRelations = relations(safetyPlans, ({ one }) => ({
  client: one(users, {
    fields: [safetyPlans.clientId],
    references: [users.id],
  }),
  case: one(cases, {
    fields: [safetyPlans.caseId],
    references: [cases.id],
  }),
}));

export const incidentReportsRelations = relations(incidentReports, ({ one }) => ({
  case: one(cases, {
    fields: [incidentReports.caseId],
    references: [cases.id],
  }),
}));

export const secureMessagesRelations = relations(secureMessages, ({ one }) => ({
  case: one(cases, {
    fields: [secureMessages.caseId],
    references: [cases.id],
  }),
  sender: one(users, {
    fields: [secureMessages.senderId],
    references: [users.id],
    relationName: 'sent_messages',
  }),
  recipient: one(users, {
    fields: [secureMessages.recipientId],
    references: [users.id],
    relationName: 'received_messages',
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  case: one(cases, {
    fields: [documents.caseId],
    references: [cases.id],
  }),
  uploader: one(users, {
    fields: [documents.uploaderId],
    references: [users.id],
  }),
}));

export const securityAuditEventsRelations = relations(securityAuditEvents, ({ one }) => ({
  actor: one(users, {
    fields: [securityAuditEvents.actorUserId],
    references: [users.id],
  }),
}));
