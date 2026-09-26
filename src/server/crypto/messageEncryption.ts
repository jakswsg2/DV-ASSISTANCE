/**
 * Application-Level Message Encryption Module
 * DV-Assistance Platform - Step 14
 *
 * Implements authenticated Application-Level Encryption using AES-256-GCM.
 * Note: This is Application-Level Encryption (NOT True E2EE). The server decrypts
 * message content exclusively when authorized for an active survivor or assigned advocate.
 *
 * Guarantees:
 * - 12-byte unique cryptographic nonce/IV per message
 * - 16-byte GCM authentication tag validation
 * - Key version metadata tracking ('v1')
 * - Zero plaintext messages stored in database or audit logs
 * - Zero encryption keys stored in database or sent to frontend
 * - Fail-closed production enforcement when encryption keys are missing
 */

import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { config } from '../config.ts';

export interface EncryptedMessageEnvelope {
  readonly version: string;
  readonly algorithm: 'AES-256-GCM';
  readonly iv: string; // Base64
  readonly ciphertext: string; // Base64
  readonly tag: string; // Base64
}

/**
 * Key Provider Abstraction
 * Resolves the 256-bit encryption key for the specified version.
 * Fails closed in production if APP_MESSAGE_ENCRYPTION_KEY is unconfigured or malformed.
 * Strictly requires exactly 32 bytes (64 hex or 44 base64 characters); no silent padding/truncation.
 */
export function getMessageEncryptionKey(version = 'v1'): Buffer {
  const envKey = process.env.APP_MESSAGE_ENCRYPTION_KEY?.trim();

  if (envKey && envKey.length > 0) {
    // Exact 64 hex characters (32 bytes)
    if (/^[0-9a-fA-F]{64}$/.test(envKey)) {
      return Buffer.from(envKey, 'hex');
    }
    // Exact 44 base64 characters (32 bytes)
    if (/^[A-Za-z0-9+/]{43}=$/.test(envKey) || /^[A-Za-z0-9+/]{44}$/.test(envKey)) {
      const decoded = Buffer.from(envKey, 'base64');
      if (decoded.length === 32) {
        return decoded;
      }
    }

    throw new Error(
      '[Security] APP_MESSAGE_ENCRYPTION_KEY must be a valid 256-bit (32-byte) hex (64 chars) or base64 string. Silent padding or truncation is disallowed.'
    );
  }

  // Production Fail-Closed Requirement: Never use fallback key in production
  if (config.isProd) {
    throw new Error('[Security] APP_MESSAGE_ENCRYPTION_KEY must be configured in production.');
  }

  // Development-only deterministic key derived from session secret and version
  return createHash('sha256')
    .update(`dv_message_key_${version}_${config.sessionSecret}`)
    .digest();
}

/**
 * Encrypts plaintext message content using AES-256-GCM.
 * Returns a JSON-serialized EncryptedMessageEnvelope.
 */
export async function encryptMessage(plaintext: string, version = 'v1'): Promise<string> {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('Plaintext content must be a non-empty string.');
  }

  const key = getMessageEncryptionKey(version);
  const iv = randomBytes(12); // Standard 96-bit nonce for AES-GCM

  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const envelope: EncryptedMessageEnvelope = {
    version,
    algorithm: 'AES-256-GCM',
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: tag.toString('base64'),
  };

  return JSON.stringify(envelope);
}

/**
 * Decrypts a JSON-serialized EncryptedMessageEnvelope using AES-256-GCM.
 * Validates authentication tag; throws error if tampered.
 */
export async function decryptMessage(envelopeJson: string): Promise<string> {
  if (!envelopeJson || typeof envelopeJson !== 'string') {
    throw new Error('Invalid encrypted payload envelope.');
  }

  let envelope: EncryptedMessageEnvelope;
  try {
    envelope = JSON.parse(envelopeJson);
  } catch {
    throw new Error('Malformed encrypted message envelope JSON.');
  }

  if (envelope.algorithm !== 'AES-256-GCM' || !envelope.iv || !envelope.ciphertext || !envelope.tag) {
    throw new Error('Unsupported or corrupted encryption envelope format.');
  }

  const key = getMessageEncryptionKey(envelope.version || 'v1');
  const iv = Buffer.from(envelope.iv, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

export default {
  encryptMessage,
  decryptMessage,
  getMessageEncryptionKey,
};
