import { createContext } from 'react';

import type { Command } from './command-types';

export type CommandCenterCtx = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  commands: Command[];
  registerCommands: (namespace: string, commands: Command[]) => () => void;
};

// Separate file so CommandProvider (command-context.tsx) can export only a
// component, satisfying the react-refresh/only-export-components rule.
export const CommandCenterContext = createContext<CommandCenterCtx | null>(null);
