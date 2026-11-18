'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Database,
  GitBranch,
  KeyRound,
  Layers,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Table2,
} from 'lucide-react';

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: string | null;
  primaryKey: boolean;
}

interface ForeignKeyInfo {
  column: string;
  targetTable: string;
  targetColumn: string;
  onDelete: string;
}

interface IndexInfo {
  name: string;
  tableName: string;
  unique: boolean;
  isAutoIndex: boolean;
  columns: string[];
}

interface DiscoveredTable {
  name: string;
  type: string;
  columnCount: number;
  primaryKeys: string[];
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  foreignKeys: ForeignKeyInfo[];
  referencedBy: Array<{ sourceTable: string; sourceColumn: string; column: string }>;
  semantic: {
    primaryModule: string;
    primaryModuleName: string;
    purpose: string;
    isAuditTable: boolean;
    hasTenantIsolation: boolean;
  };
}

interface ModuleCatalogItem {
  id: string;
  name: string;
  purpose: string;
  tables: string[];
  auditTables: string[];
}

interface SchemaCatalogPayload {
  generatedAt: string;
  readOnly: boolean;
  source: { mode: string; location: string };
  summary: {
    tablesCount: number;
    viewsCount: number;
    relationsCount: number;
    logicalLinksCount: number;
    indexesCount: number;
    triggersCount: number;
    auditTablesCount: number;
    modulesCount: number;
  };
  modules: ModuleCatalogItem[];
  tables: DiscoveredTable[];
  auditCorrelationChains: Array<{ name: string; steps: string[] }>;
}

