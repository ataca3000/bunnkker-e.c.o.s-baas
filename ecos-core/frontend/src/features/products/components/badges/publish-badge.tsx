import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

type PublishBadgeProps = {
  published: boolean | null | undefined;
  className?: string;
};

export function PublishBadge({ published, className }: PublishBadgeProps) {
  const { t } = useTranslation('products');

  if (published === null || published === undefined) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return published ? (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700',
        'dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-400',
        className,
      )}
    >
      <Eye className="size-3 shrink-0" />
      {t($ => $.badges.published)}
    </span>
  ) : (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground',
        className,
      )}
    >
      <EyeOff className="size-3 shrink-0" />
      {t($ => $.badges.draft)}
    </span>
  );
}
