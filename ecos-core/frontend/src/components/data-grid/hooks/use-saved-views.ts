/**
 * Saved Views — future extension point.
 * A "saved view" captures: column visibility, column order, sort state, and active filters.
 * When implemented: persist views to localStorage (or server), expose load/save/delete.
 */
export type SavedView = {
  id: string;
  name: string;
  createdAt: string;
  // Future: columnVisibility, columnOrder, sort, filters
};

export function useSavedViews(_storageKey: string) {
  const views: SavedView[] = [];

  function saveView(_name: string) {
    // TODO: capture current grid state and persist
  }

  function loadView(_id: string) {
    // TODO: restore grid state from saved view
  }

  function deleteView(_id: string) {
    // TODO: remove saved view
  }

  return { views, saveView, loadView, deleteView };
}
