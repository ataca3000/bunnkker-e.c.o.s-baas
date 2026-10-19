import { useQuery } from '@tanstack/react-query';

import { Combobox } from '@/components/crud';
import { companiesService } from '@/features/companies/services/companies-service';

type CompanySelectProps = {
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Searchable company select backed by the Companies API. Reuses the generic
 * Combobox from the CRUD kit — no duplicated select logic.
 */
export function CompanySelect({
  value,
  onChange,
  placeholder = 'Select company…',
  disabled,
  className,
}: CompanySelectProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['company-options'],
    queryFn: () => companiesService.list({ per_page: 100, sort_by: 'name', sort_dir: 'asc' }),
    staleTime: 5 * 60 * 1000,
  });

  const options = (data?.items ?? []).map((company) => ({
    value: company.id,
    label: `${company.name} (${company.code})`,
  }));

  return (
    <Combobox
      options={options}
      value={value}
      onChange={onChange}
      loading={isLoading}
      placeholder={placeholder}
      searchPlaceholder="Search companies…"
      emptyText="No companies found"
      disabled={disabled}
      className={className}
    />
  );
}
