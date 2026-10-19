import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Coins, Users, Wallet } from 'lucide-react';

import { UniversalDataGrid, type DataGridColumnDef } from '@/components/data-grid';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkspacePage } from '@/components/page';
import { WorkspaceHeader, type WorkspaceMetric } from '@/components/workspace';
import { usePermission } from '@/features/authorization';
import { useFormatter } from '@/hooks/use-formatter';

import { CustomerRef, DocumentStatusBadge } from '../components/ar-badges';
import { CustomerLedgerDrawer } from '../components/customer-ledger-drawer';
import { useArAging, useArInvoices, useArReceipts } from '../hooks/use-finance-ar';
import { AGING_BUCKETS, type AgingCustomerRow, type ArInvoice, type ArReceipt } from '../types/finance-ar';

/**
 * EPIC-FINANCE-UI-001 · Phase 4 — Accounts Receivable (read-only).
 * Consumes the certified AR endpoints (aging, invoices, receipts, customer ledger, control
 * reconciliation). Values are shown exactly as returned — never recalculated in the browser.
 * The AR API exposes only `customer_id` (no name); ids are shown verbatim (see the report's
 * Finance ↔ CRM Boundary). No backend changes; IAM-gated by finance.ar.view; EN/AR; responsive.
 */
export function AccountsReceivablePage() {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const { can } = usePermission();

  const aging = useArAging();
  const [ledgerCustomer, setLedgerCustomer] = useState<string | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);

  const openLedger = (customerId: string) => { setLedgerCustomer(customerId); setLedgerOpen(true); };

  const metrics = useMemo<WorkspaceMetric[]>(() => {
    const totals = aging.data?.totals;
    return [
      { id: 'total', icon: Wallet, label: t(($) => $.ar.kpi.totalOutstanding), value: fmt.money(totals?.total), isLoading: aging.isLoading },
      { id: 'current', icon: Coins, label: t(($) => $.ar.kpi.current), value: fmt.money(totals?.current), isLoading: aging.isLoading },
      { id: 'over90', icon: AlertTriangle, label: t(($) => $.ar.kpi.over90), value: fmt.money(totals?.['90_plus']), isLoading: aging.isLoading, colorClass: 'text-red-600' },
      { id: 'customers', icon: Users, label: t(($) => $.ar.kpi.customers), value: aging.data?.customers.length ?? 0, isLoading: aging.isLoading },
    ];
  }, [aging.data, aging.isLoading, fmt, t]);

  if (!can('finance.ar.view')) {
    return (
      <>
        <WorkspaceHeader breadcrumbs={[{ label: t(($) => $.breadcrumb.finance) }, { label: t(($) => $.ar.title) }]} title={t(($) => $.ar.title)} />
        <WorkspacePage><NoAccess /></WorkspacePage>
      </>
    );
  }

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: t(($) => $.breadcrumb.finance) }, { label: t(($) => $.ar.title) }]}
        title={t(($) => $.ar.title)}
        description={t(($) => $.ar.subtitle)}
        metrics={metrics}
      />
      <WorkspacePage>
        <Tabs defaultValue="aging">
          <TabsList>
            <TabsTrigger value="aging">{t(($) => $.ar.tab.aging)}</TabsTrigger>
            <TabsTrigger value="invoices">{t(($) => $.ar.tab.invoices)}</TabsTrigger>
            <TabsTrigger value="receipts">{t(($) => $.ar.tab.receipts)}</TabsTrigger>
          </TabsList>

          <TabsContent value="aging" className="mt-4">
            <AgingTab onDrill={openLedger} />
          </TabsContent>
          <TabsContent value="invoices" className="mt-4">
            <InvoicesTab />
          </TabsContent>
          <TabsContent value="receipts" className="mt-4">
            <ReceiptsTab />
          </TabsContent>
        </Tabs>
      </WorkspacePage>

      <CustomerLedgerDrawer customerId={ledgerCustomer} open={ledgerOpen} onOpenChange={setLedgerOpen} />
    </>
  );
}

// ── Aging (AR customer balance view) ──────────────────────────────────────────

