import { useMemo, useState } from 'react';
import { Eye, History, Pencil, Plus, Trash2, TrendingUp } from 'lucide-react';
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
import { CategorySelect } from '@/features/products/components/category-select';
import { ProductFormDrawer } from '@/features/products/components/product-form-drawer';
import { StockStatusBadge } from '@/features/products/components/stock-status-badge';
import { UnitSelect } from '@/features/products/components/unit-select';
import { useProductsQuery, useDeleteProduct } from '@/features/products/hooks/use-products';
import type {
  Product,
  ProductSortField,
  ProductStatusFilter,
  ProductType,
} from '@/features/products/types/product';
import { getMediaUrl } from '@/lib/media';
import { ROUTES } from '@/router/routes';

const PER_PAGE = 10;

type ProductsViewProps = {
  productType: ProductType;
  title: string;
  subtitle: string;
  breadcrumbLabel: string;
  searchPlaceholder: string;
  createLabel: string;
  /** When true, omits PageHeader and Card wrapper — renders bare content for embedding in a tab. */
  headless?: boolean;
  /** Override the "View" row action — receives the clicked product. */
  onView?: (product: Product) => void;
  /** Extra row actions appended after the built-in ones. */
  onViewTab?: (product: Product, tab: string) => void;
};

export function ProductsView({
  productType,
  title,
  subtitle,
  breadcrumbLabel,
  searchPlaceholder,
  createLabel,
  headless = false,
  onView,
  onViewTab,
}: ProductsViewProps) {
  const { t } = useTranslation('products');
  const { t: tCommon } = useTranslation('common');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [unitFilter, setUnitFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: ProductSortField; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc',
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const params = useMemo(
    () => ({
      search: search || undefined,
      product_type: productType,
      category_id: categoryFilter || undefined,
      unit_id: unitFilter || undefined,
      status: statusFilter,
      page,
      per_page: PER_PAGE,
      sort_by: sort.field,
      sort_dir: sort.direction,
    }),
    [search, productType, categoryFilter, unitFilter, statusFilter, page, sort],
  );

  const { data, isLoading, isError, isFetching, refetch } = useProductsQuery(params);
  const deleteProduct = useDeleteProduct();

  const productTypeLabel: Record<ProductType, string> = {
    finished_good: t($ => $.types.finished_good),
    raw_material: t($ => $.types.raw_material),
    packaging_material: t($ => $.types.packaging_material),
  };

  const items = data?.items ?? [];
  const meta = data?.meta;

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleSort = (field: string) => {
    setSort((current) =>
      current.field === field
        ? { field: field as ProductSortField, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { field: field as ProductSortField, direction: 'asc' },
    );
    setPage(1);
  };

  const openCreate = () => {
    setDrawerProduct(null);
    setDrawerOpen(true);
  };

  const openEdit = (product: Product) => {
    setDrawerProduct(product);
    setDrawerOpen(true);
  };

  const columns: ColumnDef<Product>[] = [
    {
      key: 'image_url',
      header: t($ => $.columns.image),
      cell: (p) =>
        getMediaUrl(p.image_url) ? (
          <img src={getMediaUrl(p.image_url)!} alt={p.name} className="size-10 rounded object-cover" />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'sku',
      header: t($ => $.columns.sku),
      sortable: true,
      cell: (p) => <span className="font-medium">{p.sku}</span>,
    },
    {
      key: 'barcode',
      header: t($ => $.columns.barcode),
      cell: (p) => <span className="text-muted-foreground">{p.barcode ?? '—'}</span>,
    },
    { key: 'name', header: t($ => $.columns.name), sortable: true, cell: (p) => p.name },
    { key: 'category', header: t($ => $.columns.category), cell: (p) => p.category?.name ?? '—' },
    { key: 'unit', header: t($ => $.columns.unit), cell: (p) => p.unit?.name ?? '—' },
    {
      key: 'regular_price',
      header: t($ => $.columns.regularPrice),
      cell: (p) => (
        <span className="tabular-nums">
          {p.regular_price != null ? p.regular_price.toFixed(2) : '—'}
        </span>
      ),
    },
    {
      key: 'sale_price',
      header: t($ => $.columns.salePrice),
      cell: (p) => (
        <span className="tabular-nums">
          {p.sale_price != null ? p.sale_price.toFixed(2) : '—'}
        </span>
      ),
    },
    {
      key: 'stock_status',
      header: t($ => $.columns.stockStatus),
      cell: (p) => <StockStatusBadge status={p.stock_status} />,
    },
    {
      key: 'product_type',
      header: t($ => $.columns.type),
      sortable: true,
      cell: (p) => (
        <Badge variant="outline">
          {productTypeLabel[p.product_type]}
        </Badge>
      ),
    },
    {
      key: 'is_active',
      header: t($ => $.columns.status),
      sortable: true,
      cell: (p) => <StatusBadge status={p.is_active ? 'active' : 'inactive'} />,
    },
  ];

  const confirmDelete = () => {
    if (!deleting) return;
    deleteProduct.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  };

  if (headless) {
    return (
      <>
        <EntityToolbar
          searchPlaceholder={searchPlaceholder}
          onSearchChange={handleSearch}
          onRefresh={() => void refetch()}
          isRefreshing={isFetching}
          onExport={() => undefined}
          onClearFilters={() => {
            setCategoryFilter(null);
            setUnitFilter(null);
            setStatusFilter('all');
            setPage(1);
          }}
          filterPanel={
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t($ => $.filters.category)}</span>
                <CategorySelect
                  value={categoryFilter}
                  onChange={(value) => { setCategoryFilter(value); setPage(1); }}
                  placeholder={t($ => $.filters.allCategories)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t($ => $.filters.unit)}</span>
                <UnitSelect
                  value={unitFilter}
                  onChange={(value) => { setUnitFilter(value); setPage(1); }}
                  placeholder={t($ => $.filters.allUnits)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{tCommon($ => $.filters.status)}</span>
                <select
                  value={statusFilter}
                  onChange={(event) => { setStatusFilter(event.target.value as ProductStatusFilter); setPage(1); }}
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
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {createLabel}
          </Button>
        </EntityToolbar>

        <EntityTable<Product>
          columns={columns}
          data={items}
          getRowId={(product) => product.id}
          isLoading={isLoading}
          isError={isError}
          sort={sort}
          onSortChange={handleSort}
          rowActions={(product) => (
            <ActionMenu
              label={t($ => $.viewTabs.actionsFor, { name: product.name })}
              items={[
                {
                  key: 'view',
                  label: tCommon($ => $.actions.view),
                  icon: Eye,
                  onSelect: () => (onView ? onView(product) : openEdit(product)),
                },
                { key: 'edit', label: tCommon($ => $.common.edit), icon: Pencil, onSelect: () => openEdit(product) },
                ...(onViewTab
                  ? [
                      { key: 'stock-history', label: t($ => $.viewTabs.stockHistory), icon: History, onSelect: () => onViewTab(product, 'stock-history') },
                      { key: 'price-history', label: t($ => $.viewTabs.priceHistory), icon: TrendingUp, onSelect: () => onViewTab(product, 'price-history') },
                    ]
                  : []),
                {
                  key: 'delete',
                  label: tCommon($ => $.common.delete),
                  icon: Trash2,
                  variant: 'destructive',
                  onSelect: () => setDeleting(product),
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

        <ProductFormDrawer
          open={drawerOpen}
          onOpenChange={(open) => { setDrawerOpen(open); if (!open) setDrawerProduct(null); }}
          product={drawerProduct}
          defaultType={productType}
        />

        <ConfirmDialog
          open={deleting !== null}
          onOpenChange={(open) => { if (!open) setDeleting(null); }}
          title={t($ => $.delete.title)}
          description={tCommon($ => $.dialogs.softDeleteMessage, { name: deleting?.name ?? '' })}
          confirmLabel={t($ => $.delete.confirm)}
          variant="destructive"
          loading={deleteProduct.isPending}
          onConfirm={confirmDelete}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={[{ label: tCommon($ => $.home), to: ROUTES.dashboard }, { label: breadcrumbLabel }]}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {createLabel}
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <EntityToolbar
            searchPlaceholder={searchPlaceholder}
            onSearchChange={handleSearch}
            onRefresh={() => void refetch()}
            isRefreshing={isFetching}
            onExport={() => undefined}
            onClearFilters={() => {
              setCategoryFilter(null);
              setUnitFilter(null);
              setStatusFilter('all');
              setPage(1);
            }}
            filterPanel={
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{t($ => $.filters.category)}</span>
                  <CategorySelect
                    value={categoryFilter}
                    onChange={(value) => {
                      setCategoryFilter(value);
                      setPage(1);
                    }}
                    placeholder={t($ => $.filters.allCategories)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{t($ => $.filters.unit)}</span>
                  <UnitSelect
                    value={unitFilter}
                    onChange={(value) => {
                      setUnitFilter(value);
                      setPage(1);
                    }}
                    placeholder={t($ => $.filters.allUnits)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{tCommon($ => $.filters.status)}</span>
                  <select
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(event.target.value as ProductStatusFilter);
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

          <EntityTable<Product>
            columns={columns}
            data={items}
            getRowId={(product) => product.id}
            isLoading={isLoading}
            isError={isError}
            sort={sort}
            onSortChange={handleSort}
            rowActions={(product) => (
              <ActionMenu
                label={t($ => $.viewTabs.actionsFor, { name: product.name })}
                items={[
                  { key: 'view', label: tCommon($ => $.actions.view), icon: Eye, onSelect: () => openEdit(product) },
                  { key: 'edit', label: tCommon($ => $.common.edit), icon: Pencil, onSelect: () => openEdit(product) },
                  {
                    key: 'delete',
                    label: tCommon($ => $.common.delete),
                    icon: Trash2,
                    variant: 'destructive',
                    onSelect: () => setDeleting(product),
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

      <ProductFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setDrawerProduct(null);
        }}
        product={drawerProduct}
        defaultType={productType}
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
        loading={deleteProduct.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
