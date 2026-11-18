'use strict';

const { safeQuery } = require('../connection/database-connection');
const { assertSafeIdentifier } = require('../security/readonly-guard');

/**
 * Descubre columnas, tipos, nulabilidad, claves primarias y columnas ocultas
 * combinando PRAGMA table_info y PRAGMA table_xinfo.
 */
function discoverColumns(db, tablesAndViews) {
  const columnsByTable = {};

  for (const entity of tablesAndViews) {
    const safeName = assertSafeIdentifier(entity.name);
    const basicCols = safeQuery(db, `PRAGMA table_info("${safeName}")`);
    let extendedCols = [];
    try {
      extendedCols = safeQuery(db, `PRAGMA table_xinfo("${safeName}")`);
    } catch {
      extendedCols = [];
    }

    const xInfoByName = new Map();
    for (const xc of extendedCols) {
      xInfoByName.set(String(xc.name), {
        hidden: Number(xc.hidden || 0),
      });
    }

    const merged = (extendedCols.length > 0 ? extendedCols : basicCols).map((col) => {
      const colName = String(col.name);
      const xMeta = xInfoByName.get(colName);
      return {
        cid: Number(col.cid),
        name: colName,
        type: String(col.type || 'ANY'),
        notNull: Boolean(col.notnull),
        defaultValue: col.dflt_value !== undefined && col.dflt_value !== null ? String(col.dflt_value) : null,
        primaryKey: Number(col.pk || 0) > 0,
        primaryKeyOrder: Number(col.pk || 0),
        hidden: xMeta ? xMeta.hidden : Number(col.hidden || 0),
      };
    });

    columnsByTable[entity.name] = merged;
  }

  return columnsByTable;
}

module.exports = {
  discoverColumns,
};
