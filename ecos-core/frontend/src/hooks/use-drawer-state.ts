import { useCallback, useState } from 'react';

type DrawerMode = 'create' | 'edit' | 'view';

type DrawerState<T> = {
  open: boolean;
  mode: DrawerMode;
  entity: T | null;
};

type UseDrawerStateReturn<T> = {
  open: boolean;
  mode: DrawerMode;
  entity: T | null;
  openCreate: () => void;
  openEdit: (entity: T) => void;
  openView: (entity: T) => void;
  close: () => void;
};

/**
 * Generic drawer open/mode/entity state machine.
 * Covers the create → submit, edit → submit, view → close lifecycle
 * used in every ERP module's entity management drawer.
 *
 * Usage:
 *   const drawer = useDrawerState<Product>();
 *   <EntityDrawer open={drawer.open} onClose={drawer.close}>
 *     {drawer.mode === 'create' ? <CreateForm /> : <EditForm entity={drawer.entity!} />}
 *   </EntityDrawer>
 */
export function useDrawerState<T>(): UseDrawerStateReturn<T> {
  const [state, setState] = useState<DrawerState<T>>({
    open: false,
    mode: 'create',
    entity: null,
  });

  const openCreate = useCallback(() => {
    setState({ open: true, mode: 'create', entity: null });
  }, []);

  const openEdit = useCallback((entity: T) => {
    setState({ open: true, mode: 'edit', entity });
  }, []);

  const openView = useCallback((entity: T) => {
    setState({ open: true, mode: 'view', entity });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    open: state.open,
    mode: state.mode,
    entity: state.entity,
    openCreate,
    openEdit,
    openView,
    close,
  };
}
