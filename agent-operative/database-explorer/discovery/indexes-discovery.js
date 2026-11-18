'use strict';

const { safeQuery } = require('../connection/database-connection');
const { assertSafeIdentifier } = require('../security/readonly-guard');

/**
 * Descubre índices vía PRAGMA index_list, PRAGMA index_info y sqlite_master.
 */
function discoverIndexes(db, tables) {
  const masterRows = safeQuery(
    db,
    `SELECT name, tbl_name, sql
     FROM sqlite_master
     WHERE type = 'index'
       AND name NOT LIKE 'sqlite_autoindex_%'
     ORDER BY tbl_name ASC, name ASC`
  );

  const sqlByIndexName = new Map();
  for (const r of masterRows) {
    sqlByIndexName.set(String(r.name), r.sql ? String(r.sql) : null);
  }

  const indexes = [];
  const seen = new Set();

  for (const table of tables) {
    const safeTable = assertSafeIdentifier(table.name);
    const idxRows = safeQuery(db, `PRAGMA index_list("${safeTable}")`);

    for (const idx of idxRows) {
      const idxName = String(idx.name);
      const isAutoIndex = idxName.startsWith('sqlite_autoindex_');
      let columns = [];

      if (/^[a-zA-Z0-9_]+$/.test(idxName)) {
        try {
          const safeIdx = assertSafeIdentifier(idxName);
          const colRows = safeQuery(db, `PRAGMA index_info("${safeIdx}")`);
          columns = colRows
            .sort((a, b) => Number(a.seqno || 0) - Number(b.seqno || 0))
            .map((c) => String(c.name || ''))
            .filter(Boolean);
        } catch {
          columns = [];
        }
      }

      const key = `${table.name}:${idxName}`;
      if (seen.has(key)) continue;
      seen.add(key);

      indexes.push({
        name: idxName,
        tableName: table.name,
        unique: Boolean(idx.unique),
        origin: String(idx.origin || (isAutoIndex ? 'u' : 'c')),
        partial: Boolean(idx.partial),
        isAutoIndex,
        columns,
        sql: sqlByIndexName.get(idxName) || null,
      });
    }
  }

  return indexes;
}

module.exports = {
  discoverIndexes,
};
