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

import { BillStatusBadge, PaymentStatusBadge, SupplierRef } from '../components/ap-badges';
import { SupplierLedgerDrawer } from '../components/supplier-ledger-drawer';
import { useApAging, useApBills, useApPayments } from '../hooks/use-finance-ap';
import { AP_AGING_BUCKETS, type ApAgingSupplierRow, type ApBill, type ApPayment } from '../types/finance-ap';

/**
 * EPIC-FINANCE-UI-001 · Phase 5 — Accounts Payable (read-only).
 * Consumes the certified AP endpoints (aging, bills, payments, supplier ledger). Values are
 * shown exactly as returned — never recalculated in the browser. The AP API exposes only
 * `supplier_id` (no name); ids are shown verbatim (see the report's Finance ↔ vendor boundary).
 * No backend changes; IAM-gated by finance.ap.view; EN/AR; responsive.
 */
export function AccountsPayablePage() {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const { can } = usePermission();

  const aging = useApAging();
  const [ledgerSupplier, setLedgerSupplier] = useState<string | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);

  const openLedger = (supplierId: string) => { setLedgerSupplier(supplierId); setLedgerOpen(true); };

  const metrics = useMemo<WorkspaceMetric[]>(() => {
    const totals = aging.data?.totals;
    return [
      { id: 'total', icon: Wallet, label: t(($) => $.ap.kpi.totalOutstanding), value: fmt.money(totals?.total), isLoading: aging.isLoading },
      { id: 'current', icon: Coins, label: t(($) => $.ap.kpi.current), value: fmt.money(totals?.current), isLoading: aging.isLoading },
      { id: 'over90', icon: AlertTriangle, label: t(($) => $.ap.kpi.over90), value: fmt.money(totals?.['90_plus']), isLoading: aging.isLoading, colorClass: 'text-red-600' },
      { id: 'suppliers', icon: Users, label: t(($) => $.ap.kpi.suppliers), value: aging.data?.suppliers.length ?? 0, isLoading: aging.isLoading },
    ];
  }, [aging.data, aging.isLoading, fmt, t]);

  if (!can('finance.ap.view')) {
    return (
      <>
        <WorkspaceHeader breadcrumbs={[{ label: t(($) => $.breadcrumb.finance) }, { label: t(($) => $.ap.title) }]} title={t(($) => $.ap.title)} />
        <WorkspacePage><NoAccess /></WorkspacePage>
      </>
    );
  }

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: t(($) => $.breadcrumb.finance) }, { label: t(($) => $.ap.title) }]}
        title={t(($) => $.ap.title)}
        description={t(($) => $.ap.subtitle)}
        metrics={metrics}
      />
      <WorkspacePage>
        <Tabs defaultValue="aging">
          <TabsList>
            <TabsTrigger value="aging">{t(($) => $.ap.tab.aging)}</TabsTrigger>
            <TabsTrigger value="bills">{t(($) => $.ap.tab.bills)}</TabsTrigger>
            <TabsTrigger value="payments">{t(($) => $.ap.tab.payments)}</TabsTrigger>
          </TabsList>

          <TabsContent value="aging" className="mt-4">
            <AgingTab onDrill={openLedger} />
          </TabsContent>
          <TabsContent value="bills" className="mt-4">
            <BillsTab />
          </TabsContent>
          <TabsContent value="payments" className="mt-4">
            <PaymentsTab />
          </TabsContent>
        </Tabs>
      </WorkspacePage>

      <SupplierLedgerDrawer supplierId={ledgerSupplier} open={ledgerOpen} onOpenChange={setLedgerOpen} />
    </>
  );
}

// ── Aging (AP supplier balance view) ──────────────────────────────────────────

