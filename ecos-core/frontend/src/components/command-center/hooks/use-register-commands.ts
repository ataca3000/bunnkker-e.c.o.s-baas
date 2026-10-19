import { useEffect, useRef } from 'react';

import { commandRegistry } from '../command-registry';
import type { Command } from '../command-types';

/**
 * Register module-specific commands with the Command Center at mount time.
 * Commands are automatically unregistered when the component unmounts.
 *
 * Usage — in a module layout or feature page:
 *
 *   import { useRegisterCommands } from '@/components/command-center';
 *
 *   function OrdersLayout() {
 *     const { openCreateDrawer } = useOrdersActions();
 *
 *     useRegisterCommands('orders', [
 *       {
 *         id: 'action.order.new',
 *         title: 'New Order',
 *         description: 'Open the create order drawer',
 *         group: 'actions',
 *         icon: ShoppingBag,
 *         keywords: ['create', 'sale'],
 *         shortcut: '⌘N',
 *         action: openCreateDrawer,
 *       },
 *     ]);
 *
 *     return <Outlet />;
 *   }
 *
 * Important:
 *   - Commands are registered synchronously but React re-renders are async.
 *   - The `commands` array reference is captured once at mount. If actions change
 *     (e.g. a closure over state), pass stable callbacks (useCallback).
 *   - Re-registration only happens when `namespace` changes — not when the
 *     commands array identity changes. This avoids infinite loops.
 *
 * @param namespace  Unique module identifier e.g. 'orders', 'inventory', 'crm'.
 *                   Use a consistent slug that matches your module folder name.
 * @param commands   Commands to register. Use stable references where possible.
 */
export function useRegisterCommands(namespace: string, commands: Command[]): void {
  const cmdsRef = useRef(commands);

  // Keep the ref current without touching it during render.
  useEffect(() => {
    cmdsRef.current = commands;
  }, [commands]);

  useEffect(() => {
    return commandRegistry.register(namespace, cmdsRef.current);
  }, [namespace]);
}
