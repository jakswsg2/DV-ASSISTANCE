/**
 * Secure Messaging Domain API Router
 * DV-Assistance Platform - Step 14
 *
 * Implements:
 * - GET  /api/v1/messages/case/:caseId: Retrieves and decrypts authorized messages for a case
 * - POST /api/v1/messages: Encrypts with AES-256-GCM and persists message
 * - PATCH /api/v1/messages/:id/read: Marks message as read by intended recipient
 *
 * Security Guarantees:
 * - Application-Level Encryption (AES-256-GCM) with unique IV and auth tag per message
 * - Admin Data Wall: Admin accounts strictly receive 403/404; zero message content access
 * - Anonymous / Public: Strictly denied (401/403)
 * - Zero plaintext messages or encryption keys stored in database or audit logs
 * - IDOR Protection: Masked 404 NOT_FOUND on unauthorized message/case access attempts
 */

import { Router, type Request, type Response } from 'express';
import { ApiError } from '../middleware/errorHandler.ts';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { requirePermission, authorizeCaseAccess } from '../auth/authorization.ts';
import { messageRepository } from '../repositories/messageRepository.ts';
import { encryptMessage, decryptMessage } from '../crypto/messageEncryption.ts';
import { recordAuditEvent } from '../audit/auditLogger.ts';
import { db } from '../../db/index.ts';
import { dbConfig } from '../../db/config.ts';
import { caseAssignments } from '../../db/schema.ts';
import { devDataStore } from '../repositories/devStore.ts';
import { eq, and } from 'drizzle-orm';

export const messagesRouter = Router();

/**
 * GET /api/v1/messages/case/:caseId
 * Retrieves all encrypted messages for an authorized case and decrypts them for the principal.
 */
messagesRouter.get(
  '/case/:caseId',
  requirePermission('messages:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const caseId = req.params.caseId;

    // Authorize case scope (verifies Client ownership or Advocate active assignment)
    const { caseRecord } = await authorizeCaseAccess(req.user, caseId, req.requestId);

    const encryptedMessages = await messageRepository.listMessagesByCaseId(caseRecord.id);

    // Decrypt messages asynchronously for authorized caller
    const decryptedMessages = await Promise.all(
      encryptedMessages.map(async (msg) => {
        let content: string;
        try {
          content = await decryptMessage(msg.encryptedPayload);
        } catch {
          content = '[Decryption failed: corrupted payload or mismatched key]';
        }

        return {
          id: msg.id,
          caseId: msg.caseId,
          senderId: msg.senderId,
          recipientId: msg.recipientId,
          content,
          isRead: msg.isRead,
          sentAt: msg.sentAt,
          retentionPolicyOverrideHours: msg.retentionPolicyOverrideHours,
          senderAlias: (msg as any).senderAlias || 'Participant',
          senderRole: (msg as any).senderRole || 'user',
        };
      })
    );

    recordAuditEvent({
      action: 'message:viewed',
      outcome: 'success',
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || 'client',
      resourceType: 'case_messages',
      resourceId: caseRecord.id,
      requestId: req.requestId,
      metadata: { messageCount: decryptedMessages.length, caseId: caseRecord.id },
    });

    res.status(200).json({
      messages: decryptedMessages,
    });
  })
);

/**
 * POST /api/v1/messages
 * Encrypts and sends a secure message into an authorized case.
 */
