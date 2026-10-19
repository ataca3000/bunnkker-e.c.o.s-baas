import { describe, expect, it } from 'vitest';

import { grants } from './use-authorization';
import { isModuleVisible } from './use-navigation';
import {
  EMPTY_CONTEXT,
  normalizeContext,
  normalizePermission,
  type AuthorizationContext,
} from './types';

const ctx = (over: Partial<AuthorizationContext>): AuthorizationContext => ({
  ...EMPTY_CONTEXT,
  ...over,
});

describe('normalizePermission', () => {
  it('lowercases and snake-cases PascalCase segments', () => {
    expect(normalizePermission('Inventory.Products.ViewCost')).toBe('inventory.products.view_cost');
    expect(normalizePermission('sales.orders.view')).toBe('sales.orders.view');
  });
});

describe('grants', () => {
  it('system users are granted everything', () => {
    expect(grants([], true, 'anything.at.all')).toBe(true);
  });
  it('non-system users need the (normalised) permission', () => {
    expect(grants(['inventory.products.view'], false, 'Inventory.Products.View')).toBe(true);
    expect(grants(['inventory.products.view'], false, 'inventory.products.delete')).toBe(false);
  });
});

describe('normalizeContext', () => {
  it('maps the backend DTO into the in-memory context', () => {
    const c = normalizeContext({
      is_system: false,
      permissions: ['sales.orders.view'],
      visibility: { hidden_fields: ['cost'] },
      scopes: { 'sales.orders': 'self' },
      navigation: ['commerce'],
      landing_page: 'orders',
    });
    expect(c.permissions).toContain('sales.orders.view');
    expect(c.hiddenFields).toContain('cost');
    expect(c.scopes['sales.orders']).toBe('self');
    expect(c.navigation).toEqual(['commerce']);
    expect(c.landingPage).toBe('orders');
  });
  it('is safe against an absent payload', () => {
    expect(normalizeContext(undefined)).toEqual(EMPTY_CONTEXT);
  });
});

describe('isModuleVisible (dynamic sidebar)', () => {
  it('system users see every module', () => {
    const c = ctx({ isSystem: true });
    expect(isModuleVisible('finance', c)).toBe(true);
    expect(isModuleVisible('engineering', c)).toBe(true);
  });

  it('dashboard is always visible', () => {
    expect(isModuleVisible('dashboard', ctx({}))).toBe(true);
  });

  it('a template navigation whitelist is authoritative', () => {
    const c = ctx({ navigation: ['inventory', 'operations'] });
    expect(isModuleVisible('inventory', c)).toBe(true);
    expect(isModuleVisible('operations', c)).toBe(true);
    // Not in the whitelist → hidden, even with a matching permission.
    expect(
      isModuleVisible(
        'finance',
        ctx({ navigation: ['inventory'], permissions: ['finance.periods.view'] }),
      ),
    ).toBe(false);
  });

  it('falls back to permission-domain matching when no whitelist', () => {
    const c = ctx({ permissions: ['inventory.products.view'] });
    expect(isModuleVisible('inventory', c)).toBe(true);
    expect(isModuleVisible('marketing', c)).toBe(false);
  });

  it('respects org feature flags (disabled feature hides the module)', () => {
    const c = ctx({ navigation: ['finance'], featureFlags: { accounting: false } });
    expect(isModuleVisible('finance', c)).toBe(false);
  });

  it('the executive board follows the whitelist, not the permissions behind it', () => {
    // The C-level templates carry `executive`; no other template does. A user
    // holding every domain permission the board reads still cannot see it
    // unless their template lists it — the whitelist is authoritative.
    const cLevel = ctx({ navigation: ['dashboard', 'executive', 'finance'] });
    expect(isModuleVisible('executive', cLevel)).toBe(true);

    const director = ctx({
      navigation: ['dashboard', 'finance', 'reports'],
      permissions: ['finance.reports.view', 'crm.executive.view'],
    });
    expect(isModuleVisible('executive', director)).toBe(false);
  });

  it('without a whitelist the executive board needs a domain it actually reads', () => {
    expect(isModuleVisible('executive', ctx({ permissions: ['finance.reports.view'] }))).toBe(true);
    expect(isModuleVisible('executive', ctx({ permissions: ['hr.employees.view'] }))).toBe(false);
  });

  it('a restricted user sees strictly fewer modules than a system user', () => {
    const restricted = ctx({ navigation: ['inventory', 'operations'] });
    const visible = ['dashboard', 'inventory', 'operations', 'finance', 'marketing', 'crm'].filter(
      (m) => isModuleVisible(m, restricted),
    );
    expect(visible.sort()).toEqual(['dashboard', 'inventory', 'operations']);
  });
});
