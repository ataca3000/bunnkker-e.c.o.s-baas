import { useState } from 'react';

import type { GridSelectionAPI } from './types';

type UseRowSelectionOptions<T> = {
  items: T[];
  getId: (item: T) => string;
};

/** Returned by useRowSelection — GridSelectionAPI plus clearSelection for page-level resets. */
export type UseRowSelectionReturn = GridSelectionAPI & {
  clearSelection: () => void;
};

export function useRowSelection<T>({
  items,
  getId,
}: UseRowSelectionOptions<T>): UseRowSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelected = (id: string) => selectedIds.has(id);
  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(getId(item)));
  const someSelected = !allSelected && items.some((item) => selectedIds.has(getId(item)));

  function selectRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function selectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(items.map(getId)) : new Set());
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    allSelected,
    someSelected,
    selectRow,
    selectAll,
    clearSelection,
  };
}
