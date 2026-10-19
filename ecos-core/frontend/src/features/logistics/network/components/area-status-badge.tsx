import { useTranslation } from 'react-i18next';
import { Ban, CheckCircle, FileText, PauseCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { ServiceAreaStatus } from '../types/network';

import type enLogistics from '@/i18n/locales/en/logistics.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of
 * key strings can never type-check. The selector is the same expression
 * the compiler validates at an inline call site, kept in the table.
 */
type LogisticsLabel = ($: typeof enLogistics) => string;

const CONFIG: Record<
  ServiceAreaStatus,
  { labelKey: LogisticsLabel; className: string; Icon: typeof CheckCircle }
> = {
  draft: {
    labelKey: ($) => $.network.areaStatus.draft,
    className: 'bg-sky-600 hover:bg-sky-600 text-white',
    Icon: FileText,
  },
  active: {
    labelKey: ($) => $.common.active,
    className: 'bg-emerald-600 hover:bg-emerald-600 text-white',
    Icon: CheckCircle,
  },
  // Paused still SERVES existing commitments — it only stops new ones.
  paused: {
    labelKey: ($) => $.network.areaStatus.paused,
    className: 'bg-amber-500 hover:bg-amber-500 text-white',
    Icon: PauseCircle,
  },
  closed: {
    labelKey: ($) => $.network.areaStatus.closed,
    className: 'bg-muted text-muted-foreground hover:bg-muted',
    Icon: Ban,
  },
};

export function AreaStatusBadge({ status }: { status: ServiceAreaStatus }) {
  const { t } = useTranslation('logistics');
  const { labelKey, className, Icon } = CONFIG[status];

  return (
    <Badge className={`gap-1 text-xs ${className}`}>
      <Icon className="size-3" />
      {t(labelKey)}
    </Badge>
  );
}
