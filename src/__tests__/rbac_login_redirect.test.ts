import { describe, it, expect } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
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

  describe('Worker Redirections from /dashboard', () => {
    
    it('should redirect inventory worker to /dashboard/inventory', async () => {
      const req = buildRequestWithRole('/dashboard', 'inventory', 'inv-123');
      const res = await middleware(req);
      
      expect(res).toBeDefined();
      expect(res.status).toBe(307); // Temporary redirect status
      expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard/inventory');
    });

    it('should redirect sales worker to /dashboard/sales', async () => {
      const req = buildRequestWithRole('/dashboard', 'sales', 'sales-123');
      const res = await middleware(req);
      
      expect(res).toBeDefined();
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard/sales');
    });

    it('should redirect billing worker to /dashboard/audit', async () => {
      const req = buildRequestWithRole('/dashboard', 'billing', 'bill-123');
      const res = await middleware(req);
      
      expect(res).toBeDefined();
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard/audit');
    });

    it('should redirect delivery driver to /dashboard/patio', async () => {
      const req = buildRequestWithRole('/dashboard', 'driver', 'driver-123');
      const res = await middleware(req);
      
      expect(res).toBeDefined();
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard/patio');
    });

    it('should redirect marketing worker to /dashboard/marketing', async () => {
      const req = buildRequestWithRole('/dashboard', 'marketing', 'mkt-123');
      const res = await middleware(req);
      
      expect(res).toBeDefined();
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard/marketing');
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
      // Sales worker trying to access billing audit
      const req = buildRequestWithRole('/dashboard/audit', 'sales', 'sales-123');
      const res = await middleware(req);
      
      expect(res).toBeDefined();
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
