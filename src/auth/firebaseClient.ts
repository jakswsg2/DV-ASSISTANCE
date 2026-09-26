/**
 * Client-Side Firebase Authentication SDK
 * DV-Assistance Platform - Step 12
 *
 * Initializes the client-side Firebase app and auth services if configuration is present.
 * Uses strictly client-safe public credentials (VITE_FIREBASE_*).
 * Contains ZERO server-side service account keys or private secrets.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type UserCredential,
} from 'firebase/auth';

export interface FirebaseClientConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

const firebaseConfig: FirebaseClientConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseClientConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (isFirebaseClientConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
  } catch (err) {
    console.warn('[FirebaseClient] Initialization warning:', err);
  }
}

export const googleProvider = new GoogleAuthProvider();

/**
 * Initiates Google sign-in using popup flow.
 * Returns the verified Firebase user ID token.
 */
export async function signInWithGoogle(): Promise<string> {
  if (!auth) {
    throw new Error('FIREBASE_CLIENT_NOT_CONFIGURED');
  }

  const result: UserCredential = await signInWithPopup(auth, googleProvider);
  return await result.user.getIdToken();
}

/**
 * Signs out from client Firebase SDK.
 */
export async function clientSignOut(): Promise<void> {
  if (auth) {
    await firebaseSignOut(auth);
  }
}

export { app, auth };
