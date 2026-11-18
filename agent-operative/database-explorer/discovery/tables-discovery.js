'use strict';

const { safeQuery } = require('../connection/database-connection');

/**
 * Descubre tablas físicas y vistas SQL usando sqlite_master sin modificar nada.
 */
function discoverTablesAndViews(db) {
  const rows = safeQuery(
    db,
    `SELECT type, name, tbl_name, rootpage, sql
     FROM sqlite_master
     WHERE type IN ('table', 'view')
       AND name NOT LIKE 'sqlite_%'
     ORDER BY type ASC, name ASC`
  );

  const tables = [];
  const views = [];

  for (const row of rows) {
    const entry = {
      name: String(row.name),
      type: row.type === 'view' ? 'view' : 'table',
      tableName: String(row.tbl_name || row.name),
      rootpage: Number(row.rootpage || 0),
      sql: row.sql ? String(row.sql) : null,
    };
    if (entry.type === 'view') {
      views.push(entry);
    } else {
      tables.push(entry);
    }
  }

  return { tables, views };
}

module.exports = {
  discoverTablesAndViews,
};
