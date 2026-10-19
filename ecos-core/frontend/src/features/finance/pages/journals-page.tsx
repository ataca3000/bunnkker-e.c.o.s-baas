import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, CheckCircle2, Clock, Plus, RotateCcw } from 'lucide-react';

import { ActionMenu } from '@/components/crud';
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
import { useFormatter } from '@/hooks/use-formatter';

import { JournalDetailDrawer } from '../components/journal-detail-drawer';
import { JournalFormDrawer } from '../components/journal-form-drawer';
import { JournalStatusBadge } from '../components/journal-status-badge';
import { useApproveJournal, useJournals } from '../hooks/use-finance-gl';
import type { Journal, JournalStatus } from '../types/finance-gl';

/** Statuses the API actually emits (approved/locked/cancelled exist in the enum but the
 *  Journal HTTP API never produces them — see the report's Backend Gaps). */
const STATUS_FILTERS: (JournalStatus | 'all')[] = ['all', 'draft', 'posted', 'reversed'];

/**
 * TASK-FIN-UI-002 · Journal Entries + Approval workspace.
 * Consumes GET /finance/journals (status filter only), /{uuid}, POST create, PATCH approve,
 * POST reverse, DELETE discard. Statuses use the backend's own names (Draft / Posted /
 * Reversed) — no invented "approval queue". Search is client-side (no search param exists).
 */
export function JournalsPage() {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const { can } = usePermission();

  const [statusFilter, setStatusFilter] = useState<JournalStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const journals = useJournals(statusFilter === 'all' ? {} : { status: statusFilter });
  const approve = useApproveJournal();

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = journals.data ?? [];
    if (!term) return list;
    return list.filter((j) =>
      [j.reference ?? '', j.description ?? ''].some((v) => v.toLowerCase().includes(term)),
    );
  }, [journals.data, search]);

  const metrics = useMemo<WorkspaceMetric[]>(() => {
    const list = journals.data ?? [];
    return [
      { id: 'total', icon: BookOpen, label: t(($) => $.gl.journal.kpi.total), value: list.length, isLoading: journals.isLoading },
      { id: 'draft', icon: Clock, label: t(($) => $.gl.journal.kpi.draft), value: list.filter((j) => j.status === 'draft').length, isLoading: journals.isLoading, colorClass: 'text-amber-600' },
      { id: 'posted', icon: CheckCircle2, label: t(($) => $.gl.journal.kpi.posted), value: list.filter((j) => j.status === 'posted').length, isLoading: journals.isLoading },
      { id: 'reversed', icon: RotateCcw, label: t(($) => $.gl.journal.kpi.reversed), value: list.filter((j) => j.status === 'reversed').length, isLoading: journals.isLoading },
    ];
  }, [journals.data, journals.isLoading, t]);

  const openDetail = (id: string) => { setDetailId(id); setDetailOpen(true); };

  const columns = useMemo<DataGridColumnDef<Journal>[]>(() => [
    { key: 'reference', label: t(($) => $.gl.journal.reference), pin: 'left', cell: (j) => <span className="font-medium">{j.reference || t(($) => $.gl.journal.entry)}</span> },
    { key: 'description', label: t(($) => $.gl.journal.description), cell: (j) => <span className="text-muted-foreground">{j.description || '—'}</span> },
    { key: 'entry_date', label: t(($) => $.gl.journal.entryDate), sortable: true, cell: (j) => fmt.date(j.entry_date) },
    { key: 'status', label: t(($) => $.gl.journal.statusLabel), cell: (j) => <JournalStatusBadge status={j.status} /> },
    { key: 'total_debit', label: t(($) => $.gl.journal.totalDebit), align: 'end', cell: (j) => <span className="tabular-nums">{fmt.money(j.total_debit)}</span> },
    { key: 'total_credit', label: t(($) => $.gl.journal.totalCredit), align: 'end', cell: (j) => <span className="tabular-nums">{fmt.money(j.total_credit)}</span> },
    {
      key: 'actions', label: '', pin: 'right', align: 'end', alwaysVisible: true,
      cell: (j) => {
        const items = [
          { key: 'view', label: t(($) => $.gl.actions.view), onSelect: () => openDetail(j.id) },
          ...(j.status === 'draft' && can('finance.journal.post')
            ? [{ key: 'approve', label: t(($) => $.gl.actions.approve), onSelect: () => approve.mutate(j.id) }]
            : []),
        ];
        return <ActionMenu items={items} />;
      },
    },
  ], [t, fmt, can, approve]);

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: t(($) => $.breadcrumb.finance) }, { label: t(($) => $.gl.journal.title) }]}
        title={t(($) => $.gl.journal.title)}
        description={t(($) => $.gl.journal.subtitle)}
        metrics={metrics}
      />
      <WorkspacePage
        toolbar={
          <SmartToolbar
            primaryAction={can('finance.journal.create') ? { label: t(($) => $.gl.journal.new), icon: Plus, onClick: () => setCreateOpen(true) } : undefined}
            onRefresh={() => journals.refetch()}
            isFetching={journals.isFetching}
            viewControls={
              <div className="flex items-center gap-2">
                <Input placeholder={t(($) => $.gl.journal.searchPlaceholder)} value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-48" />
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as JournalStatus | 'all')}>
                  <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTERS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s === 'all' ? t(($) => $.gl.journal.filter.all) : t(($) => $.gl.journal.status[s])}
                      </SelectItem>
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
          rowId={(j) => j.id}
          loading={journals.isLoading}
          error={journals.isError}
          onRowClick={(j) => openDetail(j.id)}
          emptyState={<p className="py-10 text-center text-sm text-muted-foreground">{t(($) => $.gl.journal.empty)}</p>}
        />
      </WorkspacePage>

      <JournalDetailDrawer journalId={detailId} open={detailOpen} onOpenChange={setDetailOpen} />
      <JournalFormDrawer open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

export default JournalsPage;
