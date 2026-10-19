import { useQuery } from '@tanstack/react-query';

import { Combobox } from '@/components/crud';
import { brandsService } from '@/features/brands/services/brands-service';

type BrandSelectProps = {
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Searchable brand select backed by the Brands API. Used wherever
 * a Brand must be chosen as the owner of an entity (Products, etc.).
 */
export function BrandSelect({
  value,
  onChange,
  placeholder = 'Select brand…',
  disabled,
  className,
}: BrandSelectProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['brand-options'],
    queryFn: () => brandsService.list({ per_page: 100, sort_by: 'name', sort_dir: 'asc', status: 'active' }),
    staleTime: 5 * 60 * 1000,
  });

  const options = (data?.items ?? []).map((brand) => ({
    value: brand.id,
    label: `${brand.name} (${brand.code})`,
  }));

  return (
    <Combobox
      options={options}
      value={value}
      onChange={onChange}
      loading={isLoading}
      placeholder={placeholder}
      searchPlaceholder="Search brands…"
      emptyText="No brands found"
      disabled={disabled}
      className={className}
    />
  );
}
