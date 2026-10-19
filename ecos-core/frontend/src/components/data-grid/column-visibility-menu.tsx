import { Check, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import type { ColumnMeta, ColumnVisibilityState } from './types';

type ColumnVisibilityMenuProps = {
  columns: ColumnMeta[];
  visibility: ColumnVisibilityState;
  onToggle: (key: string) => void;
  onReset: () => void;
  label?: string;
};

export function ColumnVisibilityMenu({
  columns,
  visibility,
  onToggle,
  onReset,
  label,
}: ColumnVisibilityMenuProps) {
  const { t } = useTranslation('common');
  const buttonLabel = label ?? t($ => $.dataGrid.columns);
  const toggleable = columns.filter((c) => !c.alwaysVisible && c.label);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="size-3.5" />
          {buttonLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {toggleable.map((col) => {
          const visible = visibility[col.key] ?? (col.defaultVisible !== false);
          return (
            <DropdownMenuItem
              key={col.key}
              onClick={() => onToggle(col.key)}
              className="flex items-center gap-2"
            >
              <span
                className={cn(
                  'flex size-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors',
                  visible
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/40',
                )}
              >
                {visible ? <Check className="size-2.5" strokeWidth={3} /> : null}
              </span>
              <span className="text-sm">{col.label}</span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onReset} className="gap-2">
          <RotateCcw className="size-3.5" />
          <span className="text-sm">{t($ => $.dataGrid.resetToDefaults)}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
