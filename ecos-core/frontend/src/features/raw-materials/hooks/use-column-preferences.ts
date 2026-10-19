import { useCallback, useState } from 'react';

// ─── Column definitions ───────────────────────────────────────────────────────

export type ColumnKey =
  | 'image'
  | 'name'
  | 'material_type'
  | 'category'
  | 'unit'
  | 'stock_status'
  | 'on_hand'
  | 'reserved'
  | 'available'
  | 'current_cost'
  | 'inventory_value'
  | 'allow_negative'
  | 'sku'
  | 'actions';

export type ColumnDef = {
  key:     ColumnKey;
  label:   string;
  locked?: boolean;
};

export const ALL_COLUMNS: ColumnDef[] = [
  { key: 'image',           label: 'Image' },
  { key: 'name',            label: 'Name',            locked: true },
  { key: 'material_type',   label: 'Material Type' },
  { key: 'category',        label: 'Category' },
  { key: 'unit',            label: 'Unit' },
  { key: 'stock_status',    label: 'Stock Status' },
  { key: 'on_hand',         label: 'On Hand' },
  { key: 'reserved',        label: 'Reserved' },
  { key: 'available',       label: 'Available' },
  { key: 'current_cost',    label: 'Current Cost' },
  { key: 'inventory_value', label: 'Inventory Value' },
  { key: 'allow_negative',  label: 'Allow Negative' },
  { key: 'sku',             label: 'SKU' },
  { key: 'actions',         label: 'Actions',         locked: true },
];

const DEFAULT_VISIBLE = new Set<ColumnKey>(ALL_COLUMNS.map((c) => c.key));
const STORAGE_KEY     = 'ecos.raw-materials.columns';
const LOCKED          = new Set<ColumnKey>(ALL_COLUMNS.filter((c) => c.locked).map((c) => c.key));
const VALID_KEYS      = new Set<ColumnKey>(ALL_COLUMNS.map((c) => c.key));

// ─── Persistence helpers ──────────────────────────────────────────────────────

function load(): Set<ColumnKey> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBLE;
    const parsed = (JSON.parse(raw) as string[]).filter((k) => VALID_KEYS.has(k as ColumnKey)) as ColumnKey[];
    return new Set([...parsed, ...LOCKED]);
  } catch {
    return DEFAULT_VISIBLE;
  }
}

function persist(cols: Set<ColumnKey>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...cols]));
  } catch {
    // storage unavailable — continue without persistence
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type ColumnPreferences = {
  visibleColumns:  Set<ColumnKey>;
  toggleColumn:    (key: ColumnKey) => void;
  restoreDefaults: () => void;
  showAll:         () => void;
};

export function useColumnPreferences(): ColumnPreferences {
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(load);

  const toggleColumn = useCallback((key: ColumnKey) => {
    if (LOCKED.has(key)) return;
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      persist(next);
      return next;
    });
  }, []);

  const restoreDefaults = useCallback(() => {
    setVisibleColumns(DEFAULT_VISIBLE);
    persist(DEFAULT_VISIBLE);
  }, []);

  const showAll = useCallback(() => {
    setVisibleColumns(DEFAULT_VISIBLE);
    persist(DEFAULT_VISIBLE);
  }, []);

  return { visibleColumns, toggleColumn, restoreDefaults, showAll };
}
