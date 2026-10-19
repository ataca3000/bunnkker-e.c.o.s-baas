import { useMemo, useState } from 'react';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  ActionMenu,
  ConfirmDialog,
  EntityTable,
  EntityToolbar,
  PageHeader,
  Pagination,
  StatusBadge,
} from '@/components/crud';
import type { ColumnDef } from '@/components/crud/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BranchFormDrawer } from '@/features/branches/components/branch-form-drawer';
import { CompanySelect } from '@/features/branches/components/company-select';
import { useBranchesQuery, useDeleteBranch } from '@/features/branches/hooks/use-branches';
import type { Branch, BranchSortField, BranchStatusFilter } from '@/features/branches/types/branch';
import { ROUTES } from '@/router/routes';

const PER_PAGE = 10;

export function BranchesPage() {
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
  const [drawerBranch, setDrawerBranch] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState<Branch | null>(null);

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

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleSort = (field: string) => {
    setSort((current) =>
      current.field === field
        ? { field: field as BranchSortField, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { field: field as BranchSortField, direction: 'asc' },
    );
    setPage(1);
  };

  const openCreate = () => {
    setDrawerBranch(null);
    setDrawerOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setDrawerBranch(branch);
    setDrawerOpen(true);
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

  const confirmDelete = () => {
    if (!deleting) return;
    deleteBranch.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.title)}
        subtitle={t($ => $.subtitle)}
        breadcrumbs={[
          { label: tCommon($ => $.home), to: ROUTES.dashboard },
          { label: 'Organization', to: ROUTES.organization },
          { label: t($ => $.title) },
        ]}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {t($ => $.actions.new)}
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <EntityToolbar
            searchPlaceholder={t($ => $.search)}
            onSearchChange={handleSearch}
            onRefresh={() => void refetch()}
            isRefreshing={isFetching}
            onExport={() => undefined}
            onClearFilters={() => {
              setCompanyFilter(null);
              setStatusFilter('all');
              setPage(1);
            }}
            filterPanel={
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{tCommon($ => $.filters.company)}</span>
                  <CompanySelect
                    value={companyFilter}
                    onChange={(value) => {
                      setCompanyFilter(value);
                      setPage(1);
                    }}
                    placeholder={tCommon($ => $.filters.allCompanies)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{tCommon($ => $.filters.status)}</span>
                  <select
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(event.target.value as BranchStatusFilter);
                      setPage(1);
                    }}
                    className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                  >
                    <option value="all">{tCommon($ => $.status.all)}</option>
                    <option value="active">{tCommon($ => $.status.active)}</option>
                    <option value="inactive">{tCommon($ => $.status.inactive)}</option>
                  </select>
                </div>
              </>
            }
          />

          <EntityTable<Branch>
            columns={columns}
            data={items}
            getRowId={(branch) => branch.id}
            isLoading={isLoading}
            isError={isError}
            sort={sort}
            onSortChange={handleSort}
            rowActions={(branch) => (
              <ActionMenu
                label={`Actions for ${branch.name}`}
                items={[
                  { key: 'view', label: tCommon($ => $.actions.view), icon: Eye, onSelect: () => openEdit(branch) },
                  { key: 'edit', label: tCommon($ => $.common.edit), icon: Pencil, onSelect: () => openEdit(branch) },
                  {
                    key: 'delete',
                    label: tCommon($ => $.common.delete),
                    icon: Trash2,
                    variant: 'destructive',
                    onSelect: () => setDeleting(branch),
                  },
                ]}
              />
            )}
          />

          {meta ? (
            <Pagination
              meta={{
                page: meta.current_page,
                perPage: meta.per_page,
                total: meta.total,
                lastPage: meta.last_page,
              }}
              onPageChange={setPage}
            />
          ) : null}
        </CardContent>
      </Card>

      <BranchFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setDrawerBranch(null);
        }}
        branch={drawerBranch}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t($ => $.delete.title)}
        description={tCommon($ => $.dialogs.softDeleteMessage, { name: deleting?.name ?? '' })}
        confirmLabel={t($ => $.delete.confirm)}
        variant="destructive"
        loading={deleteBranch.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
