import { describe, it, expect } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import middleware from '../middleware';
import { signRole } from '../lib/apiAuth';

describe('RBAC High Concurrency Stress Test', () => {

  const buildRequestWithRole = (pathname: string, role: string, uid: string): NextRequest => {
    const url = new URL(`http://localhost:3000${pathname}`);
    const req = new NextRequest(url, {
      headers: {
        host: 'localhost:3000'
      }
    });
    
    // Firmar la sesión correspondiente
    const sig = signRole(role, uid);
    req.cookies.set('msj-session', uid);
    req.cookies.set('msj-role', role);
    req.cookies.set('msj-role-sig', sig);
    
    return req;
  };

  it('should process 1000 concurrent requests with mixed roles without errors', async () => {
    const rolesList = ['superadmin', 'inventory', 'sales', 'billing', 'driver', 'marketing', 'client'];
    const paths = ['/dashboard', '/dashboard/inventory', '/dashboard/sales', '/dashboard/users', '/dashboard/audit', '/dashboard/patio'];
    
    const requests: NextRequest[] = [];
    
    // Generar 1000 peticiones con roles y rutas aleatorias
    for (let i = 0; i < 1000; i++) {
      const role = rolesList[Math.floor(Math.random() * rolesList.length)];
      const pathname = paths[Math.floor(Math.random() * paths.length)];
      requests.push(buildRequestWithRole(pathname, role, `user-${i}`));
    }

    console.log(`[STRESS TEST] Iniciando ejecución concurrente de 1000 peticiones en paralelo...`);
    const startTime = Date.now();
    
    // Ejecutar las 1000 peticiones de forma paralela (Promesas concurrentes)
    const responses = await Promise.all(requests.map(req => middleware(req)));
    
    const duration = Date.now() - startTime;
    console.log(`[STRESS TEST] Completado. Tiempo total para 1000 peticiones: ${duration}ms (${(duration / 1000).toFixed(3)}s)`);
    
    // Verificar que todas las peticiones devolvieron una respuesta válida (NextResponse)
    expect(responses.length).toBe(1000);
    responses.forEach((res) => {
      expect(res).toBeDefined();
      expect([200, 307]).toContain(res.status); // O pasan limpio (200) o son redirigidas (307)
    });
    
    // El rendimiento por petición debe ser excelente (menos de 5ms por petición promedio bajo concurrencia local)
    const avgTime = duration / 1000;
    console.log(`[STRESS TEST] Tiempo medio por petición en lote concurrente: ${avgTime.toFixed(2)}ms`);
    expect(avgTime).toBeLessThan(10); // Assert que es menor a 10ms promedio
  });
});
