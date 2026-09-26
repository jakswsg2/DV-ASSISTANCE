/**
 * Document Vault Domain API Router
 * DV-Assistance Platform - Step 15
 *
 * Implements:
 * - GET  /api/v1/documents/case/:caseId: Lists authorized case documents
 * - GET  /api/v1/documents/:id: Retrieves document metadata
 * - GET  /api/v1/documents/:id/download: Server-authorized secure document streaming
 * - POST /api/v1/documents/upload: Malware scan, EXIF stripping, and private storage
 *
 * Security Guarantees:
 * - Private Object Storage (GCS / Dev isolated store); zero public URLs
 * - Strict Allowed File Types (PDF, JPEG, PNG) verified by magic bytes
 * - Client-controlled storage paths strictly disallowed
 * - Admin Data Wall: Admins blocked from survivor documents (403/404)
 * - Safe response headers (nosniff, attachment, sanitized filename)
 */

import { Router, type Request, type Response } from 'express';
import { ApiError } from '../middleware/errorHandler.ts';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { requirePermission, authorizeCaseAccess } from '../auth/authorization.ts';
import { documentRepository } from '../repositories/documentRepository.ts';
import { storageProvider } from '../storage/storageProvider.ts';
import {
  inspectAndSanitizeUpload,
  sanitizeFileName,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../security/documentScanner.ts';
import { recordAuditEvent } from '../audit/auditLogger.ts';

export const documentsRouter = Router();

/**
 * GET /api/v1/documents/case/:caseId
 * Lists all documents in an authorized case.
 */
documentsRouter.get(
  '/case/:caseId',
  requirePermission('docs:view'),
  asyncHandler(async (req: Request, res: Response) => {
    const caseId = req.params.caseId;

    // Authorize caller's case scope
    const { caseRecord } = await authorizeCaseAccess(req.user, caseId, req.requestId);

    const docs = await documentRepository.listDocumentsByCaseId(caseRecord.id);

    recordAuditEvent({
      action: 'document:viewed',
      outcome: 'success',
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || 'client',
      resourceType: 'case_documents',
      resourceId: caseRecord.id,
      requestId: req.requestId,
      metadata: { documentCount: docs.length, caseId: caseRecord.id },
    });

    res.status(200).json({
      documents: docs,
    });
  })
);

/**
 * GET /api/v1/documents/:id
 * Retrieves metadata for a specific document.
 */
documentsRouter.get(
  '/:id',
  requirePermission('docs:view'),
  asyncHandler(async (req: Request, res: Response) => {
    const documentId = req.params.id;
    const doc = await documentRepository.getDocumentById(documentId);

    if (!doc) {
      recordAuditEvent({
        action: 'security:document_access_denied',
        outcome: 'denied',
        actorUserId: req.user?.id || null,
        actorRole: req.user?.role || 'client',
        resourceType: 'document',
        resourceId: documentId,
        requestId: req.requestId,
      });
      throw new ApiError(404, 'NOT_FOUND', 'The requested document does not exist or you do not have access.');
    }

    // Authorize access to the linked case
    await authorizeCaseAccess(req.user, doc.caseId, req.requestId);

    recordAuditEvent({
      action: 'document:viewed',
      outcome: 'success',
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || 'client',
      resourceType: 'document',
      resourceId: doc.id,
      requestId: req.requestId,
    });

    res.status(200).json({
      document: doc,
    });
  })
);

/**
 * GET /api/v1/documents/:id/download
 * Streams the document securely with attachment disposition and protective headers.
 */
documentsRouter.get(
  '/:id/download',
  requirePermission('docs:view'),
  asyncHandler(async (req: Request, res: Response) => {
    const documentId = req.params.id;
    const doc = await documentRepository.getDocumentById(documentId);

    if (!doc) {
      recordAuditEvent({
        action: 'security:document_access_denied',
        outcome: 'denied',
        actorUserId: req.user?.id || null,
        actorRole: req.user?.role || 'client',
        resourceType: 'document',
        resourceId: documentId,
        requestId: req.requestId,
      });
      throw new ApiError(404, 'NOT_FOUND', 'The requested document does not exist or you do not have access.');
    }

    // Authorize caller's case scope
    await authorizeCaseAccess(req.user, doc.caseId, req.requestId);

    const fileBuffer = await storageProvider.readObject(doc.storagePath);

    const safeDownloadName = sanitizeFileName(doc.sanitizedFileName);

    recordAuditEvent({
      action: 'document:downloaded',
      outcome: 'success',
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || 'client',
      resourceType: 'document',
      resourceId: doc.id,
      requestId: req.requestId,
      metadata: { fileSizeBytes: doc.fileSizeBytes, mimeType: doc.mimeType },
    });

    // Enforce strict security download headers
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    res.status(200).send(fileBuffer);
  })
);

/**
 * POST /api/v1/documents/upload
 * Validates, scans, sanitizes EXIF, and stores confidential document.
 */
documentsRouter.post(
  '/upload',
  requirePermission('docs:upload'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;
    if (!user || user.isAnonymous) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required to upload documents.');
    }

    const { caseId, fileName, mimeType, fileBase64, classification } = req.body || {};

    if (!caseId || typeof caseId !== 'string') {
      throw new ApiError(400, 'INVALID_INPUT', 'A valid caseId UUID is required.');
    }

    if (!fileName || typeof fileName !== 'string') {
      throw new ApiError(400, 'INVALID_INPUT', 'A valid fileName is required.');
    }

    if (!fileBase64 || typeof fileBase64 !== 'string') {
      throw new ApiError(400, 'INVALID_INPUT', 'Document file payload (base64) is required.');
    }

    // 1. Authorize case scope
    const { caseRecord } = await authorizeCaseAccess(user, caseId, req.requestId);

    // 2. Decode raw file buffer
    let rawBuffer: Buffer;
    try {
      rawBuffer = Buffer.from(fileBase64, 'base64');
    } catch {
      throw new ApiError(400, 'INVALID_FILE', 'Malformed base64 file data.');
    }

    // 3. Inspect, scan for malware, verify magic bytes, and strip EXIF
    const scanResult = await inspectAndSanitizeUpload(
      rawBuffer,
      typeof mimeType === 'string' ? mimeType : 'application/octet-stream',
      fileName
    );

    const safeName = sanitizeFileName(fileName);
    const storagePath = storageProvider.generateOpaqueStoragePath(caseRecord.id, scanResult.normalizedExtension);

    // 4. Save sanitized buffer to private storage
    await storageProvider.saveObject(storagePath, scanResult.sanitizedBuffer, scanResult.detectedMimeType);

    // 5. Persist document metadata (uploaderId derived strictly from session principal)
    const newDoc = await documentRepository.createDocument({
      caseId: caseRecord.id,
      uploaderId: user.id,
      sanitizedFileName: safeName,
      mimeType: scanResult.detectedMimeType,
      fileSizeBytes: scanResult.sanitizedBuffer.length,
      storagePath,
      classification:
        classification === 'CONFIDENTIAL' || classification === 'HIGHLY_SENSITIVE'
          ? classification
          : 'HIGHLY_SENSITIVE',
    });

    recordAuditEvent({
      action: 'document:uploaded',
      outcome: 'success',
      actorUserId: user.id,
      actorRole: user.role,
      resourceType: 'document',
      resourceId: newDoc.id,
      requestId: req.requestId,
      metadata: {
        caseId: caseRecord.id,
        fileSizeBytes: newDoc.fileSizeBytes,
        mimeType: newDoc.mimeType,
        scannedBy: scanResult.scannedBy,
      },
    });

    res.status(201).json({
      document: newDoc,
      message: 'Document scanned and stored securely in Document Vault.',
    });
  })
);

export default documentsRouter;
