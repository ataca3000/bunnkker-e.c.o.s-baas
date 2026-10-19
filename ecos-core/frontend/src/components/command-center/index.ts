// ── Command Center — public API ────────────────────────────────────────────────
//
// Usage:
//   import { GlobalCommandPalette, CommandProvider, useCommandCenter, useRegisterCommands } from '@/components/command-center';
//
// Provider placement (in AppShell, inside HeaderProvider and Router):
//   <CommandProvider>...</CommandProvider>
//
// Module registration (in module layout):
//   useRegisterCommands('my-module', myCommands);
//
// Programmatic palette control:
//   const { open, close, toggle, isOpen } = useCommandCenter();

export { GlobalCommandPalette } from './command-palette';
export type { GlobalCommandPaletteProps } from './command-palette';

export { CommandProvider } from './command-context';
export { useCommandCenter } from './use-command-center';

export { useRegisterCommands } from './hooks/use-register-commands';
export { commandRegistry, useRegisteredCommands } from './command-registry';

export { createDefaultCommands, COMMAND_GROUP_META, EMPTY_STATE_GROUPS, SEARCH_GROUP_ORDER } from './command-groups';
export { KEYBOARD_SHORTCUTS, groupShortcuts } from './command-shortcuts';
export type { ShortcutCategory, ShortcutDef } from './command-shortcuts';

export type { Command, CommandGroup, CommandGroupMeta } from './command-types';
