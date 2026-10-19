// ── Shared money type ────────────────────────────────────────────────────────

export type Money = {
  amount: string;
  currency: string;
};

// ── Session ───────────────────────────────────────────────────────────────────

export type SessionStatus = 'open' | 'suspended' | 'closed';

export type Session = {
  id: string;
  cashier_id: string;
  company_id: string | null;
  channel_id: string | null;
  warehouse_id: string | null;
  status: SessionStatus;
  device_fingerprint: string;
  device_type: string;
  ip_address: string | null;
  opened_at: string;
  closed_at: string | null;
  suspended_at: string | null;
};

export type PosCompany = {
  id: string;
  code: string;
  name: string;
  currency: string;
  is_active: boolean;
};

export type PosWarehouse = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  is_active: boolean;
};

export type PosChannel = {
  id: string;
  company_id: string;
  name: string;
  platform: string;
  platform_label: string;
  is_active: boolean;
};

export type OpenSessionPayload = {
  company_id: string;
  channel_id?: string;
  warehouse_id: string;
  device_fingerprint: string;
  device_type: string;
};

// ── Shift ─────────────────────────────────────────────────────────────────────

export type ShiftStatus = 'open' | 'closing' | 'closed';

export type Shift = {
  id: string;
  session_id: string;
  terminal_id: string;
  cashier_id: string;
  shift_number: number;
  status: ShiftStatus;
  opening_cash: Money;
  closing_count: Money | null;
  expected_closing: Money | null;
  variance: Money | null;
  opened_at: string;
  submitted_at: string | null;
  closed_at: string | null;
};

export type OpenShiftPayload = {
  session_id: string;
  terminal_id: string;
  cashier_id: string;
  opening_cash: Money;
};

export type CloseShiftPayload = {
  closing_count: Money;
};

export type ApproveShiftPayload = {
  expected_closing: Money;
};

export type RejectShiftPayload = {
  reason: string;
};

// ── Cart ──────────────────────────────────────────────────────────────────────

export type CartStatus = 'open' | 'held' | 'completed' | 'cancelled' | 'expired';

export type CartLine = {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: string;
  unit_price: Money;
  line_total: Money;
  discount_amount: Money | null;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: string | null;
  notes: string | null;
  sort_order: number;
};

export type Cart = {
  id: string;
  session_id: string;
  shift_id: string;
  terminal_id: string;
  cashier_id: string;
  customer_id: string | null;
  currency: string;
  status: CartStatus;
  subtotal: Money;
  discount_total: Money;
  total: Money;
  lines: CartLine[];
  notes: string | null;
  held_at: string | null;
};

export type OpenCartPayload = {
  session_id: string;
  shift_id: string;
  terminal_id: string;
  cashier_id: string;
  currency: string;
  customer_id?: string;
};

export type AddCartLinePayload = {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: string;
  unit_price: string;
  currency: string;
};

// ── Payment / Sale ────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'card' | 'wallet' | 'store_credit' | 'loyalty';

export type PaymentTender = {
  method: PaymentMethod;
  amount: string;
  reference?: string;
};

export type ProcessSalePayload = {
  cart_id: string;
  payments: PaymentTender[];
};

export type SaleResult = {
  sale_id: string;
  receipt_id: string;
  receipt_number: string;
  total: string;
  amount_paid: string;
  change_given: string;
  currency: string;
};

export type Sale = {
  id: string;
  receipt_number: string;
  session_id: string;
  shift_id: string;
  terminal_id: string;
  cashier_id: string;
  customer_id: string | null;
  status: 'pending' | 'completed' | 'voided' | 'refunded' | 'partially_refunded';
  currency: string;
  subtotal: Money;
  discount_total: Money;
  total: Money;
  amount_paid: Money;
  change_given: Money;
  lines: SaleLine[];
  payment_summaries: PaymentSummary[];
  created_at: string;
};

export type SaleLine = {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: string;
  unit_price: Money;
  line_total: Money;
};

export type PaymentSummary = {
  method: string;
  amount: Money;
  reference: string | null;
};

// ── Returns ───────────────────────────────────────────────────────────────────

export type ReturnLine = {
  line_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: string;
  unit_price: Money;
  refund_amount: Money;
  reason?: string;
  should_restock?: boolean;
  sort_order: number;
};

export type ProcessReturnPayload = {
  sale_id: string;
  cashier_id: string;
  currency: string;
  refund_total: string;
  refund_method: string;
  lines: ReturnLine[];
  notes?: string;
  cashier_name?: string;
  customer_name?: string;
};

export type ReturnResult = {
  return_id: string;
  return_number: string;
  receipt_id: string;
  receipt_number: string;
  refund_amount: string;
  currency: string;
};

// ── Exchange ──────────────────────────────────────────────────────────────────

export type ExchangeLine = {
  original_line_id: string | null;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: string;
  unit_price: Money;
  line_total: Money;
  sort_order: number;
};

export type ProcessExchangePayload = {
  original_sale_id: string;
  cashier_id: string;
  currency: string;
  reason: string;
  returned_lines: ExchangeLine[];
  replacement_lines: ExchangeLine[];
  notes?: string;
  cashier_name?: string;
  customer_name?: string;
};

export type ExchangeResult = {
  exchange_id: string;
  exchange_number: string;
  receipt_id: string;
  receipt_number: string;
};

// ── Receipt ───────────────────────────────────────────────────────────────────

export type ReceiptType = 'sale' | 'return' | 'exchange' | 'void' | 'reprint';

export type ReceiptLineItem = {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: string;
  unit_price: Money;
  line_total: Money;
};

export type ReceiptTotals = {
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
  tendered: Money;
  change: Money;
};

export type ReceiptPayment = {
  method: string;
  amount: Money;
};

export type Receipt = {
  id: string;
  receipt_number: string;
  type: ReceiptType;
  original_transaction_id: string;
  original_transaction_number: string;
  terminal_id: string;
  session_id: string;
  shift_id: string;
  cashier_id: string;
  cashier_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  currency: string;
  line_items: ReceiptLineItem[];
  totals: ReceiptTotals;
  payments: ReceiptPayment[];
  issued_at: string;
  is_voided: boolean;
  void_reason: string | null;
};

// ── Product (catalog) ─────────────────────────────────────────────────────────

export type Product = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  selling_price: number | null;
  currency: string | null;
  category_id: string | null;
  category_name: string | null;
  unit_id: string | null;
  unit_name: string | null;
  is_active: boolean;
  stock_quantity: number;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
};

export type ProductsResult = {
  data: Product[];
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
};

// ── Category (for product grid filter) ───────────────────────────────────────

export type PosCategory = {
  id: string;
  name: string;
};

// ── Customer (for POS customer search) ───────────────────────────────────────

export type PosCustomer = {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  email: string | null;
};

// ── POS UI State types ────────────────────────────────────────────────────────

export type PosMode = 'sale' | 'return' | 'exchange' | 'manager';

export type PosContext = {
  sessionId: string | null;
  shiftId: string | null;
  cashierId: string;
  cashierName: string;
  companyId: string | null;
  channelId: string | null;
  warehouseId: string | null;
  currency: string;
};
