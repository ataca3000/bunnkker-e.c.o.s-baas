/**
 * Keyboard shortcut display registry — ECOS ERP.
 *
 * This is a DISPLAY registry only. It powers a "Keyboard Shortcuts" help panel
 * and lets modules declare their shortcuts without duplicating documentation.
 *
 * Actual key bindings live in the components themselves:
 *   - Ctrl+K        → GlobalSearch / GlobalCommandPalette
 *   - Arrow keys    → the command palette, list pages, switchers, tabs
 *   - Ctrl+S        → form drawers
 *
 * Future uses:
 *   - Conflict detection when modules register custom shortcuts
 *   - Voice command aliases
 *   - Custom shortcut remapping
 */
export type ShortcutCategory =
  | 'global'
  | 'navigation'
  | 'list'
  | 'table'
  | 'form';

export type ShortcutDef = {
  /** Display string e.g. '⌘K', 'Ctrl+Shift+N', '↑↓' */
  keys: string;
  description: string;
  category: ShortcutCategory;
};

export const KEYBOARD_SHORTCUTS: ShortcutDef[] = [
  // ── Global ────────────────────────────────────────────────────────────────
  { keys: '⌘K',           description: 'Open Command Center',         category: 'global' },
  { keys: 'Esc',          description: 'Close dialog / clear search',  category: 'global' },

  // ── Navigation ────────────────────────────────────────────────────────────
  { keys: '/',            description: 'Focus page search',            category: 'navigation' },
  { keys: '⌘N',          description: 'Quick create (new record)',     category: 'navigation' },

  // ── Table & list ─────────────────────────────────────────────────────────
  { keys: '↑ / ↓',       description: 'Move row focus',               category: 'table' },
  { keys: '↵',           description: 'Open focused row',             category: 'table' },
  { keys: 'Space',        description: 'Select / deselect row',        category: 'table' },
  { keys: 'Alt + 1–9',   description: 'Switch status tab (Orders)',   category: 'table' },

  // ── Form & drawer ─────────────────────────────────────────────────────────
  { keys: '⌘S',          description: 'Submit form',                  category: 'form' },
  { keys: '← / →',       description: 'Switch drawer tabs',           category: 'form' },
];

/** Group shortcuts by category for display in a help panel. */
export function groupShortcuts(): Record<ShortcutCategory, ShortcutDef[]> {
  const map: Record<ShortcutCategory, ShortcutDef[]> = {
    global: [],
    navigation: [],
    list: [],
    table: [],
    form: [],
  };
  for (const s of KEYBOARD_SHORTCUTS) {
    map[s.category].push(s);
  }
  return map;
}