export default function DatabaseSchemaExplorerPanel() {
  const [catalog, setCatalog] = useState<SchemaCatalogPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTableName, setSelectedTableName] = useState<string>('Order');

  const loadCatalog = useCallback(async (forceRescan = false) => {
    if (forceRescan) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetch('/api/oil/schema-explorer', {
        method: forceRescan ? 'POST' : 'GET',
        credentials: 'include',
        headers: forceRescan ? { 'Content-Type': 'application/json' } : undefined,
        body: forceRescan ? JSON.stringify({ writeCatalog: false }) : undefined,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'No se pudo cargar la introspección de base de datos.');
      }
      const nextCatalog = json.data as SchemaCatalogPayload;
      setCatalog(nextCatalog);
      if (nextCatalog.tables?.length > 0) {
        setSelectedTableName((prev) =>
          nextCatalog.tables.some((t) => t.name === prev) ? prev : nextCatalog.tables[0].name
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error consultando el explorador de esquema.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog(false);
  }, [loadCatalog]);

  const filteredTables = useMemo(() => {
    if (!catalog?.tables) return [];
    const q = searchQuery.trim().toLowerCase();
    return catalog.tables.filter((tbl) => {
      if (selectedModule !== 'ALL' && tbl.semantic.primaryModule !== selectedModule) {
        return false;
      }
      if (!q) return true;
      if (tbl.name.toLowerCase().includes(q)) return true;
      if (tbl.semantic.primaryModuleName.toLowerCase().includes(q)) return true;
      return tbl.columns.some((c) => c.name.toLowerCase().includes(q));
    });
  }, [catalog, selectedModule, searchQuery]);

  const activeTable = useMemo(() => {
    if (filteredTables.length === 0) return null;
    return filteredTables.find((t) => t.name === selectedTableName) || filteredTables[0];
  }, [filteredTables, selectedTableName]);

  if (loading && !catalog) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-6 space-y-4">
        <div className="h-6 w-64 rounded bg-slate-800 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-20 rounded-lg bg-slate-900 border border-slate-800 animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-lg bg-slate-900 border border-slate-800 animate-pulse" />
      </div>
    );
  }

  if (error && !catalog) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-slate-950 p-6 text-sm text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-white">No se pudo ejecutar el explorador OIL Fase 1</p>
          <p className="text-xs text-rose-300 mt-1">{error}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadCatalog(false)}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!catalog) return null;

  return (
    <section className="space-y-6 text-slate-100">
      {/* Encabezado limpio y acción única */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Lock size={13} className="text-emerald-400 shrink-0" />
            <span>BUNKKER OIL Fase 1</span>
            <span aria-hidden="true">·</span>
            <span>Modo Solo Lectura (query_only = ON)</span>
            <span aria-hidden="true">·</span>
            <span>
              {catalog.source.mode === 'sqlite_file' ? 'Base SQLite física' : 'Espejo Prisma SQLite'}
            </span>
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Database Schema Explorer
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl">
            Introspección automática de tablas, columnas, llaves foráneas, índices y mapas semánticos de auditoría sin modificar la estructura ni duplicar motores del ERP.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => void loadCatalog(true)}
            disabled={refreshing}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Escaneando...' : 'Re-escanear Esquema'}
          </button>
        </div>
      </div>

      {/* Cinta métrica con numeración tabular */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Tablas detectadas', value: catalog.summary.tablesCount, sub: `${catalog.summary.modulesCount} módulos` },
          {
            label: 'Relaciones detectadas',
            value: catalog.summary.relationsCount,
            sub: `+${catalog.summary.logicalLinksCount} enlaces semánticos`,
          },
          { label: 'Índices detectados', value: catalog.summary.indexesCount, sub: 'sqlite_master + PRAGMA' },
          {
            label: 'Vistas y triggers',
            value: catalog.summary.viewsCount + catalog.summary.triggersCount,
            sub: `${catalog.summary.viewsCount} vistas / ${catalog.summary.triggersCount} triggers`,
          },
          {
            label: 'Tablas de auditoría',
            value: catalog.summary.auditTablesCount,
            sub: 'Bitácora e historial',
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
          >
            <p className="text-xs text-slate-400">{metric.label}</p>
            <p className="mt-1 text-2xl font-bold text-white font-mono tabular-nums">
              {metric.value}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">{metric.sub}</p>
          </div>
        ))}
      </div>

      {/* Filtros por módulo + buscador */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedModule('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              selectedModule === 'ALL'
                ? 'bg-slate-100 text-slate-950'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Todos ({catalog.summary.tablesCount})
          </button>
          {catalog.modules.map((mod) => (
            <button
              key={mod.id}
              type="button"
              onClick={() => setSelectedModule(mod.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                selectedModule === mod.id
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {mod.name} ({mod.tables.length})
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72 shrink-0">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar tabla o columna..."
            aria-label="Filtrar tabla o columna"
            className="w-full rounded-lg border border-slate-800 bg-slate-900/90 pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Vista maestro-detalle del catálogo */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 items-start">
        {/* Lista de tablas */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <Table2 size={14} className="text-sky-400" /> Catálogo de Tablas
            </span>
            <span className="text-[11px] font-mono tabular-nums text-slate-500">
              {filteredTables.length}
            </span>
          </div>

          {filteredTables.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Sin coincidencias para el filtro actual.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/70 max-h-[540px] overflow-y-auto">
              {filteredTables.map((tbl) => {
                const isSelected = activeTable?.name === tbl.name;
                return (
                  <button
                    key={tbl.name}
                    type="button"
                    onClick={() => setSelectedTableName(tbl.name)}
                    className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                      isSelected ? 'bg-sky-950/50 text-white' : 'hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-mono font-medium truncate">{tbl.name}</span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                        {tbl.columnCount} cols
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="truncate">{tbl.semantic.primaryModuleName}</span>
                      {tbl.semantic.isAuditTable && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-400 shrink-0">Auditoría</span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detalle de la tabla seleccionada */}
        {activeTable && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Layers size={13} className="text-sky-400" />
                  <span>{activeTable.semantic.primaryModuleName}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeTable.semantic.hasTenantIsolation ? 'Aislamiento tenantId' : 'Tabla global'}</span>
                  {activeTable.semantic.isAuditTable && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-400">Registro de auditoría</span>
                    </>
                  )}
                </div>
                <h3 className="mt-1 text-base font-mono font-semibold text-white">
                  {activeTable.name}
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">{activeTable.semantic.purpose}</p>
              </div>
              <div className="text-xs text-slate-400 font-mono tabular-nums shrink-0">
                PK: {activeTable.primaryKeys.join(', ') || 'N/A'}
              </div>
            </div>

            {/* Tabla densa de columnas */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Columna</th>
                    <th className="py-2.5 px-4 font-medium">Tipo SQLite</th>
                    <th className="py-2.5 px-4 font-medium">Clave</th>
                    <th className="py-2.5 px-4 font-medium">Requerido</th>
                    <th className="py-2.5 px-4 font-medium">Valor por defecto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {activeTable.columns.map((col) => (
                    <tr key={col.name} className="hover:bg-slate-800/30">
                      <td className="py-2 px-4 font-mono text-slate-100">{col.name}</td>
                      <td className="py-2 px-4 font-mono text-sky-300">{col.type}</td>
                      <td className="py-2 px-4 text-slate-300">
                        {col.primaryKey ? (
                          <span className="inline-flex items-center gap-1 text-amber-300 font-mono">
                            <KeyRound size={11} /> PK
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 px-4 text-slate-400">{col.notNull ? 'NOT NULL' : 'NULL'}</td>
                      <td className="py-2 px-4 font-mono text-slate-500">
                        {col.defaultValue || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Relaciones e Índices */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-t border-slate-800 divide-y md:divide-y-0 md:divide-x divide-slate-800">
              <div className="p-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <GitBranch size={13} className="text-sky-400" /> Relaciones FK
                </h4>
                {activeTable.foreignKeys.length === 0 && activeTable.referencedBy.length === 0 ? (
                  <p className="text-xs text-slate-500">Sin claves foráneas físicas declaradas en esta tabla.</p>
                ) : (
                  <div className="space-y-1.5 text-xs font-mono">
                    {activeTable.foreignKeys.map((fk, idx) => (
                      <p key={`out-${idx}`} className="text-slate-300">
                        {fk.column} → {fk.targetTable}.{fk.targetColumn}{' '}
                        <span className="text-slate-500">({fk.onDelete})</span>
                      </p>
                    ))}
                    {activeTable.referencedBy.map((ref, idx) => (
                      <p key={`in-${idx}`} className="text-slate-400">
                        ← {ref.sourceTable}.{ref.sourceColumn}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Database size={13} className="text-sky-400" /> Índices ({activeTable.indexes.length})
                </h4>
                {activeTable.indexes.length === 0 ? (
                  <p className="text-xs text-slate-500">Solo índice primario implícito.</p>
                ) : (
                  <div className="space-y-1.5 text-xs font-mono">
                    {activeTable.indexes.map((idx) => (
                      <p key={idx.name} className="text-slate-300 truncate">
                        {idx.name}{' '}
                        <span className="text-slate-500">
                          [{idx.columns.join(', ')}]{idx.unique ? ' · UNIQUE' : ''}
                        </span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cadenas semánticas de correlación para auditoría */}
      {catalog.auditCorrelationChains?.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldCheck size={15} className="text-emerald-400" /> Mapas Semánticos de Auditoría Cruzada (SYSTEM_CONTEXT)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {catalog.auditCorrelationChains.map((chain) => (
              <div key={chain.name} className="space-y-2 border-t border-slate-800 pt-3">
                <p className="text-xs font-semibold text-slate-200">{chain.name}</p>
                <ol className="space-y-1 text-xs text-slate-400 list-decimal list-inside">
                  {chain.steps.map((step, i) => (
                    <li key={i} className="font-mono text-[11px] leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
