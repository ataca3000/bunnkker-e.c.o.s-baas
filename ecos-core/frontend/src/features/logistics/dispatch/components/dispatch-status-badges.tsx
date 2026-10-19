import { useTranslation } from 'react-i18next';
import { AlertTriangle, Lock, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import type enLogistics from '@/i18n/locales/en/logistics.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of
 * key strings can never type-check. The selector is the same expression
 * the compiler validates at an inline call site, kept in the table.
 */
type LogisticsLabel = ($: typeof enLogistics) => string;
import type {
  ConflictAuthority,
  QueueItemStatus,
  QueuePriority,
  SessionStatus,
} from '../types/dispatch-ops';

/** `labelKey` is a `logistics` namespace key — resolved at render, never stored translated. */
const SESSION: Record<SessionStatus, { labelKey: LogisticsLabel; className: string }> = {
  open: {
    labelKey: ($) => $.dispatch.session.status.open,
    className: 'bg-emerald-600 hover:bg-emerald-600 text-white',
  },
  paused: {
    labelKey: ($) => $.dispatch.session.status.paused,
    className: 'bg-amber-500 hover:bg-amber-500 text-white',
  },
  closing: {
    labelKey: ($) => $.dispatch.session.status.closing,
    className: 'bg-amber-600 hover:bg-amber-600 text-white',
  },
  closed: {
    labelKey: ($) => $.dispatch.session.status.closed,
    className: 'bg-muted text-muted-foreground hover:bg-muted',
  },
  abandoned: {
    labelKey: ($) => $.dispatch.session.status.abandoned,
    className: 'bg-destructive hover:bg-destructive text-destructive-foreground',
  },
};

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const { t } = useTranslation('logistics');
  const { labelKey, className } = SESSION[status];

  return <Badge className={`text-xs ${className}`}>{t(labelKey)}</Badge>;
}

const QUEUE: Record<QueueItemStatus, { labelKey: LogisticsLabel; className: string }> = {
  waiting: {
    labelKey: ($) => $.dispatch.queue.status.waiting,
    className: 'bg-muted text-muted-foreground hover:bg-muted',
  },
  claimed: {
    labelKey: ($) => $.dispatch.queue.status.claimed,
    className: 'bg-sky-600 hover:bg-sky-600 text-white',
  },
  assigned: {
    labelKey: ($) => $.common.assigned,
    className: 'bg-emerald-600 hover:bg-emerald-600 text-white',
  },
  blocked: {
    labelKey: ($) => $.dispatch.queue.status.blocked,
    className: 'bg-destructive hover:bg-destructive text-destructive-foreground',
  },
  deferred: {
    labelKey: ($) => $.dispatch.queue.status.deferred,
    className: 'bg-amber-500 hover:bg-amber-500 text-white',
  },
  completed: {
    labelKey: ($) => $.common.completed,
    className: 'bg-slate-600 hover:bg-slate-600 text-white',
  },
  cancelled: {
    labelKey: ($) => $.common.cancelled,
    className: 'bg-muted text-muted-foreground hover:bg-muted',
  },
};

export function QueueStatusBadge({ status }: { status: QueueItemStatus }) {
  const { t } = useTranslation('logistics');
  const { labelKey, className } = QUEUE[status];

  return <Badge className={`text-xs ${className}`}>{t(labelKey)}</Badge>;
}

const PRIORITY: Record<QueuePriority, { labelKey: LogisticsLabel; className: string }> = {
  critical: {
    labelKey: ($) => $.common.critical,
    className: 'bg-destructive hover:bg-destructive text-destructive-foreground',
  },
  high: { labelKey: ($) => $.common.high, className: 'bg-amber-500 hover:bg-amber-500 text-white' },
  normal: {
    labelKey: ($) => $.dispatch.priority.normal,
    className: 'bg-sky-600 hover:bg-sky-600 text-white',
  },
  low: { labelKey: ($) => $.common.low, className: 'bg-muted text-muted-foreground hover:bg-muted' },
};

export function PriorityBadge({ priority }: { priority: QueuePriority }) {
  const { t } = useTranslation('logistics');
  const { labelKey, className } = PRIORITY[priority];

  return <Badge className={`text-xs ${className}`}>{t(labelKey)}</Badge>;
}

/**
 * Which module owns the fact behind a conflict.
 *
 * Shown next to every conflict because Dispatch may not overrule another
 * authority — a dispatcher needs to know where the fix actually lives.
 */
const AUTHORITY: Record<ConflictAuthority, LogisticsLabel> = {
  fleet: ($) => $.dispatch.authority.fleet,
  drivers: ($) => $.dispatch.authority.drivers,
  network: ($) => $.dispatch.authority.network,
  distribution: ($) => $.dispatch.authority.distribution,
  dispatch: ($) => $.dispatch.authority.dispatch,
};

export function AuthorityBadge({ authority }: { authority: ConflictAuthority }) {
  const { t } = useTranslation('logistics');
  const isOurs = authority === 'dispatch';

  return (
    <Badge variant="outline" className={`gap-1 text-[10px] ${isOurs ? '' : 'border-amber-500'}`}>
      {!isOurs && <Lock className="size-2.5" />}
      {t(AUTHORITY[authority])}
    </Badge>
  );
}

export function SeverityIcon({ severity }: { severity: 'blocking' | 'advisory' }) {
  return severity === 'blocking' ? (
    <XCircle className="size-3.5 shrink-0 text-destructive" />
  ) : (
    <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />
  );
}
