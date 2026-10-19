import type { SupplierStatus } from '../types/supplier';
import { useSupplierLabels, SUPPLIER_STATUS_COLORS } from '../hooks/use-suppliers-labels';

type Props = {
  status?: SupplierStatus | null;
  /** Fallback: derive from is_active when explicit status is not provided. */
  isActive?: boolean;
};

export function SupplierStatusBadge({ status, isActive }: Props) {
  const { supplierStatusLabel } = useSupplierLabels();
  const resolved: SupplierStatus = status ?? (isActive ? 'active' : 'archived');
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${SUPPLIER_STATUS_COLORS[resolved]}`}>
      {supplierStatusLabel[resolved]}
    </span>
  );
}
