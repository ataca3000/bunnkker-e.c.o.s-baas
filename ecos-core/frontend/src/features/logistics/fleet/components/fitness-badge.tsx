import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { FitnessLevel, FleetUnitLifecycle } from '../types/fleet';

import type enLogistics from '@/i18n/locales/en/logistics.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of
 * key strings can never type-check. The selector is the same expression
 * the compiler validates at an inline call site, kept in the table.
 */
type LogisticsLabel = ($: typeof enLogistics) => string;

const FITNESS: Record<FitnessLevel, { labelKey: LogisticsLabel; className: string; Icon: typeof CheckCircle }> = {
  fit: {
    labelKey: ($) => $.fleet.fitness.fit,
    className: 'bg-emerald-600 hover:bg-emerald-600 text-white',
    Icon: CheckCircle,
  },
  fit_with_warnings: {
    labelKey: ($) => $.fleet.fitness.warnings,
    className: 'bg-amber-500 hover:bg-amber-500 text-white',
    Icon: AlertTriangle,
  },
  unfit: {
    labelKey: ($) => $.fleet.fitness.unfit,
    className: 'bg-destructive hover:bg-destructive text-destructive-foreground',
    Icon: XCircle,
  },
};

export function FitnessBadge({ level }: { level: FitnessLevel }) {
  const { t } = useTranslation('logistics');
  const { labelKey, className, Icon } = FITNESS[level];

  return (
    <Badge className={`gap-1 text-xs ${className}`}>
      <Icon className="size-3" />
      {t(labelKey)}
    </Badge>
  );
}

const LIFECYCLE: Record<FleetUnitLifecycle, { labelKey: LogisticsLabel; className: string }> = {
  draft: { labelKey: ($) => $.fleet.lifecycle.draft, className: 'bg-muted text-muted-foreground hover:bg-muted' },
  commissioning: {
    labelKey: ($) => $.fleet.lifecycle.commissioning,
    className: 'bg-sky-600 hover:bg-sky-600 text-white',
  },
  active: { labelKey: ($) => $.common.active, className: 'bg-emerald-600 hover:bg-emerald-600 text-white' },
  suspended: { labelKey: ($) => $.fleet.lifecycle.suspended, className: 'bg-amber-600 hover:bg-amber-600 text-white' },
  decommissioning: {
    labelKey: ($) => $.fleet.lifecycle.decommissioning,
    className: 'bg-orange-500 hover:bg-orange-500 text-white',
  },
  retired: { labelKey: ($) => $.fleet.lifecycle.retired, className: 'bg-slate-600 hover:bg-slate-600 text-white' },
};

export function LifecycleBadge({ state }: { state: FleetUnitLifecycle }) {
  const { t } = useTranslation('logistics');
  const { labelKey, className } = LIFECYCLE[state];

  return <Badge className={`text-xs ${className}`}>{t(labelKey)}</Badge>;
}
