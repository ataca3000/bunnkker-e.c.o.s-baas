import { Boxes } from 'lucide-react';

import { cn } from '@/lib/utils';
import { env } from '@/lib/env';

type BrandLogoProps = {
  className?: string;
  /** Hide the wordmark and show only the logo mark. */
  iconOnly?: boolean;
};

/**
 * Reusable application logo (mark + wordmark).
 */
export function BrandLogo({ className, iconOnly = false }: BrandLogoProps) {
  return (
    <span className={cn('flex items-center gap-2 font-semibold', className)}>
      <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
        <Boxes className="size-5" />
      </span>
      {iconOnly ? null : <span className="truncate">{env.appName}</span>}
    </span>
  );
}
