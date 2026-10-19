import { useContext } from 'react';

import { CommandCenterContext } from './command-center-context';
import type { CommandCenterCtx } from './command-center-context';

export type { CommandCenterCtx };

/**
 * Access the Command Center context.
 * Must be used inside <CommandProvider>.
 */
export function useCommandCenter(): CommandCenterCtx {
  const ctx = useContext(CommandCenterContext);
  if (!ctx) throw new Error('useCommandCenter must be used inside CommandProvider');
  return ctx;
}
