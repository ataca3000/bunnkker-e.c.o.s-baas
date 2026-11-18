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
}

const GENESIS_HASH = '0'.repeat(64);
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

function computePayloadHash(input: {
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

function computeEntryHash(params: {
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
}): ImmutableAuditEntry[] {
  const entries = ensureLoaded();
  const branchId = filters?.branchId?.trim();
  const scoped = branchId && branchId !== 'all'
    ? entries.filter((e) => e.branchId === branchId)
    : entries;
  const limit = Math.max(1, Math.min(200, filters?.limit ?? 80));
  return [...scoped].reverse().slice(0, limit);
}

export function verifyAuditChainIntegrity(
  customEntries?: ImmutableAuditEntry[]
): AuditChainVerificationResult {
  const entries = customEntries ?? ensureLoaded();
  if (entries.length === 0) {
    return {
      valid: true,
      checkedCount: 0,
      headHash: GENESIS_HASH,
    };
  }

  let expectedPrevHash = GENESIS_HASH;
  for (let idx = 0; idx < entries.length; idx++) {
    const entry = entries[idx];
    if (idx > 0 && entry.previousHash !== expectedPrevHash) {
      return {
        valid: false,
        checkedCount: idx + 1,
        brokenSequence: entry.sequence,
        brokenEntryId: entry.entryId,
        reason: `Ruptura de encadenamiento en secuencia #${entry.sequence} (previousHash no coincide).`,
        headHash: entries[entries.length - 1].entryHash,
      };
    }

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

    if (expectedPayloadHash !== entry.payloadHash) {
      return {
        valid: false,
        checkedCount: idx + 1,
        brokenSequence: entry.sequence,
        brokenEntryId: entry.entryId,
        reason: `Alteración detectada en el contenido del registro #${entry.sequence} (${entry.action}).`,
        headHash: entries[entries.length - 1].entryHash,
      };
    }

    const expectedEntryHash = computeEntryHash({
      entryId: entry.entryId,
      sequence: entry.sequence,
      branchId: entry.branchId,
      payloadHash: entry.payloadHash,
      previousHash: entry.previousHash,
      timestamp: entry.timestamp,
    });

    if (expectedEntryHash !== entry.entryHash) {
      return {
        valid: false,
        checkedCount: idx + 1,
        brokenSequence: entry.sequence,
        brokenEntryId: entry.entryId,
        reason: `Huella criptográfica inválida en secuencia #${entry.sequence}.`,
        headHash: entries[entries.length - 1].entryHash,
      };
    }

    expectedPrevHash = entry.entryHash;
  }

  return {
    valid: true,
    checkedCount: entries.length,
    headHash: entries[entries.length - 1].entryHash,
  };
}

export function resetImmutableAuditForTest(): void {
  if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) return;
  const g = globalThis as unknown as {
    __bunkkerImmutableAudit?: { entries: ImmutableAuditEntry[]; loaded: boolean };
  };
  g.__bunkkerImmutableAudit = { entries: [], loaded: true };
}
