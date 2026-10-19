import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { CampaignProduct } from '../types/campaign-studio';
import { campaignStudioKeys } from './use-campaign-studio';

const BASE = '/marketing/studio';

export function useCampaignProducts(draftId: string) {
  return useQuery({
    queryKey: [...campaignStudioKeys.draft(draftId), 'products'],
    queryFn: async (): Promise<CampaignProduct[]> => {
      const { data } = await axios.get(`${BASE}/drafts/${draftId}/products`);
      return data.data;
    },
    enabled: !!draftId,
  });
}

export function useLinkProduct(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { product_type: CampaignProduct['product_type']; product_id: string; product_name?: string; product_sku?: string }) => {
      const { data } = await axios.post(`${BASE}/drafts/${draftId}/products`, payload);
      return data.data as CampaignProduct;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...campaignStudioKeys.draft(draftId), 'products'] }),
  });
}

export function useUnlinkProduct(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      await axios.delete(`${BASE}/drafts/${draftId}/products/${productId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...campaignStudioKeys.draft(draftId), 'products'] }),
  });
}

export function useRefreshProductAvailability(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await axios.post(`${BASE}/drafts/${draftId}/products/refresh`);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...campaignStudioKeys.draft(draftId), 'products'] }),
  });
}
