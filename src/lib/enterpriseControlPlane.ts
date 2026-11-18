import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { atomicWriteFileSync, resolveReadablePath, resolveWritablePath } from './atomicFs';
import { getCapabilitiesForRole, type EnterpriseCapability } from './enterpriseRbac';

/**
 * enterpriseControlPlane.ts — Plano de Control Multi-Sucursal, Sesiones Revocables y Centro Unificado de Alertas
 */

export type BranchStatus = 'online' | 'degraded' | 'offline';
export type BranchIsolationMode = 'isolated_local_first' | 'cloud_mirror';
export type SubscriptionTier = 'TRIAL' | 'STARTER' | 'PRO' | 'ENTERPRISE';

export interface BranchNode {
  branchId: string;
  name: string;
  code: string;
  region: string;
  timezone: string;
  status: BranchStatus;
  isolationMode: BranchIsolationMode;
  schemaVersion: string;
  pendingSyncCount: number;
  lastHeartbeatAt: string;
  lastReplicationAt: string;
  todaySales: number;
  todayOrders: number;
  activeAlerts: number;
  latencyMs: number;
  subscriptionTier: SubscriptionTier;
  isPrimaryLocal: boolean;
}

export interface SessionRecord {
  sessionId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  branchId: string;
  role: string;
  capabilities: EnterpriseCapability[];
  provider: 'google_sso' | 'terminal_pin';
  deviceId?: string;
  issuedAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt?: string;
  revokedBy?: string;
}

export type UnifiedAlertCategory = 'stock' | 'order' | 'security' | 'sync';
export type UnifiedAlertSeverity = 'info' | 'warning' | 'critical';

export interface UnifiedAlertEvent {
  alertId: string;
  branchId: string;
  branchName: string;
  category: UnifiedAlertCategory;
  severity: UnifiedAlertSeverity;
  title: string;
  detail: string;
  targetUrl: string;
  createdAt: string;
}

interface ControlPlaneState {
  branches: BranchNode[];
  sessions: SessionRecord[];
  loaded: boolean;
}

const CONTROL_PLANE_FILE = path.join(process.cwd(), 'data', 'enterprise_control_plane.json');
const MAX_SESSIONS = 400;

function getState(): ControlPlaneState {
  const g = globalThis as unknown as { __bunkkerControlPlane?: ControlPlaneState };
  if (!g.__bunkkerControlPlane) {
    g.__bunkkerControlPlane = {
      branches: [],
      sessions: [],
      loaded: false,
    };
  }
  return g.__bunkkerControlPlane;
}

function sanitizeBranchId(raw: string): string {
  return (
    raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || `sucursal-${Date.now().toString(36)}`
  );
}

function defaultPrimaryBranch(): BranchNode {
  const now = new Date().toISOString();
  return {
    branchId: 'default',
    name: 'Sucursal Matriz Local',
    code: 'MTZ-01',
    region: 'México Centro (Nodo Primario)',
    timezone: 'America/Mexico_City',
    status: 'online',
    isolationMode: 'isolated_local_first',
    schemaVersion: '2026.11-ecos',
    pendingSyncCount: 0,
    lastHeartbeatAt: now,
    lastReplicationAt: now,
    todaySales: 0,
    todayOrders: 0,
    activeAlerts: 0,
    latencyMs: 4,
    subscriptionTier: 'PRO',
    isPrimaryLocal: true,
  };
}

function ensureLoaded(): ControlPlaneState {
  const state = getState();
  if (state.loaded) {
    if (state.branches.length === 0) {
      state.branches.push(defaultPrimaryBranch());
    }
    return state;
  }

  state.loaded = true;
  if (!(process.env.NODE_ENV === 'test' || process.env.VITEST)) {
    try {
      const readable = resolveReadablePath(CONTROL_PLANE_FILE);
      if (fs.existsSync(readable)) {
        const parsed = JSON.parse(fs.readFileSync(readable, 'utf-8'));
        if (parsed && Array.isArray(parsed.branches)) {
          state.branches = parsed.branches;
        }
        if (parsed && Array.isArray(parsed.sessions)) {
          state.sessions = parsed.sessions;
        }
      }
    } catch (err) {
      console.warn('[ControlPlane] Error loading state:', err);
    }
  }

  if (state.branches.length === 0) {
    state.branches.push(defaultPrimaryBranch());
  }

  return state;
}

