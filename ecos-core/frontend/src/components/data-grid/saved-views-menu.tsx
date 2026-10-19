import { Bookmark, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SavedViewsMenuProps = {
  label?: string;
};

/**
 * Saved Views — placeholder for future view persistence.
 * Will allow users to save and restore filter/sort/column combinations per module.
 */
export function SavedViewsMenu({ label }: SavedViewsMenuProps) {
  const { t } = useTranslation('common');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Bookmark className="size-3.5" />
          {label ?? t($ => $.savedViews.label)}
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          {t($ => $.savedViews.empty)}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>{t($ => $.savedViews.saveCurrent)}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
