import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Combobox } from '@/components/crud';
import { categoriesService } from '@/features/categories/services/categories-service';
import type { CategoryScope } from '@/features/categories/types/category';

type ParentCategorySelectProps = {
  value: string | null;
  onChange: (value: string) => void;
  /** Category id to exclude from the options (prevents selecting self). */
  excludeId?: string;
  /** Only show parents with this scope so a product category cannot nest under a material category. */
  scope?: CategoryScope;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Searchable parent-category select backed by the Categories API. Reuses the
 * generic Combobox from the CRUD kit. Includes a "None" option for top-level
 * categories. Only levels 1–2 can be parents (3 is the max depth).
 */
export function ParentCategorySelect({
  value,
  onChange,
  excludeId,
  scope,
  placeholder,
  disabled,
  className,
}: ParentCategorySelectProps) {
  const { t } = useTranslation('categories');

  const { data, isLoading } = useQuery({
    queryKey: ['category-options', scope ?? 'all'],
    queryFn: () => categoriesService.list({ per_page: 100, sort_by: 'name', sort_dir: 'asc', scope }),
    staleTime: 60 * 1000,
  });

  const noneOption = { value: '', label: t($ => $.form.noParent) };

  const options = [
    noneOption,
    ...(data?.items ?? [])
      .filter((category) => category.id !== excludeId && category.level < 3)
      .map((category) => ({
        value: category.id,
        label: `${category.name} (${category.code}) · L${category.level}`,
      })),
  ];

  return (
    <Combobox
      options={options}
      value={value ?? ''}
      onChange={onChange}
      loading={isLoading}
      placeholder={placeholder ?? t($ => $.form.selectParent)}
      searchPlaceholder={t($ => $.form.searchCategories)}
      emptyText={t($ => $.form.noResults)}
      disabled={disabled}
      className={className}
    />
  );
}
