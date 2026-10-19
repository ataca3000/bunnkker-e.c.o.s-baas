import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type FormSectionProps = {
  title: string;
  description?: string;
  count?: number;
  badge?: ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Collapsible section for grouping form fields. Shows title, optional count
 * badge, and optional description. Defaults to expanded; set defaultOpen=false
 * to start collapsed.
 */
export function FormSection({
  title,
  description,
  count,
  badge,
  defaultOpen = true,
  collapsible = true,
  children,
  className,
}: FormSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('rounded-lg border overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => collapsible && setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3',
          'bg-muted/40 transition-colors',
          collapsible && 'hover:bg-muted/60',
          !collapsible && 'cursor-default',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">{title}</span>
          {count != null && (
            <Badge variant="secondary" className="text-xs h-5 px-1.5 shrink-0">
              {count}
            </Badge>
          )}
          {badge}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {description && !open && (
            <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-32">
              {description}
            </span>
          )}
          {collapsible && (
            open
              ? <ChevronDown className="size-4 text-muted-foreground" />
              : <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-4 border-t">
          {description && (
            <p className="text-sm text-muted-foreground -mt-1">{description}</p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
