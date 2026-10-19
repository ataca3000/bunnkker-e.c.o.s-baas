import { Package, Plus, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

type ProductEmptyStateProps = {
  hasFilters: boolean;
  onCreateProduct: () => void;
  onImportProducts?: () => void;
  onClearFilters?: () => void;
};

export function ProductEmptyState({
  hasFilters,
  onCreateProduct,
  onImportProducts,
  onClearFilters,
}: ProductEmptyStateProps) {
  const { t } = useTranslation('products');

  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
          <Package className="size-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-base font-semibold">{t($ => $.emptyState.withFiltersTitle)}</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {t($ => $.emptyState.withFiltersDescription)}
        </p>
        {onClearFilters ? (
          <Button variant="outline" size="sm" className="mt-4" onClick={onClearFilters}>
            {t($ => $.emptyState.clearFilters)}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex size-20 items-center justify-center rounded-2xl bg-primary/10">
        <Package className="size-10 text-primary" />
      </div>
      <h3 className="mt-5 text-lg font-semibold">{t($ => $.emptyState.noProductsTitle)}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {t($ => $.emptyState.noProductsDescription)}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onCreateProduct}>
          <Plus className="size-4" />
          {t($ => $.emptyState.createProduct)}
        </Button>
        {onImportProducts ? (
          <Button variant="outline" onClick={onImportProducts}>
            <Upload className="size-4" />
            {t($ => $.emptyState.importProducts)}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
