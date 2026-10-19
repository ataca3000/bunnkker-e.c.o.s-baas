import { useTranslation } from 'react-i18next';

import { PageDrawer } from '@/components/page';
import { useFormatter } from '@/hooks/use-formatter';

import { useSupplierLedger } from '../hooks/use-finance-ap';

type Props = { supplierId: string | null; open: boolean; onOpenChange: (open: boolean) => void };

/**
 * Supplier AP ledger drill-down (`GET /finance/ap/suppliers/{id}/ledger`). Shows the
 * backend-computed opening/closing balance and the running-balance line movements. Keyed by
 * `supplier_id` — Finance carries no supplier name (see the Finance ↔ vendor boundary). No
 * values are recalculated in the browser.
 */
export function SupplierLedgerDrawer({ supplierId, open, onOpenChange }: Props) {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const query = useSupplierLedger(open ? supplierId : null);
  const ledger = query.data;

  return (
    <PageDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t(($) => $.ap.ledger.title)}
      description={supplierId ?? undefined}
      size="2xl"
    >
      {query.isLoading && <p className="text-sm text-muted-foreground">{t(($) => $.loading)}</p>}
      {query.isError && <p className="text-sm text-red-600">{t(($) => $.error)}</p>}
      {ledger && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-6 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <span><span className="text-muted-foreground">{t(($) => $.ap.ledger.opening)}: </span><span className="tabular-nums font-semibold">{fmt.money(ledger.opening_balance)}</span></span>
            <span><span className="text-muted-foreground">{t(($) => $.ap.ledger.closing)}: </span><span className="tabular-nums font-semibold">{fmt.money(ledger.closing_balance)}</span></span>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">{t(($) => $.ap.ledger.date)}</th>
                  <th className="p-2 text-start">{t(($) => $.ap.ledger.type)}</th>
                  <th className="p-2 text-start">{t(($) => $.gl.journal.description)}</th>
                  <th className="p-2 text-end">{t(($) => $.gl.coa.balance.debit)}</th>
                  <th className="p-2 text-end">{t(($) => $.gl.coa.balance.credit)}</th>
                  <th className="p-2 text-end">{t(($) => $.ap.ledger.runningBalance)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ledger.lines.map((l) => (
                  <tr key={l.uuid}>
                    <td className="p-2 whitespace-nowrap">{fmt.date(l.entry_date)}</td>
                    <td className="p-2">{t(($) => $.ap.entryType[l.entry_type])}</td>
                    <td className="p-2 text-muted-foreground">{l.description || '—'}</td>
                    <td className="p-2 text-end tabular-nums">{l.debit ? fmt.money(l.debit) : '—'}</td>
                    <td className="p-2 text-end tabular-nums">{l.credit ? fmt.money(l.credit) : '—'}</td>
                    <td className="p-2 text-end tabular-nums font-medium">{fmt.money(l.running_balance)}</td>
                  </tr>
                ))}
                {ledger.lines.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{t(($) => $.empty)}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageDrawer>
  );
}
