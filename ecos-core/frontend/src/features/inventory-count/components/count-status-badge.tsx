import { Badge } from '@/components/ui/badge';
import type { CountSessionStatus } from '../types/inventory-count';
import { useInventoryCountLabels, COUNT_STATUS_COLORS } from '../hooks/use-inventory-count-labels';

export function CountStatusBadge({ status }: { status: CountSessionStatus }) {
  const { countStatusLabel } = useInventoryCountLabels();
  return (
    <Badge className={COUNT_STATUS_COLORS[status] ?? ''}>
      {countStatusLabel[status] ?? status}
    </Badge>
  );
}
