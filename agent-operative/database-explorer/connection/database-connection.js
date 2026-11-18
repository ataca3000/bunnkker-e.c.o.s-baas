'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { assertReadOnlySql, verifyReadOnlyConnection } = require('../security/readonly-guard');

function resolveSqlitePath(explicitDbPath) {
  const candidates = [];

  if (explicitDbPath && typeof explicitDbPath === 'string' && explicitDbPath.trim()) {
    candidates.push(explicitDbPath.trim());
  }

  const envUrl = process.env.DATABASE_URL || '';
  if (envUrl.startsWith('file:')) {
    const rawPath = envUrl.slice('file:'.length).split('?')[0];
    if (rawPath) {
      candidates.push(path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), 'prisma', rawPath));
      candidates.push(path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath));
    }
  }

  const root = process.cwd();
  candidates.push(
    path.join(root, 'prisma', 'dev.db'),
    path.join(root, 'prisma', 'bunkker.db'),
    path.join(root, 'data', 'bunkker.db'),
    path.join(root, 'bunkker.db')
  );

  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Continuar con el siguiente candidato
    }
  }

  return null;
}

function mapPrismaScalarToSqliteType(prismaType) {
  const clean = prismaType.replace(/[?[\]]/g, '');
  switch (clean) {
    case 'Int':
    case 'BigInt':
    case 'Boolean':
      return 'INTEGER';
    case 'Float':
    case 'Decimal':
      return 'REAL';
    case 'Bytes':
      return 'BLOB';
    case 'DateTime':
      return 'DATETIME';
    case 'String':
    default:
      return 'TEXT';
  }
}

function formatSqliteDefault(prismaType, attrsText) {
  if (!attrsText) return '';
  if (/@default\(now\(\)\)/.test(attrsText)) return "DEFAULT CURRENT_TIMESTAMP";
  if (/@default\(true\)/.test(attrsText)) return 'DEFAULT 1';
  if (/@default\(false\)/.test(attrsText)) return 'DEFAULT 0';
  const numMatch = /@default\((-?\d+(?:\.\d+)?)\)/.exec(attrsText);
  if (numMatch) return `DEFAULT ${numMatch[1]}`;
  const strMatch = /@default\("([^"]*)"\)/.exec(attrsText);
  if (strMatch) return `DEFAULT '${strMatch[1].replace(/'/g, "''")}'`;
  if (prismaType.startsWith('Boolean')) return 'DEFAULT 0';
  return '';
}

/**
 * Construye sentencias DDL SQLite fieles a prisma/schema.sqlite.prisma para entornos
 * donde aún no existe un archivo .db físico en disco (p. ej. sandbox nube).
 */
