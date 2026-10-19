import { Box, Layers, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { ProductType } from '@/features/products/types/product';

type ProductTypeBadgeProps = {
  type: ProductType;
  className?: string;
};

export function ProductTypeBadge({ type, className }: ProductTypeBadgeProps) {
  const { t } = useTranslation('products');

  const CONFIG: Record<ProductType, { labelKey: string; icon: typeof Package; className: string }> = {
    finished_good: {
      labelKey: 'badges.finishedGood',
      icon: Package,
      className:
        'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-400',
    },
    raw_material: {
      labelKey: 'badges.rawMaterial',
      icon: Layers,
      className:
        'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-400',
    },
    packaging_material: {
      labelKey: 'badges.packaging',
      icon: Box,
      className:
        'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-400',
    },
  };

  const cfg = CONFIG[type];
  const Icon = cfg.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
        cfg.className,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" />
      {(t as unknown as (k: string) => string)(cfg.labelKey)}
    </span>
  );
}
