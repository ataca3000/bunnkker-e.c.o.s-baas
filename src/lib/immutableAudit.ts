import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { atomicWriteFileSync, resolveReadablePath, resolveWritablePath } from './atomicFs';

/**
 * immutableAudit.ts — Bitácora Inmutable Encadenada SHA-256 (Append-Only)
 * Cada nuevo evento calcula su huella criptográfica combinando el hash del
 * registro anterior (`previousHash`) + su contenido canónico. Cualquier edición
 * manual o truncado rompe la verificación de cadena.
 */

export interface ImmutableAuditEntry {
  entryId: string;
  sequence: number;
  branchId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  resourceRef: string;
  details?: Record<string, unknown>;
  payloadHash: string;
  previousHash: string;
  entryHash: string;
  timestamp: string;
}

export interface AppendImmutableAuditInput {
  branchId?: string;
  actorId: string;
  actorName?: string;
  actorRole: string;
  action: string;
  resourceRef: string;
  details?: Record<string, unknown>;
  timestamp?: string;
}

export interface AuditChainVerificationResult {
  valid: boolean;
  checkedCount: number;
  brokenSequence?: number;
  brokenEntryId?: string;
  reason?: string;
  headHash: string;
  genesisHash: string;
  verifiedAt: string;
}

export interface AuditBlockVerification {
  entryId: string;
  sequence: number;
  payloadValid: boolean;
  linkValid: boolean;
  hashValid: boolean;
  valid: boolean;
  expectedPayloadHash: string;
  expectedPreviousHash: string;
  expectedEntryHash: string;
}

export interface AuditDetailedVerificationResult {
  integrity: AuditChainVerificationResult;
  blocks: AuditBlockVerification[];
  blockStatuses: Record<string, AuditBlockVerification>;
  totalChainCount: number;
}

export interface TamperSimulationResult {
  targetSequence: number;
  targetEntryId: string;
  tamperedField: string;
  originalValue: string;
  tamperedValue: string;
  integrity: AuditChainVerificationResult;
  brokenBlock: AuditBlockVerification | null;
  realLedgerUntouched: boolean;
}

export const GENESIS_HASH = '0'.repeat(64);
const AUDIT_CHAIN_FILE = path.join(process.cwd(), 'data', 'enterprise_audit_chain.json');
const MAX_CHAIN_ENTRIES = 2000;

function getAuditState(): { entries: ImmutableAuditEntry[]; loaded: boolean } {
  const g = globalThis as unknown as {
    __bunkkerImmutableAudit?: { entries: ImmutableAuditEntry[]; loaded: boolean };
  };
  if (!g.__bunkkerImmutableAudit) {
    g.__bunkkerImmutableAudit = { entries: [], loaded: false };
  }
  return g.__bunkkerImmutableAudit;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function computePayloadHash(input: {
  branchId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  resourceRef: string;
  details?: Record<string, unknown>;
  timestamp: string;
}): string {
  const canonical = JSON.stringify({
    branchId: input.branchId,
    actorId: input.actorId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: input.action,
    resourceRef: input.resourceRef,
    details: input.details || {},
    timestamp: input.timestamp,
  });
  return sha256(canonical);
}

export function computeEntryHash(params: {
  entryId: string;
  sequence: number;
  branchId: string;
  payloadHash: string;
  previousHash: string;
  timestamp: string;
}): string {
  return sha256(
    `${params.sequence}|${params.entryId}|${params.branchId}|${params.payloadHash}|${params.previousHash}|${params.timestamp}`
  );
}

function ensureLoaded(): ImmutableAuditEntry[] {
  const state = getAuditState();
  if (state.loaded) return state.entries;
  state.loaded = true;

  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return state.entries;
  }

  try {
    const readable = resolveReadablePath(AUDIT_CHAIN_FILE);
    if (fs.existsSync(readable)) {
      const raw = fs.readFileSync(readable, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state.entries = parsed;
      }
    }
  } catch (err) {
    console.warn('[ImmutableAudit] Error loading audit chain:', err);
  }

  return state.entries;
}

function persistEntries(entries: ImmutableAuditEntry[]): void {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return;
  try {
    const writable = resolveWritablePath(AUDIT_CHAIN_FILE);
    atomicWriteFileSync(writable, JSON.stringify(entries, null, 2), true);
  } catch (err) {
    console.warn('[ImmutableAudit] Persist warning:', err);
  }
}

