/**
 * Server Configuration Foundation
 * DV-Assistance Platform - Step 12
 *
 * Centralizes environment parsing and validation for the backend foundation.
 * Distinguishes development, test, and production environments.
 * Manages session secret, cookie parameters, and server-side Firebase configuration.
 * Strictly prevents leaking secrets to client bundles.
 */

import dotenv from 'dotenv';

// Load environment variables from .env file if present
dotenv.config();

export interface FirebaseServerConfig {
  readonly projectId?: string;
  readonly clientEmail?: string;
  readonly privateKey?: string;
  readonly isConfigured: boolean;
}

export interface ServerConfig {
  readonly port: number;
  readonly host: string;
  readonly nodeEnv: 'development' | 'production' | 'test';
  readonly apiPrefix: string;
  readonly maxJsonBodySize: string;
  readonly sessionCookieName: string;
  readonly sessionSecret: string;
  readonly sessionTtlSeconds: number;
  /**
   * Development authentication is disabled by default.
   *
   * It must be explicitly enabled with ALLOW_DEV_AUTH=true.
   *
   * This prevents accidental exposure of /auth/dev-session
   * when the application is reachable through a public domain.
   */
  readonly allowDevAuth: boolean;
  readonly firebase: FirebaseServerConfig;
  readonly isDev: boolean;
  readonly isProd: boolean;
  readonly isTest: boolean;
}

const rawEnv = process.env.NODE_ENV?.toLowerCase();

if (rawEnv !== 'development' && rawEnv !== 'production' && rawEnv !== 'test') {
  throw new Error(
    `Invalid NODE_ENV="${process.env.NODE_ENV ?? ''}". Expected development, production, or test.`
  );
}

const nodeEnv = rawEnv as 'development' | 'production' | 'test';

const parsedPort = parseInt(process.env.PORT || '3000', 10);
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
// Handle escaped newlines in private key string if supplied via env var
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

const isFirebaseConfigured = Boolean(
  firebaseProjectId && (firebaseClientEmail || process.env.GOOGLE_APPLICATION_CREDENTIALS)
);

/**
 * Development authentication is disabled by default.
 *
 * It must be explicitly enabled with:
 *   ALLOW_DEV_AUTH=true
 *
 * This prevents accidental exposure of /auth/dev-session
 * when the application is reachable through a public domain.
 */
const allowDevAuth = process.env.ALLOW_DEV_AUTH?.toLowerCase() === 'true';
const sessionSecret =
      process.env.SESSION_SECRET ||
      (nodeEnv === 'development'
        ? 'dv-dev-session-secret-for-local-development-only'
        : undefined);

    if (nodeEnv === 'production' && !sessionSecret) {
      throw new Error(
        'SESSION_SECRET is required in production.'
      );
    }

    if (sessionSecret && sessionSecret.length < 32) {
      throw new Error(
        'SESSION_SECRET must be at least 32 characters long.'
      );
    }
export const config: ServerConfig = Object.freeze({
  port,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv,
  apiPrefix: '/api/v1',
  maxJsonBodySize: process.env.MAX_JSON_BODY_SIZE || '100kb',
  sessionCookieName: 'dv_session',
  sessionSecret,
  sessionTtlSeconds: parseInt(process.env.SESSION_TTL_SECONDS || '28800', 10), // 8 hours
  allowDevAuth,
  firebase: Object.freeze({
    projectId: firebaseProjectId,
    clientEmail: firebaseClientEmail,
    privateKey: firebasePrivateKey,
    isConfigured: isFirebaseConfigured,
  }),
  isDev: nodeEnv === 'development',
  isProd: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
});

export default config;