function persistState(state: ControlPlaneState): void {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return;
  try {
    const writable = resolveWritablePath(CONTROL_PLANE_FILE);
    atomicWriteFileSync(
      writable,
      JSON.stringify({ branches: state.branches, sessions: state.sessions }, null, 2),
      true
    );
  } catch (err) {
    console.warn('[ControlPlane] Persist error:', err);
  }
}

// ── 1. Multi-Branch Isolated Registry ────────────────────────────────────────

export async function hydratePrimaryBranchFromDb(prismaClient?: any): Promise<BranchNode> {
  const state = ensureLoaded();
  let primary = state.branches.find((b) => b.branchId === 'default');
  if (!primary) {
    primary = defaultPrimaryBranch();
    state.branches.unshift(primary);
  }

  try {
    const db = prismaClient || (await import('./prisma')).prisma;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [orders, pendingSync, products, appCfg] = await Promise.all([
      db.order.findMany({ where: { tenantId: 'default' } }).catch(() => []),
      db.syncQueue.count({ where: { tenantId: 'default', status: { in: ['PENDING', 'FAILED'] } } }).catch(() => 0),
      db.product.findMany({ where: { tenantId: 'default', deletedAt: null } }).catch(() => []),
      db.appConfig.findUnique({ where: { id: 'global' } }).catch(() => null),
    ]);

    let todaySales = 0;
    let todayOrders = 0;
    for (const o of orders) {
      if (o.status === 'cancelled' || o.status === 'rejected') continue;
      const d = o.date ? new Date(o.date) : null;
      if (d && d >= todayStart) {
        todayOrders += 1;
        todaySales += Number(o.total || 0);
      }
    }

    const lowStockAlerts = products.filter((p: any) => Number(p.stock || 0) <= Number(p.minStock ?? 5)).length;
    primary.todaySales = Math.round(todaySales * 100) / 100;
    primary.todayOrders = todayOrders;
    primary.pendingSyncCount = Number(pendingSync || 0);
    primary.activeAlerts = lowStockAlerts + (pendingSync > 0 ? 1 : 0);
    primary.lastHeartbeatAt = new Date().toISOString();
    primary.status = pendingSync > 12 ? 'degraded' : 'online';
    if (appCfg?.licenseType && ['TRIAL', 'STARTER', 'PRO', 'ENTERPRISE'].includes(appCfg.licenseType)) {
      primary.subscriptionTier = appCfg.licenseType as SubscriptionTier;
    }
    persistState(state);
  } catch {
    // Fallback gracefully without throwing
  }

  return primary;
}

export async function listBranchNodes(prismaClient?: any): Promise<BranchNode[]> {
  await hydratePrimaryBranchFromDb(prismaClient);
  const state = ensureLoaded();
  return state.branches.map((b) => ({ ...b }));
}

export function getBranchNode(branchId: string): BranchNode | null {
  const state = ensureLoaded();
  const found = state.branches.find((b) => b.branchId === branchId);
  return found ? { ...found } : null;
}

