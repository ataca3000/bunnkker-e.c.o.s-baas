import { describe, expect, it } from 'vitest';
import { canAccessDashboardPath, getRoleLandingPath } from '../lib/dashboardRouting';

describe('dashboard role routing', () => {
  it.each(['sales', 'caja', 'billing', 'inventory', 'almacen', 'bodega', 'carga_descarga', 'carga', 'patio', 'driver', 'delivery', 'repartidor', 'chofer', 'pickup', 'mostrador'])(
    'keeps %s in the unified operational dashboard',
    (role) => {
      expect(getRoleLandingPath(role)).toBe('/dashboard');
      expect(canAccessDashboardPath(role, '/dashboard')).toBe(true);
    },
  );

  it('sends marketing directly to the canonical marketing module', () => {
    expect(getRoleLandingPath('marketing')).toBe('/dashboard/marketing');
    expect(getRoleLandingPath('marketing', '/dashboard/design')).toBe('/dashboard/marketing?tab=studio');
  });

  it('honors a requested route only when that role is allowed to use it', () => {
    expect(getRoleLandingPath('sales', '/dashboard/crm')).toBe('/dashboard/crm');
    expect(getRoleLandingPath('sales', '/dashboard/audit')).toBe('/dashboard');
    expect(getRoleLandingPath('admin', '/dashboard/audit')).toBe('/dashboard/audit');
  });

  it('rejects external, malformed, and prefix-collision redirects', () => {
    expect(getRoleLandingPath('sales', 'https://example.com/dashboard/sales')).toBe('/dashboard');
    expect(getRoleLandingPath('sales', '//example.com/dashboard/sales')).toBe('/dashboard');
    expect(getRoleLandingPath('sales', '/dashboard/sales-archive')).toBe('/dashboard');
    expect(canAccessDashboardPath('sales', '/dashboard/sales-archive')).toBe(false);
  });

  it('keeps customer accounts and unknown roles outside the staff dashboard', () => {
    expect(getRoleLandingPath('client', '/dashboard')).toBe('/cuenta');
    expect(getRoleLandingPath('unassigned')).toBeNull();
    expect(canAccessDashboardPath('unassigned', '/dashboard')).toBe(false);
  });
});
