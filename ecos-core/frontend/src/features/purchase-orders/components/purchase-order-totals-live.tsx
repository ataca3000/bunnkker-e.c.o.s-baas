import { useWatch, useFormContext } from 'react-hook-form';

import { PurchaseOrderTotals } from '@/features/purchase-orders/components/purchase-order-totals';
import type { PurchaseOrderFormValues } from '@/features/purchase-orders/components/purchase-order-form-schema';

export function PurchaseOrderTotalsLive() {
  const { control } = useFormContext<PurchaseOrderFormValues>();
  const lines = useWatch({ control, name: 'lines' });

  const subtotal = (lines ?? []).reduce(
    (sum, l) => sum + Number(l?.quantity ?? 0) * Number(l?.unit_price ?? 0),
    0,
  );

  return <PurchaseOrderTotals subtotal={subtotal} total={subtotal} />;
}