messagesRouter.post(
  '/',
  requirePermission('messages:send'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;
    if (!user || user.isAnonymous) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required to send secure messages.');
    }

    const { caseId, recipientId, content, retentionPolicyOverrideHours } = req.body || {};

    if (!caseId || typeof caseId !== 'string') {
      throw new ApiError(400, 'INVALID_INPUT', 'A valid caseId UUID is required.');
    }

    if (!recipientId || typeof recipientId !== 'string') {
      throw new ApiError(400, 'INVALID_INPUT', 'A valid recipientId UUID is required.');
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new ApiError(400, 'INVALID_INPUT', 'Message content cannot be empty.');
    }

    if (content.length > 4000) {
      throw new ApiError(400, 'INVALID_INPUT', 'Message content exceeds maximum allowed length (4000 characters).');
    }

    // Authorize caller's participation in the case
    const { caseRecord } = await authorizeCaseAccess(user, caseId, req.requestId);

    const targetRecipientId = recipientId.trim();

    // Validate recipient is an authorized participant in this case (Client owner or assigned Advocate)
    let isRecipientAuthorized = targetRecipientId === caseRecord.clientId;

    if (!isRecipientAuthorized) {
      if (!dbConfig.isConfigured) {
        isRecipientAuthorized = Array.from(devDataStore.assignments.values()).some(
          (a) => a.caseId === caseRecord.id && a.advocateId === targetRecipientId && a.status === 'active'
        );
      } else {
        const assignments = await db
          .select()
          .from(caseAssignments)
          .where(
            and(
              eq(caseAssignments.caseId, caseRecord.id),
              eq(caseAssignments.advocateId, targetRecipientId),
              eq(caseAssignments.status, 'active')
            )
          )
          .limit(1);
        isRecipientAuthorized = assignments.length > 0;
      }
    }

    if (!isRecipientAuthorized) {
      recordAuditEvent({
        action: 'security:message_invalid_recipient',
        outcome: 'denied',
        actorUserId: user.id,
        actorRole: user.role,
        resourceType: 'case',
        resourceId: caseRecord.id,
        requestId: req.requestId,
        metadata: { attemptedRecipientId: targetRecipientId },
      });
      throw new ApiError(400, 'INVALID_RECIPIENT', 'The specified recipient is not an authorized participant in this case.');
    }

    // Encrypt message content with AES-256-GCM
    const encryptedPayload = await encryptMessage(content.trim());

    // Persist encrypted payload
    const newMessage = await messageRepository.createMessage({
      caseId: caseRecord.id,
      senderId: user.id, // Strictly derived from verified session principal
      recipientId: targetRecipientId,
      encryptedPayload,
      retentionPolicyOverrideHours:
        typeof retentionPolicyOverrideHours === 'number' ? retentionPolicyOverrideHours : null,
    });

    recordAuditEvent({
      action: 'message:sent',
      outcome: 'success',
      actorUserId: user.id,
      actorRole: user.role,
      resourceType: 'message',
      resourceId: newMessage.id,
      requestId: req.requestId,
      metadata: {
        caseId: caseRecord.id,
        recipientId: newMessage.recipientId,
      },
    });

    res.status(201).json({
      id: newMessage.id,
      caseId: newMessage.caseId,
      senderId: newMessage.senderId,
      recipientId: newMessage.recipientId,
      isRead: newMessage.isRead,
      sentAt: newMessage.sentAt,
      message: 'Message encrypted with AES-256-GCM and dispatched securely.',
    });
  })
);

/**
 * PATCH /api/v1/messages/:id/read
 * Marks a message as read by the recipient.
 */
messagesRouter.patch(
  '/:id/read',
  requirePermission('messages:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;
    if (!user || user.isAnonymous) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.');
    }

    const messageId = req.params.id;
    const existingMessage = await messageRepository.getMessageById(messageId);

    // IDOR protection: if message not found or caller is not intended recipient, return 404
    if (!existingMessage || existingMessage.recipientId !== user.id) {
      recordAuditEvent({
        action: 'security:message_idor_denied',
        outcome: 'denied',
        actorUserId: user.id,
        actorRole: user.role,
        resourceType: 'message',
        resourceId: messageId,
        requestId: req.requestId,
      });
      throw new ApiError(404, 'NOT_FOUND', 'The requested message does not exist or you do not have access.');
    }

    const updated = await messageRepository.markMessageAsRead(messageId, user.id);

    recordAuditEvent({
      action: 'message:marked_read',
      outcome: 'success',
      actorUserId: user.id,
      actorRole: user.role,
      resourceType: 'message',
      resourceId: messageId,
      requestId: req.requestId,
    });

    res.status(200).json({
      message: updated,
      status: 'read',
    });
  })
);

export default messagesRouter;
