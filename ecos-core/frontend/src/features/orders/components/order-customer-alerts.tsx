import { AlertTriangle, Star, Ban } from 'lucide-react';

import type { CustomerLookupStats } from '@/features/orders/types/order';

type Props = {
  stats: CustomerLookupStats;
};

type Alert = {
  icon: React.ReactNode;
  label: string;
  variant: 'warning' | 'danger' | 'success' | 'info';
};

export function OrderCustomerAlerts({ stats }: Props) {
  const alerts: Alert[] = [];

  if (stats.total_orders > 0 && stats.cancelled / stats.total_orders > 0.4) {
    alerts.push({
      icon: <Ban className="size-3.5" />,
      label: 'High Cancellation Rate',
      variant: 'danger',
    });
  }

  if (stats.lifetime_value >= 10_000) {
    alerts.push({
      icon: <Star className="size-3.5" />,
      label: 'VIP Customer',
      variant: 'success',
    });
  }

  if (stats.total_orders >= 10) {
    alerts.push({
      icon: <Star className="size-3.5" />,
      label: 'Frequent Buyer',
      variant: 'info',
    });
  }

  if (stats.total_orders === 0) {
    alerts.push({
      icon: <AlertTriangle className="size-3.5" />,
      label: 'First Order',
      variant: 'info',
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {alerts.map((alert) => (
        <AlertBadge key={alert.label} {...alert} />
      ))}
    </div>
  );
}

function AlertBadge({ icon, label, variant }: Alert) {
  const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium';
  const colors = {
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  };

  return (
    <span className={`${base} ${colors[variant]}`}>
      {icon}
      {label}
    </span>
  );
}