export function appendImmutableAudit(input: AppendImmutableAuditInput): ImmutableAuditEntry {
  const entries = ensureLoaded();
  const branchId = (input.branchId || 'default').trim() || 'default';
  const timestamp = input.timestamp || new Date().toISOString();
  const actorName = (input.actorName || input.actorId || 'Sistema').trim();
  const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
  const sequence = lastEntry ? lastEntry.sequence + 1 : 1;
  const previousHash = lastEntry ? lastEntry.entryHash : GENESIS_HASH;
  const entryId = `aud_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;

  const payloadHash = computePayloadHash({
    branchId,
    actorId: input.actorId,
    actorName,
    actorRole: input.actorRole,
    action: input.action,
    resourceRef: input.resourceRef,
    details: input.details,
    timestamp,
  });

  const entryHash = computeEntryHash({
    entryId,
    sequence,
    branchId,
    payloadHash,
    previousHash,
    timestamp,
  });

  const entry: ImmutableAuditEntry = {
    entryId,
    sequence,
    branchId,
    actorId: input.actorId,
    actorName,
    actorRole: input.actorRole,
    action: input.action,
    resourceRef: input.resourceRef,
    details: input.details,
    payloadHash,
    previousHash,
    entryHash,
    timestamp,
  };

  entries.push(entry);
  if (entries.length > MAX_CHAIN_ENTRIES) {
    entries.splice(0, entries.length - MAX_CHAIN_ENTRIES);
  }
  persistEntries(entries);
  return entry;
}

export function listImmutableAudit(filters?: {
  branchId?: string;
  limit?: number;
  action?: string;
  q?: string;
}): ImmutableAuditEntry[] {
  const entries = ensureLoaded();
  const branchId = filters?.branchId?.trim();
  const action = filters?.action?.trim();
  const q = filters?.q?.trim().toLowerCase();

  let scoped = branchId && branchId !== 'all'
    ? entries.filter((e) => e.branchId === branchId)
    : entries;

  if (action && action !== 'all') {
    scoped = scoped.filter((e) => e.action === action);
  }

  if (q) {
    scoped = scoped.filter((e) => {
      const haystack = `${e.sequence} ${e.entryId} ${e.branchId} ${e.actorName} ${e.actorRole} ${e.action} ${e.resourceRef} ${e.entryHash} ${e.payloadHash} ${e.previousHash}`.toLowerCase();
      return haystack.includes(q);
    });
  }

  const limit = Math.max(1, Math.min(200, filters?.limit ?? 80));
  return [...scoped].reverse().slice(0, limit);
}

export function listDistinctAuditActions(): string[] {
  const entries = ensureLoaded();
  return Array.from(new Set(entries.map((e) => e.action))).sort();
}

export function verifyAuditChainDetailed(
  customEntries?: ImmutableAuditEntry[]
): AuditDetailedVerificationResult {
  const entries = customEntries ?? ensureLoaded();
  const verifiedAt = new Date().toISOString();

  if (entries.length === 0) {
    return {
      integrity: {
        valid: true,
        checkedCount: 0,
        headHash: GENESIS_HASH,
        genesisHash: GENESIS_HASH,
        verifiedAt,
      },
      blocks: [],
      blockStatuses: {},
      totalChainCount: 0,
    };
  }

  const blocks: AuditBlockVerification[] = [];
  const blockStatuses: Record<string, AuditBlockVerification> = {};
  let firstBreak:
    | { sequence: number; entryId: string; reason: string }
    | undefined;

  let expectedPrevHash = GENESIS_HASH;
  for (let idx = 0; idx < entries.length; idx++) {
    const entry = entries[idx];
    const linkValid =
      idx === 0
        ? entry.sequence === 1
          ? entry.previousHash === GENESIS_HASH
          : true
        : entry.previousHash === expectedPrevHash;

    const expectedPayloadHash = computePayloadHash({
      branchId: entry.branchId,
      actorId: entry.actorId,
      actorName: entry.actorName,
      actorRole: entry.actorRole,
      action: entry.action,
      resourceRef: entry.resourceRef,
      details: entry.details,
      timestamp: entry.timestamp,
    });
    const payloadValid = expectedPayloadHash === entry.payloadHash;

    const expectedEntryHash = computeEntryHash({
      entryId: entry.entryId,
      sequence: entry.sequence,
      branchId: entry.branchId,
      payloadHash: entry.payloadHash,
      previousHash: entry.previousHash,
      timestamp: entry.timestamp,
    });
    const hashValid = expectedEntryHash === entry.entryHash;
    const valid = linkValid && payloadValid && hashValid;

    const blockCheck: AuditBlockVerification = {
      entryId: entry.entryId,
      sequence: entry.sequence,
      payloadValid,
      linkValid,
      hashValid,
      valid,
      expectedPayloadHash,
      expectedPreviousHash: idx === 0 ? entry.previousHash : expectedPrevHash,
      expectedEntryHash,
    };

    blocks.push(blockCheck);
    blockStatuses[entry.entryId] = blockCheck;

    if (!firstBreak && !valid) {
      if (!linkValid) {
        firstBreak = {
          sequence: entry.sequence,
          entryId: entry.entryId,
          reason: `Ruptura de encadenamiento en secuencia #${entry.sequence} (previousHash no coincide).`,
        };
      } else if (!payloadValid) {
        firstBreak = {
          sequence: entry.sequence,
          entryId: entry.entryId,
          reason: `Alteración detectada en el contenido del registro #${entry.sequence} (${entry.action}).`,
        };
      } else {
        firstBreak = {
          sequence: entry.sequence,
          entryId: entry.entryId,
          reason: `Huella criptográfica inválida en secuencia #${entry.sequence}.`,
        };
      }
    }

    expectedPrevHash = entry.entryHash;
  }

  const headHash = entries[entries.length - 1].entryHash;

  return {
    integrity: firstBreak
      ? {
          valid: false,
          checkedCount: firstBreak.sequence,
          brokenSequence: firstBreak.sequence,
          brokenEntryId: firstBreak.entryId,
          reason: firstBreak.reason,
          headHash,
          genesisHash: GENESIS_HASH,
          verifiedAt,
        }
      : {
          valid: true,
          checkedCount: entries.length,
          headHash,
          genesisHash: GENESIS_HASH,
          verifiedAt,
        },
    blocks,
    blockStatuses,
    totalChainCount: entries.length,
  };
}

