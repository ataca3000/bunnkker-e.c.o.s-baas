import type { TFunction } from 'i18next';

import type { ColumnMeta } from '@/components/data-grid/types';

// ── Structural layout — keys + visibility only, no labels ─────────────────────
// Labels come from createOrderColumnMeta(t) so the picker and grid headers
// always read from the same i18n source.

type ColumnStructure = Omit<ColumnMeta, 'label'>;

const COLUMN_STRUCTURE: ColumnStructure[] = [
  { key: 'checkbox',            alwaysVisible: true  },
  { key: 'order_number',        alwaysVisible: true  },
  { key: 'customer',            defaultVisible: true },
  { key: 'status',              defaultVisible: true },
  { key: 'address',             defaultVisible: true },
  { key: 'zone',                defaultVisible: true },
  { key: 'location',            defaultVisible: true },
  { key: 'inventory_execution', defaultVisible: true }, // was 'customer_confirmed' — key now matches column def
  { key: 'products_count',      defaultVisible: true },
  { key: 'payment_method',      defaultVisible: true },
  { key: 'payment_proof',       defaultVisible: true },
  { key: 'total',               defaultVisible: true },
  { key: 'customer_note',       defaultVisible: true },
  { key: 'created_at',          defaultVisible: true },
  { key: 'sales_rep',           defaultVisible: true },
  { key: 'delivery_driver',     defaultVisible: true },
  { key: 'store',               defaultVisible: true },
  { key: 'shipping_attempts',   defaultVisible: true },
  { key: 'updated_at',          defaultVisible: true },
  { key: 'actions',             alwaysVisible: true  },
  { key: 'delivery_window',     defaultVisible: false },
];

// Maps a column key to its i18n label — identical keys used in createOrderColumns().
function resolveLabel(key: string, t: TFunction<'orders'>): string {
  switch (key) {
    case 'order_number':        return t($ => $.columns.number);
    case 'customer':            return t($ => $.columns.customer);
    case 'status':              return t($ => $.columns.status);
    case 'address':             return t($ => $.columns.address);
    case 'zone':                return t($ => $.columns.zone);
    case 'location':            return t($ => $.columns.location);
    case 'inventory_execution': return t($ => $.columns.inventoryExecution);
    case 'products_count':      return t($ => $.columns.productsCount);
    case 'payment_method':      return t($ => $.columns.paymentMethod);
    case 'payment_proof':       return t($ => $.columns.paymentProof);
    case 'total':               return t($ => $.columns.total);
    case 'customer_note':       return t($ => $.columns.customerNote);
    case 'created_at':          return t($ => $.columns.createdAt);
    case 'sales_rep':           return t($ => $.columns.salesRep);
    case 'delivery_driver':     return t($ => $.columns.driver);
    case 'store':               return t($ => $.columns.store);
    case 'shipping_attempts':   return t($ => $.columns.shippingAttempts);
    case 'updated_at':          return t($ => $.columns.updatedAt);
    case 'delivery_window':     return t($ => $.columns.deliveryWindow);
    default:                    return '';
  }
}

/**
 * Returns ColumnMeta[] with i18n labels matching the grid column headers.
 * Call inside useMemo in the page component:
 *   const columnMeta = useMemo(() => createOrderColumnMeta(t), [t]);
 */
export function createOrderColumnMeta(t: TFunction<'orders'>): ColumnMeta[] {
  return COLUMN_STRUCTURE.map((col) => ({ ...col, label: resolveLabel(col.key, t) }));
}
