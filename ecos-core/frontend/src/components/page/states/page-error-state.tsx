import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PageErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
};

/**
 * Full-page error state — centered, designed to fill WorkspacePage's content area.
 *
 * Usage:
 *   <PageErrorState onRetry={() => void refetch()} />
 */
export function PageErrorState({
  title,
  description,
  onRetry,
  className,
}: PageErrorStateProps) {
  const { t } = useTranslation('common');

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-20 text-center',
        className,
      )}
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-8" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold">{title ?? t($ => $.error.title)}</p>
        <p className="mx-auto max-w-xs text-sm text-muted-foreground">
          {description ?? t($ => $.error.description)}
        </p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          <RefreshCcw className="size-3.5" aria-hidden />
          {t($ => $.error.retry)}
        </Button>
      ) : null}
    </div>
  );
}
