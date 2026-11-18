'use strict';

const fs = require('fs');
const path = require('path');
const { openReadOnlyConnection } = require('./connection/database-connection');
const { discoverTablesAndViews } = require('./discovery/tables-discovery');
const { discoverColumns } = require('./discovery/columns-discovery');
const { discoverRelations } = require('./discovery/relations-discovery');
const { discoverIndexes } = require('./discovery/indexes-discovery');
const { discoverTriggers } = require('./discovery/triggers-discovery');
const { analyzeSchema, renderCatalogMarkdown } = require('./analysis/schema-analyzer');

/**
 * Ejecuta la fase de descubrimiento completo sobre SQLite en modo estrictamente solo lectura.
 */
function exploreDatabaseSchema(options = {}) {
  const conn = openReadOnlyConnection(options);
  try {
    const { tables, views } = discoverTablesAndViews(conn.db);
    const allEntities = [...tables, ...views];
    const columnsByTable = discoverColumns(conn.db, allEntities);
    const relations = discoverRelations(conn.db, tables);
    const indexes = discoverIndexes(conn.db, tables);
    const triggers = discoverTriggers(conn.db);

    const catalog = analyzeSchema({
      sourceMode: conn.sourceMode,
      sourceLocation: conn.sourceLocation,
      tables,
      views,
      columnsByTable,
      relations,
      indexes,
      triggers,
    });

    if (options.writeCatalog) {
      const catalogDir = options.catalogDir || path.join(__dirname, 'catalog');
      fs.mkdirSync(catalogDir, { recursive: true });
      fs.writeFileSync(
        path.join(catalogDir, 'schema-catalog.json'),
        JSON.stringify(catalog, null, 2) + '\n',
        'utf8'
      );
      fs.writeFileSync(
        path.join(catalogDir, 'schema-documentation.md'),
        renderCatalogMarkdown(catalog) + '\n',
        'utf8'
      );
    }

    return catalog;
  } finally {
    conn.close();
  }
}

if (require.main === module) {
  const shouldWrite = process.argv.includes('--write');
  const catalog = exploreDatabaseSchema({ writeCatalog: shouldWrite });
  console.log(
    JSON.stringify(
      {
        source: catalog.source,
        summary: catalog.summary,
        modules: catalog.modules.map((m) => ({
          id: m.id,
          name: m.name,
          tableCount: m.tables.length,
        })),
      },
      null,
      2
    )
  );
}

module.exports = {
  exploreDatabaseSchema,
  renderCatalogMarkdown,
};
