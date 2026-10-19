import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { Combobox } from '@/components/crud';
import { unitsService } from '@/features/units/services/units-service';

type UnitSelectProps = {
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Searchable unit-of-measure select backed by the Units API. Reuses the generic
 * Combobox from the CRUD kit.
 */
export function UnitSelect({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: UnitSelectProps) {
  const { t } = useTranslation('products');

  const { data, isLoading } = useQuery({
    queryKey: ['unit-options'],
    queryFn: () => unitsService.list({ per_page: 100, sort_by: 'name', sort_dir: 'asc' }),
    staleTime: 60 * 1000,
  });

  const options = (data?.items ?? []).map((unit) => ({
    value: unit.id,
    label: `${unit.name} (${unit.code})`,
  }));

  return (
    <Combobox
      options={options}
      value={value ?? ''}
      onChange={onChange}
      loading={isLoading}
      placeholder={placeholder ?? t($ => $.selects.unitPlaceholder)}
      searchPlaceholder={t($ => $.selects.unitSearch)}
      emptyText={t($ => $.selects.unitEmpty)}
      disabled={disabled}
      className={className}
    />
  );
}
