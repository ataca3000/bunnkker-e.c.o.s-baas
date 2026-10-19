import { useEffect, useState } from 'react';

import type { Command } from './command-types';

type Namespace = string;

/**
 * CommandRegistry — global command store for ECOS ERP.
 *
 * Architecture:
 *   A singleton that modules write to at mount time and the CommandProvider
 *   reads from. Subscribers are notified on every registration change so
 *   React can re-render the palette.
 *
 * Integration pattern (module layout or feature page):
 *
 *   import { useRegisterCommands } from '@/components/command-center';
 *
 *   function OrdersLayout() {
 *     useRegisterCommands('orders', [
 *       {
 *         id: 'action.order.new',
 *         title: 'New Order',
 *         description: 'Open the create order drawer',
 *         group: 'actions',
 *         icon: ShoppingBag,
 *         keywords: ['create', 'sale'],
 *         shortcut: '⌘N',
 *         action: () => dispatch(openCreateDrawer()),
 *       },
 *     ]);
 *     return <Outlet />;
 *   }
 *
 * Extension points (not yet implemented):
 *   filterByPermission(permissionKey)  — gate commands by RBAC
 *   filterByWorkspace(workspaceId)     — multi-workspace scoping
 *   saveToRecents(commandId)           — persist recently executed
 *   rankBySemantic(query, embeddings)  — AI-powered relevance ranking
 */
class CommandRegistryImpl {
  private readonly namespaces = new Map<Namespace, Command[]>();
  private readonly listeners = new Set<() => void>();

  /**
   * Register a set of commands under a namespace.
   * Returns an unregister function — call it in useEffect cleanup.
   *
   * If the namespace is already registered, it is replaced.
   */
  register(ns: Namespace, commands: Command[]): () => void {
    this.namespaces.set(ns, commands);
    this.notify();
    return () => {
      this.namespaces.delete(ns);
      this.notify();
    };
  }

  /** All registered commands, flattened across all namespaces. */
  getAll(): Command[] {
    return Array.from(this.namespaces.values()).flat();
  }

  /**
   * Filter commands by a free-text query.
   * Matches title, description, and keywords (case-insensitive substring).
   * Returns all commands when query is empty or blank.
   *
   * Future: replace body with semantic/vector similarity search.
   */
  search(query: string): Command[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.getAll();
    return this.getAll().filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.keywords?.some((k) => k.toLowerCase().includes(q)),
    );
  }

  /**
   * Subscribe to registry changes (register / unregister events).
   * Returns an unsubscribe function.
   */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}

/** Singleton command registry. Import directly for non-React registration. */
export const commandRegistry = new CommandRegistryImpl();

/**
 * React hook that subscribes to the registry and returns the current
 * command list. Re-renders whenever a module registers or unregisters.
 */
export function useRegisteredCommands(): Command[] {
  const [commands, setCommands] = useState<Command[]>(() => commandRegistry.getAll());

  useEffect(
    () => commandRegistry.subscribe(() => setCommands(commandRegistry.getAll())),
    [],
  );

  return commands;
}
