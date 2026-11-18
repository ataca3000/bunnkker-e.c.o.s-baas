'use strict';

const { safeQuery } = require('../connection/database-connection');
const { assertSafeIdentifier } = require('../security/readonly-guard');

/**
 * Descubre claves foráneas declaradas en cada tabla vía PRAGMA foreign_key_list.
 */
function discoverRelations(db, tables) {
  const relations = [];

  for (const table of tables) {
    const safeName = assertSafeIdentifier(table.name);
    const fkRows = safeQuery(db, `PRAGMA foreign_key_list("${safeName}")`);

    for (const fk of fkRows) {
      relations.push({
        id: Number(fk.id || 0),
        seq: Number(fk.seq || 0),
        fromTable: table.name,
        fromColumn: String(fk.from || ''),
        toTable: String(fk.table || ''),
        toColumn: String(fk.to || 'id'),
        onUpdate: String(fk.on_update || 'NO ACTION'),
        onDelete: String(fk.on_delete || 'NO ACTION'),
        match: String(fk.match || 'NONE'),
      });
    }
  }

  return relations;
}

module.exports = {
  discoverRelations,
};
