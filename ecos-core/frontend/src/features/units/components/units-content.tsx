import { useMemo, useState } from 'react';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { UnitFormDrawer } from '@/features/units/components/unit-form-drawer';
import { useUnitsQuery, useDeleteUnit } from '@/features/units/hooks/use-units';
import type { Unit, UnitSortField } from '@/features/units/types/unit';

const PER_PAGE = 10;

/** Headless units table — no PageHeader or Card wrapper. Embed inside a tab CardContent. */
export function UnitsContent() {
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

  const handleSort = (field: string) => {
    setSort((curr) =>
      curr.field === field
        ? { field: field as UnitSortField, direction: curr.direction === 'asc' ? 'desc' : 'asc' }
        : { field: field as UnitSortField, direction: 'asc' },
    );
    setPage(1);
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

  return (
    <>
      <EntityToolbar
        searchPlaceholder={t($ => $.search)}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        onRefresh={() => void refetch()}
        isRefreshing={isFetching}
        onExport={() => undefined}
      >
        <Button onClick={() => { setDrawerUnit(null); setDrawerOpen(true); }}>
          <Plus className="size-4" />
          {t($ => $.actions.new)}
        </Button>
      </EntityToolbar>

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
              { key: 'view', label: tCommon($ => $.actions.view), icon: Eye, onSelect: () => { setDrawerUnit(unit); setDrawerOpen(true); } },
              { key: 'edit', label: tCommon($ => $.common.edit), icon: Pencil, onSelect: () => { setDrawerUnit(unit); setDrawerOpen(true); } },
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
          meta={{ page: meta.current_page, perPage: meta.per_page, total: meta.total, lastPage: meta.last_page }}
          onPageChange={setPage}
        />
      ) : null}

      <UnitFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => { setDrawerOpen(open); if (!open) setDrawerUnit(null); }}
        unit={drawerUnit}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={t($ => $.delete.title)}
        description={tCommon($ => $.dialogs.softDeleteMessage, { name: deleting?.name ?? '' })}
        confirmLabel={t($ => $.delete.confirm)}
        variant="destructive"
        loading={deleteUnit.isPending}
        onConfirm={() => {
          if (!deleting) return;
          deleteUnit.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </>
  );
}
