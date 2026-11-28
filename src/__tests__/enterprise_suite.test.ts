import { beforeEach, describe, expect, it } from 'vitest';
import { buildTodayVsYesterdaySummary } from '@/lib/executiveAnalytics';
import { getCapabilitiesForRole, hasCapability } from '@/lib/enterpriseRbac';
import {
  appendImmutableAudit,
  resetImmutableAuditForTest,
  simulateTamperDiagnostic,
  verifyAuditChainDetailed,
  verifyAuditChainIntegrity,
} from '@/lib/immutableAudit';
import {
  createBranchNode,
  isSessionActive,
  isSessionRevoked,
  issueSessionRecord,
  recordBranchHeartbeat,
  resetControlPlaneForTest,
  revokeSessionRecord,
} from '@/lib/enterpriseControlPlane';
import { canAccessDashboardPath } from '@/lib/dashboardRouting';
import type { Order } from '@/lib/types';

function makeOrder(id: string, date: Date, total: number, status = 'paid'): Order {
  return {
    id,
    date: date.toISOString(),
    createdAt: date.toISOString(),
    items: [],
    total,
    paymentMethod: 'Efectivo',
    status: status as Order['status'],
    offline: false,
    synced: true,
  };
}

describe('BUNKKER Enterprise Suite & Daily Performance', () => {
  beforeEach(() => {
    resetImmutableAuditForTest();
    resetControlPlaneForTest();
  });

  it('computes Today vs Yesterday same-hour cutoff pace and full-day comparison accurately', () => {
    // Reference timestamp: Nov 18 2026, 10:30 local
    const now = new Date(2026, 10, 18, 10, 30, 0);
    const orders: Order[] = [
      makeOrder('o1', new Date(2026, 10, 18, 9, 15, 0), 1500),
      makeOrder('o2', new Date(2026, 10, 18, 10, 10, 0), 900),
      // Cancelled order should be ignored
      makeOrder('o3', new Date(2026, 10, 18, 10, 20, 0), 5000, 'cancelled'),
      // Yesterday before 10:30 cutoff
      makeOrder('y1', new Date(2026, 10, 17, 8, 45, 0), 1200),
      // Yesterday AFTER 10:30 cutoff (included in fullDay, excluded in sameHourPace)
      makeOrder('y2', new Date(2026, 10, 17, 17, 20, 0), 2800),
    ];

    const summary = buildTodayVsYesterdaySummary(orders, now);

    expect(summary.cutoffTimeLabel).toBe('10:30');
    expect(summary.sameHourPace.sales.today).toBe(2400);
    expect(summary.sameHourPace.sales.yesterday).toBe(1200);
    expect(summary.sameHourPace.sales.delta).toBe(1200);
    expect(summary.sameHourPace.benchmarkPercent).toBe(200);

    expect(summary.fullDay.sales.today).toBe(2400);
    expect(summary.fullDay.sales.yesterday).toBe(4000);
    expect(summary.fullDay.sales.delta).toBe(-1600);
    expect(summary.fullDay.benchmarkPercent).toBe(60);

    // 08:00-11:59 bucket index = 2 ('08h')
    expect(summary.intradayBuckets[2].todaySales).toBe(2400);
    expect(summary.intradayBuckets[2].yesterdaySales).toBe(1200);
    // 16:00-19:59 bucket index = 4 ('16h')
    expect(summary.intradayBuckets[4].yesterdaySales).toBe(2800);
  });

  it('enforces granular RBAC capabilities across corporate and floor roles', () => {
    expect(hasCapability('superadmin', 'branches:admin')).toBe(true);
    expect(hasCapability('admin', 'sessions:revoke')).toBe(true);
    expect(hasCapability('billing', 'workspace:export')).toBe(true);

    expect(hasCapability('sales', 'orders:write')).toBe(true);
    expect(hasCapability('sales', 'sessions:revoke')).toBe(false);
    expect(hasCapability('sales', 'branches:admin')).toBe(false);
    expect(hasCapability('driver', 'workspace:export')).toBe(false);
    expect(getCapabilitiesForRole('client')).toEqual([]);

    expect(canAccessDashboardPath('superadmin', '/dashboard/enterprise')).toBe(true);
    expect(canAccessDashboardPath('admin', '/dashboard/enterprise')).toBe(true);
    expect(canAccessDashboardPath('sales', '/dashboard/enterprise')).toBe(false);
    expect(canAccessDashboardPath('driver', '/dashboard/enterprise')).toBe(false);
  });

  it('verifies SHA-256 immutable audit chain and detects payload tampering', () => {
    const e1 = appendImmutableAudit({
      branchId: 'default',
      actorId: 'u-1',
      actorName: 'Dueño',
      actorRole: 'superadmin',
      action: 'BRANCH_CREATED',
      resourceRef: 'suc-norte',
    });
    const e2 = appendImmutableAudit({
      branchId: 'suc-norte',
      actorId: 'u-1',
      actorName: 'Dueño',
      actorRole: 'superadmin',
      action: 'SESSION_ISSUED_SSO',
      resourceRef: 'jti_abc',
    });

    expect(e2.previousHash).toBe(e1.entryHash);
    const validReport = verifyAuditChainIntegrity();
    expect(validReport.valid).toBe(true);
    expect(validReport.checkedCount).toBe(2);

    // Simulate malicious modification of second entry
    const tampered = [
      e1,
      {
        ...e2,
        action: 'TAMPERED_ACTION',
      },
    ];
    const invalidReport = verifyAuditChainIntegrity(tampered);
    expect(invalidReport.valid).toBe(false);
    expect(invalidReport.brokenSequence).toBe(2);

    // Detailed per-block verification + broken chain link detection
    const detailedOk = verifyAuditChainDetailed();
    expect(detailedOk.totalChainCount).toBe(2);
    expect(detailedOk.blockStatuses[e1.entryId].valid).toBe(true);
    expect(detailedOk.blockStatuses[e2.entryId].linkValid).toBe(true);

    const linkBroken = verifyAuditChainDetailed([
      e1,
      {
        ...e2,
        previousHash: 'f'.repeat(64),
      },
    ]);
    expect(linkBroken.integrity.valid).toBe(false);
    expect(linkBroken.blockStatuses[e2.entryId].linkValid).toBe(false);

    // Isolated forensic simulation keeps real ledger valid and untouched
    const sim = simulateTamperDiagnostic(2);
    expect(sim.realLedgerUntouched).toBe(true);
    expect(sim.integrity.valid).toBe(false);
    expect(sim.targetSequence).toBe(2);
    expect(sim.brokenBlock?.payloadValid).toBe(false);
    expect(verifyAuditChainIntegrity().valid).toBe(true);
  });

  it('manages isolated branch nodes and enforces instant session revocation', () => {
    const north = createBranchNode({
      name: 'Sucursal Norte',
      branchId: 'suc-norte',
      region: 'Monterrey',
      subscriptionTier: 'ENTERPRISE',
    });
    expect(north.branchId).toBe('suc-norte');
    expect(north.isolationMode).toBe('isolated_local_first');

    const hb = recordBranchHeartbeat('suc-norte', { todaySales: 18500, todayOrders: 14, latencyMs: 12 });
    expect(hb.todaySales).toBe(18500);
    expect(hb.todayOrders).toBe(14);

    const session = issueSessionRecord({
      userId: 'sso-owner',
      userName: 'Luis Halo',
      userEmail: 'luishalo69@gmail.com',
      branchId: 'suc-norte',
      role: 'superadmin',
      provider: 'google_sso',
    });

    expect(isSessionActive(session.sessionId)).toBe(true);
    expect(isSessionRevoked(session.sessionId)).toBe(false);

    const revoked = revokeSessionRecord(session.sessionId, 'admin-console');
    expect(revoked?.revokedAt).toBeTruthy();
    expect(isSessionActive(session.sessionId)).toBe(false);
    expect(isSessionRevoked(session.sessionId)).toBe(true);
  });
});
