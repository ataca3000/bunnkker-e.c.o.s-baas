import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Combobox } from '@/components/crud';
import { categoriesService } from '@/features/categories/services/categories-service';

type Props = {
  value:        string | null;
  onChange:     (value: string) => void;
  placeholder?: string;
  disabled?:    boolean;
  className?:   string;
};

/**
 * Category picker restricted to scope='material'.
 * Used by raw material AND packaging material forms (both are material scope).
 */
export function RawMaterialCategorySelect({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: Props) {
  const { t } = useTranslation('raw-materials');

  const { data, isLoading } = useQuery({
    queryKey: ['rm-category-options', 'material'],
    queryFn:  () =>
      categoriesService.list({ scope: 'material', per_page: 200, sort_by: 'name', sort_dir: 'asc', status: 'active' }),
    staleTime: 60_000,
  });

  const options = (data?.items ?? []).map((c) => ({
    value: c.id,
    label: `${c.name} (${c.code})`,
  }));

  return (
    <Combobox
      options={options}
      value={value ?? ''}
      onChange={onChange}
      loading={isLoading}
      placeholder={placeholder ?? t($ => $.categorySelect.placeholder)}
      searchPlaceholder={t($ => $.categorySelect.searchPlaceholder)}
      emptyText={t($ => $.categorySelect.emptyText)}
      disabled={disabled}
      className={className}
    />
  );
}
