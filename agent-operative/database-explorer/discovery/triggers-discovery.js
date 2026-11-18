'use strict';

const { safeQuery } = require('../connection/database-connection');

/**
 * Descubre triggers SQLite declarados en sqlite_master sin modificar datos.
 */
function discoverTriggers(db) {
  const rows = safeQuery(
    db,
    `SELECT name, tbl_name, sql
     FROM sqlite_master
     WHERE type = 'trigger'
     ORDER BY tbl_name ASC, name ASC`
  );

  return rows.map((row) => ({
    name: String(row.name),
    tableName: String(row.tbl_name || ''),
    sql: row.sql ? String(row.sql) : null,
  }));
}

module.exports = {
  discoverTriggers,
};