export function createBranchNode(input: {
  name: string;
  branchId?: string;
  code?: string;
  region?: string;
  timezone?: string;
  isolationMode?: BranchIsolationMode;
  subscriptionTier?: SubscriptionTier;
}): BranchNode {
  const state = ensureLoaded();
  const branchId = sanitizeBranchId(input.branchId || input.name);
  const existing = state.branches.find((b) => b.branchId === branchId);
  if (existing) {
    throw new Error(`Ya existe un nodo registrado con identificador "${branchId}".`);
  }

  const now = new Date().toISOString();
  const node: BranchNode = {
    branchId,
    name: input.name.trim(),
    code: (input.code || `SUC-${String(state.branches.length + 1).padStart(2, '0')}`).toUpperCase(),
    region: (input.region || 'México · Nodo Autónomo').trim(),
    timezone: (input.timezone || 'America/Mexico_City').trim(),
    status: 'online',
    isolationMode: input.isolationMode || 'isolated_local_first',
    schemaVersion: '2026.11-ecos',
    pendingSyncCount: 0,
    lastHeartbeatAt: now,
    lastReplicationAt: now,
    todaySales: 0,
    todayOrders: 0,
    activeAlerts: 0,
    latencyMs: 18,
    subscriptionTier: input.subscriptionTier || 'PRO',
    isPrimaryLocal: false,
  };

  state.branches.push(node);
  persistState(state);
  return { ...node };
}

export function recordBranchHeartbeat(
  branchId: string,
  patch?: Partial<Pick<BranchNode, 'status' | 'pendingSyncCount' | 'todaySales' | 'todayOrders' | 'latencyMs' | 'activeAlerts'>>
): BranchNode {
  const state = ensureLoaded();
  const node = state.branches.find((b) => b.branchId === branchId);
  if (!node) {
    throw new Error(`Sucursal "${branchId}" no encontrada.`);
  }
  const now = new Date().toISOString();
  node.lastHeartbeatAt = now;
  if (patch?.status) node.status = patch.status;
  if (typeof patch?.pendingSyncCount === 'number') node.pendingSyncCount = Math.max(0, patch.pendingSyncCount);
  if (typeof patch?.todaySales === 'number') node.todaySales = Math.max(0, patch.todaySales);
  if (typeof patch?.todayOrders === 'number') node.todayOrders = Math.max(0, patch.todayOrders);
  if (typeof patch?.latencyMs === 'number') node.latencyMs = Math.max(1, patch.latencyMs);
  if (typeof patch?.activeAlerts === 'number') node.activeAlerts = Math.max(0, patch.activeAlerts);
  persistState(state);
  return { ...node };
}

export async function syncBranchNode(branchId: string, prismaClient?: any): Promise<BranchNode> {
  const state = ensureLoaded();
  const node = state.branches.find((b) => b.branchId === branchId);
  if (!node) {
    throw new Error(`Sucursal "${branchId}" no encontrada.`);
  }

  const now = new Date().toISOString();
  if (branchId === 'default') {
    try {
      const db = prismaClient || (await import('./prisma')).prisma;
      await db.syncQueue.updateMany({
        where: { tenantId: 'default', status: { in: ['PENDING', 'FAILED'] } },
        data: { status: 'SYNCED', errorMsg: null },
      });
    } catch {
      // Ignore if queue unavailable
    }
  }

  node.pendingSyncCount = 0;
  node.status = 'online';
  node.lastHeartbeatAt = now;
  node.lastReplicationAt = now;
  persistState(state);
  return { ...node };
}

export function updateBranchSubscriptionTier(branchId: string, tier: SubscriptionTier): BranchNode {
  const state = ensureLoaded();
  const node = state.branches.find((b) => b.branchId === branchId);
  if (!node) {
    throw new Error(`Sucursal "${branchId}" no encontrada.`);
  }
  node.subscriptionTier = tier;
  persistState(state);
  return { ...node };
}

// ── 2. Revocable Session Registry (Entra ID / Cloud IAM Pattern) ─────────────

