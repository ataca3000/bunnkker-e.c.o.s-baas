import { useCallback, useState } from 'react';

import { lsKey } from '@/components/ecos/tokens';

export type ColumnWidths = Partial<Record<string, number>>;

type UseColumnVisibilityOptions<K extends string> = {
  /** localStorage namespace — e.g. "products", "orders". */
  storageKey: string;
  /** Default visibility map (all keys you want to toggle). */
  defaults: Record<K, boolean>;
  /** Default pixel widths per column key. */
  defaultWidths?: Record<string, number>;
  /** Minimum column width in pixels (default: 48). */
  minWidth?: number;
};

type UseColumnVisibilityReturn<K extends string> = {
  visible: Record<K, boolean>;
  setVisible: (key: K, value: boolean) => void;
  widths: ColumnWidths;
  setWidth: (key: string, width: number) => void;
  getWidth: (key: string) => number;
  resetPrefs: () => void;
};

/**
 * Generic localStorage-backed column visibility + width hook.
 * Feature modules should define their own ColKey type and pass
 * defaults — this hook handles persistence and merging.
 *
 * Usage:
 *   const { visible, setVisible, getWidth, setWidth } = useColumnVisibility({
 *     storageKey: 'products',
 *     defaults: DEFAULT_VISIBILITY,
 *     defaultWidths: DEFAULT_COLUMN_WIDTHS,
 *   });
 */
export function useColumnVisibility<K extends string>({
  storageKey,
  defaults,
  defaultWidths = {},
  minWidth = 48,
}: UseColumnVisibilityOptions<K>): UseColumnVisibilityReturn<K> {
  const visKey   = lsKey(storageKey, 'cols');
  const widthKey = lsKey(storageKey, 'col_widths');

  const readVis = (): Record<K, boolean> => {
    try {
      const raw = localStorage.getItem(visKey);
      if (raw) return { ...defaults, ...(JSON.parse(raw) as Record<K, boolean>) };
    } catch { /* ignore */ }
    return { ...defaults };
  };

  const readWidths = (): ColumnWidths => {
    try {
      const raw = localStorage.getItem(widthKey);
      if (raw) return JSON.parse(raw) as ColumnWidths;
    } catch { /* ignore */ }
    return {};
  };

  const [visible, setVisibleState] = useState<Record<K, boolean>>(readVis);
  const [widths, setWidthsState]   = useState<ColumnWidths>(readWidths);

  const setVisible = useCallback((key: K, value: boolean) => {
    setVisibleState((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(visKey, JSON.stringify(next));
      return next;
    });
  }, [visKey]);

  const setWidth = useCallback((key: string, width: number) => {
    setWidthsState((prev) => {
      const next = { ...prev, [key]: Math.max(minWidth, Math.round(width)) };
      localStorage.setItem(widthKey, JSON.stringify(next));
      return next;
    });
  }, [widthKey, minWidth]);

  const resetPrefs = useCallback(() => {
    localStorage.removeItem(visKey);
    localStorage.removeItem(widthKey);
    setVisibleState({ ...defaults });
    setWidthsState({});
  }, [visKey, widthKey, defaults]);

  const getWidth = useCallback((key: string) => {
    return widths[key] ?? defaultWidths[key] ?? 100;
  }, [widths, defaultWidths]);

  return { visible, setVisible, widths, setWidth, getWidth, resetPrefs };
}
