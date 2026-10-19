import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ProductCard } from '@/features/pos/components/product-card';
import { ProductSearch } from '@/features/pos/components/product-search';
import { useCatalog, useProductCategories } from '@/features/pos/hooks/use-pos-queries';
import type { Product } from '@/features/pos/types';

const CATEGORY_KEY = 'pos_last_category';

function readSavedCategory(): string | null {
  try { return sessionStorage.getItem(CATEGORY_KEY); } catch { return null; }
}

function saveCategory(id: string | null) {
  try {
    if (id) sessionStorage.setItem(CATEGORY_KEY, id);
    else sessionStorage.removeItem(CATEGORY_KEY);
  } catch {}
}

type ProductGridProps = {
  onProductSelect: (product: Product) => void;
};

export function ProductGrid({ onProductSelect }: ProductGridProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(readSavedCategory);
  const [page, setPage] = useState(1);

  // 300ms debounce — clear immediately when search is emptied
  useEffect(() => {
    if (!search) { setDebouncedSearch(''); return; }
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: categoriesData } = useProductCategories();
  const categories = categoriesData ?? [];

  const { data, isLoading, isFetching } = useCatalog({
    search:      debouncedSearch || undefined,
    category_id: selectedCategoryId || undefined,
    page,
  });

  const products   = data?.data ?? [];
  const totalPages = data?.last_page ?? 1;

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleCategorySelect(id: string | null) {
    setSelectedCategoryId(id);
    saveCategory(id);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <ProductSearch value={search} onChange={handleSearchChange} autoFocus id="pos-product-search" />

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none shrink-0">
          <button
            onClick={() => handleCategorySelect(null)}
            className={cn(
              'shrink-0 rounded-full px-3 text-xs font-medium transition-colors min-h-9 flex items-center',
              !selectedCategoryId
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-accent',
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              className={cn(
                'shrink-0 rounded-full px-3 text-xs font-medium transition-colors min-h-9 flex items-center whitespace-nowrap',
                selectedCategoryId === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-accent',
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {search || selectedCategoryId ? 'No products found' : 'No products available'}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 pb-2">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={onProductSelect}
                disabled={isFetching}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1 shrink-0">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="flex min-h-9 items-center rounded px-2 text-xs disabled:opacity-40 hover:bg-accent"
          >
            ‹ Prev
          </button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="flex min-h-9 items-center rounded px-2 text-xs disabled:opacity-40 hover:bg-accent"
          >
            Next ›
          </button>
        </div>
      )}
    </div>
  );
}