function buildDdlFromPrismaSchema(schemaPath) {
  const content = fs.readFileSync(schemaPath, 'utf8');
  const modelRegex = /model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)\n\}/g;
  const models = new Map();

  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    models.set(match[1], match[2]);
  }

  const statements = [];
  const viewAndTriggerNotes = [];

  for (const [modelName, body] of models.entries()) {
    const lines = body
      .split(/\r?\n/)
      .map((l) => l.replace(/\/\/.*$/, '').trim())
      .filter(Boolean);

    const colsSql = [];
    const foreignKeysSql = [];
    const uniqueSql = [];
    const indexSql = [];

    for (const line of lines) {
      if (line.startsWith('@@unique')) {
        const colsMatch = /\[\[?([^\]]+)\]/.exec(line);
        if (colsMatch) {
          const cols = colsMatch[1]
            .split(',')
            .map((c) => `"${c.trim()}"`)
            .join(', ');
          uniqueSql.push(`UNIQUE (${cols})`);
        }
        continue;
      }

      if (line.startsWith('@@index')) {
        const colsMatch = /\[([^\]]+)\]/.exec(line);
        if (colsMatch) {
          const cols = colsMatch[1]
            .split(',')
            .map((c) => c.trim());
          const idxName = `idx_${modelName}_${cols.join('_')}`;
          indexSql.push(
            `CREATE INDEX IF NOT EXISTS "${idxName}" ON "${modelName}" (${cols.map((c) => `"${c}"`).join(', ')});`
          );
        }
        continue;
      }

      if (line.startsWith('@@')) continue;

      const fieldMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*[\[\]?]*)(.*)$/.exec(line);
      if (!fieldMatch) continue;

      const [, fieldName, fieldType, attrsText] = fieldMatch;
      const baseType = fieldType.replace(/[?[\]]/g, '');

      // Relación ORM
      if (models.has(baseType)) {
        const relMatch = /@relation\(([^)]*)\)/.exec(attrsText);
        if (relMatch) {
          const relArgs = relMatch[1];
          const fieldsPart = /fields:\s*\[([^\]]+)\]/.exec(relArgs);
          const refsPart = /references:\s*\[([^\]]+)\]/.exec(relArgs);
          if (fieldsPart && refsPart) {
            const localCols = fieldsPart[1].split(',').map((c) => `"${c.trim()}"`).join(', ');
            const refCols = refsPart[1].split(',').map((c) => `"${c.trim()}"`).join(', ');
            const onDeleteMatch = /onDelete:\s*(Cascade|SetNull|Restrict|NoAction)/i.exec(relArgs);
            const onDeleteClause = onDeleteMatch
              ? ` ON DELETE ${onDeleteMatch[1].toUpperCase() === 'SETNULL' ? 'SET NULL' : onDeleteMatch[1].toUpperCase()}`
              : '';
            foreignKeysSql.push(
              `FOREIGN KEY (${localCols}) REFERENCES "${baseType}" (${refCols})${onDeleteClause}`
            );
          }
        }
        continue;
      }

      const isNullable = fieldType.endsWith('?');
      const sqliteType = mapPrismaScalarToSqliteType(fieldType);
      const isPk = /@id\b/.test(attrsText);
      const isUnique = /@unique\b/.test(attrsText);
      const defClause = formatSqliteDefault(fieldType, attrsText);

      const parts = [`"${fieldName}"`, sqliteType];
      if (isPk) parts.push('PRIMARY KEY');
      if (!isNullable && !isPk) parts.push('NOT NULL');
      if (isUnique && !isPk) parts.push('UNIQUE');
      if (defClause) parts.push(defClause);

      colsSql.push(parts.join(' '));
    }

    const tableParts = [...colsSql, ...uniqueSql, ...foreignKeysSql];
    statements.push(`CREATE TABLE IF NOT EXISTS "${modelName}" (\n  ${tableParts.join(',\n  ')}\n);`);
    statements.push(...indexSql);
  }

  return { statements, notes: viewAndTriggerNotes };
}

function findPrismaSchemaPath(explicitSchemaPath) {
  const root = process.cwd();
  const candidates = [
    explicitSchemaPath,
    path.join(root, 'prisma', 'schema.sqlite.prisma'),
    path.join(root, 'prisma', 'schema.prisma'),
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return p;
    }
  }
  return null;
}

/**
 * Abre una conexión SQLite estrictamente en modo solo lectura.
 * Si existe un archivo .db físico, se abre con `{ readOnly: true }`.
 * Si no existe y `allowPrismaSchemaMirror !== false`, construye un espejo `:memory:` desde Prisma
 * y lo bloquea inmediatamente con `PRAGMA query_only = ON` para introspección SQLite nativa real.
 */
function openReadOnlyConnection(options = {}) {
  const resolvedFile = resolveSqlitePath(options.dbPath);

  if (resolvedFile) {
    const db = new DatabaseSync(resolvedFile, { readOnly: true });
    db.exec('PRAGMA query_only = ON;');
    verifyReadOnlyConnection(db);
    return {
      db,
      sourceMode: 'sqlite_file',
      sourceLocation: resolvedFile,
      close: () => {
        try {
          db.close();
        } catch {}
      },
    };
  }

  if (options.allowPrismaSchemaMirror === false) {
    throw new Error('No se encontró archivo SQLite (.db) y allowPrismaSchemaMirror está desactivado.');
  }

  const schemaPath = findPrismaSchemaPath(options.prismaSchemaPath);
  if (!schemaPath) {
    throw new Error('No se encontró base SQLite ni esquema Prisma para inicializar la introspección.');
  }

  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  const { statements } = buildDdlFromPrismaSchema(schemaPath);
  for (const stmt of statements) {
    db.exec(stmt);
  }

  // Bloqueo irreversible de solo lectura tras compilar el esquema espejo en RAM
  db.exec('PRAGMA query_only = ON;');
  verifyReadOnlyConnection(db);

  return {
    db,
    sourceMode: 'prisma_sqlite_mirror',
    sourceLocation: schemaPath,
    close: () => {
      try {
        db.close();
      } catch {}
    },
  };
}

/**
 * Ejecuta consultas pasando siempre por el guardia de solo lectura.
 */
function safeQuery(db, sql, params = []) {
  const validatedSql = assertReadOnlySql(sql);
  const stmt = db.prepare(validatedSql);
  return Array.isArray(params) && params.length > 0 ? stmt.all(...params) : stmt.all();
}

module.exports = {
  resolveSqlitePath,
  buildDdlFromPrismaSchema,
  findPrismaSchemaPath,
  openReadOnlyConnection,
  safeQuery,
};
