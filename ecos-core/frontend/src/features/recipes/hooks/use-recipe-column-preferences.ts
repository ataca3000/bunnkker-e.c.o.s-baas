import { useCallback, useState } from 'react';

// ─── Column definitions ───────────────────────────────────────────────────────

export type RecipeColumnKey =
  | 'image'
  | 'product'
  | 'category'
  | 'recipe_cost'
  | 'waste_pct'
  | 'total_materials'
  | 'channel'
  | 'company'
  | 'updated'
  | 'status'
  | 'actions';

export type RecipeColumnDef = {
  key:     RecipeColumnKey;
  label:   string;
  locked?: boolean;
};

// Mandatory order per PKG-RECIPE-006 spec
export const ALL_RECIPE_COLUMNS: RecipeColumnDef[] = [
  { key: 'image',           label: 'Product Image' },
  { key: 'product',         label: 'Product',         locked: true },
  { key: 'category',        label: 'Category' },
  { key: 'recipe_cost',     label: 'Recipe Cost' },
  { key: 'waste_pct',       label: 'Waste %' },
  { key: 'total_materials', label: 'Total Materials' },
  { key: 'channel',         label: 'Channel' },
  { key: 'company',         label: 'Company' },
  { key: 'updated',         label: 'Updated' },
  { key: 'status',          label: 'Status' },
  { key: 'actions',         label: 'Actions',         locked: true },
];

const DEFAULT_VISIBLE = new Set<RecipeColumnKey>(ALL_RECIPE_COLUMNS.map((c) => c.key));
const STORAGE_KEY     = 'ecos.recipes.columns';
const LOCKED          = new Set<RecipeColumnKey>(ALL_RECIPE_COLUMNS.filter((c) => c.locked).map((c) => c.key));
const VALID_KEYS      = new Set<RecipeColumnKey>(ALL_RECIPE_COLUMNS.map((c) => c.key));

// ─── Persistence helpers ──────────────────────────────────────────────────────

function load(): Set<RecipeColumnKey> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBLE;
    const parsed = (JSON.parse(raw) as string[]).filter((k) => VALID_KEYS.has(k as RecipeColumnKey)) as RecipeColumnKey[];
    return new Set([...parsed, ...LOCKED]);
  } catch {
    return DEFAULT_VISIBLE;
  }
}

function persist(cols: Set<RecipeColumnKey>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...cols]));
  } catch {
    // storage unavailable — continue without persistence
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type RecipeColumnPreferences = {
  visibleColumns:  Set<RecipeColumnKey>;
  toggleColumn:    (key: RecipeColumnKey) => void;
  restoreDefaults: () => void;
  showAll:         () => void;
};

export function useRecipeColumnPreferences(): RecipeColumnPreferences {
  const [visibleColumns, setVisibleColumns] = useState<Set<RecipeColumnKey>>(load);

  const toggleColumn = useCallback((key: RecipeColumnKey) => {
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
