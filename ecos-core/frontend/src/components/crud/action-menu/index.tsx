import { MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ActionMenuItem } from '@/components/crud/types';

type ActionMenuProps = {
  items: ActionMenuItem[];
  label?: string;
};

/**
 * Reusable row/entity action menu (View, Edit, Delete and custom actions).
 */
export function ActionMenu({ items, label }: ActionMenuProps) {
  const { t } = useTranslation('common');

  if (items.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label ?? t($ => $.actions.openActions)}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem
              key={item.key}
              variant={item.variant}
              disabled={item.disabled}
              onClick={item.onSelect}
            >
              {Icon ? <Icon className="size-4" /> : null}
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
