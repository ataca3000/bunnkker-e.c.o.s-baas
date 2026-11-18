'use strict';

const { buildModulesCatalog, detectModuleForTable } = require('./module-detector');
const { mapRelationships } = require('./relationship-mapper');

function analyzeSchema({
  sourceMode,
  sourceLocation,
  tables,
  views,
  columnsByTable,
  relations,
  indexes,
  triggers,
}) {
  const indexesByTable = {};
  for (const idx of indexes) {
    if (!indexesByTable[idx.tableName]) indexesByTable[idx.tableName] = [];
    indexesByTable[idx.tableName].push(idx);
  }

  const triggersByTable = {};
  for (const trg of triggers) {
    if (!triggersByTable[trg.tableName]) triggersByTable[trg.tableName] = [];
    triggersByTable[trg.tableName].push(trg);
  }

  const relationships = mapRelationships(tables, relations, columnsByTable);

  const enrichedTables = tables.map((table) => {
    const columns = columnsByTable[table.name] || [];
    const tableIndexes = indexesByTable[table.name] || [];
    const tableTriggers = triggersByTable[table.name] || [];
    const outboundFks = relationships.outboundByTable[table.name] || [];
    const inboundFks = relationships.inboundByTable[table.name] || [];
    const semantic = detectModuleForTable(table.name, columns);

    return {
      name: table.name,
      type: table.type,
      columnCount: columns.length,
      primaryKeys: columns.filter((c) => c.primaryKey).map((c) => c.name),
      columns,
      indexes: tableIndexes,
      triggers: tableTriggers,
      foreignKeys: outboundFks,
      referencedBy: inboundFks,
      semantic,
    };
  });

  const enrichedViews = views.map((view) => ({
    name: view.name,
    type: 'view',
    columns: columnsByTable[view.name] || [],
    sql: view.sql,
  }));

  const modules = buildModulesCatalog(enrichedTables);
  const auditTables = enrichedTables.filter((t) => t.semantic.isAuditTable).map((t) => t.name);
  const tablesWithoutTenantId = enrichedTables
    .filter((t) => !t.semantic.hasTenantIsolation)
    .map((t) => t.name);

  const generatedAt = new Date().toISOString();

  const summary = {
    tablesCount: enrichedTables.length,
    viewsCount: enrichedViews.length,
    relationsCount: relations.length,
    logicalLinksCount: relationships.logicalLinks.length,
    indexesCount: indexes.length,
    explicitIndexesCount: indexes.filter((i) => !i.isAutoIndex).length,
    triggersCount: triggers.length,
    auditTablesCount: auditTables.length,
    modulesCount: modules.length,
  };

  return {
    schemaVersion: '1.0.0',
    phase: 'OIL Phase 1 — Read-Only Database Schema Explorer',
    readOnly: true,
    generatedAt,
    source: {
      mode: sourceMode,
      location: sourceLocation,
    },
    summary,
    modules,
    auditTables,
    tablesWithoutTenantId,
    tables: enrichedTables,
    views: enrichedViews,
    relations,
    logicalLinks: relationships.logicalLinks,
    indexes,
    triggers,
    auditCorrelationChains: relationships.auditCorrelationChains,
  };
}

function renderCatalogMarkdown(catalog) {
  const lines = [];
  lines.push('# BUNKKER OIL — Catálogo de Esquema de Base de Datos (Fase 1 Solo Lectura)');
  lines.push('');
  lines.push(`- **Generado:** ${catalog.generatedAt}`);
  lines.push(`- **Modo de Fuente:** \`${catalog.source.mode}\``);
  lines.push(`- **Origen:** \`${catalog.source.location}\``);
  lines.push(`- **Protección:** \`readOnly: true\` / \`PRAGMA query_only = ON\``);
  lines.push('');
  lines.push('## Resumen de Introspección');
  lines.push('');
  lines.push('| Métrica | Cantidad |');
  lines.push('| :--- | ---: |');
  lines.push(`| Tablas detectadas | ${catalog.summary.tablesCount} |`);
  lines.push(`| Relaciones FK declaradas | ${catalog.summary.relationsCount} |`);
  lines.push(`| Enlaces semánticos detectados | ${catalog.summary.logicalLinksCount} |`);
  lines.push(`| Índices detectados | ${catalog.summary.indexesCount} |`);
  lines.push(`| Vistas detectadas | ${catalog.summary.viewsCount} |`);
  lines.push(`| Triggers detectados | ${catalog.summary.triggersCount} |`);
  lines.push(`| Tablas de auditoría e historial | ${catalog.summary.auditTablesCount} |`);
  lines.push(`| Módulos funcionales mapeados | ${catalog.summary.modulesCount} |`);
  lines.push('');
  lines.push('## Catálogo de Módulos');
  lines.push('');
  for (const mod of catalog.modules) {
    lines.push(`### ${mod.name}`);
    lines.push(`- **Propósito:** ${mod.purpose}`);
    lines.push(`- **Tablas:** ${mod.tables.map((t) => `\`${t}\``).join(', ')}`);
    if (mod.auditTables.length > 0) {
      lines.push(`- **Auditoría/Trazabilidad:** ${mod.auditTables.map((t) => `\`${t}\``).join(', ')}`);
    }
    lines.push('');
  }

  lines.push('## Detalle de Tablas y Columnas');
  lines.push('');
  for (const tbl of catalog.tables) {
    lines.push(`### \`${tbl.name}\` (${tbl.semantic.primaryModuleName})`);
    lines.push(
      `- **PK:** ${tbl.primaryKeys.join(', ') || 'N/A'} · **Multi-tenant:** ${tbl.semantic.hasTenantIsolation ? 'Sí (`tenantId`)' : 'Global'} · **Auditoría:** ${tbl.semantic.isAuditTable ? 'Sí' : 'No'}`
    );
    if (tbl.foreignKeys.length > 0) {
      lines.push(
        `- **Relaciones salientes:** ${tbl.foreignKeys.map((fk) => `\`${fk.column}\` → \`${fk.targetTable}.${fk.targetColumn}\` (ON DELETE ${fk.onDelete})`).join('; ')}`
      );
    }
    lines.push('');
    lines.push('| Columna | Tipo SQLite | Nulo | PK | Default |');
    lines.push('| :--- | :--- | :---: | :---: | :--- |');
    for (const col of tbl.columns) {
      lines.push(
        `| \`${col.name}\` | \`${col.type}\` | ${col.notNull ? 'NO' : 'SÍ'} | ${col.primaryKey ? 'PK' : ''} | ${col.defaultValue ? `\`${col.defaultValue}\`` : ''} |`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = {
  analyzeSchema,
  renderCatalogMarkdown,
};
