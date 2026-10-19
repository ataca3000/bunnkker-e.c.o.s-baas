import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type { RawMaterial, RawMaterialPayload, RawMaterialsQuery, RawMaterialsResult, RawMaterialStats, MaterialPurchaseHistory, WarehouseDistribution } from '@/features/raw-materials/types';
import type { StockMovement } from '@/features/stock-ledger/types/stock-movement';

type AddStockPayload = {
  product_id:   string;
  warehouse_id: string;
  quantity:     number;
  unit_cost?:   number | null;
  notes?:       string | null;
};

function buildParams(query: RawMaterialsQuery): Record<string, unknown> {
  const { material_type, availability, allow_negative, ...rest } = query;
  const params: Record<string, unknown> = { ...rest };

  // Map material_type to backend product_type / product_types
  if (material_type === 'raw_material') {
    params.product_type = 'raw_material';
  } else if (material_type === 'packaging_material') {
    params.product_type = 'packaging_material';
  } else {
    // No filter or 'all' — show both material types, exclude finished goods
    params.product_types = 'raw_material,packaging_material';
  }

  // Map availability to backend stock_status
  if (availability === 'available')    { params.stock_status = 'instock'; }
  if (availability === 'out_of_stock') { params.stock_status = 'outofstock'; }

  if (allow_negative === undefined) { delete params.allow_negative; }

  return params;
}

export const rawMaterialsService = {
  async list(query: RawMaterialsQuery): Promise<RawMaterialsResult> {
    const { data } = await api.get<ApiResponse<RawMaterialsResult>>('/products', { params: buildParams(query) });
    return data.data;
  },

  async get(id: string): Promise<RawMaterial> {
    const { data } = await api.get<ApiResponse<RawMaterial>>(`/products/${id}`);
    return data.data;
  },

  async create(payload: RawMaterialPayload): Promise<RawMaterial> {
    const { data } = await api.post<ApiResponse<RawMaterial>>('/products', payload);
    return data.data;
  },

  async update(id: string, payload: RawMaterialPayload): Promise<RawMaterial> {
    const { data } = await api.put<ApiResponse<RawMaterial>>(`/products/${id}`, payload);
    return data.data;
  },

  async patch(id: string, data: { allow_negative_stock?: boolean }): Promise<RawMaterial> {
    const res = await api.patch<ApiResponse<RawMaterial>>(`/products/${id}`, data);
    return res.data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/products/${id}`);
  },

  async addStock(payload: AddStockPayload): Promise<StockMovement> {
    const { data } = await api.post<ApiResponse<StockMovement>>('/stock-movements', payload);
    return data.data;
  },

  async stats(query: Pick<RawMaterialsQuery, 'material_type' | 'category_id' | 'supplier_id' | 'warehouse_id'> = {}): Promise<RawMaterialStats> {
    const { material_type, category_id, supplier_id, warehouse_id } = query;
    const params: Record<string, unknown> = {};

    if (material_type === 'raw_material')       { params.product_type = 'raw_material'; }
    else if (material_type === 'packaging_material') { params.product_type = 'packaging_material'; }
    else                                        { params.product_types = 'raw_material,packaging_material'; }

    if (category_id)  { params.category_id  = category_id; }
    if (supplier_id)  { params.supplier_id  = supplier_id; }
    if (warehouse_id) { params.warehouse_id = warehouse_id; }

    const { data } = await api.get<ApiResponse<RawMaterialStats>>('/products/stats', { params });
    return data.data;
  },

  /**
   * Purchase history from the canonical inventory_receipt_layers source
   * (existing endpoint — no new schema). Used to rebuild the Suppliers tab.
   */
  async purchaseHistory(id: string): Promise<MaterialPurchaseHistory> {
    const { data } = await api.get<ApiResponse<MaterialPurchaseHistory>>(`/products/${id}/cost-history`);
    return data.data;
  },

  /**
   * Per-warehouse stock distribution from the canonical inventory service
   * (existing endpoint — availability computed by InventoryItem::availableQty()).
   */
  async warehouseDistribution(id: string): Promise<WarehouseDistribution> {
    const { data } = await api.get<ApiResponse<WarehouseDistribution>>(`/products/${id}/warehouse-distribution`);
    return data.data;
  },

  async nextSku(prefix = 'RM'): Promise<string> {
    const { data } = await api.get<ApiResponse<{ sku: string }>>('/products/next-sku', {
      params: { prefix },
    });
    return data.data.sku;
  },
};
