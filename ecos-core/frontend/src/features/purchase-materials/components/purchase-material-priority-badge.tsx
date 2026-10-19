import { Badge } from '@/components/ui/badge';
import type { PurchaseMaterialPriority } from '../types/purchase-material';

const PRIORITY_CONFIG: Record<PurchaseMaterialPriority, { label: string; className: string }> = {
  low: {
    label: 'Low',
    className: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700',
  },
  normal: {
    label: 'Normal',
    className: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  },
  high: {
    label: 'High',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
  },
  urgent: {
    label: 'Urgent',
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
  },
};

export function PurchaseMaterialPriorityBadge({ priority }: { priority: PurchaseMaterialPriority }) {
  const config = PRIORITY_CONFIG[priority] ?? { label: priority, className: '' };
  return <Badge className={config.className}>{config.label}</Badge>;
}
