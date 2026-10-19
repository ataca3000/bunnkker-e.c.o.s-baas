import { useCallback, useState } from 'react';

type UseBulkSelectionReturn = {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toggleAll: (ids: string[]) => void;
  clear: () => void;
  count: number;
};

/**
 * Generic Set-based bulk selection state for tables and lists.
 *
 * Usage:
 *   const { selectedIds, toggle, toggleAll, clear } = useBulkSelection();
 *   // Pass selectedIds.has(row.id) to each row's checkbox.
 *   // Pass toggleAll(rows.map(r => r.id)) to the header checkbox.
 */
export function useBulkSelection(): UseBulkSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  return {
    selectedIds,
    isSelected,
    toggle,
    toggleAll,
    clear,
    count: selectedIds.size,
  };
}
