import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import middleware from '../middleware';
import { signRole } from '../lib/apiAuth';

describe('RBAC Login & Redirection Flow', () => {

  const buildRequestWithRole = (pathname: string, role: string, uid: string): NextRequest => {
    const url = new URL(`http://localhost:3000${pathname}`);
    const req = new NextRequest(url, {
      headers: {
        host: 'localhost:3000'
      }
    });
    
    // Set matching cookie signatures for the role & uid
    const sig = signRole(role, uid);
    req.cookies.set('msj-session', uid);
    req.cookies.set('msj-role', role);
    req.cookies.set('msj-role-sig', sig);
    
    return req;
  };

  describe('Unified worker dashboard entry', () => {
    it.each(['inventory', 'sales', 'billing', 'driver', 'pickup', 'mostrador', 'repartidor'])(
      'keeps %s in the role-aware mirror dashboard',
      async (role) => {
        const res = await middleware(buildRequestWithRole('/dashboard', role, `${role}-123`));

        expect(res.status).toBe(200);
        expect(res.headers.get('x-tenant-id')).toBe('default');
        expect(res.headers.get('location')).toBeNull();
      },
    );

    it('sends marketing directly to its canonical module', async () => {
      const res = await middleware(buildRequestWithRole('/dashboard', 'marketing', 'mkt-123'));

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard/marketing');
    });

    it('sends customer sessions to their own portal, not the staff dashboard', async () => {
      const res = await middleware(buildRequestWithRole('/dashboard', 'client', 'client-123'));

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/cuenta');
    });

    it('fails closed for roles without a dashboard assignment', async () => {
      const res = await middleware(buildRequestWithRole('/dashboard', 'unassigned', 'unknown-123'));

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login?error=unauthorized');
    });
  });

  describe('Protected Route Access Checks', () => {
    
    it('should allow superadmin to access any dashboard path', async () => {
      const req = buildRequestWithRole('/dashboard/users', 'superadmin', 'admin-001');
      const res = await middleware(req);
      
      expect(res).toBeDefined();
      // Should not redirect, should return next response (status 200 or header configuration)
      expect(res.status).toBe(200);
      expect(res.headers.get('x-tenant-id')).toBe('default');
    });

    it('should block unauthorized worker from accessing restricted sections', async () => {
      // Inventory worker trying to access users list
      const req = buildRequestWithRole('/dashboard/users', 'inventory', 'inv-123');
      const res = await middleware(req);
      
      expect(res).toBeDefined();
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login?error=unauthorized');
    });

    it('should block worker trying to access an unrelated dashboard section', async () => {
      const req = buildRequestWithRole('/dashboard/audit', 'sales', 'sales-123');
      const res = await middleware(req);

      expect(res).toBeDefined();
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login?error=unauthorized');
    });

    it('does not grant access to routes that only share a path prefix', async () => {
      const req = buildRequestWithRole('/dashboard/sales-history', 'sales', 'sales-456');
      const res = await middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login?error=unauthorized');
    });
  });

  describe('Unauthenticated Redirection', () => {
    it('should redirect unauthenticated users to /login', async () => {
      const req = new NextRequest(new URL('http://localhost:3000/dashboard'), {
        headers: {
          host: 'localhost:3000'
        }
      });
      const res = await middleware(req);
      
      expect(res).toBeDefined();
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/login?redirect=%2Fdashboard');
    });
  });
});