export function issueSessionRecord(input: {
  sessionId?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  branchId?: string;
  role: string;
  provider: 'google_sso' | 'terminal_pin';
  deviceId?: string;
  ttlHours?: number;
}): SessionRecord {
  const state = ensureLoaded();
  const nowMs = Date.now();
  const ttlMs = (input.ttlHours ?? 24) * 60 * 60 * 1000;

  const record: SessionRecord = {
    sessionId: input.sessionId || `jti_${crypto.randomUUID().replace(/-/g, '')}`,
    userId: input.userId,
    userName: (input.userName || input.userId).trim(),
    userEmail: input.userEmail,
    branchId: (input.branchId || 'default').trim() || 'default',
    role: input.role,
    capabilities: getCapabilitiesForRole(input.role),
    provider: input.provider,
    deviceId: input.deviceId,
    issuedAt: new Date(nowMs).toISOString(),
    lastSeenAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + ttlMs).toISOString(),
  };

  state.sessions.unshift(record);
  if (state.sessions.length > MAX_SESSIONS) {
    state.sessions.splice(MAX_SESSIONS);
  }
  persistState(state);
  return { ...record };
}

export function findSessionRecord(sessionId: string): SessionRecord | null {
  if (!sessionId) return null;
  const state = ensureLoaded();
  return state.sessions.find((s) => s.sessionId === sessionId) || null;
}

export function isSessionRevoked(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  const record = findSessionRecord(sessionId);
  if (!record) {
    // Si tiene formato de jti corporativo y fue purgado o nunca existió después de emisión, solo revocar si está explícitamente marcado o expirado.
    return false;
  }
  if (record.revokedAt) return true;
  if (new Date(record.expiresAt).getTime() <= Date.now()) return true;
  return false;
}

export function isSessionActive(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  const record = findSessionRecord(sessionId);
  if (!record) return false;
  if (record.revokedAt) return false;
  return new Date(record.expiresAt).getTime() > Date.now();
}

export function touchSessionRecord(sessionId: string): void {
  const state = ensureLoaded();
  const record = state.sessions.find((s) => s.sessionId === sessionId);
  if (!record || record.revokedAt) return;
  record.lastSeenAt = new Date().toISOString();
}

export function revokeSessionRecord(sessionId: string, revokedBy: string): SessionRecord | null {
  const state = ensureLoaded();
  const record = state.sessions.find((s) => s.sessionId === sessionId);
  if (!record) return null;
  if (!record.revokedAt) {
    record.revokedAt = new Date().toISOString();
    record.revokedBy = revokedBy;
    persistState(state);
  }
  return { ...record };
}

export function listSessions(filters?: { branchId?: string; includeRevoked?: boolean }): SessionRecord[] {
  const state = ensureLoaded();
  const branchId = filters?.branchId?.trim();
  const includeRevoked = filters?.includeRevoked ?? true;
  return state.sessions
    .filter((s) => {
      if (branchId && branchId !== 'all' && s.branchId !== branchId) return false;
      if (!includeRevoked && (s.revokedAt || new Date(s.expiresAt).getTime() <= Date.now())) return false;
      return true;
    })
    .map((s) => ({ ...s }));
}

// ── 3. Unified Enterprise Alert Aggregator ───────────────────────────────────

