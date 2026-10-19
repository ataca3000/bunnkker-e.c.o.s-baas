import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  Session, OpenSessionPayload,
  Shift, OpenShiftPayload, CloseShiftPayload, ApproveShiftPayload, RejectShiftPayload,
  Cart, OpenCartPayload, AddCartLinePayload,
  SaleResult, ProcessSalePayload,
  Sale,
  ReturnResult, ProcessReturnPayload,
  ExchangeResult, ProcessExchangePayload,
  Receipt,
  ProductsResult,
  PosCategory,
  PosCustomer,
  PosCompany,
  PosWarehouse,
  PosChannel,
} from '@/features/pos/types';

// ── POS Context (companies / warehouses / channels) ───────────────────────────

export const posContextService = {
  async companies(): Promise<PosCompany[]> {
    const { data } = await api.get<ApiResponse<{ items: PosCompany[]; meta: unknown }>>(
      '/companies',
      { params: { status: 'active', per_page: 100 } },
    );
    return data.data.items;
  },

  async warehouses(): Promise<PosWarehouse[]> {
    const { data } = await api.get<ApiResponse<{ items: PosWarehouse[]; meta: unknown }>>(
      '/warehouses',
      { params: { status: 'active', per_page: 100 } },
    );
    return data.data.items;
  },

  async channels(): Promise<PosChannel[]> {
    const { data } = await api.get<ApiResponse<{ items: PosChannel[]; meta: unknown }>>(
      '/channels',
      { params: { status: 'active', per_page: 100 } },
    );
    return data.data.items;
  },
};

// ── Sessions ──────────────────────────────────────────────────────────────────

export const sessionService = {
  async open(payload: OpenSessionPayload): Promise<Session> {
    const { data } = await api.post<ApiResponse<Session>>('/pos/sessions', payload);
    return data.data;
  },

  async get(id: string): Promise<Session> {
    const { data } = await api.get<ApiResponse<Session>>(`/pos/sessions/${id}`);
    return data.data;
  },

  async close(id: string): Promise<Session> {
    const { data } = await api.delete<ApiResponse<Session>>(`/pos/sessions/${id}`);
    return data.data;
  },
};

// ── Shifts ────────────────────────────────────────────────────────────────────

export const shiftService = {
  async open(payload: OpenShiftPayload): Promise<Shift> {
    const { data } = await api.post<ApiResponse<Shift>>('/pos/shifts', payload);
    return data.data;
  },

  async get(id: string): Promise<Shift> {
    const { data } = await api.get<ApiResponse<Shift>>(`/pos/shifts/${id}`);
    return data.data;
  },

  async close(id: string, payload: CloseShiftPayload): Promise<Shift> {
    const { data } = await api.delete<ApiResponse<Shift>>(`/pos/shifts/${id}`, { data: payload });
    return data.data;
  },

  async approve(id: string, payload: ApproveShiftPayload): Promise<Shift> {
    const { data } = await api.put<ApiResponse<Shift>>(`/pos/shifts/${id}/approve`, payload);
    return data.data;
  },

  async reject(id: string, payload: RejectShiftPayload): Promise<Shift> {
    const { data } = await api.put<ApiResponse<Shift>>(`/pos/shifts/${id}/reject`, payload);
    return data.data;
  },
};

// ── Carts ─────────────────────────────────────────────────────────────────────

