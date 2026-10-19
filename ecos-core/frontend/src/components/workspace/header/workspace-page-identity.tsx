import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  description?: string;
  badge?: ReactNode;
  className?: string;
};

export function WorkspacePageIdentity({ title, description, badge, className }: Props) {
  return (
    <div className={cn('min-w-0 flex-1', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">{title}</h1>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {description ? (
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
