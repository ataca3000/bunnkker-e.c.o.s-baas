import type { ReactNode } from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
};

/**
 * Reusable empty-state placeholder.
 */
export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <span className="bg-muted text-muted-foreground mb-1 flex size-12 items-center justify-center rounded-full">
        <Icon className="size-6" />
      </span>
      <p className="font-medium">{title}</p>
      {description ? <p className="text-muted-foreground max-w-sm text-sm">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
