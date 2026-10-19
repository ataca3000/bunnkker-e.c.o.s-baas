import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type enDashboard from '@/i18n/locales/en/dashboard.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of key
 * strings can never type-check. The selector is the same expression the
 * compiler validates at an inline call site, kept in the table.
 */
type DashboardLabel = ($: typeof enDashboard) => string;


export function SystemStatus() {
  const { t } = useTranslation('dashboard');

  const serviceKeys: { id: string; label: DashboardLabel }[] = [
    { id: 'api', label: ($) => $.systemStatus.api },
    { id: 'database', label: ($) => $.systemStatus.database },
    { id: 'queue', label: ($) => $.systemStatus.queue },
    { id: 'mail', label: ($) => $.systemStatus.mail },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t($ => $.systemStatus.title)}</CardTitle>
        <CardDescription>{t($ => $.systemStatus.subtitle)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {serviceKeys.map((item) => (
          <div key={item.id} className="flex items-center justify-between">
            <span className="text-sm">{t(item.label)}</span>
            <Badge variant="secondary" className="gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {t($ => $.systemStatus.operational)}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
