import { useCallback, useState } from 'react';

// ── Column definitions ─────────────────────────────────────────────────────────

export type ColKey =
  | 'image' | 'category' | 'price' | 'sale_price'
  | 'status' | 'channels' | 'sync' | 'updated_at' | 'sku';

export type ColumnVisibility = Record<ColKey, boolean>;
export type ColumnWidths = Partial<Record<string, number>>;

export type ColumnDef = {
  key: ColKey;
  label: string;
  defaultWidth: number;
};

export const TOGGLEABLE_COLUMNS: ColumnDef[] = [
  { key: 'image',      label: 'Image',         defaultWidth: 56  },
  { key: 'category',   label: 'Category',       defaultWidth: 128 },
  { key: 'price',      label: 'Price',          defaultWidth: 96  },
  { key: 'sale_price', label: 'Discount Price', defaultWidth: 112 },
  { key: 'status',     label: 'Status',         defaultWidth: 96  },
  { key: 'channels',   label: 'Channels',       defaultWidth: 144 },
  { key: 'sync',       label: 'Sync',           defaultWidth: 96  },
  { key: 'updated_at', label: 'Last Updated',   defaultWidth: 128 },
  { key: 'sku',        label: 'SKU',            defaultWidth: 112 },
];

export const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  checkbox:   40,
  image:      56,
  name:       220,
  category:   128,
  price:      96,
  sale_price: 112,
  status:     100,
  channels:   144,
  sync:       96,
  updated_at: 128,
  sku:        112,
  actions:    48,
};

const DEFAULT_VISIBILITY: ColumnVisibility = {
  image:      true,
  category:   true,
  price:      true,
  sale_price: true,
  status:     true,
  channels:   true,
  sync:       true,
  updated_at: true,
  sku:        true,
};

const VIS_KEY   = 'ecos_products_cols';
const WIDTH_KEY = 'ecos_products_col_widths';

function readVis(): ColumnVisibility {
  try {
    const raw = localStorage.getItem(VIS_KEY);
    if (raw) return { ...DEFAULT_VISIBILITY, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_VISIBILITY };
}

function readWidths(): ColumnWidths {
  try {
    const raw = localStorage.getItem(WIDTH_KEY);
    if (raw) return JSON.parse(raw) as ColumnWidths;
  } catch { /* ignore */ }
  return {};
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useColumnPrefs() {
  const [visible, setVisibleState] = useState<ColumnVisibility>(readVis);
  const [widths, setWidthsState]   = useState<ColumnWidths>(readWidths);

  const setVisible = useCallback((key: ColKey, value: boolean) => {
    setVisibleState((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(VIS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setWidth = useCallback((key: string, width: number) => {
    setWidthsState((prev) => {
      const next = { ...prev, [key]: Math.max(48, Math.round(width)) };
      localStorage.setItem(WIDTH_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetPrefs = useCallback(() => {
    localStorage.removeItem(VIS_KEY);
    localStorage.removeItem(WIDTH_KEY);
    setVisibleState({ ...DEFAULT_VISIBILITY });
    setWidthsState({});
  }, []);

  /** Effective width for a column (user override or default). */
  const getWidth = useCallback((key: string) => {
    return widths[key] ?? DEFAULT_COLUMN_WIDTHS[key] ?? 100;
  }, [widths]);

  return { visible, setVisible, widths, setWidth, getWidth, resetPrefs };
}