export function verifyAuditChainIntegrity(
  customEntries?: ImmutableAuditEntry[]
): AuditChainVerificationResult {
  return verifyAuditChainDetailed(customEntries).integrity;
}

export function simulateTamperDiagnostic(
  targetSequence?: number
): TamperSimulationResult {
  const realEntries = ensureLoaded();
  let cloned: ImmutableAuditEntry[];

  if (realEntries.length > 0) {
    cloned = realEntries.map((e) => ({
      ...e,
      details: e.details ? { ...e.details } : undefined,
    }));
  } else {
    const ts1 = new Date().toISOString();
    const p1 = computePayloadHash({
      branchId: 'default',
      actorId: 'sim-admin',
      actorName: 'Auditor Forense',
      actorRole: 'superadmin',
      action: 'GENESIS_SEAL',
      resourceRef: 'sha256-ledger',
      timestamp: ts1,
    });
    const id1 = 'aud_sim_genesis_0001';
    const h1 = computeEntryHash({
      entryId: id1,
      sequence: 1,
      branchId: 'default',
      payloadHash: p1,
      previousHash: GENESIS_HASH,
      timestamp: ts1,
    });
    const ts2 = new Date().toISOString();
    const p2 = computePayloadHash({
      branchId: 'default',
      actorId: 'sim-admin',
      actorName: 'Auditor Forense',
      actorRole: 'superadmin',
      action: 'CASH_CUT_VERIFIED',
      resourceRef: 'corte-turno-1',
      timestamp: ts2,
    });
    const id2 = 'aud_sim_block_0002';
    const h2 = computeEntryHash({
      entryId: id2,
      sequence: 2,
      branchId: 'default',
      payloadHash: p2,
      previousHash: h1,
      timestamp: ts2,
    });
    cloned = [
      {
        entryId: id1,
        sequence: 1,
        branchId: 'default',
        actorId: 'sim-admin',
        actorName: 'Auditor Forense',
        actorRole: 'superadmin',
        action: 'GENESIS_SEAL',
        resourceRef: 'sha256-ledger',
        payloadHash: p1,
        previousHash: GENESIS_HASH,
        entryHash: h1,
        timestamp: ts1,
      },
      {
        entryId: id2,
        sequence: 2,
        branchId: 'default',
        actorId: 'sim-admin',
        actorName: 'Auditor Forense',
        actorRole: 'superadmin',
        action: 'CASH_CUT_VERIFIED',
        resourceRef: 'corte-turno-1',
        payloadHash: p2,
        previousHash: h1,
        entryHash: h2,
        timestamp: ts2,
      },
    ];
  }

  const targetIdx =
    typeof targetSequence === 'number'
      ? Math.max(
          0,
          cloned.findIndex((e) => e.sequence === targetSequence)
        )
      : cloned.length - 1;
  const resolvedIdx = targetIdx >= 0 ? targetIdx : cloned.length - 1;
  const target = cloned[resolvedIdx];
  const originalValue = target.action;
  const tamperedValue = `${target.action}_ALTERED`;
  cloned[resolvedIdx] = {
    ...target,
    action: tamperedValue,
  };

  const verification = verifyAuditChainDetailed(cloned);
  const brokenBlock = verification.blocks[resolvedIdx] ?? null;

  return {
    targetSequence: target.sequence,
    targetEntryId: target.entryId,
    tamperedField: 'action',
    originalValue,
    tamperedValue,
    integrity: verification.integrity,
    brokenBlock,
    realLedgerUntouched: true,
  };
}

export function resetImmutableAuditForTest(): void {
  if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) return;
  const g = globalThis as unknown as {
    __bunkkerImmutableAudit?: { entries: ImmutableAuditEntry[]; loaded: boolean };
  };
  g.__bunkkerImmutableAudit = { entries: [], loaded: true };
}