export async function buildEnterpriseAlerts(
  branchId?: string,
  prismaClient?: any
): Promise<UnifiedAlertEvent[]> {
  const branches = await listBranchNodes(prismaClient);
  const branchNameById = new Map(branches.map((b) => [b.branchId, b.name]));
  const alerts: UnifiedAlertEvent[] = [];

  try {
    const db = prismaClient || (await import('./prisma')).prisma;
    const products = await db.product.findMany({ where: { tenantId: 'default', deletedAt: null } }).catch(() => []);
    for (const p of products) {
      const stock = Number(p.stock || 0);
      const minStock = Number(p.minStock ?? 5);
      if (stock <= 0) {
        alerts.push({
          alertId: `stock-zero-${p.id}`,
          branchId: 'default',
          branchName: branchNameById.get('default') || 'Sucursal Matriz Local',
          category: 'stock',
          severity: 'critical',
          title: `Sin stock: ${p.name}`,
          detail: `Existencia en 0 unidades (Estante ${p.estante || 'N/A'}). Requiere reposición inmediata.`,
          targetUrl: '/dashboard/inventory',
          createdAt: new Date().toISOString(),
        });
      } else if (stock <= minStock) {
        alerts.push({
          alertId: `stock-low-${p.id}`,
          branchId: 'default',
          branchName: branchNameById.get('default') || 'Sucursal Matriz Local',
          category: 'stock',
          severity: 'warning',
          title: `Stock bajo: ${p.name}`,
          detail: `Quedan ${stock} unidad(es) (mínimo recomendado ${minStock}).`,
          targetUrl: '/dashboard/inventory',
          createdAt: new Date().toISOString(),
        });
      }
    }

    const orders = await db.order.findMany({ where: { tenantId: 'default' } }).catch(() => []);
    const pendingCashier = orders.filter((o: any) => o.status === 'pending_cashier' || o.status === 'pending');
    if (pendingCashier.length > 0) {
      alerts.push({
        alertId: `orders-cashier-queue`,
        branchId: 'default',
        branchName: branchNameById.get('default') || 'Sucursal Matriz Local',
        category: 'order',
        severity: 'warning',
        title: `${pendingCashier.length} pedido(s) esperando caja / validación`,
        detail: `Órdenes capturadas en tienda o terminal pendientes de confirmar cobro.`,
        targetUrl: '/dashboard/sales',
        createdAt: new Date().toISOString(),
      });
    }

    const readyForDispatch = orders.filter((o: any) => o.status === 'ready_for_pickup' || o.status === 'preparing');
    if (readyForDispatch.length > 0) {
      alerts.push({
        alertId: `orders-dispatch-queue`,
        branchId: 'default',
        branchName: branchNameById.get('default') || 'Sucursal Matriz Local',
        category: 'order',
        severity: 'info',
        title: `${readyForDispatch.length} pedido(s) en surtido / mostrador`,
        detail: `Coordina preparación en Patio o entrega en Pickup Express.`,
        targetUrl: '/dashboard/patio',
        createdAt: new Date().toISOString(),
      });
    }
  } catch {
    // Non-fatal fallback
  }

  for (const branch of branches) {
    if (branch.pendingSyncCount > 0 || branch.status !== 'online') {
      alerts.push({
        alertId: `sync-branch-${branch.branchId}`,
        branchId: branch.branchId,
        branchName: branch.name,
        category: 'sync',
        severity: branch.status === 'offline' ? 'critical' : 'warning',
        title: `Replicación pendiente en ${branch.name}`,
        detail: `${branch.pendingSyncCount} eventos en cola · Estado: ${branch.status}`,
        targetUrl: '/dashboard/enterprise',
        createdAt: branch.lastHeartbeatAt,
      });
    }
  }

  const state = ensureLoaded();
  const recentRevocations = state.sessions.filter((s) => Boolean(s.revokedAt)).slice(0, 5);
  for (const rev of recentRevocations) {
    alerts.push({
      alertId: `sec-revoked-${rev.sessionId}`,
      branchId: rev.branchId,
      branchName: branchNameById.get(rev.branchId) || rev.branchId,
      category: 'security',
      severity: 'info',
      title: `Sesión revocada: ${rev.userName} (${rev.role})`,
      detail: `Expulsada por ${rev.revokedBy || 'administrador'} el ${new Date(rev.revokedAt!).toLocaleString('es-MX')}.`,
      targetUrl: '/dashboard/enterprise',
      createdAt: rev.revokedAt!,
    });
  }

  const filtered = branchId && branchId !== 'all'
    ? alerts.filter((a) => a.branchId === branchId)
    : alerts;

  const weight: Record<UnifiedAlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return filtered.sort((a, b) => weight[a.severity] - weight[b.severity]);
}

export function resetControlPlaneForTest(): void {
  if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) return;
  const g = globalThis as unknown as { __bunkkerControlPlane?: ControlPlaneState };
  g.__bunkkerControlPlane = {
    branches: [defaultPrimaryBranch()],
    sessions: [],
    loaded: true,
  };
}
