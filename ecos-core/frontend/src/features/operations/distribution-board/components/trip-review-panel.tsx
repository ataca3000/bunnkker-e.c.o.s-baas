import { CheckCircle2, Package, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TripReviewManifest, TripReviewCustody } from '../types/distribution-board';
import { CUSTODY_ITEM_LABELS } from '../types/distribution-board';
import { cn } from '@/lib/utils';

interface Props {
  manifest: TripReviewManifest | null;
  custody: TripReviewCustody;
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    shortage:  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    pending:   'bg-muted text-muted-foreground',
    skipped:   'bg-slate-100 text-slate-600',
  };
  const labels: Record<string, string> = { confirmed: 'Confirmed', shortage: 'Shortage', pending: 'Pending', skipped: 'Skipped' };
  return (
    <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium', map[status] ?? 'bg-muted text-muted-foreground')}>
      {labels[status] ?? status}
    </span>
  );
}

export function TripReviewPanel({ manifest, custody }: Props) {
  return (
    <div className="space-y-6">
      {/* Manifest */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          Loaded Products
          {manifest && (
            <Badge variant="outline" className="text-xs ms-auto">
              {manifest.confirmed_products}/{manifest.total_products} confirmed
            </Badge>
          )}
        </h3>

        {!manifest ? (
          <p className="text-sm text-muted-foreground">No manifest created.</p>
        ) : manifest.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products in the manifest.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-start font-medium text-muted-foreground text-xs">Product</th>
                  <th className="px-3 py-2 text-end font-medium text-muted-foreground text-xs">Required</th>
                  <th className="px-3 py-2 text-end font-medium text-muted-foreground text-xs">Loaded</th>
                  <th className="px-3 py-2 text-end font-medium text-muted-foreground text-xs">Shortage</th>
                  <th className="px-3 py-2 text-end font-medium text-muted-foreground text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {manifest.items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <div className="font-medium text-sm leading-tight">{item.product_name}</div>
                      {item.product_sku && (
                        <div className="text-xs text-muted-foreground font-mono">{item.product_sku}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">{item.required_qty}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{item.loaded_qty ?? '—'}</td>
                    <td className="px-3 py-2 text-end tabular-nums text-red-600 dark:text-red-400">
                      {item.shortage_qty ? item.shortage_qty : '—'}
                    </td>
                    <td className="px-3 py-2 text-end">
                      <StatusChip status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Custody */}
      {custody.total > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            Custody
            <Badge variant="outline" className="text-xs ms-auto">
              {custody.confirmed}/{custody.total} confirmed
            </Badge>
          </h3>

          <div className="space-y-2">
            {custody.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border">
                {item.is_driver_confirmed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {CUSTODY_ITEM_LABELS[item.item_type] ?? item.item_type} · Qty: {item.quantity}
                    {item.received_quantity !== null && ` · Received: ${item.received_quantity}`}
                  </div>
                </div>
                {item.is_driver_confirmed ? (
                  <Badge className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                    Confirmed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">Pending</Badge>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {custody.total === 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-2">Custody</h3>
          <p className="text-sm text-muted-foreground">No custody items assigned to this trip.</p>
        </section>
      )}
    </div>
  );
}
