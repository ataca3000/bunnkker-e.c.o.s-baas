import { useQuery } from '@tanstack/react-query';

import { Combobox } from '@/components/crud';
import { branchesService } from '@/features/branches/services/branches-service';

type BranchSelectProps = {
  companyId: string;
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Searchable branch select backed by the Branches API, scoped to a company.
 * Reuses the generic Combobox from the CRUD kit.
 */
export function BranchSelect({
  companyId,
  value,
  onChange,
  placeholder = 'Select branch…',
  disabled,
  className,
}: BranchSelectProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['branch-options', companyId],
    queryFn: () =>
      branchesService.list({
        company_id: companyId,
        per_page: 100,
        sort_by: 'name',
        sort_dir: 'asc',
      }),
    enabled: companyId !== '',
    staleTime: 60 * 1000,
  });

  const options = (data?.items ?? []).map((branch) => ({
    value: branch.id,
    label: `${branch.name} (${branch.code})`,
  }));

  return (
    <Combobox
      options={options}
      value={value ?? ''}
      onChange={onChange}
      loading={isLoading}
      placeholder={companyId === '' ? 'Select a company first' : placeholder}
      searchPlaceholder="Search branches…"
      emptyText="No branches found"
      disabled={disabled || companyId === ''}
      className={className}
    />
  );
}
