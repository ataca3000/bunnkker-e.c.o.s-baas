import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

type LoadingStateProps = {
  label?: string;
  className?: string;
};

/**
 * Reusable centered loading indicator.
 */
export function LoadingState({ label, className }: LoadingStateProps) {
  const { t } = useTranslation('common');

  return (
    <div
      className={cn(
        'text-muted-foreground flex flex-col items-center justify-center gap-2 py-12',
        className,
      )}
    >
      <Loader2 className="size-6 animate-spin" />
      <span className="text-sm">{label ?? t($ => $.loading)}</span>
    </div>
  );
}
