import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import type enDashboard from '@/i18n/locales/en/dashboard.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of key
 * strings can never type-check. The selector is the same expression the
 * compiler validates at an inline call site, kept in the table.
 */
type DashboardLabel = ($: typeof enDashboard) => string;


export function RecentActivity() {
  const { t } = useTranslation('dashboard');

  const activityKeys: { id: string; label: DashboardLabel }[] = [
    { id: 'onboarding', label: ($) => $.recentActivity.onboarding },
    { id: 'inventory', label: ($) => $.recentActivity.inventory },
    { id: 'sales', label: ($) => $.recentActivity.sales },
    { id: 'hr', label: ($) => $.recentActivity.hr },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t($ => $.recentActivity.title)}</CardTitle>
        <CardDescription>{t($ => $.recentActivity.subtitle)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {activityKeys.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-sm">{t(item.label)}</span>
              <span className="text-muted-foreground text-xs">{t($ => $.recentActivity.justNow)}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
