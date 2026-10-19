import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  ActionMenu,
  ConfirmDialog,
  EntityTable,
  EntityToolbar,
  Pagination,
  StatusBadge,
} from '@/components/crud';
import type { ColumnDef } from '@/components/crud/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CompanySelect } from '@/features/branches/components/company-select';
import { BranchFormDrawer } from '@/features/branches/components/branch-form-drawer';
import { useBranchesQuery, useDeleteBranch } from '@/features/branches/hooks/use-branches';
import type { Branch, BranchSortField, BranchStatusFilter } from '@/features/branches/types/branch';

const PER_PAGE = 10;

/** Headless branches table — no PageHeader or Card wrapper. */
export function BranchesContent() {
  const { t } = useTranslation('branches');
  const { t: tCommon } = useTranslation('common');

  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<BranchStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: BranchSortField; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc',
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);

  const params = useMemo(
    () => ({
      search: search || undefined,
      company_id: companyFilter || undefined,
      status: statusFilter,
      page,
      per_page: PER_PAGE,
      sort_by: sort.field,
      sort_dir: sort.direction,
    }),
    [search, companyFilter, statusFilter, page, sort],
  );

  const { data, isLoading, isError, isFetching, refetch } = useBranchesQuery(params);
  const deleteBranch = useDeleteBranch();

  const items = data?.items ?? [];
  const meta = data?.meta;

  const handleSort = (field: string) => {
    setSort((curr) =>
      curr.field === field
        ? { field: field as BranchSortField, direction: curr.direction === 'asc' ? 'desc' : 'asc' }
        : { field: field as BranchSortField, direction: 'asc' },
    );
    setPage(1);
  };

  const columns: ColumnDef<Branch>[] = [
    { key: 'company', header: t($ => $.columns.company), cell: (b) => b.company?.name ?? '—' },
    {
      key: 'code',
      header: t($ => $.columns.code),
      sortable: true,
      cell: (b) => <span className="font-medium">{b.code}</span>,
    },
    { key: 'name', header: t($ => $.columns.name), sortable: true, cell: (b) => b.name },
    {
      key: 'phone',
      header: t($ => $.columns.phone),
      cell: (b) => <span className="text-muted-foreground">{b.phone ?? '—'}</span>,
    },
    { key: 'city', header: t($ => $.columns.city), sortable: true, cell: (b) => b.city ?? '—' },
    {
      key: 'is_head_office',
      header: t($ => $.columns.headOffice),
      sortable: true,
      cell: (b) =>
        b.is_head_office ? (
          <Badge>{t($ => $.columns.headOffice)}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'is_active',
      header: t($ => $.columns.status),
      sortable: true,
      cell: (b) => <StatusBadge status={b.is_active ? 'active' : 'inactive'} />,
    },
  ];

  return (
    <>
      <EntityToolbar
        searchPlaceholder={t($ => $.search)}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        onRefresh={() => void refetch()}
        isRefreshing={isFetching}
        onExport={() => undefined}
        onClearFilters={() => { setCompanyFilter(null); setStatusFilter('all'); setPage(1); }}
        filterPanel={
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{tCommon($ => $.filters.company)}</span>
              <CompanySelect
                value={companyFilter}
                onChange={(v) => { setCompanyFilter(v); setPage(1); }}
                placeholder={tCommon($ => $.filters.allCompanies)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{tCommon($ => $.filters.status)}</span>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as BranchStatusFilter); setPage(1); }}
                className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
              >
                <option value="all">{tCommon($ => $.status.all)}</option>
                <option value="active">{tCommon($ => $.status.active)}</option>
                <option value="inactive">{tCommon($ => $.status.inactive)}</option>
              </select>
            </div>
          </>
        }
      >
        <Button
          onClick={() => { setEditingBranch(null); setDrawerOpen(true); }}
        >
          <Plus className="size-4" />
          {t($ => $.actions.new)}
        </Button>
      </EntityToolbar>

      <EntityTable<Branch>
        columns={columns}
        data={items}
        getRowId={(b) => b.id}
        isLoading={isLoading}
        isError={isError}
        sort={sort}
        onSortChange={handleSort}
        rowActions={(branch) => (
          <ActionMenu
            label={`Actions for ${branch.name}`}
            items={[
              {
                key: 'edit',
                label: tCommon($ => $.common.edit),
                icon: Pencil,
                onSelect: () => { setEditingBranch(branch); setDrawerOpen(true); },
              },
              {
                key: 'delete',
                label: tCommon($ => $.common.delete),
                icon: Trash2,
                variant: 'destructive',
                onSelect: () => setDeletingBranch(branch),
              },
            ]}
          />
        )}
      />

      {meta ? (
        <Pagination
          meta={{ page: meta.current_page, perPage: meta.per_page, total: meta.total, lastPage: meta.last_page }}
          onPageChange={setPage}
        />
      ) : null}

      <BranchFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => { setDrawerOpen(open); if (!open) setEditingBranch(null); }}
        branch={editingBranch}
      />

      <ConfirmDialog
        open={deletingBranch !== null}
        onOpenChange={(open) => { if (!open) setDeletingBranch(null); }}
        title={t($ => $.delete.title)}
        description={tCommon($ => $.dialogs.softDeleteMessage, { name: deletingBranch?.name ?? '' })}
        confirmLabel={t($ => $.delete.confirm)}
        variant="destructive"
        loading={deleteBranch.isPending}
        onConfirm={() => {
          if (!deletingBranch) return;
          deleteBranch.mutate(deletingBranch.id, { onSuccess: () => setDeletingBranch(null) });
        }}
      />
    </>
  );
}
