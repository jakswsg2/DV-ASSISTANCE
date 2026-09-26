/**
 * Secure Message Domain Repository
 * DV-Assistance Platform - Step 14
 *
 * Implements persistent database operations for secure messages.
 * Guarantees that only encrypted payloads are stored; never plaintext.
 * No destructive message deletion or automatic shredding is performed.
 */

import { randomUUID } from 'node:crypto';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { dbConfig } from '../../db/config.ts';
import { secureMessages, users } from '../../db/schema.ts';
import { devDataStore, type DevSecureMessage } from './devStore.ts';

export interface CreateMessageParams {
  readonly caseId: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly encryptedPayload: string;
  readonly retentionPolicyOverrideHours?: number | null;
}

export class MessageRepository {
  /**
   * Persists an encrypted message into the database.
   */
  async createMessage(params: CreateMessageParams) {
    if (!dbConfig.isConfigured) {
      const messageId = randomUUID();
      const message: DevSecureMessage = {
        id: messageId,
        caseId: params.caseId,
        senderId: params.senderId,
        recipientId: params.recipientId,
        encryptedPayload: params.encryptedPayload,
        isRead: false,
        sentAt: new Date(),
        retentionPolicyOverrideHours: params.retentionPolicyOverrideHours || null,
      };
      devDataStore.messages.set(messageId, message);
      return message;
    }

    const [message] = await db
      .insert(secureMessages)
      .values({
        caseId: params.caseId,
        senderId: params.senderId,
        recipientId: params.recipientId,
        encryptedPayload: params.encryptedPayload,
        isRead: false,
        retentionPolicyOverrideHours: params.retentionPolicyOverrideHours || null,
      })
      .returning();

    return message;
  }

  /**
   * Lists all messages for an authorized case.
   */
  async listMessagesByCaseId(caseId: string) {
    if (!dbConfig.isConfigured) {
      return Array.from(devDataStore.messages.values())
        .filter((m) => m.caseId === caseId)
        .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
        .map((m) => {
          const sender = devDataStore.users.get(m.senderId);
          const recipient = devDataStore.users.get(m.recipientId);
          return {
            ...m,
            senderAlias: sender?.safeAlias || 'Sender',
            senderRole: sender?.role || 'user',
            recipientAlias: recipient?.safeAlias || 'Recipient',
            recipientRole: recipient?.role || 'user',
          };
        });
    }

    const rows = await db
      .select({
        id: secureMessages.id,
        caseId: secureMessages.caseId,
        senderId: secureMessages.senderId,
        recipientId: secureMessages.recipientId,
        encryptedPayload: secureMessages.encryptedPayload,
        isRead: secureMessages.isRead,
        sentAt: secureMessages.sentAt,
        retentionPolicyOverrideHours: secureMessages.retentionPolicyOverrideHours,
        senderAlias: users.safeAlias,
        senderRole: users.role,
      })
      .from(secureMessages)
      .leftJoin(users, eq(secureMessages.senderId, users.id))
      .where(eq(secureMessages.caseId, caseId))
      .orderBy(asc(secureMessages.sentAt));

    return rows;
  }

  /**
   * Retrieves a single message by ID.
   */
  async getMessageById(messageId: string) {
    if (!dbConfig.isConfigured) {
      return devDataStore.messages.get(messageId) || null;
    }

    const rows = await db
      .select()
      .from(secureMessages)
      .where(eq(secureMessages.id, messageId))
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Marks a message as read by the intended recipient.
   */
  async markMessageAsRead(messageId: string, recipientId: string) {
    if (!dbConfig.isConfigured) {
      const msg = devDataStore.messages.get(messageId);
      if (msg && msg.recipientId === recipientId) {
        msg.isRead = true;
        return msg;
      }
      return null;
    }

    const [updated] = await db
      .update(secureMessages)
      .set({ isRead: true })
      .where(and(eq(secureMessages.id, messageId), eq(secureMessages.recipientId, recipientId)))
      .returning();

    return updated || null;
  }
}

export const messageRepository = new MessageRepository();
export default messageRepository;
