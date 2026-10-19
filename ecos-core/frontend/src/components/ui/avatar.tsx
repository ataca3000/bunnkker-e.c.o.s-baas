import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Lightweight avatar (initials only, no image dependency) used by the shell's
 * user menu. Kept framework-light to avoid an extra Radix dependency.
 */
function Avatar({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="avatar"
      className={cn(
        'bg-muted text-muted-foreground inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-medium select-none',
        className,
      )}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: React.ComponentProps<'span'>) {
  return <span data-slot="avatar-fallback" className={cn('uppercase', className)} {...props} />;
}

/** Derive up-to-two-letter initials from a display name. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2);
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`;
}

export { Avatar, AvatarFallback, getInitials };