function AgingTab({ onDrill }: { onDrill: (supplierId: string) => void }) {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const aging = useApAging();

  const columns = useMemo<DataGridColumnDef<ApAgingSupplierRow>[]>(() => [
    { key: 'supplier_id', label: t(($) => $.ap.aging.supplier), pin: 'left', cell: (r) => <SupplierRef id={r.supplier_id} /> },
    ...AP_AGING_BUCKETS.map((b): DataGridColumnDef<ApAgingSupplierRow> => ({
      key: b, label: t(($) => $.ap.bucket[b]), align: 'end',
      cell: (r) => <span className="tabular-nums">{r[b] ? fmt.money(r[b]) : '—'}</span>,
    })),
    { key: 'total', label: t(($) => $.ap.aging.total), align: 'end', cell: (r) => <span className="tabular-nums font-medium">{fmt.money(r.total)}</span> },
  ], [t, fmt]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t(($) => $.ap.supplierNote)}</p>

      <UniversalDataGrid
        data={aging.data?.suppliers ?? []}
        columns={columns}
        rowId={(r) => r.supplier_id}
        loading={aging.isLoading}
        error={aging.isError}
        onRowClick={(r) => onDrill(r.supplier_id)}
        emptyState={<p className="py-10 text-center text-sm text-muted-foreground">{t(($) => $.empty)}</p>}
      />

      {aging.data && (
        <div className="flex flex-wrap items-center justify-end gap-5 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          {AP_AGING_BUCKETS.map((b) => (
            <span key={b}><span className="text-muted-foreground">{t(($) => $.ap.bucket[b])}: </span><span className="tabular-nums font-medium">{fmt.money(aging.data.totals[b])}</span></span>
          ))}
          <span><span className="text-muted-foreground">{t(($) => $.ap.aging.total)}: </span><span className="tabular-nums font-semibold">{fmt.money(aging.data.totals.total)}</span></span>
        </div>
      )}
    </div>
  );
}

// ── Bills (with the backend `outstanding` figure) ─────────────────────────────

function BillsTab() {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const bills = useApBills();

  const columns = useMemo<DataGridColumnDef<ApBill>[]>(() => [
    { key: 'number', label: t(($) => $.ap.bill.number), pin: 'left', cell: (b) => <span className="font-medium">{b.number}</span> },
    { key: 'supplier_id', label: t(($) => $.ap.bill.supplier), cell: (b) => <SupplierRef id={b.supplier_id} /> },
    { key: 'document_type', label: t(($) => $.ap.bill.type), cell: (b) => t(($) => $.ap.docType[b.document_type]) },
    { key: 'bill_date', label: t(($) => $.ap.bill.billDate), cell: (b) => fmt.date(b.bill_date) },
    { key: 'due_date', label: t(($) => $.ap.bill.dueDate), cell: (b) => fmt.date(b.due_date) },
    { key: 'total', label: t(($) => $.ap.bill.total), align: 'end', cell: (b) => <span className="tabular-nums">{fmt.money(b.total)}</span> },
    { key: 'outstanding', label: t(($) => $.ap.bill.outstanding), align: 'end', cell: (b) => <span className="tabular-nums font-medium">{b.outstanding == null ? '—' : fmt.money(b.outstanding)}</span> },
    { key: 'status', label: t(($) => $.ap.bill.status), cell: (b) => <BillStatusBadge status={b.status} /> },
  ], [t, fmt]);

  return (
    <UniversalDataGrid
      data={bills.data ?? []}
      columns={columns}
      rowId={(b) => b.id}
      loading={bills.isLoading}
      error={bills.isError}
      emptyState={<p className="py-10 text-center text-sm text-muted-foreground">{t(($) => $.ap.bill.empty)}</p>}
    />
  );
}

// ── Payments (strictly read-only; maker/checker status shown) ─────────────────

function PaymentsTab() {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const payments = useApPayments();

  const columns = useMemo<DataGridColumnDef<ApPayment>[]>(() => [
    { key: 'number', label: t(($) => $.ap.payment.number), pin: 'left', cell: (p) => <span className="font-medium">{p.number}</span> },
    { key: 'supplier_id', label: t(($) => $.ap.payment.supplier), cell: (p) => <SupplierRef id={p.supplier_id} /> },
    { key: 'payment_date', label: t(($) => $.ap.payment.date), cell: (p) => fmt.date(p.payment_date) },
    { key: 'amount', label: t(($) => $.ap.payment.amount), align: 'end', cell: (p) => <span className="tabular-nums">{fmt.money(p.amount)}</span> },
    { key: 'unallocated', label: t(($) => $.ap.payment.unallocated), align: 'end', cell: (p) => <span className="tabular-nums font-medium">{p.unallocated == null ? '—' : fmt.money(p.unallocated)}</span> },
    { key: 'status', label: t(($) => $.ap.payment.status), cell: (p) => <PaymentStatusBadge status={p.status} /> },
  ], [t, fmt]);

  return (
    <UniversalDataGrid
      data={payments.data ?? []}
      columns={columns}
      rowId={(p) => p.id}
      loading={payments.isLoading}
      error={payments.isError}
      emptyState={<p className="py-10 text-center text-sm text-muted-foreground">{t(($) => $.ap.payment.empty)}</p>}
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

export default AccountsPayablePage;
