import { useTranslation } from 'react-i18next';
import { AlertTriangle, BadgeCheck, CircleSlash, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { LicenseStatus } from '../types/driver';

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
  LicenseStatus,
  { labelKey: LogisticsLabel; className: string; Icon: typeof BadgeCheck }
> = {
  valid: {
    labelKey: ($) => $.drivers.license.status.valid,
    className: 'bg-emerald-600 hover:bg-emerald-600 text-white',
    Icon: BadgeCheck,
  },
  expiring_soon: {
    labelKey: ($) => $.drivers.license.status.expiringSoon,
    className: 'bg-amber-500 hover:bg-amber-500 text-white',
    Icon: AlertTriangle,
  },
  expired: {
    labelKey: ($) => $.drivers.license.status.expired,
    className: 'bg-destructive hover:bg-destructive text-destructive-foreground',
    Icon: ShieldAlert,
  },
  missing: {
    labelKey: ($) => $.drivers.license.status.missing,
    className: 'bg-muted text-muted-foreground hover:bg-muted',
    Icon: CircleSlash,
  },
};

/**
 * Licence state, derived server-side. `daysRemaining` turns the badge into an
 * explicit countdown so the expiry warning is legible at a glance.
 */
export function LicenseStatusBadge({
  status,
  daysRemaining,
  showCountdown = false,
}: {
  status: LicenseStatus;
  daysRemaining?: number | null;
  showCountdown?: boolean;
}) {
  const { t } = useTranslation('logistics');
  const { labelKey, className, Icon } = CONFIG[status];

  let text = t(labelKey);
  if (showCountdown && daysRemaining != null) {
    if (status === 'expiring_soon') {
      text =
        daysRemaining === 0
          ? t($ => $.drivers.license.countdown.expiresToday)
          : t($ => $.drivers.license.countdown.expiresInDays, { days: daysRemaining });
    } else if (status === 'expired') {
      const days = Math.abs(daysRemaining);
      text = t($ => $.drivers.license.countdown.expiredAgo, { days });
    }
  }

  return (
    <Badge className={`gap-1 text-xs ${className}`}>
      <Icon className="size-3" />
      {text}
    </Badge>
  );
}
