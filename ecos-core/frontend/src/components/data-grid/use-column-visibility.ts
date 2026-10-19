import { useCallback, useState } from 'react';

import type { ColumnMeta, ColumnVisibilityState } from './types';

function buildDefaults(columns: ColumnMeta[]): ColumnVisibilityState {
  const result: ColumnVisibilityState = {};
  for (const col of columns) {
    result[col.key] = col.defaultVisible !== false;
  }
  return result;
}

/**
 * Manages per-column visibility with localStorage persistence.
 * Use one hook instance at the page level and pass `visibility` + `toggle` + `reset`
 * down to both the table and the column-manager menu.
 */
export function useColumnVisibility(storageKey: string, columns: ColumnMeta[]) {
  const [visibility, setVisibility] = useState<ColumnVisibilityState>(() => {
    const defaults = buildDefaults(columns);
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as ColumnVisibilityState;
        return { ...defaults, ...parsed };
      }
    } catch { /* ignore */ }
    return defaults;
  });

  const toggle = useCallback(
    (key: string) => {
      setVisibility((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    },
    [storageKey],
  );

  const reset = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    setVisibility(buildDefaults(columns));
  }, [storageKey, columns]);

  const isVisible = useCallback(
    (key: string): boolean => {
      const col = columns.find((c) => c.key === key);
      if (col?.alwaysVisible) return true;
      return visibility[key] ?? (col?.defaultVisible !== false);
    },
    [visibility, columns],
  );

  return { visibility, toggle, reset, isVisible };
}
