import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
};

/**
 * Reusable error placeholder with an optional retry action.
 */
export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  const { t } = useTranslation('common');
  const displayTitle = title ?? t($ => $.error.title);
  const displayDescription = description ?? t($ => $.error.description);

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <span className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <AlertTriangle className="size-6" />
      </span>
      <p className="font-medium">{displayTitle}</p>
      <p className="text-muted-foreground max-w-sm text-sm">{displayDescription}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          {t($ => $.error.retry)}
        </Button>
      ) : null}
    </div>
  );
}