function AgingTab({ onDrill }: { onDrill: (customerId: string) => void }) {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const aging = useArAging();

  const columns = useMemo<DataGridColumnDef<AgingCustomerRow>[]>(() => [
    { key: 'customer_id', label: t(($) => $.ar.aging.customer), pin: 'left', cell: (r) => <CustomerRef id={r.customer_id} /> },
    ...AGING_BUCKETS.map((b): DataGridColumnDef<AgingCustomerRow> => ({
      key: b, label: t(($) => $.ar.bucket[b]), align: 'end',
      cell: (r) => <span className="tabular-nums">{r[b] ? fmt.money(r[b]) : '—'}</span>,
    })),
    { key: 'total', label: t(($) => $.ar.aging.total), align: 'end', cell: (r) => <span className="tabular-nums font-medium">{fmt.money(r.total)}</span> },
  ], [t, fmt]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t(($) => $.ar.customerNote)}</p>

      <UniversalDataGrid
        data={aging.data?.customers ?? []}
        columns={columns}
        rowId={(r) => r.customer_id}
        loading={aging.isLoading}
        error={aging.isError}
        onRowClick={(r) => onDrill(r.customer_id)}
        emptyState={<p className="py-10 text-center text-sm text-muted-foreground">{t(($) => $.empty)}</p>}
      />

      {aging.data && (
        <div className="flex flex-wrap items-center justify-end gap-5 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          {AGING_BUCKETS.map((b) => (
            <span key={b}><span className="text-muted-foreground">{t(($) => $.ar.bucket[b])}: </span><span className="tabular-nums font-medium">{fmt.money(aging.data.totals[b])}</span></span>
          ))}
          <span><span className="text-muted-foreground">{t(($) => $.ar.aging.total)}: </span><span className="tabular-nums font-semibold">{fmt.money(aging.data.totals.total)}</span></span>
        </div>
      )}
    </div>
  );
}

// ── Invoices (with the backend `outstanding` figure) ──────────────────────────

function InvoicesTab() {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const invoices = useArInvoices();

  const columns = useMemo<DataGridColumnDef<ArInvoice>[]>(() => [
    { key: 'number', label: t(($) => $.ar.invoice.number), pin: 'left', cell: (i) => <span className="font-medium">{i.number}</span> },
    { key: 'customer_id', label: t(($) => $.ar.invoice.customer), cell: (i) => <CustomerRef id={i.customer_id} /> },
    { key: 'document_type', label: t(($) => $.ar.invoice.type), cell: (i) => t(($) => $.ar.docType[i.document_type]) },
    { key: 'invoice_date', label: t(($) => $.ar.invoice.invoiceDate), cell: (i) => fmt.date(i.invoice_date) },
    { key: 'due_date', label: t(($) => $.ar.invoice.dueDate), cell: (i) => fmt.date(i.due_date) },
    { key: 'total', label: t(($) => $.ar.invoice.total), align: 'end', cell: (i) => <span className="tabular-nums">{fmt.money(i.total)}</span> },
    { key: 'outstanding', label: t(($) => $.ar.invoice.outstanding), align: 'end', cell: (i) => <span className="tabular-nums font-medium">{i.outstanding == null ? '—' : fmt.money(i.outstanding)}</span> },
    { key: 'status', label: t(($) => $.ar.invoice.status), cell: (i) => <DocumentStatusBadge status={i.status} /> },
  ], [t, fmt]);

  return (
    <UniversalDataGrid
      data={invoices.data ?? []}
      columns={columns}
      rowId={(i) => i.id}
      loading={invoices.isLoading}
      error={invoices.isError}
      emptyState={<p className="py-10 text-center text-sm text-muted-foreground">{t(($) => $.ar.invoice.empty)}</p>}
    />
  );
}

// ── Receipts (strictly read-only) ─────────────────────────────────────────────

function ReceiptsTab() {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const receipts = useArReceipts();

  const columns = useMemo<DataGridColumnDef<ArReceipt>[]>(() => [
    { key: 'number', label: t(($) => $.ar.receipt.number), pin: 'left', cell: (r) => <span className="font-medium">{r.number}</span> },
    { key: 'customer_id', label: t(($) => $.ar.receipt.customer), cell: (r) => <CustomerRef id={r.customer_id} /> },
    { key: 'receipt_date', label: t(($) => $.ar.receipt.date), cell: (r) => fmt.date(r.receipt_date) },
    { key: 'amount', label: t(($) => $.ar.receipt.amount), align: 'end', cell: (r) => <span className="tabular-nums">{fmt.money(r.amount)}</span> },
    { key: 'unallocated', label: t(($) => $.ar.receipt.unallocated), align: 'end', cell: (r) => <span className="tabular-nums font-medium">{r.unallocated == null ? '—' : fmt.money(r.unallocated)}</span> },
    { key: 'status', label: t(($) => $.ar.receipt.status), cell: (r) => <DocumentStatusBadge status={r.status} /> },
  ], [t, fmt]);

  return (
    <UniversalDataGrid
      data={receipts.data ?? []}
      columns={columns}
      rowId={(r) => r.id}
      loading={receipts.isLoading}
      error={receipts.isError}
      emptyState={<p className="py-10 text-center text-sm text-muted-foreground">{t(($) => $.ar.receipt.empty)}</p>}
    />
  );
}

function NoAccess() {
  const { t } = useTranslation('finance');
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">{t(($) => $.gl.statements.noAccess)}</CardContent>
    </Card>
  );
}

export default AccountsReceivablePage;
