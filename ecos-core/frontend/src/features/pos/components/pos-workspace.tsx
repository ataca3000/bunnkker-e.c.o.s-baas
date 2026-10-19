import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { toast } from '@/components/ds/use-toast';
import { AnimatePresence, motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { PosHeader } from '@/features/pos/components/pos-header';
import { ProductGrid } from '@/features/pos/components/product-grid';
import { CartPanel } from '@/features/pos/components/cart-panel';
import { PaymentPanel } from '@/features/pos/components/payment-panel';
import { ReceiptPanel } from '@/features/pos/components/receipt-panel';
import { ReturnPanel } from '@/features/pos/components/return-panel';
import { ExchangePanel } from '@/features/pos/components/exchange-panel';
import { ManagerPanel } from '@/features/pos/components/manager-panel';
import { CustomerPanel } from '@/features/pos/components/customer-panel';
import { HeldCartsPanel } from '@/features/pos/components/held-carts-panel';
import { KeyboardHelp } from '@/features/pos/components/keyboard-help';
import { CartRecoveryDialog } from '@/features/pos/components/cart-recovery-dialog';
import { useBarcodeScanner } from '@/features/pos/hooks/use-barcode-scanner';
import { useKeyboardShortcuts } from '@/features/pos/hooks/use-keyboard-shortcuts';
import {
  useCart,
  useSession,
  useAddCartLine,
  useUpdateCartLine,
  useOpenCart,
  useHoldCart,
  useCancelCart,
} from '@/features/pos/hooks/use-pos-queries';
import { catalogService } from '@/features/pos/services/pos-service';
import { usePosStore } from '@/features/pos/store/pos-store';
import type { CartLine, PosMode, Product } from '@/features/pos/types';

type RightPanel = 'cart' | 'payment' | 'receipt' | 'return' | 'exchange' | 'held-carts';

export function PosWorkspace() {
  const {
    mode, setMode, cartId, shiftId, sessionId,
    terminalId, cashierId, currency, activeCustomerId,
    activeCustomerName, tenderDraft,
    paymentPanelOpen, openPayment, closePayment,
    lastReceiptId, setLastReceipt,
    toggleKeyboardHelp, tickCustomerSearch,
    clearTransaction,
    reset,
    setCart,
  } = usePosStore();

  const [rightPanel, setRightPanel] = useState<RightPanel>('cart');
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const isScanningRef = useRef(false);
  // True only when there was a persisted cartId from a previous session at mount time
  const hadCartOnMount = useRef(Boolean(cartId));
  const productSearchId = 'pos-product-search';

  const addLine    = useAddCartLine();
  const updateLine = useUpdateCartLine();
  const openCart   = useOpenCart();
  const holdCart   = useHoldCart();
  const cancelCart = useCancelCart();

  const { data: cart, isError: cartError } = useCart();
  const { isError: sessionError } = useSession();

  // Recover gracefully when a persisted session or cart is no longer valid
  useEffect(() => {
    if (sessionError && sessionId) {
      reset();
      toast.error('Session expired', 'Please open a new session in Manager mode');
    }
  }, [sessionError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cartError && cartId) {
      setCart(null);
      hadCartOnMount.current = false;
      toast.warning('Cart reset', 'Previous cart is no longer available');
    }
  }, [cartError]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recovery detection: show dialog once when a previous cart is found on startup
  useEffect(() => {
    if (!hadCartOnMount.current) return;
    if (cart) {
      hadCartOnMount.current = false;
      if (cart.status === 'open' && cart.lines.length > 0) {
        setShowRecovery(true);
      }
    }
  }, [cart]);  

  // Auto-dismiss barcode error after 3 seconds
  useEffect(() => {
    if (!barcodeError) return;
    const timer = setTimeout(() => setBarcodeError(null), 3000);
    return () => clearTimeout(timer);
  }, [barcodeError]);

  // ── Product add to cart ─────────────────────────────────────────────────────
  async function handleProductSelect(product: Product) {
    if (mode !== 'sale') return;
    setBarcodeError(null);

    let cId = cartId;

    if (!cId && sessionId && shiftId) {
      const newCart = await openCart.mutateAsync({
        session_id:  sessionId,
        shift_id:    shiftId,
        terminal_id: terminalId,
        cashier_id:  cashierId,
        currency,
        customer_id: activeCustomerId ?? undefined,
      });
      cId = newCart.id;
    }

    if (!cId) return;

    await addLine.mutateAsync({
      cartId: cId,
      payload: {
        product_id:   product.id,
        product_name: product.name,
        sku:          product.sku,
        quantity:     '1',
        unit_price:   String(product.selling_price ?? 0),
        currency:     product.currency ?? currency,
      },
    });
  }

  // ── Barcode scanner ─────────────────────────────────────────────────────────
  // When the same product is scanned again, increment the existing cart line
  // instead of adding a duplicate.
  async function onScan(barcode: string) {
    if (mode !== 'sale' || isScanningRef.current) return;
    isScanningRef.current = true;
    setBarcodeError(null);
    setBarcodeLoading(true);

    try {
      const result = await catalogService.list({ search: barcode, per_page: 1 });
      if (result.data.length === 0) {
        setBarcodeError(`No product found for barcode "${barcode}"`);
        return;
      }

      const product = result.data[0];

      // Check if the product is already in the active cart
      const existingLine = cart?.lines?.find(
        (l: CartLine) => l.product_id === product.id,
      );

      if (existingLine && cartId) {
        const newQty = parseFloat(existingLine.quantity) + 1;
        await updateLine.mutateAsync({
          cartId,
          lineId: existingLine.id,
          newQty,
          line: existingLine,
        });
      } else {
        await handleProductSelect(product);
      }
    } catch {
      setBarcodeError('Barcode lookup failed. Please try again.');
    } finally {
      isScanningRef.current = false;
      setBarcodeLoading(false);
      // Restore focus to product search after every scan
      document.getElementById(productSearchId)?.focus();
    }
  }

  useBarcodeScanner({ onScan, enabled: mode === 'sale' });

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useKeyboardShortcuts([
    {
      key: 'f8',
      description: 'Open payment',
      handler: () => { if (mode === 'sale') { openPayment(); setRightPanel('payment'); } },
    },
    {
      key: 'f9',
      description: 'Hold cart',
      handler: () => { if (cartId && mode === 'sale') holdCart.mutate(cartId); },
    },
    {
      key: 'Escape',
      description: 'Cancel / close',
      handler: () => {
        setBarcodeError(null);
        if (rightPanel === 'payment') { closePayment(); setRightPanel('cart'); }
        else if (rightPanel !== 'cart') setRightPanel('cart');
      },
    },
    {
      key: 'n',
      ctrl: true,
      description: 'New sale',
      handler: () => { clearTransaction(); setMode('sale'); setRightPanel('cart'); },
    },
    {
      key: 'r',
      ctrl: true,
      description: 'Return mode',
      handler: () => { setMode('return'); setRightPanel('return'); },
    },
    {
      key: 'e',
      ctrl: true,
      description: 'Exchange mode',
      handler: () => { setMode('exchange'); setRightPanel('exchange'); },
    },
    {
      key: '1',
      alt: true,
      description: 'Sale mode',
      handler: () => { setMode('sale'); setRightPanel('cart'); },
    },
    {
      key: 'm',
      ctrl: true,
      description: 'Manager view',
      handler: () => setMode('manager'),
    },
    {
      key: 'h',
      ctrl: true,
      description: 'Held carts',
      handler: () => setRightPanel((p) => p === 'held-carts' ? 'cart' : 'held-carts'),
    },
    {
      key: 'k',
      ctrl: true,
      description: 'Focus customer search',
      handler: () => { if (!isManagerMode) tickCustomerSearch(); },
    },
    {
      key: '?',
      shift: true,
      description: 'Keyboard help',
      handler: () => toggleKeyboardHelp(),
    },
  ]);

  // ── Mode change ─────────────────────────────────────────────────────────────
  function handleModeChange(m: PosMode) {
    setMode(m);
    if (m === 'return')        setRightPanel('return');
    else if (m === 'exchange') setRightPanel('exchange');
    else if (m === 'sale')     setRightPanel('cart');
  }

  // ── Payment success ──────────────────────────────────────────────────────────
  function handlePaymentSuccess() {
    setRightPanel('receipt');
    closePayment();
  }

  // ── Return / exchange success ────────────────────────────────────────────────
  function handleTransactionSuccess() {
    setMode('sale');
    setRightPanel('receipt');
  }

  // ── Recovery handlers ────────────────────────────────────────────────────────
  function handleResumeRecovery() {
    setShowRecovery(false);
    toast.success('Sale resumed', 'Your previous items are ready');
  }

  function handleDiscardRecovery() {
    if (cartId) {
      cancelCart.mutate(cartId, {
        onSuccess: () => setShowRecovery(false),
        onError: () => {
          clearTransaction();
          setShowRecovery(false);
        },
      });
    } else {
      setShowRecovery(false);
    }
  }

  // ── Layout ───────────────────────────────────────────────────────────────────
  const isManagerMode = mode === 'manager';

  // Determine the active panel key for animation
  const activePanelKey = paymentPanelOpen ? 'payment' : rightPanel;

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      {/* Top header bar */}
      <PosHeader onModeChange={handleModeChange} />

      {/* Main workspace */}
      <div className="flex flex-1 min-h-0">

        {/* Left panel — product catalog (hidden in manager mode) */}
        {!isManagerMode && (
          <div className="flex-1 min-w-0 border-r p-3 overflow-hidden flex flex-col">
            {/* Customer bar */}
            <div className="mb-2 shrink-0">
              <CustomerPanel />
            </div>

            {/* Barcode status — loading indicator or error */}
            {(barcodeLoading || barcodeError) && (
              <div
                className={cn(
                  'mb-2 flex items-center gap-2 rounded-md px-3 py-2 text-xs shrink-0',
                  barcodeLoading
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-destructive/10 text-destructive',
                )}
              >
                {barcodeLoading ? (
                  <>
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                    <span>Looking up barcode…</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span className="flex-1">{barcodeError}</span>
                    <button onClick={() => setBarcodeError(null)}>
                      <X className="size-3" />
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Mode-specific content */}
            {mode === 'sale' && (
              <ProductGrid onProductSelect={handleProductSelect} />
            )}
            {mode === 'return' && (
              <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                Use the Return panel →
              </div>
            )}
            {mode === 'exchange' && (
              <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                Use the Exchange panel →
              </div>
            )}
          </div>
        )}

        {/* Manager mode full panel */}
        {isManagerMode && (
          <div className="flex-1 overflow-y-auto">
            <ManagerPanel />
          </div>
        )}

        {/* Right panel — animated slide */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activePanelKey}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'flex flex-col border-l bg-background',
              isManagerMode ? 'w-80' : 'w-[340px] shrink-0',
            )}
          >
            {paymentPanelOpen ? (
              <PaymentPanel
                onClose={() => { closePayment(); setRightPanel('cart'); }}
                onSuccess={handlePaymentSuccess}
              />
            ) : rightPanel === 'receipt' ? (
              <ReceiptPanel
                receiptId={lastReceiptId}
                onClose={() => { setLastReceipt(null); setRightPanel('cart'); }}
                onNewSale={() => {
                  setLastReceipt(null);
                  clearTransaction();
                  setMode('sale');
                  setRightPanel('cart');
                }}
              />
            ) : rightPanel === 'return' ? (
              <ReturnPanel
                onClose={() => { setMode('sale'); setRightPanel('cart'); }}
                onSuccess={handleTransactionSuccess}
              />
            ) : rightPanel === 'exchange' ? (
              <ExchangePanel
                onClose={() => { setMode('sale'); setRightPanel('cart'); }}
                onSuccess={handleTransactionSuccess}
              />
            ) : rightPanel === 'held-carts' ? (
              <HeldCartsPanel
                onClose={() => setRightPanel('cart')}
                onResumed={() => setRightPanel('cart')}
              />
            ) : (
              <CartPanel
                onCheckout={() => { openPayment(); setRightPanel('payment'); }}
                onViewHeld={() => setRightPanel('held-carts')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Keyboard help dialog */}
      <KeyboardHelp />

      {/* Cart recovery dialog — shown once when a previous unfinished sale is detected */}
      {showRecovery && cart && (
        <CartRecoveryDialog
          open={showRecovery}
          cart={cart}
          customerName={activeCustomerName}
          hasTenderDraft={Boolean(tenderDraft?.length)}
          onResume={handleResumeRecovery}
          onDiscard={handleDiscardRecovery}
          isDiscarding={cancelCart.isPending}
        />
      )}
    </div>
  );
}
