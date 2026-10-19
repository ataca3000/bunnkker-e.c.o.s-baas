import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { ProductSearchResult } from '../types/conversation';

export function useProductSearch(query: string, companyId?: string) {
  return useQuery<ProductSearchResult[]>({
    queryKey: ['product-selector-search', query, companyId],
    queryFn: () =>
      axios
        .get('/api/omnichannel/products/search', { params: { q: query, company_id: companyId, limit: 20 } })
        .then((r) => r.data?.data ?? []),
    enabled: query.length >= 1,
    staleTime: 30_000,
  });
}

export function useProductDetail(productId: string | null) {
  return useQuery<ProductSearchResult>({
    queryKey: ['product-selector-detail', productId],
    queryFn: () => axios.get(`/api/omnichannel/products/${productId}`).then((r) => r.data),
    enabled: !!productId,
  });
}
