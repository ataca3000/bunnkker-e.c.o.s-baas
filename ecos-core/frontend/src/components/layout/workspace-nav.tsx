import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WorkspaceNavItem = {
  key: string;
  icon: LucideIcon;
  label: string;
};

type WorkspaceNavProps = {
  items: WorkspaceNavItem[];
  active: string;
  onChange: (key: string) => void;
  cols?: 2 | 3 | 4;
};

const colsMap: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
};

export function WorkspaceNav({ items, active, onChange, cols = 4 }: WorkspaceNavProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3', colsMap[cols])}>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={cn(
              'group flex flex-col items-center gap-2.5 rounded-xl border p-5 text-center transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isActive
                ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                : 'border-border bg-card hover:border-primary/30 hover:bg-accent/50',
            )}
          >
            <div
              className={cn(
                'flex size-11 items-center justify-center rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
              )}
            >
              <Icon className="size-5" />
            </div>
            <span
              className={cn(
                'text-sm font-medium leading-tight',
                isActive ? 'text-primary' : 'text-foreground',
              )}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
