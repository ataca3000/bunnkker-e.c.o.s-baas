// Phase 1.1 — deferred; restore nav entry in module-navigation.ts to activate (PKG-TRANSFERS-001)
import { ArrowLeftRight, Construction } from 'lucide-react';

import { PageHeader } from '@/components/crud';
import { Card, CardContent } from '@/components/ui/card';
import { ROUTES } from '@/router/routes';

export function StockTransfersPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Stock Transfers"
        subtitle="Manage inter-warehouse stock movements"
        breadcrumbs={[
          { label: 'Home', to: ROUTES.dashboard },
          { label: 'Stock Transfers' },
        ]}
      />

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Construction className="size-7 text-muted-foreground" />
          </div>
          <div>
            <p className="text-base font-semibold">Stock Transfers — Coming Soon</p>
            <p className="text-muted-foreground mt-1 text-sm max-w-sm">
              Inter-warehouse transfer management is planned for a future release.
              Transfer movements are already tracked in the{' '}
              <a
                href={ROUTES.stockLedger}
                className="text-primary underline underline-offset-2 hover:no-underline"
              >
                Stock Ledger
              </a>{' '}
              as <code className="rounded bg-muted px-1 py-0.5 text-xs">transfer_in</code> /{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">transfer_out</code> entries.
            </p>
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-2">
            <ArrowLeftRight className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Roadmap: PKG-TRANSFERS-001</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
