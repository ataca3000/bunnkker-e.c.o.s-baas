import { Utensils } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/crud';
import { Card, CardContent } from '@/components/ui/card';
import { ROUTES } from '@/router/routes';

export function ConsumablesPage() {
  const { t } = useTranslation('inventory');
  const { t: tCommon } = useTranslation('common');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.consumables.title)}
        subtitle={t($ => $.consumables.subtitle)}
        breadcrumbs={[
          { label: tCommon($ => $.home), to: ROUTES.dashboard },
          { label: t($ => $.title), to: ROUTES.inventoryProducts },
          { label: t($ => $.consumables.title) },
        ]}
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Utensils className="size-10 text-muted-foreground" />
          <p className="font-medium">{t($ => $.consumables.title)}</p>
          <p className="text-muted-foreground text-sm max-w-sm">
            {t($ => $.consumables.comingSoon)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
