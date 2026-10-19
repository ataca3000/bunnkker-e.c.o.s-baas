// @refresh reset
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { usePosStore } from '@/features/pos/store/pos-store';
import { toast } from '@/components/ds/use-toast';
import {
  posContextService,
  sessionService,
  shiftService,
  cartService,
  saleService,
  returnService,
  exchangeService,
  receiptService,
  catalogService,
  posCategoriesService,
  posCustomerService,
} from '@/features/pos/services/pos-service';
import { useAuthStore } from '@/features/auth/store/auth-store';
import type {
  CartLine,
  OpenSessionPayload,
  OpenShiftPayload,
  CloseShiftPayload,
  ApproveShiftPayload,
  RejectShiftPayload,
  OpenCartPayload,
  AddCartLinePayload,
  ProcessSalePayload,
  ProcessReturnPayload,
  ProcessExchangePayload,
} from '@/features/pos/types';

// ── Query keys ────────────────────────────────────────────────────────────────

export const posKeys = {
  companies:  () => ['pos', 'companies'] as const,
  warehouses: () => ['pos', 'warehouses'] as const,
  channels:   () => ['pos', 'channels'] as const,
  session:    (id: string) => ['pos', 'session', id] as const,
  shift:      (id: string) => ['pos', 'shift', id] as const,
  cart:       (id: string) => ['pos', 'cart', id] as const,
  sale:       (id: string) => ['pos', 'sale', id] as const,
  receipt:    (id: string) => ['pos', 'receipt', id] as const,
  catalog:    (params: object) => ['pos', 'catalog', params] as const,
  categories: () => ['pos', 'categories'] as const,
  customers:  (search: string) => ['pos', 'customers', search] as const,
};

// ── POS Context (companies / warehouses / channels) ───────────────────────────

export function usePosCompanies() {
  return useQuery({
    queryKey: posKeys.companies(),
    queryFn:  () => posContextService.companies(),
    staleTime: 5 * 60_000,
  });
}

export function usePosWarehouses() {
  return useQuery({
    queryKey: posKeys.warehouses(),
    queryFn:  () => posContextService.warehouses(),
    staleTime: 5 * 60_000,
  });
}

export function usePosChannels() {
  return useQuery({
    queryKey: posKeys.channels(),
    queryFn:  () => posContextService.channels(),
    staleTime: 5 * 60_000,
  });
}

// ── Session ───────────────────────────────────────────────────────────────────

export function useSession() {
  const sessionId = usePosStore((s) => s.sessionId);
  return useQuery({
    queryKey: posKeys.session(sessionId ?? ''),
    queryFn:  () => sessionService.get(sessionId!),
    enabled:  !!sessionId,
    staleTime: 30_000,
  });
}

export function useOpenSession() {
  const { setSession, setCashier, setTerminal, setContext } = usePosStore();
  const authUser = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (payload: OpenSessionPayload) => sessionService.open(payload),
    onSuccess:  (session) => {
      setSession(session.id);
      setTerminal(session.cashier_id); // terminal_id = cashier_id after refactor
      setCashier(session.cashier_id, authUser?.name ?? '');
      setContext(session.company_id, session.channel_id, session.warehouse_id);
      toast.success('Session opened');
    },
    onError: () => toast.error('Failed to open session'),
  });
}

export function useCloseSession() {
  const { reset } = usePosStore();
  return useMutation({
    mutationFn: (sessionId: string) => sessionService.close(sessionId),
    onSuccess:  () => {
      reset();
      toast.success('Session closed');
    },
    onError: () => toast.error('Failed to close session'),
  });
}

// ── Shift ─────────────────────────────────────────────────────────────────────

export function useShift() {
  const shiftId = usePosStore((s) => s.shiftId);
  return useQuery({
    queryKey: posKeys.shift(shiftId ?? ''),
    queryFn:  () => shiftService.get(shiftId!),
    enabled:  !!shiftId,
    staleTime: 30_000,
  });
}

export function useOpenShift() {
  const { setShift } = usePosStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: OpenShiftPayload) => shiftService.open(payload),
    onSuccess:  (shift) => {
      setShift(shift.id);
      qc.setQueryData(posKeys.shift(shift.id), shift);
      toast.success('Shift opened', `Opening cash: ${shift.opening_cash.amount}`);
    },
    onError: () => toast.error('Failed to open shift'),
  });
}

