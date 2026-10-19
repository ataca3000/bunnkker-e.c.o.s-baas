import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import type { StatusVariant } from '@/components/crud/types';
import type enCommon from '@/i18n/locales/en/common.json';
import { cn } from '@/lib/utils';

type StatusConfig = {
  /**
   * The label as an i18next selector into the `common` namespace.
   *
   * Held as a selector rather than a key string: selector mode has no type for
   * a key chosen at runtime, so `t('status.active')` stored in a constant
   * cannot type-check. The selector is the same expression the compiler
   * validates at an inline call site — it just lives in the table.
   */
  label: ($: typeof enCommon) => string;
  dot: string;
  variant: 'secondary' | 'outline';
  muted?: boolean;
};

const STATUS_CONFIG: Record<StatusVariant, StatusConfig> = {
  active: { label: ($) => $.status.active, dot: 'bg-emerald-500', variant: 'secondary' },
  pending: { label: ($) => $.status.pending, dot: 'bg-amber-500', variant: 'secondary' },
  inactive: {
    label: ($) => $.status.inactive,
    dot: 'bg-muted-foreground',
    variant: 'outline',
    muted: true,
  },
  archived: {
    label: ($) => $.status.archived,
    dot: 'bg-muted-foreground',
    variant: 'outline',
    muted: true,
  },
};

type StatusBadgeProps = {
  status: StatusVariant;
  label?: string;
  className?: string;
};

/**
 * Reusable status badge supporting active / inactive / pending / archived.
 */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const { t } = useTranslation('common');
  const config = STATUS_CONFIG[status];

  return (
    <Badge
      variant={config.variant}
      className={cn('gap-1.5', config.muted && 'text-muted-foreground', className)}
    >
      <span className={cn('size-1.5 rounded-full', config.dot)} />
      {label ?? t(config.label)}
    </Badge>
  );
}
