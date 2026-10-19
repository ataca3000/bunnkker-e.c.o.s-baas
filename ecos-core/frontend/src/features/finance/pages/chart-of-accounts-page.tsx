import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, CheckCircle2, Landmark, Layers, Plus } from 'lucide-react';

import { ActionMenu, StatusBadge } from '@/components/crud';
import { UniversalDataGrid, SmartToolbar, type DataGridColumnDef } from '@/components/data-grid';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkspacePage } from '@/components/page';
import { WorkspaceHeader, type WorkspaceMetric } from '@/components/workspace';
import { usePermission } from '@/features/authorization';

import { AccountDetailDrawer } from '../components/account-detail-drawer';
import { AccountFormDrawer } from '../components/account-form-drawer';
import { useAccounts, useSetAccountActive } from '../hooks/use-finance-gl';
import type { Account, AccountType } from '../types/finance-gl';

const TYPES: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

/**
 * TASK-FIN-UI-002 · Chart of Accounts workspace.
 * Consumes GET /finance/accounts (+ options, POST create, PATCH active). No update endpoint
 * exists, so editing is limited to activate/deactivate. Search is client-side (the API
 * exposes no search param); type filter uses the server `type` param.
 */
export function ChartOfAccountsPage() {
  const { t } = useTranslation('finance');
  const { can } = usePermission();
  const canManage = can('finance.coa.manage');

  const [typeFilter, setTypeFilter] = useState<AccountType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Account | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const accounts = useAccounts(typeFilter === 'all' ? {} : { type: typeFilter });
  const setActive = useSetAccountActive();

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = accounts.data ?? [];
    if (!term) return list;
    return list.filter((a) =>
      [a.code, a.name, a.name_ar ?? ''].some((v) => v.toLowerCase().includes(term)),
    );
  }, [accounts.data, search]);

  const metrics = useMemo<WorkspaceMetric[]>(() => {
    const list = accounts.data ?? [];
    return [
      { id: 'total', icon: BookOpen, label: t(($) => $.gl.coa.kpi.total), value: list.length, isLoading: accounts.isLoading },
      { id: 'postable', icon: Layers, label: t(($) => $.gl.coa.kpi.postable), value: list.filter((a) => a.is_postable).length, isLoading: accounts.isLoading },
      { id: 'control', icon: Landmark, label: t(($) => $.gl.coa.kpi.control), value: list.filter((a) => a.is_control).length, isLoading: accounts.isLoading },
      { id: 'active', icon: CheckCircle2, label: t(($) => $.gl.coa.kpi.active), value: list.filter((a) => a.is_active).length, isLoading: accounts.isLoading },
    ];
  }, [accounts.data, accounts.isLoading, t]);

  const columns = useMemo<DataGridColumnDef<Account>[]>(() => [
    { key: 'code', label: t(($) => $.gl.coa.field.code), pin: 'left', sortable: true, cell: (a) => <span className="font-medium tabular-nums">{a.code}</span> },
    {
      key: 'name', label: t(($) => $.gl.coa.field.name), sortable: true,
      cell: (a) => (
        <div className="min-w-0">
          <div className="truncate">{a.name}</div>
          {a.name_ar && <div className="truncate text-xs text-muted-foreground" dir="rtl">{a.name_ar}</div>}
        </div>
      ),
    },
    { key: 'account_type', label: t(($) => $.gl.coa.field.type), cell: (a) => t(($) => $.gl.coa.type[a.account_type]) },
    { key: 'account_category', label: t(($) => $.gl.coa.field.category), cell: (a) => (a.account_category ? a.account_category.replace(/_/g, ' ') : '—') },
    { key: 'normal_balance', label: t(($) => $.gl.coa.field.normalBalance), cell: (a) => t(($) => $.gl.coa.balance[a.normal_balance]) },
    { key: 'statement', label: t(($) => $.gl.coa.field.statement), cell: (a) => t(($) => $.gl.coa.statement[a.statement]) },
    { key: 'currency', label: t(($) => $.gl.coa.field.currency), align: 'center', cell: (a) => a.currency },
    { key: 'is_control', label: t(($) => $.gl.coa.field.control), align: 'center', cell: (a) => (a.is_control ? t(($) => $.gl.yes) : t(($) => $.gl.no)) },
    { key: 'is_active', label: t(($) => $.gl.coa.field.status), cell: (a) => <StatusBadge status={a.is_active ? 'active' : 'inactive'} /> },
    {
      key: 'actions', label: '', pin: 'right', align: 'end', alwaysVisible: true,
      cell: (a) => {
        const items = [
          { key: 'view', label: t(($) => $.gl.actions.view), onSelect: () => { setDetail(a); setDetailOpen(true); } },
          ...(canManage
            ? [{
                key: 'toggle',
                label: a.is_active ? t(($) => $.gl.actions.deactivate) : t(($) => $.gl.actions.activate),
                onSelect: () => setActive.mutate({ uuid: a.id, isActive: !a.is_active }),
              }]
            : []),
        ];
        return <ActionMenu items={items} />;
      },
    },
  ], [t, canManage, setActive]);

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: t(($) => $.breadcrumb.finance) }, { label: t(($) => $.gl.coa.title) }]}
        title={t(($) => $.gl.coa.title)}
        description={t(($) => $.gl.coa.subtitle)}
        metrics={metrics}
      />
      <WorkspacePage
        toolbar={
          <SmartToolbar
            primaryAction={canManage ? { label: t(($) => $.gl.coa.new), icon: Plus, onClick: () => setCreateOpen(true) } : undefined}
            onRefresh={() => accounts.refetch()}
            isFetching={accounts.isFetching}
            viewControls={
              <div className="flex items-center gap-2">
                <Input
                  placeholder={t(($) => $.gl.coa.searchPlaceholder)}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-48"
                />
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as AccountType | 'all')}>
                  <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t(($) => $.gl.coa.filter.allTypes)}</SelectItem>
                    {TYPES.map((ty) => (
                      <SelectItem key={ty} value={ty}>{t(($) => $.gl.coa.type[ty])}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            }
          />
        }
      >
        <UniversalDataGrid
          data={rows}
          columns={columns}
          rowId={(a) => a.id}
          loading={accounts.isLoading}
          error={accounts.isError}
          onRowClick={(a) => { setDetail(a); setDetailOpen(true); }}
          emptyState={<p className="py-10 text-center text-sm text-muted-foreground">{t(($) => $.gl.coa.empty)}</p>}
        />
      </WorkspacePage>

      <AccountDetailDrawer account={detail} open={detailOpen} onOpenChange={setDetailOpen} />
      <AccountFormDrawer open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

export default ChartOfAccountsPage;
