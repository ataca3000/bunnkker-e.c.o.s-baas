import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import type { ProductStockStatus } from '@/features/products/types/product';

const VARIANT_MAP: Record<ProductStockStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  instock: 'default',
  outofstock: 'destructive',
  onbackorder: 'secondary',
};

type StockStatusBadgeProps = {
  status: ProductStockStatus | null | undefined;
};

export function StockStatusBadge({ status }: StockStatusBadgeProps) {
  const { t } = useTranslation('products');

  if (!status) return <span className="text-muted-foreground">—</span>;

  return (
    <Badge variant={VARIANT_MAP[status]}>
      {t($ => $.stockStatus[status])}
    </Badge>
  );
}
