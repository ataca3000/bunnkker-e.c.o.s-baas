import { Layers, Package, Ruler, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { PageHeader } from '@/components/crud';
import { WorkspaceCard } from '@/components/layout/workspace-card';
import { useCategoriesQuery } from '@/features/categories/hooks/use-categories';
import { useProductsQuery } from '@/features/products/hooks/use-products';
import { useUnitsQuery } from '@/features/units/hooks/use-units';
import { ROUTES } from '@/router/routes';

const COUNT_PARAMS = { page: 1, per_page: 1 } as const;

export function InventoryProductsWorkspace() {
  const { t } = useTranslation('inventory');
  const { t: tCommon } = useTranslation('common');
  const { t: tProd } = useTranslation('products');
  const { t: tCat } = useTranslation('categories');
  const { t: tUnit } = useTranslation('units');
  const navigate = useNavigate();

  const { data: finishedData, isLoading: finishedLoading } = useProductsQuery({
    ...COUNT_PARAMS,
    product_type: 'finished_good',
  });
  const { data: rawData, isLoading: rawLoading } = useProductsQuery({
    ...COUNT_PARAMS,
    product_type: 'raw_material',
  });
  const { data: categoriesData, isLoading: categoriesLoading } = useCategoriesQuery(COUNT_PARAMS);
  const { data: unitsData, isLoading: unitsLoading } = useUnitsQuery(COUNT_PARAMS);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.workspace.title)}
        subtitle={t($ => $.workspace.subtitle)}
        breadcrumbs={[{ label: tCommon($ => $.home), to: ROUTES.dashboard }, { label: t($ => $.workspace.title) }]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <WorkspaceCard
          icon={Package}
          title={tProd($ => $.finishedGoods.title)}
          description={tProd($ => $.finishedGoods.subtitle)}
          count={finishedData?.meta.total}
          countLabel={t($ => $.workspace.countLabel)}
          href={ROUTES.products}
          isLoading={finishedLoading}
          newLabel={tProd($ => $.actions.new)}
          onNew={() => navigate(ROUTES.products, { state: { openCreate: true } })}
        />
        <WorkspaceCard
          icon={Layers}
          title={tProd($ => $.rawMaterials.title)}
          description={tProd($ => $.rawMaterials.subtitle)}
          count={rawData?.meta.total}
          countLabel={t($ => $.workspace.countLabel)}
          href={ROUTES.rawMaterials}
          isLoading={rawLoading}
          newLabel={tProd($ => $.actions.new)}
          onNew={() => navigate(ROUTES.rawMaterials, { state: { openCreate: true } })}
        />
        <WorkspaceCard
          icon={Tag}
          title={tCat($ => $.title)}
          description={tCat($ => $.subtitle)}
          count={categoriesData?.meta.total}
          countLabel={t($ => $.workspace.countLabel)}
          href={ROUTES.categories}
          isLoading={categoriesLoading}
        />
        <WorkspaceCard
          icon={Ruler}
          title={tUnit($ => $.title)}
          description={tUnit($ => $.subtitle)}
          count={unitsData?.meta.total}
          countLabel={t($ => $.workspace.countLabel)}
          href={ROUTES.units}
          isLoading={unitsLoading}
        />
      </div>
    </div>
  );
}
