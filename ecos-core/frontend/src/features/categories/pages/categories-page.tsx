import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layers, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog, PageHeader } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ds/use-toast';
import { CategoryFormDrawer } from '@/features/categories/components/category-form-drawer';
import { useCategoriesQuery, useDeleteCategory } from '@/features/categories/hooks/use-categories';
import type {
  Category,
  CategoryScope,
  CategorySortField,
  CategoryStatusFilter,
} from '@/features/categories/types/category';

const PER_PAGE = 15;

type ScopeTab = 'all' | CategoryScope;

function ScopeTypeBadge({ scope }: { scope: CategoryScope }) {
  const { t } = useTranslation('categories');
  if (scope === 'product') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
        <Tag className="size-2.5" />
        {t($ => $.scope.product)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
      <Layers className="size-2.5" />
      {t($ => $.scope.material)}
    </span>
  );
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(d));
}

export function CategoriesPage() {
  const { t } = useTranslation('categories');
  const { t: tCommon } = useTranslation('common');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const [searchParams, setSearchParams] = useSearchParams();
  const scopeParam = searchParams.get('scope') as ScopeTab | null;
  const activeScope: ScopeTab = scopeParam === 'product' || scopeParam === 'material' ? scopeParam : 'all';

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

  function setScope(tab: ScopeTab) {
    const next = new URLSearchParams(searchParams);
    if (tab === 'all') next.delete('scope');
    else next.set('scope', tab);
    setSearchParams(next, { replace: true });
    setPage(1);
  }

  const scopeQueryArg = activeScope === 'all' ? undefined : activeScope;

  const mainParams = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter,
      scope: scopeQueryArg,
      page,
      per_page: PER_PAGE,
      sort_by: sort.field,
      sort_dir: sort.direction,
    }),
    [search, statusFilter, scopeQueryArg, page, sort],
  );

  const { data, isLoading, isError, isFetching } = useCategoriesQuery(mainParams);

  // Lightweight count queries for tab labels (per_page=1 → meta.total)
  const { data: allCount } = useCategoriesQuery({ per_page: 1, page: 1 });
  const { data: productCount } = useCategoriesQuery({ per_page: 1, page: 1, scope: 'product' });
  const { data: materialCount } = useCategoriesQuery({ per_page: 1, page: 1, scope: 'material' });

  const deleteCategory = useDeleteCategory();
  const items = data?.items ?? [];
  const meta = data?.meta;

  const openCreate = useCallback(() => {
    setDrawerCategory(null);
    setDrawerOpen(true);
  }, []);

  const openEdit = useCallback((cat: Category) => {
    setDrawerCategory(cat);
    setDrawerOpen(true);
  }, []);

  function handleSort(field: string) {
    setSort((current) =>
      current.field === field
        ? { field: field as CategorySortField, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { field: field as CategorySortField, direction: 'asc' },
    );
    setPage(1);
  }

  function handleDelete(cat: Category) {
    deleteCategory.mutate(cat.id, {
      onSuccess: () => {
        setDeleting(null);
        toast.success(tAny('toast.deleted', { name: cat.name }));
      },
      onError: () => toast.error(t($ => $.toast.deleteError)),
    });
  }

  const SortBtn = ({ field, label }: { field: CategorySortField; label: string }) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className="flex items-center gap-0.5 hover:text-foreground transition-colors"
    >
      {label}
      {sort.field === field && (
        <span className="text-primary ml-0.5">{sort.direction === 'asc' ? '↑' : '↓'}</span>
      )}
    </button>
  );

  const TABS: { id: ScopeTab; label: string; count: number | undefined }[] = [
    { id: 'all',      label: t($ => $.tabs.all),       count: allCount?.meta.total },
    { id: 'product',  label: t($ => $.tabs.products),  count: productCount?.meta.total },
    { id: 'material', label: t($ => $.tabs.materials), count: materialCount?.meta.total },
  ];

  const defaultScope = activeScope === 'all' ? undefined : activeScope;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={t($ => $.title)}
        subtitle={t($ => $.pageSubtitle)}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4 mr-1.5" />
            {t($ => $.actions.new)}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-6 pb-6 flex flex-col gap-4">
        {/* ── Scope Tabs ─────────────────────────────────────────────── */}
        <div className="flex items-end gap-0 border-b">
          {TABS.map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setScope(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeScope === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {label}
              {count !== undefined && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  activeScope === id
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Toolbar ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-8 w-56 text-sm"
            placeholder={t($ => $.filter.search)}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as CategoryStatusFilter); setPage(1); }}
            className="h-8 w-32 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">{t($ => $.filter.allStatus)}</option>
            <option value="active">{t($ => $.filter.active)}</option>
            <option value="inactive">{t($ => $.filter.inactive)}</option>
          </select>
          {(search || statusFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => { setSearch(''); setStatusFilter('all'); setPage(1); }}
            >
              {t($ => $.filter.clear)}
            </Button>
          )}
          <span className="ms-auto text-xs text-muted-foreground">
            {meta ? tAny('filter.count', { count: meta.total }) : ''}
          </span>
        </div>

        {/* ── DataGrid ─────────────────────────────────────────────── */}
        <div className={`rounded-lg border overflow-hidden transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">
                    <SortBtn field="name" label={t($ => $.columns.name)} />
                  </th>
                  <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.columns.type)}</th>
                  <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.columns.parent)}</th>
                  <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">
                    <SortBtn field="level" label={t($ => $.columns.level)} />
                  </th>
                  <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.columns.usedBy)}</th>
                  <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">
                    <SortBtn field="is_active" label={t($ => $.columns.status)} />
                  </th>
                  <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">
                    <SortBtn field="created_at" label={t($ => $.columns.updated)} />
                  </th>
                  <th className="px-3 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      {t($ => $.loading)}
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-destructive">
                      {t($ => $.error)}
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      {search
                        ? tAny('empty.search', { search })
                        : activeScope === 'product'
                          ? t($ => $.empty.product)
                          : activeScope === 'material'
                            ? t($ => $.empty.material)
                            : t($ => $.empty.default)}
                    </td>
                  </tr>
                ) : (
                  items.map((cat) => (
                    <tr
                      key={cat.id}
                      className="border-t hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => openEdit(cat)}
                    >
                      <td className="px-3 py-2.5">
                        <div>
                          <p className="font-medium leading-tight">{cat.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{cat.code}</p>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <ScopeTypeBadge scope={cat.category_scope} />
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">
                        {cat.parent?.name ?? <span className="italic">{t($ => $.status.root)}</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-medium bg-secondary text-secondary-foreground rounded px-1.5 py-0.5">
                          L{cat.level}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">—</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-block w-2 h-2 rounded-full ${cat.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {cat.is_active ? t($ => $.status.active) : t($ => $.status.inactive)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">{fmtDate(cat.updated_at)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openEdit(cat); }}
                            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title={t($ => $.tooltip.edit)}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setDeleting(cat); }}
                            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                            title={t($ => $.tooltip.delete)}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {meta && meta.last_page > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {tAny('pagination.showing', {
                from: (meta.current_page - 1) * meta.per_page + 1,
                to: Math.min(meta.current_page * meta.per_page, meta.total),
                total: meta.total,
              })}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t($ => $.pagination.previous)}
              </Button>
              <span>{tAny('pagination.page', { current: meta.current_page, last: meta.last_page })}</span>
              <Button size="sm" variant="outline" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>
                {t($ => $.pagination.next)}
              </Button>
            </div>
          </div>
        )}
      </div>

      <CategoryFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setDrawerCategory(null);
        }}
        category={drawerCategory}
        defaultScope={defaultScope}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={t($ => $.delete.title)}
        description={tCommon($ => $.dialogs.softDeleteMessage, { name: deleting?.name ?? '' })}
        confirmLabel={t($ => $.delete.confirm)}
        variant="destructive"
        loading={deleteCategory.isPending}
        onConfirm={() => { if (deleting) handleDelete(deleting); }}
      />
    </div>
  );
}
