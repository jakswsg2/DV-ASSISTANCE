/**
 * Firebase Admin Authentication Wrapper
 * DV-Assistance Platform - Step 12
 *
 * Server-only module for verifying Firebase-issued ID tokens.
 * Strictly prevents private keys or service account credentials from leaking to client.
 * Handles missing or incomplete cloud credentials gracefully during local/offline testing.
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { config } from '../config.ts';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;

export function initializeFirebaseAdmin(): { app: App | null; auth: Auth | null } {
  if (adminAuth) {
    return { app: adminApp, auth: adminAuth };
  }

  // Check if an app is already initialized
  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    adminAuth = getAuth(adminApp);
    return { app: adminApp, auth: adminAuth };
  }

  // If explicit credentials are provided
  if (config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey) {
    try {
      adminApp = initializeApp({
        credential: cert({
          projectId: config.firebase.projectId,
          clientEmail: config.firebase.clientEmail,
          privateKey: config.firebase.privateKey,
        }),
      });
      adminAuth = getAuth(adminApp);
      console.log(`[FirebaseAdmin] Initialized with service account for project: ${config.firebase.projectId}`);
      return { app: adminApp, auth: adminAuth };
    } catch (err) {
      console.error('[FirebaseAdmin] Failed to initialize with provided service account credentials:', err);
    }
  } else if (config.firebase.projectId) {
    // Project ID only (e.g. Cloud Run metadata server or GOOGLE_APPLICATION_CREDENTIALS)
    try {
      adminApp = initializeApp({ projectId: config.firebase.projectId });
      adminAuth = getAuth(adminApp);
      console.log(`[FirebaseAdmin] Initialized with application default credentials for project: ${config.firebase.projectId}`);
      return { app: adminApp, auth: adminAuth };
    } catch (err) {
      console.error('[FirebaseAdmin] Failed to initialize with application default credentials:', err);
    }
  }

  // In development, we allow server to boot even if Firebase credentials are not yet provisioned
  if (config.isDev) {
    console.log('[FirebaseAdmin] Firebase Admin credentials not provided. Running in development mode with live auth disabled.');
  }

  return { app: null, auth: null };
}

export function isFirebaseAdminConfigured(): boolean {
  const { auth } = initializeFirebaseAdmin();
  return auth !== null;
}

/**
 * Verifies a client-supplied Firebase ID token using the official Firebase Admin SDK.
 * Never trusts client claims.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const { auth } = initializeFirebaseAdmin();
  if (!auth) {
    throw new Error('FIREBASE_ADMIN_NOT_CONFIGURED');
  }

  return await auth.verifyIdToken(idToken, true);
}

export default {
  initializeFirebaseAdmin,
  isFirebaseAdminConfigured,
  verifyFirebaseIdToken,
};
