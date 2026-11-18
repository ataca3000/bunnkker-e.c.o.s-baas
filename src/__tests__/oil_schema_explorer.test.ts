import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { NextRequest } from 'next/server';
import { signRole } from '@/lib/apiAuth';
import { GET, POST } from '@/app/api/oil/schema-explorer/route';

interface SqliteDbLike {
  exec: (sql: string) => void;
  close: () => void;
}

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string, opts?: { readOnly?: boolean }) => SqliteDbLike;
};
const guard = req('../../agent-operative/database-explorer/security/readonly-guard.js') as {
  assertReadOnlySql: (sql: string) => string;
  assertSafeIdentifier: (id: string) => string;
  verifyReadOnlyConnection: (db: SqliteDbLike) => boolean;
};
const { openReadOnlyConnection } = req(
  '../../agent-operative/database-explorer/connection/database-connection.js'
) as {
  openReadOnlyConnection: (opts?: Record<string, unknown>) => {
    db: SqliteDbLike;
    sourceMode: string;
    sourceLocation: string;
    close: () => void;
  };
};
const { exploreDatabaseSchema } = req('../../agent-operative/database-explorer/index.js') as {
  exploreDatabaseSchema: (opts?: Record<string, unknown>) => {
    source: { mode: string; location: string };
    summary: {
      tablesCount: number;
      viewsCount: number;
      relationsCount: number;
      logicalLinksCount: number;
      explicitIndexesCount: number;
      indexesCount: number;
      triggersCount: number;
      auditTablesCount: number;
      modulesCount: number;
    };
    modules: Array<{ id: string; name: string; tables: string[] }>;
    tables: Array<{
      name: string;
      primaryKeys: string[];
      columns: Array<{ name: string; type: string }>;
      foreignKeys: Array<{ column: string; targetTable: string; targetColumn: string }>;
      semantic: { primaryModule: string; isAuditTable: boolean; hasTenantIsolation: boolean };
    }>;
    views: Array<{ name: string }>;
    triggers: Array<{ name: string; tableName: string }>;
  };
};

function makeAuthenticatedRequest(
  url: string,
  method: 'GET' | 'POST',
  role: string,
  uid = 'oil-test-user',
  tenantId = 'default'
) {
  const sig = signRole(role, uid, tenantId);
  const request = new NextRequest(url, {
    method,
    headers: {
      'x-tenant-id': tenantId,
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
    },
    ...(method === 'POST' ? { body: JSON.stringify({ writeCatalog: false }) } : {}),
  });
  request.cookies.set('msj-session', uid);
  request.cookies.set('msj-role', role);
  request.cookies.set('msj-role-sig', sig);
  return request;
}

