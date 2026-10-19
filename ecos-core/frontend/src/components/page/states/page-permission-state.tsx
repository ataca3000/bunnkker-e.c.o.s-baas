import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

type PagePermissionStateProps = {
  title?: string;
  description?: string;
  className?: string;
};

export function PagePermissionState({
  title,
  description,
  className,
}: PagePermissionStateProps) {
  const { t } = useTranslation('common');
  const displayTitle = title ?? t($ => $.permission.accessDenied);
  const displayDescription = description ?? t($ => $.permission.description);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-20 text-center',
        className,
      )}
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
        <ShieldAlert className="size-8" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold">{displayTitle}</p>
        <p className="mx-auto max-w-xs text-sm text-muted-foreground">{displayDescription}</p>
      </div>
    </div>
  );
}
