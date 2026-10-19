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
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UnitFormDrawer } from '@/features/units/components/unit-form-drawer';
import { useUnitsQuery, useDeleteUnit } from '@/features/units/hooks/use-units';
import type { Unit, UnitSortField } from '@/features/units/types/unit';
import { ROUTES } from '@/router/routes';

const PER_PAGE = 10;

export function UnitsPage() {
  const { t } = useTranslation('units');
  const { t: tCommon } = useTranslation('common');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: UnitSortField; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc',
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerUnit, setDrawerUnit] = useState<Unit | null>(null);
  const [deleting, setDeleting] = useState<Unit | null>(null);

  const params = useMemo(
    () => ({
      search: search || undefined,
      page,
      per_page: PER_PAGE,
      sort_by: sort.field,
      sort_dir: sort.direction,
    }),
    [search, page, sort],
  );

  const { data, isLoading, isError, isFetching, refetch } = useUnitsQuery(params);
  const deleteUnit = useDeleteUnit();

  const items = data?.items ?? [];
  const meta = data?.meta;

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleSort = (field: string) => {
    setSort((current) =>
      current.field === field
        ? { field: field as UnitSortField, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { field: field as UnitSortField, direction: 'asc' },
    );
    setPage(1);
  };

  const openCreate = () => {
    setDrawerUnit(null);
    setDrawerOpen(true);
  };

  const openEdit = (unit: Unit) => {
    setDrawerUnit(unit);
    setDrawerOpen(true);
  };

  const columns: ColumnDef<Unit>[] = [
    {
      key: 'code',
      header: t($ => $.columns.code),
      sortable: true,
      cell: (u) => <span className="font-medium">{u.code}</span>,
    },
    { key: 'name', header: t($ => $.columns.name), sortable: true, cell: (u) => u.name },
    {
      key: 'symbol',
      header: t($ => $.columns.symbol),
      sortable: true,
      cell: (u) => <span className="text-muted-foreground">{u.symbol ?? '—'}</span>,
    },
    {
      key: 'description',
      header: t($ => $.columns.description),
      cell: (u) => <span className="text-muted-foreground">{u.description ?? '—'}</span>,
    },
    {
      key: 'is_active',
      header: t($ => $.columns.status),
      sortable: true,
      cell: (u) => <StatusBadge status={u.is_active ? 'active' : 'inactive'} />,
    },
  ];

  const confirmDelete = () => {
    if (!deleting) return;
    deleteUnit.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.title)}
        subtitle={t($ => $.subtitle)}
        breadcrumbs={[
          { label: tCommon($ => $.home), to: ROUTES.dashboard },
          { label: t($ => $.breadcrumb.inventory), to: ROUTES.products },
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
          />

          <EntityTable<Unit>
            columns={columns}
            data={items}
            getRowId={(unit) => unit.id}
            isLoading={isLoading}
            isError={isError}
            sort={sort}
            onSortChange={handleSort}
            rowActions={(unit) => (
              <ActionMenu
                label={t($ => $.actions.ariaLabel, { name: unit.name })}
                items={[
                  { key: 'view', label: tCommon($ => $.actions.view), icon: Eye, onSelect: () => openEdit(unit) },
                  { key: 'edit', label: tCommon($ => $.common.edit), icon: Pencil, onSelect: () => openEdit(unit) },
                  {
                    key: 'delete',
                    label: tCommon($ => $.common.delete),
                    icon: Trash2,
                    variant: 'destructive',
                    onSelect: () => setDeleting(unit),
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

      <UnitFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setDrawerUnit(null);
        }}
        unit={drawerUnit}
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
        loading={deleteUnit.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
