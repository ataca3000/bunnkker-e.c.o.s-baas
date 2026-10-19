import type { ComponentType } from 'react';
import type enCommandPalette from '@/i18n/locales/en/command-palette.json';

// ── Command group ─────────────────────────────────────────────────────────────

/**
 * Semantic category for a command.
 * Extend this union when new categories are needed (e.g. 'report', 'voice').
 */
export type CommandGroup =
  | 'navigation'  // Go to a page or workspace
  | 'actions'     // Create, import, export operations
  | 'search'      // Search within an entity type
  | 'recent'      // Recently visited pages or records
  | 'favorites'   // User-pinned commands
  | 'ai';         // AI-assisted actions (reserved — not implemented)

// ── Command definition ────────────────────────────────────────────────────────

/**
 * A single executable command in the ECOS ERP Command Center.
 *
 * All commands are immutable once registered. To update a command, unregister
 * the namespace and re-register with the updated set.
 *
 * Extension points (intentionally separate from the implemented fields):
 *   permission  — RBAC key e.g. 'orders.create'. Future: gate via auth store.
 *   workspace   — Workspace slug restriction. Future: multi-tenant context.
 *   voiceAlias  — Natural-language alias for voice input. Future: voice commands.
 */
export type Command = {
  /**
   * Globally unique identifier.
   * Convention: `{group}.{module}.{verb}` e.g. `nav.orders`, `action.order.new`
   */
  id: string;
  title: string;
  description?: string;
  group: CommandGroup;
  icon: ComponentType<{ className?: string }>;
  /** Additional search terms beyond title and description. */
  keywords?: string[];
  /** Cosmetic shortcut hint rendered in the palette item row. Actual binding in command-shortcuts.ts. */
  shortcut?: string;
  /** Called when the command is selected (click or Enter). */
  action: () => void;
  // ── Future extension points ─────────────────────────────────────────────────
  /** RBAC permission required. Undefined = visible to all roles. */
  permission?: string;
  /** Restrict to a specific workspace context. Undefined = cross-workspace. */
  workspace?: string;
  /** Command is visible but cannot be executed. */
  disabled?: boolean;
  /** Show "Soon" badge instead of executing the action. Architecture-ready, not yet implemented. */
  soon?: boolean;
};

// ── Group metadata ─────────────────────────────────────────────────────────────

/**
 * A group's label, held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for "a key chosen at runtime", so storing
 * 'groups.navigation' and calling t() on it cannot type-check. Storing the
 * selector itself does: it is the same value the compiler already validates at
 * every inline call site, just held in a constant.
 */
export type CommandPaletteLabel = ($: typeof enCommandPalette) => string;

export type CommandGroupMeta = {
  label: CommandPaletteLabel;
  icon: ComponentType<{ className?: string }>;
};
