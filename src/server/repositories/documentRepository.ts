/**
 * Document Domain Repository
 * DV-Assistance Platform - Step 15
 *
 * Implements persistent database operations for case document metadata.
 * Document binary payloads are stored in private object storage, never in PostgreSQL.
 */

import { randomUUID } from 'node:crypto';
import { eq, desc } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { dbConfig } from '../../db/config.ts';
import { documents, users } from '../../db/schema.ts';
import { devDataStore, type DevDocument } from './devStore.ts';

export interface CreateDocumentParams {
  readonly caseId: string;
  readonly uploaderId: string;
  readonly sanitizedFileName: string;
  readonly mimeType: string;
  readonly fileSizeBytes: number;
  readonly storagePath: string;
  readonly classification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'HIGHLY_SENSITIVE';
}

export class DocumentRepository {
  /**
   * Persists document metadata into PostgreSQL / devDataStore.
   */
  async createDocument(params: CreateDocumentParams) {
    const classification = params.classification || 'HIGHLY_SENSITIVE';

    if (!dbConfig.isConfigured) {
      const docId = randomUUID();
      const doc: DevDocument = {
        id: docId,
        caseId: params.caseId,
        uploaderId: params.uploaderId,
        sanitizedFileName: params.sanitizedFileName,
        mimeType: params.mimeType,
        fileSizeBytes: params.fileSizeBytes,
        storagePath: params.storagePath,
        classification,
        uploadedAt: new Date(),
      };
      devDataStore.documents.set(docId, doc);
      return doc;
    }

    const [doc] = await db
      .insert(documents)
      .values({
        caseId: params.caseId,
        uploaderId: params.uploaderId,
        sanitizedFileName: params.sanitizedFileName,
        mimeType: params.mimeType,
        fileSizeBytes: params.fileSizeBytes,
        storagePath: params.storagePath,
        classification,
      })
      .returning();

    return doc;
  }

  /**
   * Lists all document metadata records for an authorized case.
   */
  async listDocumentsByCaseId(caseId: string) {
    if (!dbConfig.isConfigured) {
      return Array.from(devDataStore.documents.values())
        .filter((d) => d.caseId === caseId)
        .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
        .map((d) => {
          const uploader = devDataStore.users.get(d.uploaderId);
          return {
            ...d,
            uploaderAlias: uploader?.safeAlias || 'Uploader',
            uploaderRole: uploader?.role || 'user',
          };
        });
    }

    const rows = await db
      .select({
        id: documents.id,
        caseId: documents.caseId,
        uploaderId: documents.uploaderId,
        sanitizedFileName: documents.sanitizedFileName,
        mimeType: documents.mimeType,
        fileSizeBytes: documents.fileSizeBytes,
        storagePath: documents.storagePath,
        classification: documents.classification,
        uploadedAt: documents.uploadedAt,
        uploaderAlias: users.safeAlias,
        uploaderRole: users.role,
      })
      .from(documents)
      .leftJoin(users, eq(documents.uploaderId, users.id))
      .where(eq(documents.caseId, caseId))
      .orderBy(desc(documents.uploadedAt));

    return rows;
  }

  /**
   * Retrieves a single document metadata record by ID.
   */
  async getDocumentById(documentId: string) {
    if (!dbConfig.isConfigured) {
      return devDataStore.documents.get(documentId) || null;
    }

    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }
}

export const documentRepository = new DocumentRepository();
export default documentRepository;
