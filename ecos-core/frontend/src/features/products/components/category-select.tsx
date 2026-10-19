import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { Combobox } from '@/components/crud';
import { categoriesService } from '@/features/categories/services/categories-service';

type CategorySelectProps = {
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Searchable category select backed by the Categories API. Reuses the generic
 * Combobox from the CRUD kit.
 */
export function CategorySelect({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: CategorySelectProps) {
  const { t } = useTranslation('products');

  const { data, isLoading } = useQuery({
    queryKey: ['category-options'],
    queryFn: () => categoriesService.list({ per_page: 100, sort_by: 'name', sort_dir: 'asc' }),
    staleTime: 60 * 1000,
  });

  const options = (data?.items ?? []).map((category) => ({
    value: category.id,
    label: `${category.name} (${category.code})`,
  }));

  return (
    <Combobox
      options={options}
      value={value ?? ''}
      onChange={onChange}
      loading={isLoading}
      placeholder={placeholder ?? t($ => $.selects.categoryPlaceholder)}
      searchPlaceholder={t($ => $.selects.categorySearch)}
      emptyText={t($ => $.selects.categoryEmpty)}
      disabled={disabled}
      className={className}
    />
  );
}
