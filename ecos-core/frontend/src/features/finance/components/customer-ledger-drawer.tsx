import { useTranslation } from 'react-i18next';

import { PageDrawer } from '@/components/page';
import { useFormatter } from '@/hooks/use-formatter';

import { useCustomerLedger } from '../hooks/use-finance-ar';

type Props = { customerId: string | null; open: boolean; onOpenChange: (open: boolean) => void };

/**
 * Customer AR ledger drill-down (`GET /finance/ar/customers/{id}/ledger`). Shows the
 * backend-computed opening/closing balance and the running-balance line movements. This is
 * an AR balance view keyed by `customer_id` — Finance carries no customer name (see report's
 * Finance ↔ CRM Boundary). No values are recalculated in the browser.
 */
export function CustomerLedgerDrawer({ customerId, open, onOpenChange }: Props) {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const query = useCustomerLedger(open ? customerId : null);
  const ledger = query.data;

  return (
    <PageDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t(($) => $.ar.ledger.title)}
      description={customerId ?? undefined}
      size="2xl"
    >
      {query.isLoading && <p className="text-sm text-muted-foreground">{t(($) => $.loading)}</p>}
      {query.isError && <p className="text-sm text-red-600">{t(($) => $.error)}</p>}
      {ledger && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-6 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <span><span className="text-muted-foreground">{t(($) => $.ar.ledger.opening)}: </span><span className="tabular-nums font-semibold">{fmt.money(ledger.opening_balance)}</span></span>
            <span><span className="text-muted-foreground">{t(($) => $.ar.ledger.closing)}: </span><span className="tabular-nums font-semibold">{fmt.money(ledger.closing_balance)}</span></span>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">{t(($) => $.ar.ledger.date)}</th>
                  <th className="p-2 text-start">{t(($) => $.ar.ledger.type)}</th>
                  <th className="p-2 text-start">{t(($) => $.gl.journal.description)}</th>
                  <th className="p-2 text-end">{t(($) => $.gl.coa.balance.debit)}</th>
                  <th className="p-2 text-end">{t(($) => $.gl.coa.balance.credit)}</th>
                  <th className="p-2 text-end">{t(($) => $.ar.ledger.runningBalance)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ledger.lines.map((l) => (
                  <tr key={l.uuid}>
                    <td className="p-2 whitespace-nowrap">{fmt.date(l.entry_date)}</td>
                    <td className="p-2">{t(($) => $.ar.entryType[l.entry_type])}</td>
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
