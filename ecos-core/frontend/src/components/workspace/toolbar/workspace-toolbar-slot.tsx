import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  children: ReactNode;
  className?: string;
};

/** Styled container for injecting feature-specific toolbars below WorkspaceHeader. Pure composition — no logic. */
export function WorkspaceToolbarSlot({ children, className }: Props) {
  return <div className={cn('px-4 py-3 sm:px-6', className)}>{children}</div>;
}