export const cartService = {
  async open(payload: OpenCartPayload): Promise<Cart> {
    const { data } = await api.post<ApiResponse<Cart>>('/pos/carts', payload);
    return data.data;
  },

  async get(id: string): Promise<Cart> {
    const { data } = await api.get<ApiResponse<Cart>>(`/pos/carts/${id}`);
    return data.data;
  },

  async addLine(cartId: string, payload: AddCartLinePayload): Promise<Cart> {
    const { data } = await api.post<ApiResponse<Cart>>(`/pos/carts/${cartId}/lines`, payload);
    return data.data;
  },

  async removeLine(cartId: string, lineId: string): Promise<Cart> {
    const { data } = await api.delete<ApiResponse<Cart>>(`/pos/carts/${cartId}/lines/${lineId}`);
    return data.data;
  },

  async hold(cartId: string): Promise<Cart> {
    const { data } = await api.post<ApiResponse<Cart>>(`/pos/carts/${cartId}/hold`);
    return data.data;
  },

  async resume(cartId: string): Promise<Cart> {
    const { data } = await api.delete<ApiResponse<Cart>>(`/pos/carts/${cartId}/hold`);
    return data.data;
  },

  async cancel(cartId: string): Promise<Cart> {
    const { data } = await api.delete<ApiResponse<Cart>>(`/pos/carts/${cartId}`);
    return data.data;
  },

  // PUT /pos/carts/{cartId}/customer — bind or clear the customer on an open cart.
  // Backend endpoint required: PUT /pos/carts/{id}/customer { customer_id: string|null }
  async setCustomer(cartId: string, customerId: string | null): Promise<Cart> {
    const { data } = await api.put<ApiResponse<Cart>>(`/pos/carts/${cartId}/customer`, {
      customer_id: customerId,
    });
    return data.data;
  },
};

// ── Sales ─────────────────────────────────────────────────────────────────────

export const saleService = {
  async process(payload: ProcessSalePayload): Promise<SaleResult> {
    const { data } = await api.post<ApiResponse<SaleResult>>('/pos/sales', payload);
    return data.data;
  },

  async get(id: string): Promise<Sale> {
    const { data } = await api.get<ApiResponse<Sale>>(`/pos/sales/${id}`);
    return data.data;
  },
};

// ── Returns ───────────────────────────────────────────────────────────────────

export const returnService = {
  async process(payload: ProcessReturnPayload): Promise<ReturnResult> {
    const { data } = await api.post<ApiResponse<ReturnResult>>('/pos/returns', payload);
    return data.data;
  },
};

// ── Exchanges ─────────────────────────────────────────────────────────────────

export const exchangeService = {
  async process(payload: ProcessExchangePayload): Promise<ExchangeResult> {
    const { data } = await api.post<ApiResponse<ExchangeResult>>('/pos/exchanges', payload);
    return data.data;
  },
};

// ── Receipts ──────────────────────────────────────────────────────────────────

export const receiptService = {
  async get(id: string): Promise<Receipt> {
    const { data } = await api.get<ApiResponse<Receipt>>(`/pos/receipts/${id}`);
    return data.data;
  },

  async reprint(id: string): Promise<Receipt> {
    const { data } = await api.post<ApiResponse<Receipt>>(`/pos/receipts/${id}/reprint`);
    return data.data;
  },

  async void(id: string, reason: string): Promise<Receipt> {
    const { data } = await api.delete<ApiResponse<Receipt>>(`/pos/receipts/${id}`, {
      data: { reason },
    });
    return data.data;
  },
};

// ── Products (catalog) ────────────────────────────────────────────────────────

export const catalogService = {
  async list(params: {
    search?: string;
    category_id?: string;
    page?: number;
    per_page?: number;
  }): Promise<ProductsResult> {
    const { data } = await api.get<ApiResponse<ProductsResult>>('/products', { params });
    return data.data;
  },
};

// ── Product Categories (for grid filter) ─────────────────────────────────────

export const posCategoriesService = {
  async list(): Promise<PosCategory[]> {
    const { data } = await api.get<ApiResponse<{ items: PosCategory[]; meta: unknown }>>(
      '/categories',
      { params: { status: 'active', per_page: 100, sort_by: 'sort_order', sort_dir: 'asc' } },
    );
    return data.data.items;
  },
};

// ── Customer Search (for customer panel) ──────────────────────────────────────

export const posCustomerService = {
  async search(query: string): Promise<PosCustomer[]> {
    const { data } = await api.get<ApiResponse<{ items: PosCustomer[]; meta: unknown }>>(
      '/customers',
      { params: { search: query, per_page: 10 } },
    );
    return data.data.items;
  },
};
