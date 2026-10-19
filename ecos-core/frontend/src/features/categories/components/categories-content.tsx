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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CategoryFormDrawer } from '@/features/categories/components/category-form-drawer';
import { useCategoriesQuery, useDeleteCategory } from '@/features/categories/hooks/use-categories';
import type {
  Category,
  CategorySortField,
  CategoryStatusFilter,
} from '@/features/categories/types/category';

const PER_PAGE = 10;

/** Headless categories table — no PageHeader or Card wrapper. Embed inside a tab CardContent. */
export function CategoriesContent() {
  const { t } = useTranslation('categories');
  const { t: tCommon } = useTranslation('common');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CategoryStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: CategorySortField; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc',
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCategory, setDrawerCategory] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const params = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter,
      page,
      per_page: PER_PAGE,
      sort_by: sort.field,
      sort_dir: sort.direction,
    }),
    [search, statusFilter, page, sort],
  );

  const { data, isLoading, isError, isFetching, refetch } = useCategoriesQuery(params);
  const deleteCategory = useDeleteCategory();

  const items = data?.items ?? [];
  const meta = data?.meta;

  const handleSort = (field: string) => {
    setSort((curr) =>
      curr.field === field
        ? { field: field as CategorySortField, direction: curr.direction === 'asc' ? 'desc' : 'asc' }
        : { field: field as CategorySortField, direction: 'asc' },
    );
    setPage(1);
  };

  const openCreate = () => {
    setDrawerCategory(null);
    setDrawerOpen(true);
  };

  const columns: ColumnDef<Category>[] = [
    {
      key: 'code',
      header: t($ => $.columns.code),
      sortable: true,
      cell: (c) => <span className="font-medium">{c.code}</span>,
    },
    { key: 'name', header: t($ => $.columns.name), sortable: true, cell: (c) => c.name },
    { key: 'parent', header: t($ => $.columns.parent), cell: (c) => c.parent?.name ?? '—' },
    {
      key: 'level',
      header: t($ => $.columns.level),
      sortable: true,
      cell: (c) => <Badge variant="secondary">L{c.level}</Badge>,
    },
    {
      key: 'sort_order',
      header: t($ => $.columns.sort),
      sortable: true,
      cell: (c) => <span className="text-muted-foreground">{c.sort_order}</span>,
    },
    {
      key: 'is_active',
      header: t($ => $.columns.status),
      sortable: true,
      cell: (c) => <StatusBadge status={c.is_active ? 'active' : 'inactive'} />,
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
        onClearFilters={() => { setStatusFilter('all'); setPage(1); }}
        filterPanel={
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{tCommon($ => $.filters.status)}</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as CategoryStatusFilter); setPage(1); }}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="all">{tCommon($ => $.status.all)}</option>
              <option value="active">{tCommon($ => $.status.active)}</option>
              <option value="inactive">{tCommon($ => $.status.inactive)}</option>
            </select>
          </div>
        }
      >
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          {t($ => $.actions.new)}
        </Button>
      </EntityToolbar>

      <EntityTable<Category>
        columns={columns}
        data={items}
        getRowId={(category) => category.id}
        isLoading={isLoading}
        isError={isError}
        sort={sort}
        onSortChange={handleSort}
        rowActions={(category) => (
          <ActionMenu
            label={t($ => $.actions.ariaLabel, { name: category.name })}
            items={[
              { key: 'view', label: tCommon($ => $.actions.view), icon: Eye, onSelect: () => { setDrawerCategory(category); setDrawerOpen(true); } },
              { key: 'edit', label: tCommon($ => $.common.edit), icon: Pencil, onSelect: () => { setDrawerCategory(category); setDrawerOpen(true); } },
              {
                key: 'delete',
                label: tCommon($ => $.common.delete),
                icon: Trash2,
                variant: 'destructive',
                onSelect: () => setDeleting(category),
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

      <CategoryFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => { setDrawerOpen(open); if (!open) setDrawerCategory(null); }}
        category={drawerCategory}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={t($ => $.delete.title)}
        description={tCommon($ => $.dialogs.softDeleteMessage, { name: deleting?.name ?? '' })}
        confirmLabel={t($ => $.delete.confirm)}
        variant="destructive"
        loading={deleteCategory.isPending}
        onConfirm={() => {
          if (!deleting) return;
          deleteCategory.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </>
  );
}