export function useCloseShift() {
  const qc = useQueryClient();
  const { setShift } = usePosStore();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CloseShiftPayload }) =>
      shiftService.close(id, payload),
    onSuccess: (shift) => {
      qc.setQueryData(posKeys.shift(shift.id), shift);
      if (shift.status === 'closed') setShift(null);
      toast.success('Shift submitted for approval');
    },
    onError: () => toast.error('Failed to submit shift'),
  });
}

export function useApproveShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ApproveShiftPayload }) =>
      shiftService.approve(id, payload),
    onSuccess: (shift) => {
      qc.setQueryData(posKeys.shift(shift.id), shift);
      toast.success('Shift approved');
    },
    onError: () => toast.error('Failed to approve shift'),
  });
}

export function useRejectShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RejectShiftPayload }) =>
      shiftService.reject(id, payload),
    onSuccess: (shift) => {
      qc.setQueryData(posKeys.shift(shift.id), shift);
      toast.warning('Shift count rejected');
    },
    onError: () => toast.error('Failed to reject shift'),
  });
}

// ── Cart ──────────────────────────────────────────────────────────────────────

export function useCart() {
  const cartId = usePosStore((s) => s.cartId);
  return useQuery({
    queryKey: posKeys.cart(cartId ?? ''),
    queryFn:  () => cartService.get(cartId!),
    enabled:  !!cartId,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useOpenCart() {
  const { setCart } = usePosStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: OpenCartPayload) => cartService.open(payload),
    onSuccess:  (cart) => {
      setCart(cart.id);
      qc.setQueryData(posKeys.cart(cart.id), cart);
    },
  });
}

export function useAddCartLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cartId, payload }: { cartId: string; payload: AddCartLinePayload }) =>
      cartService.addLine(cartId, payload),
    onSuccess: (cart) => qc.setQueryData(posKeys.cart(cart.id), cart),
  });
}

export function useRemoveCartLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cartId, lineId }: { cartId: string; lineId: string }) =>
      cartService.removeLine(cartId, lineId),
    onSuccess: (cart) => qc.setQueryData(posKeys.cart(cart.id), cart),
  });
}

// Remove the line then re-add with the new quantity.
// If newQty ≤ 0 the line is only removed (no re-add).
export type UpdateCartLineArgs = {
  cartId: string;
  lineId: string;
  newQty: number;
  line: CartLine;
};

export function useUpdateCartLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cartId, lineId, newQty, line }: UpdateCartLineArgs) => {
      const afterRemove = await cartService.removeLine(cartId, lineId);
      if (newQty <= 0) return afterRemove;
      return cartService.addLine(cartId, {
        product_id:   line.product_id,
        product_name: line.product_name,
        sku:          line.sku,
        quantity:     String(newQty),
        unit_price:   line.unit_price.amount,
        currency:     line.unit_price.currency,
      });
    },
    onSuccess: (cart) => qc.setQueryData(posKeys.cart(cart.id), cart),
    onError:   () => toast.error('Failed to update quantity'),
  });
}

export function useHoldCart() {
  const qc = useQueryClient();
  const { clearTransaction, addHeldCartSnapshot, activeCustomerName, currency } = usePosStore();
  return useMutation({
    mutationFn: (cartId: string) => cartService.hold(cartId),
    onSuccess: (cart) => {
      addHeldCartSnapshot({
        cartId:       cart.id,
        customerName: activeCustomerName,
        total:        cart.total.amount,
        currency:     cart.currency ?? currency,
        lineCount:    cart.lines.length,
        heldAt:       cart.held_at ?? new Date().toISOString(),
      });
      qc.setQueryData(posKeys.cart(cart.id), cart);
      clearTransaction();
      toast.success('Cart held', `${cart.lines.length} item(s) saved`);
    },
    onError: () => toast.error('Failed to hold cart'),
  });
}

export function useResumeCart() {
  const { setCart, setCustomer, heldCartSnapshots, removeHeldCartSnapshot } = usePosStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cartId: string) => cartService.resume(cartId),
    onSuccess: (cart) => {
      const snapshot = heldCartSnapshots.find((h) => h.cartId === cart.id);
      setCart(cart.id);
      if (cart.customer_id) {
        setCustomer(cart.customer_id, snapshot?.customerName ?? null);
      }
      qc.setQueryData(posKeys.cart(cart.id), cart);
      removeHeldCartSnapshot(cart.id);
      toast.success('Cart resumed');
    },
    onError: () => toast.error('Failed to resume cart'),
  });
}

