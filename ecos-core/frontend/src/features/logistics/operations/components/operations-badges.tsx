import { AlertTriangle, Info, Lock, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  ExceptionSeverity,
  ExceptionSource,
  ExceptionStatus,
  PoolMemberStatus,
  PoolStatus,
  ReservationStatus,
} from '../types/operations';

const POOL: Record<PoolStatus, { labelKey: LogisticsLabel; className: string }> = {
  draft: {
    labelKey: ($) => $.operations.badges.pool.draft,
    className: 'bg-sky-600 hover:bg-sky-600 text-white',
  },
  active: { labelKey: ($) => $.common.active, className: 'bg-emerald-600 hover:bg-emerald-600 text-white' },
  suspended: {
    labelKey: ($) => $.operations.badges.pool.suspended,
    className: 'bg-amber-500 hover:bg-amber-500 text-white',
  },
  archived: {
    labelKey: ($) => $.operations.badges.pool.archived,
    className: 'bg-muted text-muted-foreground hover:bg-muted',
  },
};

export function PoolStatusBadge({ status }: { status: PoolStatus }) {
  const { t } = useTranslation('logistics');
  const { labelKey, className } = POOL[status];

  return <Badge className={`text-xs ${className}`}>{t(labelKey)}</Badge>;
}

const MEMBER: Record<PoolMemberStatus, { labelKey: LogisticsLabel; className: string }> = {
  active: {
    labelKey: ($) => $.operations.badges.member.inPool,
    className: 'bg-emerald-600 hover:bg-emerald-600 text-white',
  },
  suspended: {
    labelKey: ($) => $.operations.badges.member.heldOut,
    className: 'bg-amber-500 hover:bg-amber-500 text-white',
  },
  withdrawn: {
    labelKey: ($) => $.operations.badges.member.removed,
    className: 'bg-muted text-muted-foreground hover:bg-muted',
  },
};

export function MemberStatusBadge({ status }: { status: PoolMemberStatus }) {
  const { t } = useTranslation('logistics');
  const { labelKey, className } = MEMBER[status];

  return <Badge className={`text-xs ${className}`}>{t(labelKey)}</Badge>;
}

const RESERVATION: Record<ReservationStatus, { labelKey: LogisticsLabel; className: string }> = {
  pending: { labelKey: ($) => $.common.pending, className: 'bg-muted text-muted-foreground hover:bg-muted' },
  held: {
    labelKey: ($) => $.operations.badges.reservation.held,
    className: 'bg-sky-600 hover:bg-sky-600 text-white',
  },
  confirmed: {
    labelKey: ($) => $.operations.badges.reservation.confirmed,
    className: 'bg-emerald-600 hover:bg-emerald-600 text-white',
  },
  released: {
    labelKey: ($) => $.operations.badges.reservation.released,
    className: 'bg-muted text-muted-foreground hover:bg-muted',
  },
  failed: {
    labelKey: ($) => $.operations.badges.reservation.refused,
    className: 'bg-destructive hover:bg-destructive text-destructive-foreground',
  },
};

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const { t } = useTranslation('logistics');
  const { labelKey, className } = RESERVATION[status];

  return <Badge className={`text-xs ${className}`}>{t(labelKey)}</Badge>;
}

const EXCEPTION: Record<ExceptionStatus, { labelKey: LogisticsLabel; className: string }> = {
  open: {
    labelKey: ($) => $.operations.badges.exception.open,
    className: 'bg-destructive hover:bg-destructive text-destructive-foreground',
  },
  acknowledged: {
    labelKey: ($) => $.operations.badges.exception.acknowledged,
    className: 'bg-amber-500 hover:bg-amber-500 text-white',
  },
  escalated: {
    labelKey: ($) => $.operations.badges.exception.escalated,
    className: 'bg-destructive hover:bg-destructive text-destructive-foreground',
  },
  resolved: {
    labelKey: ($) => $.operations.badges.exception.resolved,
    className: 'bg-emerald-600 hover:bg-emerald-600 text-white',
  },
  suppressed: {
    labelKey: ($) => $.operations.badges.exception.suppressed,
    className: 'bg-muted text-muted-foreground hover:bg-muted',
  },
  auto_resolved: {
    labelKey: ($) => $.operations.badges.exception.autoResolved,
    className: 'bg-slate-600 hover:bg-slate-600 text-white',
  },
};

export function ExceptionStatusBadge({ status }: { status: ExceptionStatus }) {
  const { t } = useTranslation('logistics');
  const { labelKey, className } = EXCEPTION[status];

  return <Badge className={`text-xs ${className}`}>{t(labelKey)}</Badge>;
}

export function SeverityIcon({ severity }: { severity: ExceptionSeverity }) {
  if (severity === 'critical') {
    return <XCircle className="size-3.5 shrink-0 text-destructive" />;
  }

  if (severity === 'warning') {
    return <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />;
  }

  return <Info className="size-3.5 shrink-0 text-muted-foreground" />;
}

/**
 * Which module owns the fact behind an exception.
 *
 * Always shown, because Operations cannot clear another module's fact — an
 * operator needs to know where the fix actually lives before trying.
 */
export function SourceBadge({ source, label }: { source: ExceptionSource; label?: string }) {
  const isOurs = source === 'operations';

  return (
    <Badge variant="outline" className={`gap-1 text-[10px] ${isOurs ? '' : 'border-amber-500'}`}>
      {!isOurs && <Lock className="size-2.5" />}
      {label ?? source}
    </Badge>
  );
}

/** Which module decides a pool member's readiness — never Operations. */
export function AuthorityBadge({ authority }: { authority: 'fleet' | 'drivers' }) {
  const { t } = useTranslation('logistics');

  return (
    <Badge variant="outline" className="text-[10px]">
      {t($ => $.operations.badges.authority[authority])}
    </Badge>
  );
}
