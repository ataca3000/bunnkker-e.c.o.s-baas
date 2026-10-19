import { Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/crud';
import { Card, CardContent } from '@/components/ui/card';
import { ROUTES } from '@/router/routes';

export function PackagingMaterialsPage() {
  const { t } = useTranslation('inventory');
  const { t: tCommon } = useTranslation('common');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.packagingMaterials.title)}
        subtitle={t($ => $.packagingMaterials.subtitle)}
        breadcrumbs={[
          { label: tCommon($ => $.home), to: ROUTES.dashboard },
          { label: t($ => $.title), to: ROUTES.inventoryProducts },
          { label: t($ => $.packagingMaterials.title) },
        ]}
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Package className="size-10 text-muted-foreground" />
          <p className="font-medium">{t($ => $.packagingMaterials.title)}</p>
          <p className="text-muted-foreground text-sm max-w-sm">
            {t($ => $.packagingMaterials.comingSoon)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