describe('BUNKKER OIL Fase 1 — Database Schema Explorer (Solo Lectura)', () => {
  it('bloquea mutaciones SQL, múltiples sentencias, PRAGMAs de escritura e identificadores inseguros', () => {
    expect(() => guard.assertReadOnlySql('DELETE FROM User')).toThrow();
    expect(() => guard.assertReadOnlySql('INSERT INTO Product (id) VALUES ("1")')).toThrow();
    expect(() => guard.assertReadOnlySql('UPDATE "Order" SET status = "CANCELLED"')).toThrow();
    expect(() => guard.assertReadOnlySql('DROP TABLE AuditLog')).toThrow();
    expect(() => guard.assertReadOnlySql('SELECT * FROM User; DROP TABLE User;')).toThrow();
    expect(() => guard.assertReadOnlySql('PRAGMA journal_mode = WAL')).toThrow();
    expect(() => guard.assertReadOnlySql('PRAGMA query_only = OFF')).toThrow();
    expect(() => guard.assertSafeIdentifier('Order; DROP TABLE User')).toThrow();

    expect(guard.assertSafeIdentifier('AuditLog')).toBe('AuditLog');
    expect(guard.assertReadOnlySql('SELECT name FROM sqlite_master')).toContain('SELECT');
    expect(guard.assertReadOnlySql('PRAGMA table_info("Order")')).toContain('PRAGMA');
  });

  it('inspecciona un archivo SQLite real (.db) con tablas, FKs, índices, vistas y triggers sin permitir escrituras', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bunkker-oil-test-'));
    const tempDbPath = path.join(tempDir, 'bunkker_test.db');

    const writerDb = new DatabaseSync(tempDbPath);
    writerDb.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE Customer (
        id TEXT PRIMARY KEY,
        tenantId TEXT NOT NULL,
        name TEXT NOT NULL
      );
      CREATE TABLE SaleOrder (
        id TEXT PRIMARY KEY,
        tenantId TEXT NOT NULL,
        customerId TEXT NOT NULL,
        status TEXT NOT NULL,
        total REAL NOT NULL,
        FOREIGN KEY (customerId) REFERENCES Customer(id) ON DELETE RESTRICT
      );
      CREATE TABLE AuditEntry (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_saleorder_customer ON SaleOrder(customerId);
      CREATE VIEW v_active_sales AS
        SELECT id, customerId, total FROM SaleOrder WHERE status != 'CANCELLED';
      CREATE TRIGGER trg_saleorder_audit AFTER INSERT ON SaleOrder
      BEGIN
        INSERT INTO AuditEntry (id, action) VALUES (NEW.id, 'SALE_CREATED');
      END;
    `);
    writerDb.close();

    try {
      const conn = openReadOnlyConnection({
        dbPath: tempDbPath,
        allowPrismaSchemaMirror: false,
      });
      try {
        expect(conn.sourceMode).toBe('sqlite_file');
        expect(() => conn.db.exec("INSERT INTO Customer (id, tenantId, name) VALUES ('c1', 't1', 'X')")).toThrow();
      } finally {
        conn.close();
      }

      const catalog = exploreDatabaseSchema({
        dbPath: tempDbPath,
        allowPrismaSchemaMirror: false,
        writeCatalog: false,
      });

      expect(catalog.source.mode).toBe('sqlite_file');
      expect(catalog.summary.tablesCount).toBe(3);
      expect(catalog.summary.viewsCount).toBe(1);
      expect(catalog.summary.triggersCount).toBe(1);
      expect(catalog.summary.relationsCount).toBe(1);
      expect(catalog.summary.explicitIndexesCount).toBeGreaterThanOrEqual(1);
      expect(catalog.views.map((v) => v.name)).toContain('v_active_sales');
      expect(catalog.triggers.map((t) => t.name)).toContain('trg_saleorder_audit');

      const saleOrder = catalog.tables.find((t) => t.name === 'SaleOrder');
      expect(saleOrder).toBeDefined();
      expect(saleOrder?.foreignKeys[0]).toMatchObject({
        column: 'customerId',
        targetTable: 'Customer',
        targetColumn: 'id',
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('descubre el esquema espejo de BUNKKER (14 tablas, 7 módulos y 5 tablas de auditoría)', () => {
    const catalog = exploreDatabaseSchema({ writeCatalog: false });

    expect(catalog.summary.tablesCount).toBe(14);
    expect(catalog.summary.modulesCount).toBe(7);
    expect(catalog.summary.auditTablesCount).toBe(5);
    expect(catalog.summary.relationsCount).toBeGreaterThanOrEqual(4);

    const tableNames = catalog.tables.map((t) => t.name);
    for (const expectedTable of ['User', 'Product', 'Order', 'OrderItem', 'AuditLog', 'Customer']) {
      expect(tableNames).toContain(expectedTable);
    }

    const auditLog = catalog.tables.find((t) => t.name === 'AuditLog');
    expect(auditLog?.semantic.isAuditTable).toBe(true);
    expect(auditLog?.semantic.hasTenantIsolation).toBe(true);
  });

  it('protege /api/oil/schema-explorer con RBAC estricto (401 anónimo, 403 sales, 200 admin/superadmin)', async () => {
    const unauthRes = await GET(new NextRequest('http://localhost:3000/api/oil/schema-explorer'));
    expect(unauthRes.status).toBe(401);

    const salesRes = await GET(
      makeAuthenticatedRequest('http://localhost:3000/api/oil/schema-explorer', 'GET', 'sales')
    );
    expect(salesRes.status).toBe(403);

    const superAdminRes = await GET(
      makeAuthenticatedRequest('http://localhost:3000/api/oil/schema-explorer', 'GET', 'superadmin')
    );
    expect(superAdminRes.status).toBe(200);
    const superJson = await superAdminRes.json();
    expect(superJson.success).toBe(true);
    expect(superJson.data.summary.tablesCount).toBe(14);

    const adminPostRes = await POST(
      makeAuthenticatedRequest('http://localhost:3000/api/oil/schema-explorer', 'POST', 'admin')
    );
    expect(adminPostRes.status).toBe(200);
    const adminJson = await adminPostRes.json();
    expect(adminJson.success).toBe(true);
    expect(adminJson.data.modules.length).toBe(7);
  });
});