export function useDeleteHeldCart() {
  const qc = useQueryClient();
  const { removeHeldCartSnapshot } = usePosStore();
  return useMutation({
    mutationFn: (cartId: string) => cartService.cancel(cartId),
    onSuccess: (cart) => {
      qc.removeQueries({ queryKey: posKeys.cart(cart.id) });
      removeHeldCartSnapshot(cart.id);
      toast.info('Held cart deleted');
    },
    onError: () => toast.error('Failed to delete held cart'),
  });
}

// Bind or clear the customer on an existing open cart.
// Requires PUT /pos/carts/{id}/customer on the backend.
// Fails silently (404) until backend implements the endpoint — Zustand still tracks the customer.
export function useSetCartCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cartId, customerId }: { cartId: string; customerId: string | null }) =>
      cartService.setCustomer(cartId, customerId),
    onSuccess: (cart) => qc.setQueryData(posKeys.cart(cart.id), cart),
  });
}

export function useCancelCart() {
  const qc = useQueryClient();
  const { clearTransaction } = usePosStore();
  return useMutation({
    mutationFn: (cartId: string) => cartService.cancel(cartId),
    onSuccess: (cart) => {
      qc.removeQueries({ queryKey: posKeys.cart(cart.id) });
      clearTransaction();
    },
  });
}

// ── Sale ──────────────────────────────────────────────────────────────────────

export function useProcessSale() {
  const { clearTransaction, setLastReceipt } = usePosStore();
  return useMutation({
    mutationFn: (payload: ProcessSalePayload) => saleService.process(payload),
    onSuccess: (result) => {
      setLastReceipt(result.receipt_id);
      clearTransaction();
    },
    onError: () => toast.error('Payment failed', 'Please check the cart and try again'),
  });
}

export function useSale(id: string | null) {
  return useQuery({
    queryKey: posKeys.sale(id ?? ''),
    queryFn:  () => saleService.get(id!),
    enabled:  !!id,
    staleTime: 60_000,
  });
}

// ── Return ────────────────────────────────────────────────────────────────────

export function useProcessReturn() {
  const { clearTransaction, setLastReceipt } = usePosStore();
  return useMutation({
    mutationFn: (payload: ProcessReturnPayload) => returnService.process(payload),
    onSuccess: (result) => {
      setLastReceipt(result.receipt_id);
      clearTransaction();
    },
    onError: () => toast.error('Return failed', 'Please verify the sale ID and try again'),
  });
}

// ── Exchange ──────────────────────────────────────────────────────────────────

export function useProcessExchange() {
  const { clearTransaction, setLastReceipt } = usePosStore();
  return useMutation({
    mutationFn: (payload: ProcessExchangePayload) => exchangeService.process(payload),
    onSuccess: (result) => {
      setLastReceipt(result.receipt_id);
      clearTransaction();
    },
    onError: () => toast.error('Exchange failed', 'Please verify the sale ID and try again'),
  });
}

// ── Receipt ───────────────────────────────────────────────────────────────────

export function useReceipt(id: string | null) {
  return useQuery({
    queryKey: posKeys.receipt(id ?? ''),
    queryFn:  () => receiptService.get(id!),
    enabled:  !!id,
    staleTime: 60_000,
  });
}

export function useReprintReceipt() {
  return useMutation({
    mutationFn: (id: string) => receiptService.reprint(id),
    onSuccess: () => toast.success('Receipt reprinted'),
    onError:   () => toast.error('Reprint failed'),
  });
}

// ── Product catalog ───────────────────────────────────────────────────────────

export function useCatalog(params: { search?: string; category_id?: string; page?: number }) {
  return useQuery({
    queryKey: posKeys.catalog(params),
    queryFn:  () => catalogService.list({ ...params, per_page: 48 }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

// ── Product categories (for grid filter) ─────────────────────────────────────

export function useProductCategories() {
  return useQuery({
    queryKey: posKeys.categories(),
    queryFn:  () => posCategoriesService.list(),
    staleTime: 5 * 60_000,
  });
}

// ── Customer search (for customer panel) ─────────────────────────────────────

export function useCustomerSearch(search: string) {
  return useQuery({
    queryKey: posKeys.customers(search),
    queryFn:  () => posCustomerService.search(search),
    enabled:  search.length >= 2,
    staleTime: 30_000,
  });
}
