import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  ActionMenu,
  ConfirmDialog,
  EntityTable,
  EntityToolbar,
  PageHeader,
  Pagination,
} from '@/components/crud';
import type { ColumnDef } from '@/components/crud/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useBomsQuery, useDeleteBom } from '@/features/boms/hooks/use-boms';
import type { Bom, BomSortField } from '@/features/boms/types/bom';
import { ROUTES } from '@/router/routes';

const PER_PAGE = 20;

export function BomsPage() {
  const { t } = useTranslation('boms');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: BomSortField; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc',
  });
  const [deleting, setDeleting] = useState<Bom | null>(null);

  const params = useMemo(
    () => ({
      search: search || undefined,
      is_active: activeFilter,
      page,
      per_page: PER_PAGE,
      sort_by: sort.field,
      sort_dir: sort.direction,
    }),
    [search, activeFilter, page, sort],
  );

  const { data, isLoading, isError, isFetching, refetch } = useBomsQuery(params);
  const deleteBom = useDeleteBom();

  const items = data?.items ?? [];
  const meta = data?.meta;

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleSort = (field: string) => {
    setSort((current) =>
      current.field === field
        ? { field: field as BomSortField, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { field: field as BomSortField, direction: 'asc' },
    );
    setPage(1);
  };

  const columns = useMemo<ColumnDef<Bom>[]>(
    () => [
      {
        key: 'bom_number',
        header: t($ => $.columns.bomNumber),
        sortable: true,
        cell: (bom) => <span className="font-mono font-medium">{bom.bom_number}</span>,
      },
      {
        key: 'product',
        header: t($ => $.columns.product),
        cell: (bom) => bom.product?.name ?? '—',
      },
      {
        key: 'version',
        header: t($ => $.columns.version),
        sortable: true,
        cell: (bom) => bom.version,
      },
      {
        key: 'lines',
        header: t($ => $.columns.lines),
        cell: (bom) => bom.lines?.length ?? 0,
      },
      {
        key: 'is_active',
        header: t($ => $.columns.status),
        cell: (bom) =>
          bom.is_active ? (
            <Badge variant="default">{t($ => $.status.active)}</Badge>
          ) : (
            <Badge variant="secondary">{t($ => $.status.inactive)}</Badge>
          ),
      },
      {
        key: 'created_at',
        header: t($ => $.columns.createdAt),
        sortable: true,
        cell: (bom) => (bom.created_at ? bom.created_at.slice(0, 10) : '—'),
      },
    ],
    [t],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.title)}
        subtitle={t($ => $.subtitle)}
        breadcrumbs={[{ label: tCommon($ => $.home), to: ROUTES.dashboard }, { label: t($ => $.title) }]}
        actions={
          <Button onClick={() => navigate(ROUTES.bomsNew)}>
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
              setActiveFilter('all');
              setPage(1);
            }}
            filterPanel={
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t($ => $.filters.status)}</span>
                <select
                  value={activeFilter}
                  onChange={(e) => {
                    setActiveFilter(e.target.value as 'all' | 'true' | 'false');
                    setPage(1);
                  }}
                  className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                >
                  <option value="all">{t($ => $.filters.allStatuses)}</option>
                  <option value="true">{t($ => $.filters.activeOnly)}</option>
                  <option value="false">{t($ => $.filters.inactiveOnly)}</option>
                </select>
              </div>
            }
          />

          <EntityTable<Bom>
            columns={columns}
            data={items}
            getRowId={(bom) => bom.id}
            isLoading={isLoading}
            isError={isError}
            sort={sort}
            onSortChange={handleSort}
            rowActions={(bom) => (
              <ActionMenu
                label={t($ => $.actions.actionsFor, { number: bom.bom_number })}
                items={[
                  {
                    key: 'view',
                    label: tCommon($ => $.actions.view),
                    icon: Eye,
                    onSelect: () => navigate(`${ROUTES.boms}/${bom.id}`),
                  },
                  {
                    key: 'edit',
                    label: tCommon($ => $.common.edit),
                    icon: Pencil,
                    onSelect: () => navigate(`${ROUTES.boms}/${bom.id}/edit`),
                  },
                  {
                    key: 'delete',
                    label: tCommon($ => $.common.delete),
                    icon: Trash2,
                    variant: 'destructive' as const,
                    onSelect: () => setDeleting(bom),
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

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t($ => $.delete.title)}
        description={t($ => $.workspace.deleteMessage, { number: deleting?.bom_number ?? '' })}
        confirmLabel={t($ => $.delete.confirm)}
        variant="destructive"
        loading={deleteBom.isPending}
        onConfirm={() => {
          if (deleting)
            deleteBom.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
