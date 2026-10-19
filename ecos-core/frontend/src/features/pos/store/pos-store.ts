import { create } from 'zustand';
import { DEFAULT_CURRENCY } from '@/lib/format';
import { persist } from 'zustand/middleware';
import type { PaymentTender, PosMode } from '@/features/pos/types';

const POS_STORAGE_KEY = 'ecos_pos_context';

export type HeldCartSnapshot = {
  cartId: string;
  customerName: string | null;
  total: string;
  currency: string;
  lineCount: number;
  heldAt: string;
};

type PosState = {
  // ── Persisted operational context ─────────────────────────────────────────
  sessionId: string | null;
  shiftId: string | null;
  cartId: string | null;
  terminalId: string;   // equals cashierId after refactor — kept for shift/cart payloads
  cashierId: string;
  cashierName: string;
  companyId: string | null;
  channelId: string | null;
  warehouseId: string | null;
  currency: string;

  // Persisted held cart snapshots for this terminal
  heldCartSnapshots: HeldCartSnapshot[];

  // Persisted customer context — survives browser crash / refresh
  activeCustomerId: string | null;
  activeCustomerName: string | null;

  // Persisted payment draft — tenders entered before a crash
  tenderDraft: PaymentTender[] | null;

  // Persisted last receipt ID — receipt screen survives refresh
  lastReceiptId: string | null;

  // ── Runtime state (not persisted) ─────────────────────────────────────────
  mode: PosMode;
  keyboardHelpOpen: boolean;
  paymentPanelOpen: boolean;
  returnSaleId: string | null;
  exchangeSaleId: string | null;

  // Ctrl+K — customer search focus request (incremented to trigger focus)
  customerSearchTick: number;

  // ── Actions ───────────────────────────────────────────────────────────────
  setSession: (id: string | null) => void;
  setShift: (id: string | null) => void;
  setCart: (id: string | null) => void;
  setTerminal: (id: string, name?: string) => void;
  setCashier: (id: string, name: string) => void;
  setContext: (companyId: string | null, channelId: string | null, warehouseId: string | null) => void;
  setCurrency: (currency: string) => void;
  setMode: (mode: PosMode) => void;
  setCustomer: (id: string | null, name: string | null) => void;
  setTenderDraft: (tenders: PaymentTender[] | null) => void;
  openPayment: () => void;
  closePayment: () => void;
  openReturn: (saleId: string) => void;
  openExchange: (saleId: string) => void;
  clearTransaction: () => void;
  setLastReceipt: (id: string | null) => void;
  toggleKeyboardHelp: () => void;
  tickCustomerSearch: () => void;
  addHeldCartSnapshot: (snapshot: HeldCartSnapshot) => void;
  removeHeldCartSnapshot: (cartId: string) => void;
  reset: () => void;
};

export const usePosStore = create<PosState>()(
  persist(
    (set) => ({
      // Default persisted context
      sessionId:          null,
      shiftId:            null,
      cartId:             null,
      terminalId:         '',
      cashierId:          '',
      cashierName:        '',
      companyId:          null,
      channelId:          null,
      warehouseId:        null,
      currency:           DEFAULT_CURRENCY,
      heldCartSnapshots:  [],
      activeCustomerId:   null,
      activeCustomerName: null,
      tenderDraft:        null,
      lastReceiptId:      null,

      // Runtime state (not persisted — reset on every mount)
      mode:                'sale',
      keyboardHelpOpen:    false,
      paymentPanelOpen:    false,
      returnSaleId:        null,
      exchangeSaleId:      null,
      customerSearchTick:  0,

      // Actions
      setSession:  (id) => set({ sessionId: id }),
      setShift:    (id) => set({ shiftId: id }),
      setCart:     (id) => set({ cartId: id }),
      setTerminal: (id) => set({ terminalId: id }),
      setCashier:  (id, name) => set({ cashierId: id, cashierName: name }),
      setContext:  (companyId, channelId, warehouseId) => set({ companyId, channelId, warehouseId }),
      setCurrency: (currency) => set({ currency }),

      setMode: (mode) =>
        set({ mode, returnSaleId: null, exchangeSaleId: null, paymentPanelOpen: false }),

      setCustomer: (id, name) =>
        set({ activeCustomerId: id, activeCustomerName: name }),

      setTenderDraft: (tenders) => set({ tenderDraft: tenders }),

      openPayment:  () => set({ paymentPanelOpen: true }),
      closePayment: () => set({ paymentPanelOpen: false }),

      openReturn: (saleId) =>
        set({ mode: 'return', returnSaleId: saleId, paymentPanelOpen: false }),

      openExchange: (saleId) =>
        set({ mode: 'exchange', exchangeSaleId: saleId, paymentPanelOpen: false }),

      clearTransaction: () =>
        set({
          cartId:              null,
          activeCustomerId:    null,
          activeCustomerName:  null,
          tenderDraft:         null,
          paymentPanelOpen:    false,
          returnSaleId:        null,
          exchangeSaleId:      null,
          mode:                'sale',
        }),

      setLastReceipt: (id) => set({ lastReceiptId: id }),

      toggleKeyboardHelp: () => set((s) => ({ keyboardHelpOpen: !s.keyboardHelpOpen })),
      tickCustomerSearch: () => set((s) => ({ customerSearchTick: s.customerSearchTick + 1 })),

      addHeldCartSnapshot: (snapshot) =>
        set((s) => ({
          heldCartSnapshots: [
            ...s.heldCartSnapshots.filter((h) => h.cartId !== snapshot.cartId),
            snapshot,
          ],
        })),

      removeHeldCartSnapshot: (cartId) =>
        set((s) => ({
          heldCartSnapshots: s.heldCartSnapshots.filter((h) => h.cartId !== cartId),
        })),

      reset: () =>
        set({
          sessionId:           null,
          shiftId:             null,
          cartId:              null,
          companyId:           null,
          channelId:           null,
          warehouseId:         null,
          mode:                'sale',
          activeCustomerId:    null,
          activeCustomerName:  null,
          tenderDraft:         null,
          lastReceiptId:       null,
          keyboardHelpOpen:    false,
          paymentPanelOpen:    false,
          returnSaleId:        null,
          exchangeSaleId:      null,
          heldCartSnapshots:   [],
        }),
    }),
    {
      name: POS_STORAGE_KEY,
      partialize: (state) => ({
        sessionId:          state.sessionId,
        shiftId:            state.shiftId,
        cartId:             state.cartId,
        terminalId:         state.terminalId,
        cashierId:          state.cashierId,
        cashierName:        state.cashierName,
        companyId:          state.companyId,
        channelId:          state.channelId,
        warehouseId:        state.warehouseId,
        currency:           state.currency,
        heldCartSnapshots:  state.heldCartSnapshots,
        // Recovery-critical: these survive browser crashes and refreshes
        activeCustomerId:   state.activeCustomerId,
        activeCustomerName: state.activeCustomerName,
        tenderDraft:        state.tenderDraft,
        lastReceiptId:      state.lastReceiptId,
      }),
    },
  ),
);
