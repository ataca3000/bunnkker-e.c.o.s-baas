import { useCallback, useState } from 'react';

/**
 * Column reordering — future extension point.
 * Currently a no-op placeholder; columns render in definition order.
 * When implemented: persist order to localStorage, expose drag-and-drop handlers.
 */
export function useColumnOrder(initialKeys: string[]) {
  const [order, setOrder] = useState<string[]>(initialKeys);

  const moveColumn = useCallback((fromKey: string, toKey: string) => {
    setOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(fromKey);
      const toIdx = next.indexOf(toKey);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, fromKey);
      return next;
    });
  }, []);

  const resetOrder = useCallback(() => setOrder(initialKeys), [initialKeys]);

  return { order, moveColumn, resetOrder };
}
