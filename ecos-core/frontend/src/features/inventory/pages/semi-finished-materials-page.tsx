import { Factory } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/crud';
import { Card, CardContent } from '@/components/ui/card';
import { ROUTES } from '@/router/routes';

export function SemiFinishedMaterialsPage() {
  const { t } = useTranslation('inventory');
  const { t: tCommon } = useTranslation('common');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.semiFinished.title)}
        subtitle={t($ => $.semiFinished.subtitle)}
        breadcrumbs={[
          { label: tCommon($ => $.home), to: ROUTES.dashboard },
          { label: t($ => $.title), to: ROUTES.inventoryProducts },
          { label: t($ => $.semiFinished.shortTitle) },
        ]}
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Factory className="size-10 text-muted-foreground" />
          <p className="font-medium">{t($ => $.semiFinished.title)}</p>
          <p className="text-muted-foreground text-sm max-w-sm">
            {t($ => $.semiFinished.comingSoon)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
