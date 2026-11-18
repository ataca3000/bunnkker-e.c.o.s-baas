'use client';

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, hasRealCredentials } from '@/lib/firebase';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
] as const;

// Strictly in-memory OAuth token storage — never written to localStorage/sessionStorage
let inMemoryWorkspaceToken: string | null = null;
let inMemoryTokenExpiresAt = 0;
let authListenerBound = false;

function ensureAuthCleanupListener(): void {
  if (authListenerBound || typeof window === 'undefined' || !hasRealCredentials) return;
  authListenerBound = true;
  try {
    onAuthStateChanged(auth, (firebaseUser: any) => {
      if (!firebaseUser) {
        inMemoryWorkspaceToken = null;
        inMemoryTokenExpiresAt = 0;
      }
    });
  } catch {
    // Ignore when auth is mock
  }
}

export function getCachedWorkspaceToken(): string | null {
  ensureAuthCleanupListener();
  if (!inMemoryWorkspaceToken) return null;
  if (Date.now() >= inMemoryTokenExpiresAt) {
    inMemoryWorkspaceToken = null;
    inMemoryTokenExpiresAt = 0;
    return null;
  }
  return inMemoryWorkspaceToken;
}

export function clearWorkspaceToken(): void {
  inMemoryWorkspaceToken = null;
  inMemoryTokenExpiresAt = 0;
}

export interface GoogleAuthPopupResult {
  idToken: string;
  accessToken: string | null;
  email: string;
  displayName: string;
}

export async function signInWithGoogleWorkspace(options?: {
  includeWorkspaceScopes?: boolean;
}): Promise<GoogleAuthPopupResult> {
  if (!hasRealCredentials) {
    throw new Error('Firebase Auth no está configurado con credenciales activas en este entorno.');
  }

  ensureAuthCleanupListener();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  if (options?.includeWorkspaceScopes !== false) {
    for (const scope of WORKSPACE_SCOPES) {
      provider.addScope(scope);
    }
  }

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const idToken = await result.user.getIdToken();
  const accessToken = credential?.accessToken || null;

  if (accessToken) {
    inMemoryWorkspaceToken = accessToken;
    // Standard Google OAuth access tokens live ~55 min; refresh early before expiry
    inMemoryTokenExpiresAt = Date.now() + 50 * 60 * 1000;
  }

  return {
    idToken,
    accessToken,
    email: result.user.email || '',
    displayName: result.user.displayName || result.user.email || 'Usuario Corporativo',
  };
}

export async function disconnectGoogleWorkspace(): Promise<void> {
  clearWorkspaceToken();
  if (!hasRealCredentials) return;
  try {
    await firebaseSignOut(auth);
  } catch {
    // Ignore sign-out cleanup errors
  }
}
