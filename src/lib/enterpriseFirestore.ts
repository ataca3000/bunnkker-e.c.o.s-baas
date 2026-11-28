'use client';

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, hasRealCredentials } from '@/lib/firebase';
import type { BranchNode } from '@/lib/enterpriseControlPlane';
import type { ImmutableAuditEntry } from '@/lib/immutableAudit';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider: any) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
}

export async function syncBranchNodeToFirestore(branch: BranchNode): Promise<boolean> {
  if (!hasRealCredentials || !auth.currentUser?.uid || !auth.currentUser?.emailVerified) {
    return false;
  }
  const path = `branch_nodes/${branch.branchId}`;
  try {
    await setDoc(
      doc(db, 'branch_nodes', branch.branchId),
      {
        branchId: branch.branchId,
        ownerUid: auth.currentUser.uid,
        name: branch.name,
        code: branch.code,
        region: branch.region,
        status: branch.status,
        isolationMode: branch.isolationMode,
        pendingSyncCount: Math.max(0, Math.round(branch.pendingSyncCount)),
        todaySales: Math.max(0, Number(branch.todaySales || 0)),
        todayOrders: Math.max(0, Math.round(branch.todayOrders || 0)),
        subscriptionTier: branch.subscriptionTier,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
}

export async function mirrorImmutableAuditToFirestore(entry: ImmutableAuditEntry): Promise<boolean> {
  if (!hasRealCredentials || !auth.currentUser?.uid || !auth.currentUser?.emailVerified) {
    return false;
  }
  const path = `immutable_audit_chain/${entry.entryId}`;
  try {
    await setDoc(doc(db, 'immutable_audit_chain', entry.entryId), {
      entryId: entry.entryId,
      ownerUid: auth.currentUser.uid,
      branchId: entry.branchId,
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      action: entry.action,
      resourceRef: entry.resourceRef,
      payloadHash: entry.payloadHash,
      previousHash: entry.previousHash,
      entryHash: entry.entryHash,
      sequence: entry.sequence,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
    return false;
  }
}

export async function reconcileHostAuthoritativeSnapshotToFirestore(params: {
  branchId: string;
  branchName: string;
  roomCode: string;
  region?: string;
  todaySales: number;
  todayOrders: number;
  subscriptionTier?: 'TRIAL' | 'STARTER' | 'PRO' | 'ENTERPRISE';
}): Promise<boolean> {
  if (!hasRealCredentials || !auth.currentUser?.uid || !auth.currentUser?.emailVerified) {
    return false;
  }
  const safeBranchId = params.branchId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64) || 'branch-host-local';
  const path = `branch_nodes/${safeBranchId}`;
  try {
    await setDoc(
      doc(db, 'branch_nodes', safeBranchId),
      {
        branchId: safeBranchId,
        ownerUid: auth.currentUser.uid,
        name: params.branchName.slice(0, 120) || 'Sucursal Host Local',
        code: params.roomCode.slice(0, 24) || 'BNK-HOST',
        region: (params.region || 'LAN Local-First').slice(0, 120),
        status: 'online',
        isolationMode: 'isolated_local_first',
        pendingSyncCount: 0,
        todaySales: Math.max(0, Number(params.todaySales || 0)),
        todayOrders: Math.max(0, Math.round(params.todayOrders || 0)),
        subscriptionTier: params.subscriptionTier || 'PRO',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
}

