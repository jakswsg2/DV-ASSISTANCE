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
  readonly firebase: FirebaseServerConfig;
  readonly isDev: boolean;
  readonly isProd: boolean;
  readonly isTest: boolean;
}

const rawEnv = process.env.NODE_ENV?.toLowerCase();
const nodeEnv: 'development' | 'production' | 'test' =
  rawEnv === 'production' ? 'production' : rawEnv === 'test' ? 'test' : 'development';

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

export const config: ServerConfig = Object.freeze({
  port,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv,
  apiPrefix: '/api/v1',
  maxJsonBodySize: process.env.MAX_JSON_BODY_SIZE || '100kb',
  sessionCookieName: 'dv_session',
  sessionSecret: process.env.SESSION_SECRET || 'dv-dev-session-secret-change-in-production',
  sessionTtlSeconds: parseInt(process.env.SESSION_TTL_SECONDS || '28800', 10), // 8 hours
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
