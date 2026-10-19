import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ExternalLink, XCircle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { BrandConfigHealth } from '@/features/brands/types/brand';

type CheckItem = {
  key: keyof BrandConfigHealth['checks'];
  label: string;
};

const CHECKS: CheckItem[] = [
  { key: 'channels',           label: 'Sales Channels' },
  { key: 'delivery_geography', label: 'Delivery Geography' },
  { key: 'delivery_zones',     label: 'Delivery Zones' },
  { key: 'delivery_windows',   label: 'Delivery Windows' },
  { key: 'shipping_rules',     label: 'Shipping Pricing' },
];

type Props = {
  health: BrandConfigHealth;
  brandId: string;
  brandName?: string;
};

export function BrandConfigHealthCard({ health, brandId, brandName }: Props) {
  const navigate = useNavigate();

  if (health.is_ready) return null;

  const failingCount = CHECKS.filter((c) => !health.checks[c.key]).length;

  return (
    <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        Brand Configuration Incomplete
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          {brandName ? `"${brandName}"` : 'This Brand'} cannot receive manual orders until the
          following {failingCount === 1 ? 'item is' : `${failingCount} items are`} configured:
        </p>

        <ul className="space-y-1.5">
          {CHECKS.map((item) => {
            const ok = health.checks[item.key];
            return (
              <li key={item.key as string} className="flex items-center gap-2 text-sm">
                {ok ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle className="size-3.5 shrink-0 text-red-500 dark:text-red-400" />
                )}
                <span className={ok ? 'text-emerald-800 dark:text-emerald-300' : 'font-medium text-amber-900 dark:text-amber-100'}>
                  {item.label}
                </span>
              </li>
            );
          })}
        </ul>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-1 border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
          onClick={() => navigate(`/admin/configuration/brands/${brandId}`)}
        >
          <ExternalLink className="mr-1.5 size-3.5" />
          Configure Brand
        </Button>
      </AlertDescription>
    </Alert>
  );
}
