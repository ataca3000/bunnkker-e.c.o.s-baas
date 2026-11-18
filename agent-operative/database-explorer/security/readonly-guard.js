'use strict';

const ALLOWED_PRAGMAS = new Set([
  'table_info',
  'table_xinfo',
  'foreign_key_list',
  'index_list',
  'index_info',
  'database_list',
  'query_only',
]);

const MUTATION_KEYWORDS_REGEX =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|TRUNCATE|ATTACH|DETACH|VACUUM|REINDEX|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i;

const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Valida estrictamente nombres de tabla o índice antes de usarlos en sentencias PRAGMA.
 */
function assertSafeIdentifier(identifier) {
  if (typeof identifier !== 'string' || !IDENTIFIER_REGEX.test(identifier)) {
    throw new Error(`[ReadOnlyGuard] Identificador SQLite inseguro o inválido: "${String(identifier)}"`);
  }
  return identifier;
}

/**
 * Verifica que toda sentencia ejecutada por el explorador sea estrictamente de solo lectura.
 */
function assertReadOnlySql(sql) {
  if (typeof sql !== 'string' || !sql.trim()) {
    throw new Error('[ReadOnlyGuard] Sentencia SQL vacía.');
  }

  const normalized = sql.trim();

  // Bloquear múltiples sentencias separadas por punto y coma
  const withoutTrailingSemi = normalized.replace(/;+$/, '');
  if (withoutTrailingSemi.includes(';')) {
    throw new Error('[ReadOnlyGuard] Múltiples sentencias SQL no están permitidas en modo explorador.');
  }

  // Bloquear palabras clave de escritura o DDL (fuera de comentarios simples)
  const upper = withoutTrailingSemi.toUpperCase();
  if (upper.startsWith('PRAGMA ')) {
    const pragmaMatch = /^PRAGMA\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\(|=|$)/i.exec(withoutTrailingSemi);
    const pragmaName = pragmaMatch ? pragmaMatch[1].toLowerCase() : '';
    if (!ALLOWED_PRAGMAS.has(pragmaName)) {
      throw new Error(`[ReadOnlyGuard] PRAGMA no autorizado en modo solo lectura: "${pragmaName}"`);
    }
    if (pragmaName === 'query_only' && !/^PRAGMA\s+query_only\s*(?:=\s*(?:ON|1|TRUE))?$/i.test(withoutTrailingSemi)) {
      throw new Error('[ReadOnlyGuard] No está permitido desactivar PRAGMA query_only.');
    }
    return normalized;
  }

  if (MUTATION_KEYWORDS_REGEX.test(withoutTrailingSemi)) {
    throw new Error('[ReadOnlyGuard] Operación de escritura o DDL bloqueada por política Phase 1 Solo Lectura.');
  }

  if (!/^(SELECT|WITH|EXPLAIN\s+QUERY\s+PLAN)\b/i.test(withoutTrailingSemi)) {
    throw new Error('[ReadOnlyGuard] Solo se permiten consultas SELECT / WITH / PRAGMA de introspección.');
  }

  return normalized;
}

/**
 * Valida mediante PRAGMA query_only que la sesión SQLite abierta esté efectivamente protegida contra escrituras.
 */
function verifyReadOnlyConnection(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('[ReadOnlyGuard] Instancia de base de datos inválida.');
  }
  const row = db.prepare('PRAGMA query_only').get();
  const isQueryOnly = row && (row.query_only === 1 || row.query_only === true || row.query_only === '1');
  if (!isQueryOnly) {
    db.exec('PRAGMA query_only = ON;');
    const recheck = db.prepare('PRAGMA query_only').get();
    if (!recheck || (recheck.query_only !== 1 && recheck.query_only !== true)) {
      throw new Error('[ReadOnlyGuard] No fue posible garantizar PRAGMA query_only = ON en la conexión.');
    }
  }
  return true;
}

module.exports = {
  ALLOWED_PRAGMAS,
  assertReadOnlySql,
  assertSafeIdentifier,
  verifyReadOnlyConnection,
};
