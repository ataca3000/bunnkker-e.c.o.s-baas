// POS — Central de Caja "Caja Móvil" Fullscreen UI
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCart, type Product } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import {
    Clock, Bell, History, User, Store, ShieldAlert, Wifi, WifiOff, Globe, TerminalSquare, AlertCircle, XCircle, CheckCircle2, Phone, Lock, Unlock,
    LayoutDashboard, LogOut, ShoppingCart, Trash2, Zap, UserCheck, Scale, Settings, PenTool, Camera, RefreshCw, Package, Search,
    Columns, Receipt, DollarSign, RotateCcw, Sliders, Nfc, PauseCircle, LockKeyhole, Sparkles
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useNfcScanner } from '@/hooks/useNfcScanner';
import { useBluetoothScale } from '@/hooks/useBluetoothScale';
import { printReceipt, flushPendingPrintJobs } from '@/lib/thermalPrinter';
import { logAudit } from '@/lib/audit';
import { toast } from '@/lib/toast';
import { findProductByBarcodeOrCode } from '@/lib/barcodeLookup';
import { useERPStore } from '@/store/useERPStore';
import { broadcastSync } from '@/lib/syncNotifier';
import { playSupermarketBeep, playIncrementBeep, playErrorBeep, initAudioContextOnFirstGesture } from '@/lib/scannerAudio';
import { saveDigitalTicket, getDigitalTickets, type DigitalTicket } from '@/lib/digitalTicket';
import { loadPosCartFromIDB, savePosCartToIDB, enqueueOfflineOrder, removeQueuedOfflineOrder, flushOfflineOrderQueue } from '@/lib/indexedDBCart';
import {
    loadHardwareConfig,
    HARDWARE_CONFIG_UPDATED_EVENT,
    type HardwareConfig,
} from '@/lib/hardwareConfig';
import {
    INVENTORY_SOCKET_STATUS_EVENT,
    computePosConnectionView,
    forceReconnectInventorySockets,
    type InventorySocketState,
} from '@/lib/inventorySocketControl';
import {
    putPosCartOnHold,
    listHeldPosCarts,
    takeHeldPosCart,
    discardHeldPosCart,
    OPERATION_HOLD_UPDATED_EVENT,
    type PosHeldCart,
} from '@/lib/operationGuard';
import { runMobileOptimization } from '@/lib/mobileOptimizer';
import PinAuthorizationModal, { type PinAuthorizationResult } from '@/components/security/PinAuthorizationModal';

// Lazy loading de componentes pesados (cero bloqueo en el arranque del POS)
const CorteCajaCiego = dynamic(() => import('@/components/sales/CorteCajaCiego'), { ssr: false });
const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false });
const HardwareSettingsModal = dynamic(() => import('@/components/hardware/HardwareSettingsModal'), { ssr: false });
const PaymentModal = dynamic(() => import('@/components/sales/caja-movil/PaymentModal').then(m => m.PaymentModal), { ssr: false });
const DeliveryModal = dynamic(() => import('@/components/sales/caja-movil/DeliveryModal').then(m => m.DeliveryModal), { ssr: false });
const ScaleModal = dynamic(() => import('@/components/sales/caja-movil/ScaleModal').then(m => m.ScaleModal), { ssr: false });
const TicketReceiptModal = dynamic(() => import('@/components/sales/caja-movil/TicketReceiptModal').then(m => m.TicketReceiptModal), { ssr: false });
const TicketHistoryModal = dynamic(() => import('@/components/sales/caja-movil/TicketHistoryModal').then(m => m.TicketHistoryModal), { ssr: false });
const PosSettingsModal = dynamic(() => import('@/components/sales/caja-movil/PosSettingsModal').then(m => m.PosSettingsModal), { ssr: false });
const DeliveryProofModal = dynamic(() => import('@/components/orders/DeliveryProofModal'), { ssr: false });
import OrderPickingAssistant from '@/components/orders/OrderPickingAssistant';

// Componentes de Caja Móvil
import { Catalog } from '@/components/sales/caja-movil/Catalog';
import { Cart } from '@/components/sales/caja-movil/Cart';
import { TactileShortcutsBar } from '@/components/sales/caja-movil/TactileShortcutsBar';
import { DEFAULT_POS_CONFIG, type PosConfig } from '@/components/sales/caja-movil/PosSettingsModal';
import type { OrderType } from '@/components/sales/caja-movil/Cart';
import type { DeliveryInfo } from '@/components/sales/caja-movil/DeliveryModal';
import { StockAlertModal, type StockIssue } from '@/components/sales/caja-movil/StockAlertModal';
import { CashTenderModal } from '@/components/sales/CashTenderModal';
import { TriColorOrdersBoard } from '@/components/sales/caja-movil/TriColorOrdersBoard';
import ThemeToggle from '@/components/ThemeToggle';
import { AnimatePresence, motion } from 'framer-motion';

export default function SalesDashboard() {
    const router = useRouter();
    const { products, orders, confirmRequest, claimCashierOrder, cancelOrder, formatCurrency, createOrder, siteConfig } = useCart();
    const { profile, signOut } = useAuth();

    // UI State
    const [activeTab, setActiveTab] = useState<'pos' | 'online'>('pos');
    const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'ready' | 'delivery' | 'cancelled'>('all');
    const [showCorteCaja, setShowCorteCaja] = useState(false);
    const [showCameraScanner, setShowCameraScanner] = useState(false);
    const [currentTime, setCurrentTime] = useState('');
    const [bannerMessage, setBannerMessage] = useState<string | null>(null);
    const [corteResult, setCorteResult] = useState<{ type: 'success' | 'mismatch', data: any } | null>(null);

    // POS State
    const [isKioskMode, setIsKioskMode] = useState(false);
    const [posSearch, setPosSearch] = useState('');
    const [onlineSearch, setOnlineSearch] = useState('');
    const [posCart, setPosCart] = useState<(Product & { quantity: number })[]>([]);
    const [orderType, setOrderType] = useState<OrderType>('local');
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [isDeliveryOpen, setIsDeliveryOpen] = useState(false);
    const [isStockAlertOpen, setIsStockAlertOpen] = useState(false);
    const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo | undefined>();
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [lastOrderData, setLastOrderData] = useState<any>(null);

    // Nuevos estados para Báscula Bluetooth, Configuración de Caja, Tickets, Hardware/QR/NFC y Sockets
    const firebaseStatus = useERPStore((s) => s.firebaseStatus);
    const syncErrorCode = useERPStore((s) => s.syncErrorCode);
    const pendingOfflineCount = useERPStore((s) => s.pendingOfflineCount);

    const [navigatorOnline, setNavigatorOnline] = useState(true);
    const [isLocalHttp, setIsLocalHttp] = useState(false);
    const [socketState, setSocketState] = useState<InventorySocketState>('idle');
    const [isReconnectingSockets, setIsReconnectingSockets] = useState(false);

    const [posConfig, setPosConfig] = useState<PosConfig>(DEFAULT_POS_CONFIG);
    const [hardwareConfig, setHardwareConfig] = useState<HardwareConfig>(() => loadHardwareConfig());
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isHardwareModalOpen, setIsHardwareModalOpen] = useState(false);
    const [isScaleOpen, setIsScaleOpen] = useState(false);
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [currentTicket, setCurrentTicket] = useState<DigitalTicket | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const scale = useBluetoothScale();

    // Assignments for pickup location (ventanilla/cajon)
    const [assignments, setAssignments] = useState<Record<string, { type: 'ventanilla' | 'cajon'; number: string }>>({});
    const [claimingOrderId, setClaimingOrderId] = useState<string | null>(null);
    const [orderForDeliveryProof, setOrderForDeliveryProof] = useState<any>(null);
    const [cashTenderOrder, setCashTenderOrder] = useState<any | null>(null);
    const [pickingOrder, setPickingOrder] = useState<any | null>(null);
    const [deconstructingOrder, setDeconstructingOrder] = useState<any | null>(null);
    const [onlyMyOrders, setOnlyMyOrders] = useState(false);
    const [colaViewMode, setColaViewMode] = useState<'board' | 'list'>('board');

    const handlePickingComplete = async (orderId: string) => {
        const id = typeof orderId === 'string' ? orderId : (orderId as any)?.orderId;
        const order = orders.find(o => o.id === id) || pickingOrder;
        setPickingOrder(null);
        if (order) {
            setCashTenderOrder(order);
        }
    };

    const handleDeconstructComplete = async (orderId: string) => {
        const id = typeof orderId === 'string' ? orderId : (orderId as any)?.orderId;
        if (!id) {
            setDeconstructingOrder(null);
            return;
        }
        try {
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action: 'return_to_shelf' })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`📦 Artículos del pedido ${id} reincorporados al anaquel.`);
                broadcastSync();
            } else {
                toast.error(data.error || 'Error reincorporando artículos.');
            }
        } catch {
            toast.error('Error de red al reincorporar artículos.');
        } finally {
            setDeconstructingOrder(null);
        }
    };

    const handleAdminRefund = async (orderId: string) => {
        if (!confirm(`¿Autorizar devolución de la venta #${orderId}? Los artículos quedarán pendientes de reincorporación a inventario.`)) return;
        try {
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: orderId, action: 'admin_refund_order', reason: 'Devolución autorizada por Admin' })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`↩️ Devolución de venta ${orderId} autorizada.`);
                broadcastSync();
                const target = orders.find(o => o.id === orderId);
                if (target) {
                    setDeconstructingOrder(target);
                }
            } else {
                toast.error(data.error || 'No se pudo procesar la devolución.');
            }
        } catch {
            toast.error('Error de red al procesar devolución.');
        }
    };

    // Protección contra abandono, espera de tickets y autorización por NIP real
    const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
    const [heldCarts, setHeldCarts] = useState<PosHeldCart[]>(() => listHeldPosCarts());
    const [cartGuardAction, setCartGuardAction] = useState<'clear' | 'logout' | 'leave_dashboard' | null>(null);
    const [pendingCartPinAction, setPendingCartPinAction] = useState<{
        type: 'clear_cart' | 'discard_held';
        holdId?: string;
        afterAction?: 'logout' | 'leave_dashboard';
    } | null>(null);
    const [isOptimizingMobile, setIsOptimizingMobile] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Cargar configuración de POS, hidratar carrito POS desde IndexedDB e inicializar audio en primer gesto
    const posCartHydrated = useRef(false);
    useEffect(() => {
        initAudioContextOnFirstGesture();
        try {
            const saved = localStorage.getItem('_bunkker_pos_config');
            if (saved) {
                setPosConfig(prev => ({ ...prev, ...JSON.parse(saved) }));
            }
        } catch { }

        loadPosCartFromIDB().then((savedItems) => {
            if (Array.isArray(savedItems) && savedItems.length > 0) {
                setPosCart(prev => (prev.length === 0 ? savedItems : prev));
            }
            posCartHydrated.current = true;
        }).catch(() => {
            posCartHydrated.current = true;
        });
    }, []);

    // Monitorear red, estado de Sockets de Inventario y cambios de Hardware/QR/NFC
    useEffect(() => {
        if (typeof window === 'undefined') return;
        setNavigatorOnline(navigator.onLine);
        setIsLocalHttp(window.location.protocol === 'http:');

        const existingSocket = (window as any).__inventorySocket;
        const existingSocketState = (window as any).__inventorySocketState as InventorySocketState | undefined;
        if (existingSocket?.connected) {
            setSocketState('connected');
        } else if (existingSocketState) {
            setSocketState(existingSocketState);
        }

        const onOnline = () => setNavigatorOnline(true);
        const onOffline = () => setNavigatorOnline(false);
        const onSocketStatus = (ev: Event) => {
            const next = (ev as CustomEvent<{ status?: InventorySocketState }>).detail?.status;
            if (next) setSocketState(next);
        };
        const onHardwareUpdate = () => {
            setHardwareConfig(loadHardwareConfig());
        };
        const onHoldUpdated = () => {
            setHeldCarts(listHeldPosCarts());
        };

        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        window.addEventListener(INVENTORY_SOCKET_STATUS_EVENT, onSocketStatus);
        window.addEventListener(HARDWARE_CONFIG_UPDATED_EVENT, onHardwareUpdate);
        window.addEventListener(OPERATION_HOLD_UPDATED_EVENT, onHoldUpdated);
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
            window.removeEventListener(INVENTORY_SOCKET_STATUS_EVENT, onSocketStatus);
            window.removeEventListener(HARDWARE_CONFIG_UPDATED_EVENT, onHardwareUpdate);
            window.removeEventListener(OPERATION_HOLD_UPDATED_EVENT, onHoldUpdated);
        };
    }, []);

    // Aviso preventivo del navegador si hay ticket o cobro en preparación activa
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const hasPendingOperation = posCart.length > 0 || Boolean(pickingOrder) || Boolean(cashTenderOrder);
        if (!hasPendingOperation) return;
        const onBeforeUnload = (ev: BeforeUnloadEvent) => {
            ev.preventDefault();
            ev.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [posCart.length, pickingOrder, cashTenderOrder]);

    const connectionView = computePosConnectionView({
        navigatorOnline,
        firebaseStatus,
        syncErrorCode,
        isLocalHttp,
        socketState,
        pendingOfflineCount,
    });

    const handleRetryInventoryConnection = useCallback(async () => {
        setIsReconnectingSockets(true);
        if (isLocalHttp) {
            setSocketState('reconnecting');
        }
        try {
            forceReconnectInventorySockets();
            await Promise.allSettled([
                flushOfflineOrderQueue(),
                flushPendingPrintJobs(),
            ]);
            showToast('🔄 Reconexión de Sockets de Inventario y sincronización lanzada.');
        } finally {
            setTimeout(() => setIsReconnectingSockets(false), 900);
        }
    }, [isLocalHttp]);

    // Persistir automáticamente el carrito del POS en IndexedDB y sincronizar posesión en RAM (Chunk Lease con TTL)
    const posSessionIdRef = useRef<string>('');
    useEffect(() => {
        if (!posSessionIdRef.current && typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('bunkker_pos_lease_session');
            if (saved) {
                posSessionIdRef.current = saved;
            } else {
                const randomBytes = new Uint32Array(1);
                window.crypto.getRandomValues(randomBytes);
                const generated = `POS-${randomBytes[0].toString(36).substring(0, 5).toUpperCase()}`;
                sessionStorage.setItem('bunkker_pos_lease_session', generated);
                posSessionIdRef.current = generated;
            }
        }
    }, []);

    useEffect(() => {
        if (!posCartHydrated.current) return;
        savePosCartToIDB(posCart).catch(() => { });

        const sessionId = posSessionIdRef.current || 'POS-CAJA';
        if (posCart.length === 0) {
            fetch('/api/inventory/chunk-leases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'release_session',
                    sessionId,
                }),
            }).catch(() => { });
            return;
        }

        posCart.forEach((item) => {
            fetch('/api/inventory/chunk-leases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'lease',
                    sessionId,
                    ownerName: profile?.displayName || 'Cajero POS',
                    productId: item.id,
                    qty: item.quantity,
                    ttlMs: 180 * 1000,
                }),
            })
                .then(async (res) => {
                    if (res.status === 409) {
                        const data = await res.json().catch(() => null);
                        if (data && typeof data.maxAllowed === 'number') {
                            toast.warning(
                                data.error || `Solo quedan ${data.maxAllowed} unidades libres en el Chunk.`
                            );
                            setPosCart((prev) =>
                                prev
                                    .map((ci) =>
                                        ci.id === item.id
                                            ? { ...ci, quantity: Math.min(ci.quantity, data.maxAllowed) }
                                            : ci
                                    )
                                    .filter((ci) => ci.quantity > 0)
                            );
                        }
                    }
                })
                .catch(() => { });
        });
    }, [posCart, profile?.displayName]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isKioskMode) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isKioskMode]);

    const showToast = (msg: string) => {
        setBannerMessage(msg);
        setTimeout(() => setBannerMessage(null), 3000);
    };

    const getAvailableStock = useCallback((prodId: string, fallbackStock?: number) => {
        const product = products.find(p => p.id === prodId);
        if (!product) return fallbackStock ?? 0;
        return Math.max(0, (product.stock ?? 0) - (product.reservedStock ?? 0));
    }, [products]);

    const getStockIssues = useCallback((): StockIssue[] => {
        const issues: StockIssue[] = [];
        for (const item of posCart) {
            const available = getAvailableStock(item.id, item.stock);
            if (item.quantity > available) {
                issues.push({
                    item,
                    requested: item.quantity,
                    available,
                    diff: item.quantity - available
                });
            }
        }
        return issues;
    }, [posCart, getAvailableStock]);

    const stockIssues = getStockIssues();
    const hasStockIssues = stockIssues.length > 0;

    const handleUpdateQuantity = (id: string, quantity: number) => {
        const availableStock = getAvailableStock(id);
        const product = products.find(p => p.id === id);
        const prodName = product?.name || 'Producto';

        if (quantity <= 0) {
            setPosCart(prev => prev.filter(i => i.id !== id));
            return;
        }

        if (quantity > availableStock) {
            showToast(`⚠️ Stock insuficiente: Solicitas ${quantity}, pero solo hay ${availableStock} disponible(s) de "${prodName}". Venta bloqueada.`);
        }

        setPosCart(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
    };

    const handleAdjustStockItem = (productId: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            setPosCart(prev => prev.filter(i => i.id !== productId));
        } else {
            setPosCart(prev => prev.map(i => i.id === productId ? { ...i, quantity: newQuantity } : i));
        }
        showToast('Cantidad ajustada al stock disponible.');
    };

    const handleRemoveStockItem = (productId: string) => {
        setPosCart(prev => prev.filter(i => i.id !== productId));
        showToast('Producto eliminado del pedido.');
    };

    const handleAdjustAllStock = () => {
        setPosCart(prev => {
            return prev.map(item => {
                const available = getAvailableStock(item.id, item.stock);
                if (item.quantity > available) {
                    return available > 0 ? { ...item, quantity: available } : null;
                }
                return item;
            }).filter(Boolean) as (Product & { quantity: number })[];
        });
        setIsStockAlertOpen(false);
        showToast('Productos ajustados al stock físico disponible.');
    };

    const handleRemoveAllDeficits = () => {
        setPosCart(prev => {
            return prev.filter(item => {
                const available = getAvailableStock(item.id, item.stock);
                return item.quantity <= available;
            });
        });
        setIsStockAlertOpen(false);
        showToast('Se eliminaron los productos sin existencias suficientes.');
    };

    const posTotal = posCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const handleCheckoutClick = useCallback(() => {
        const issues = getStockIssues();
        if (issues.length > 0) {
            setIsStockAlertOpen(true);
            showToast(`⛔ Venta bloqueada: ${issues.length} producto(s) no tienen suficiente stock.`);
            return;
        }

        if (orderType === 'delivery') {
            setIsDeliveryOpen(true);
        } else {
            setIsPaymentOpen(true);
        }
    }, [getStockIssues, orderType]);

    const handleAddProduct = (product: Product) => {
        const availableStock = getAvailableStock(product.id, product.stock);
        if (availableStock <= 0) {
            if (posConfig.soundEnabled) playErrorBeep(posConfig.soundVolume);
            showToast(`⛔ Producto agotado: "${product.name}" no tiene existencias.`);
            return;
        }

        const existing = posCart.find(i => i.id === product.id);
        const currentQty = existing ? existing.quantity : 0;

        if (currentQty + 1 > availableStock) {
            if (posConfig.soundEnabled) playErrorBeep(posConfig.soundVolume);
            showToast(`⛔ Stock insuficiente: Solo hay ${availableStock} unidad(es) de "${product.name}". Venta bloqueada.`);
            return;
        }

        // Comportamiento tipo supermercado: si ya existe, pitido de incremento y +1; si es nuevo, pitido de ingreso
        if (existing) {
            if (posConfig.soundEnabled) playIncrementBeep(posConfig.soundVolume);
            showToast(`⚡ PIT! +1 "${product.name}" (Total: ${existing.quantity + 1}) — $${product.price.toFixed(2)}`);
            setPosCart(prev => prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
        } else {
            if (posConfig.soundEnabled) playSupermarketBeep(posConfig.soundVolume);
            showToast(`🔔 PIT! 1 "${product.name}" agregado — $${product.price.toFixed(2)}`);
            setPosCart(prev => [...prev, { ...product, quantity: 1 }]);
        }
    };

    const handleApplyWeightToItem = (productId: string, weight: number) => {
        handleUpdateQuantity(productId, weight);
        if (posConfig.soundEnabled) playSupermarketBeep(posConfig.soundVolume);
        showToast(`⚖️ Peso de ${weight.toFixed(3)} ${scale.unit} aplicado al producto.`);
    };

    const handleCodeLookup = useCallback((rawCode: string, source: 'barcode' | 'qr' | 'nfc') => {
        const cleanCode = rawCode.trim();
        if (!cleanCode) return;
        const normalized = cleanCode.toLowerCase();

        const shouldCheckOrdersFirst =
            (source === 'nfc' && hardwareConfig.nfcAutoAction === 'lookup_order') ||
            normalized.startsWith('ord-') ||
            normalized.startsWith('ped-') ||
            normalized.startsWith('tk-');

        if (shouldCheckOrdersFirst) {
            setActiveTab('online');
            setOnlineSearch(cleanCode);
            if (posConfig.soundEnabled && hardwareConfig.scannerBeep) playSupermarketBeep(posConfig.soundVolume);
            showToast(`🔎 Buscando pedido/ticket "${cleanCode}"...`);
            return;
        }

        const product =
            findProductByBarcodeOrCode(products, cleanCode) ||
            products.find(p => p.name.toLowerCase() === normalized);

        if (product) {
            handleAddProduct(product);
            setPosSearch('');
            return;
        }

        if (source === 'nfc' && hardwareConfig.nfcAutoAction === 'auto') {
            const matchedOrder = orders.find(o => o.id?.toLowerCase() === normalized);
            if (matchedOrder) {
                setActiveTab('online');
                setOnlineSearch(cleanCode);
                if (posConfig.soundEnabled && hardwareConfig.scannerBeep) playSupermarketBeep(posConfig.soundVolume);
                showToast(`🎫 Pedido NFC localizado: ${matchedOrder.id}`);
                return;
            }
        }

        if (posConfig.soundEnabled) playErrorBeep(posConfig.soundVolume);
        showToast('❌ Código no registrado: ' + cleanCode);
    }, [products, orders, hardwareConfig.nfcAutoAction, hardwareConfig.scannerBeep, posConfig.soundEnabled, posConfig.soundVolume]);

    // Escáner láser y lector NFC USB HID nativo (Hook global de teclado rápido)
    useBarcodeScanner((barcode) => {
        if (activeTab !== 'pos' && !hardwareConfig.nfcEnabled) return;
        const source = hardwareConfig.nfcEnabled && hardwareConfig.nfcMode === 'usb_hid' && activeTab !== 'pos' ? 'nfc' : 'barcode';
        handleCodeLookup(barcode, source);
    });

    // Lector Web NFC nativo (cuando está habilitado en HardwareSettingsModal)
    const nfcScanner = useNfcScanner({
        enabled: hardwareConfig.nfcEnabled && hardwareConfig.nfcMode === 'web_nfc',
        onRead: (tag) => {
            handleCodeLookup(tag.code, 'nfc');
        },
        onError: (msg) => {
            showToast(`⚠️ NFC: ${msg}`);
        },
    });

    // Atajos de Teclado Globales (Hotkeys de Caja)
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            const isTyping = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

            // F1 o "/" (cuando no está dentro de un input): Enfocar buscador / escáner
            if (e.key === 'F1' || (e.key === '/' && !isTyping)) {
                e.preventDefault();
                searchInputRef.current?.focus();
                return;
            }

            // F2: Cobrar en Caja
            if (e.key === 'F2') {
                e.preventDefault();
                if (posCart.length > 0) {
                    handleCheckoutClick();
                } else {
                    showToast('El pedido está vacío. Escanea o agrega productos.');
                }
                return;
            }

            // F3: Abrir Báscula Bluetooth / Serial
            if (e.key === 'F3') {
                e.preventDefault();
                setIsScaleOpen(prev => !prev);
                return;
            }

            // F4: Proteger vaciado de carrito (En Espera o Abandono con NIP)
            if (e.key === 'F4') {
                e.preventDefault();
                if (posCart.length > 0) {
                    setCartGuardAction('clear');
                }
                return;
            }

            // F5: Abrir Cámara Escáner (Modo Pasillo)
            if (e.key === 'F5') {
                e.preventDefault();
                setShowCameraScanner(prev => !prev);
                return;
            }

            // F8: Abrir Historial de Tickets y Reimpresión
            if (e.key === 'F8') {
                e.preventDefault();
                setIsHistoryOpen(prev => !prev);
                return;
            }

            // F10: Abrir Corte de Caja Ciego
            if (e.key === 'F10') {
                e.preventDefault();
                setShowCorteCaja(true);
                return;
            }

            // Escape: Cerrar modales abiertos
            if (e.key === 'Escape') {
                setIsScaleOpen(false);
                setShowCameraScanner(false);
                setIsSettingsOpen(false);
                setIsTicketModalOpen(false);
                setIsHistoryOpen(false);
                setIsPaymentOpen(false);
                setIsDeliveryOpen(false);
                setIsStockAlertOpen(false);
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [posCart, hasStockIssues, activeTab, handleCheckoutClick]);

    const handleDeliveryConfirm = (info: DeliveryInfo) => {
        setDeliveryInfo(info);
        setIsDeliveryOpen(false);
        setIsPaymentOpen(true);
    };

    const handleConfirmPayment = async (amountReceived: number, change: number, evidencePhoto?: string) => {
        if (posCart.length === 0 || processingId === 'checkout') return;

        // Doble validación de seguridad previa al cobro
        const issues = getStockIssues();
        if (issues.length > 0) {
            setIsPaymentOpen(false);
            setIsStockAlertOpen(true);
            showToast(`⛔ Venta bloqueada: Stock insuficiente detectado en ${issues.length} producto(s).`);
            return;
        }

        setProcessingId('checkout');

        const orderId = `TKT-${Date.now().toString().slice(-6)}`;
        const orderDate = new Date().toISOString();
        const socket = (window as any).__inventorySocket;
        let reservationHeld = false;

        // La venta ya está cobrada, pero todavía debe pasar por almacén.
        // "paid" es el estado común que habilita la preparación y después
        // deriva a pickup o reparto según deliveryType.
        const finalStatus = 'paid';
        const cName = orderType === 'delivery' ? deliveryInfo?.customerName : 'Cliente Mostrador';

        const orderPayload = {
            id: orderId,
            customer: {
                name: cName,
                phone: deliveryInfo?.phone || '',
                address: deliveryInfo?.address || 'Mostrador',
                reference: deliveryInfo?.reference || ''
            },
            customerName: cName,
            items: posCart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, unitType: i.unitType || 'PZA' })),
            total: posTotal,
            date: orderDate,
            status: finalStatus as any,
            paymentMethod: 'Venta Directa POS',
            deliveryType: orderType === 'delivery' ? 'DELIVERY' : 'LOCAL',
            confirmedAt: orderDate,
            channel: 'pos',
            deliveryMethod: orderType === 'delivery' ? 'repartidor' : 'directo',
            vendedorId: profile?.uid || 'LOCAL',
            vendedorName: profile?.displayName || 'Cajero',
            amountReceived,
            change,
            stockDeducted: true, // Indica a cancelOrder() que este pedido descontó stock físico y debe reintegrarse si se cancela
            evidencePhoto: evidencePhoto || null,
            ...(orderType === 'delivery' && deliveryInfo ? {
                lat: deliveryInfo.lat,
                lng: deliveryInfo.lng
            } : {})
        };

        setLastOrderData({ orderId, items: [...posCart], total: posTotal, customerName: cName, amountReceived, change });

        try {
            if (socket) {
                const reservationItems = posCart.map(item => ({ id: item.id, qty: item.quantity }));
                const dbStockMap = Object.fromEntries(reservationItems.map(item => {
                    const product = products.find(current => current.id === item.id);
                    return [item.id, Math.max(0, (product?.stock || 0) - (product?.reservedStock || 0))];
                }));
                const reservationPromise = new Promise(resolve => {
                    socket.emit('reserve_stock', { reservationId: orderId, items: reservationItems, dbStockMap }, resolve);
                });
                const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ success: true, timedOut: true }), 1500));
                const reservation: any = await Promise.race([reservationPromise, timeoutPromise]);
                if (!reservation?.success) {
                    throw new Error(`Inventario reservado en otra caja: ${(reservation?.failedItems || []).join(', ')}`);
                }
                reservationHeld = true;
            }

            const posApiPayload = {
                id: orderId,
                total: posTotal,
                paymentMethod: 'cash',
                status: finalStatus,
                deliveryType: orderType === 'delivery' ? 'DELIVERY' : 'PICKUP',
                deliveryMethod: orderType === 'delivery' ? 'repartidor' : 'pickup',
                vendedorId: profile?.uid || 'LOCAL',
                vendedorName: profile?.displayName || 'Cajero',
                confirmedAt: orderDate,
                items: posCart.map(i => ({ id: i.id, productId: i.id, quantity: i.quantity, price: i.price, name: i.name })),
                customer: orderPayload.customer,
                evidencePhoto: evidencePhoto || null
            };

            // Resguardar primero en IndexedDB contra cierres de navegador o caída de red
            await enqueueOfflineOrder({
                orderId,
                payload: posApiPayload,
                source: 'pos'
            });

            // ─── LOCAL EDGE API SYNC ───
            let syncedImmediately = false;
            try {
                if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                    throw new TypeError('Offline');
                }
                const response = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(posApiPayload)
                });
                const result = await response.json().catch(() => null);
                if (response.ok && result?.success) {
                    syncedImmediately = true;
                    await removeQueuedOfflineOrder(orderId);
                } else if (response.status >= 400 && response.status < 500) {
                    await removeQueuedOfflineOrder(orderId);
                    throw new Error(result?.error || 'No se pudo guardar la venta local.');
                }
            } catch (netErr: any) {
                const isValidationErr = netErr instanceof Error && !String(netErr.message).includes('Offline') && !String(netErr.message).includes('fetch') && !(netErr instanceof TypeError);
                if (isValidationErr) throw netErr;
                console.warn('[POS IndexedDB] Conexión inestable, venta guardada en IndexedDB para sincronización automática:', orderId);
            }

            if (reservationHeld && socket) {
                socket.emit('commit_stock', orderId);
                reservationHeld = false;
            }

            logAudit({
                type: 'ORDER_CREATE',
                userId: profile?.uid || 'POS',
                userName: profile?.displayName || cName || 'Cliente Mostrador',
                userRole: profile?.role || 'sales',
                description: `[POS] Venta directa ${orderId} — $${posTotal.toFixed(2)}${syncedImmediately ? '' : ' (Encolada en IndexedDB)'}`,
                metadata: { orderId, total: posTotal, items: posCart.length, offlineQueued: !syncedImmediately },
            }).catch(() => { });

            // Sincronización inmediata de estado local y multidispotivo (0ms)
            try {
                const currentOrders = useERPStore.getState().orders;
                const existingIdx = currentOrders.findIndex(o => o.id === orderId);
                if (existingIdx === -1) {
                    useERPStore.getState().setOrders([orderPayload as any, ...currentOrders]);
                }
                broadcastSync({ action: 'POS_DIRECT_SALE', id: orderId });
            } catch (syncErr) {
                console.warn('[POS Sync] Error al actualizar estado local:', syncErr);
            }

            // ─── RESGUARDO DE TICKET (COPIA CLIENTE + COPIA VENDEDOR) ───
            const savedTicket = saveDigitalTicket(
                'caja_1',
                profile?.displayName || 'Cajero de Turno',
                orderId,
                posCart,
                posTotal,
                {
                    amountReceived,
                    change,
                    paymentMethod: 'EFECTIVO EN CAJA',
                    customerName: cName as string,
                    vendedorId: profile?.uid || 'LOCAL',
                    vendedorName: profile?.displayName || 'Cajero',
                    evidencePhoto
                }
            );
            setCurrentTicket(savedTicket);

            // Impresión ESC/POS por Web Serial con respaldo por navegador. Nunca bloquea la venta.
            if (posConfig.autoPrintReceipt) {
                const printResult = await printReceipt({
                    businessName: siteConfig?.businessName || posConfig.cajaName || 'BUNKKER POS',
                    orderId: orderId,
                    items: posCart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
                    total: posTotal,
                    date: new Date(),
                    customerName: cName as string
                });
                if (!printResult.ok) {
                    showToast(`🖨️ ${printResult.message} El ticket digital está disponible en pantalla.`);
                    logAudit({
                        type: 'PRINT_FAILED',
                        userId: profile?.uid || 'POS',
                        userName: profile?.displayName || 'Cajero',
                        userRole: profile?.role || 'sales',
                        description: `[POS] Fallo de impresión en ${orderId}: ${printResult.code}`,
                        metadata: { orderId, code: printResult.code },
                    }).catch(() => { });
                }
            }

            // Abrir visor de comprobantes duales (Copia Cliente + Copia Tienda + Factura SAT)
            setIsTicketModalOpen(true);

            showToast(syncedImmediately ? '¡Venta completada! Ticket resguardado en bitácora.' : '💾 Venta guardada en IndexedDB (Offline) y ticket emitido.');
            setPosCart([]);
            setIsPaymentOpen(false);
            setDeliveryInfo(undefined);
            setOrderType('local');

        } catch (error: any) {
            if (reservationHeld && socket) socket.emit('release_stock', orderId);
            console.error('[POS] Error en checkout:', error);
            showToast(`❌ Error al procesar la venta: ${error?.message}`);
        } finally {
            setProcessingId(null);
        }
    };

    const handleAuthorizedOrderCancel = async (authResult: PinAuthorizationResult) => {
        if (!orderToCancel) return;
        const targetId = orderToCancel;
        try {
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    id: targetId,
                    status: 'cancelled',
                    verificationPin: authResult.pin,
                    reason: authResult.reason || 'Cancelación autorizada con NIP en caja',
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                await cancelOrder(targetId);
            }
            broadcastSync({ action: 'ORDER_CANCELLED', id: targetId });
            showToast(`Orden ${targetId} cancelada por ${authResult.verifiedBy.name}.`);
        } catch {
            showToast('Error al rechazar la orden.');
        } finally {
            setOrderToCancel(null);
        }
    };

    const handleHoldCurrentPosCart = async () => {
        const after = cartGuardAction;
        if (posCart.length > 0) {
            const held = putPosCartOnHold({
                items: posCart as any,
                orderType,
                deliveryInfo: deliveryInfo as any,
                operatorUid: profile?.uid,
                operatorName: profile?.displayName,
                reason: after === 'logout' ? 'Ticket pausado antes de cerrar sesión' : 'Ticket en espera en mostrador',
            });
            if (held) {
                setHeldCarts(listHeldPosCarts());
                setPosCart([]);
                setDeliveryInfo(undefined);
                setOrderType('local');
                showToast(`Ticket guardado en espera (${held.itemCount} artículos).`);
            }
        }
        setCartGuardAction(null);
        if (after === 'leave_dashboard') {
            router.push('/dashboard');
        } else if (after === 'logout') {
            await signOut();
            window.location.href = '/login';
        }
    };

    const handleRestoreHeldCart = (holdId: string) => {
        if (posCart.length > 0) {
            putPosCartOnHold({
                items: posCart as any,
                orderType,
                deliveryInfo: deliveryInfo as any,
                operatorUid: profile?.uid,
                operatorName: profile?.displayName,
                reason: 'Pausado automáticamente al retomar otro ticket',
            });
        }
        const restored = takeHeldPosCart(holdId);
        if (!restored) return;
        setPosCart(restored.items as any);
        setOrderType(restored.orderType || 'local');
        setDeliveryInfo(restored.deliveryInfo as any);
        setHeldCarts(listHeldPosCarts());
        setActiveTab('pos');
        showToast(`Ticket en espera retomado (${restored.itemCount} artículos).`);
    };

    const handleAuthorizedCartAbandon = async (authResult: PinAuthorizationResult) => {
        if (!pendingCartPinAction) return;
        const { type, holdId, afterAction } = pendingCartPinAction;

        if (type === 'discard_held' && holdId) {
            discardHeldPosCart(holdId);
            setHeldCarts(listHeldPosCarts());
            showToast(`Ticket en espera descartado con NIP (${authResult.verifiedBy.name}).`);
        } else {
            logAudit({
                type: 'ORDER_CANCEL',
                userId: authResult.verifiedBy.uid,
                userName: authResult.verifiedBy.name,
                userRole: authResult.verifiedBy.role,
                description: `[POS] Ticket en preparación descartado con NIP (${posCart.length} artículos). Motivo: ${authResult.reason || 'Cancelación en mostrador'}`,
                metadata: { itemCount: posCart.length, reason: authResult.reason },
            }).catch(() => {});
            setPosCart([]);
            setDeliveryInfo(undefined);
            setOrderType('local');
            showToast(`Operación cancelada con NIP (${authResult.verifiedBy.name}).`);
        }

        setPendingCartPinAction(null);
        setCartGuardAction(null);

        if (afterAction === 'leave_dashboard') {
            router.push('/dashboard');
        } else if (afterAction === 'logout') {
            await signOut();
            window.location.href = '/login';
        }
    };

    const handleRunMobileOptimize = async () => {
        if (isOptimizingMobile) return;
        setIsOptimizingMobile(true);
        try {
            const rep = await runMobileOptimization();
            showToast(
                `Caché móvil liberado: ${rep.serverRemovedFiles} archivos temp, ${rep.swCacheEvicted} entradas SW y ${rep.prunedLocalDrafts} borradores.`
            );
        } finally {
            setIsOptimizingMobile(false);
        }
    };

    const isTestOrder = (o: any) => {
        const id = (o.id || '').toLowerCase();
        const cust = (o.customer?.name || o.customerName || o.clientName || '').toLowerCase();
        return id.startsWith('test') || id.includes('demo') || cust.includes('test') || cust.includes('prueba');
    };

    const handleDeleteOrder = async (orderId: string) => {
        if (!window.confirm(`¿Estás seguro de eliminar permanentemente la orden ${orderId}? Esta acción no se puede deshacer.`)) {
            return;
        }
        try {
            const res = await fetch(`/api/orders?id=${encodeURIComponent(orderId)}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                showToast(`🗑️ Pedido ${orderId} eliminado.`);
                broadcastSync();
            } else {
                toast.error(data.error || 'Error al eliminar el pedido.');
            }
        } catch {
            toast.error('Error de red al eliminar el pedido.');
        }
    };

    const handleClaimOrder = async (orderId: string) => {
        try {
            setClaimingOrderId(orderId);
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: orderId, action: 'claim_cashier' })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`✅ Pedido ${orderId} tomado en tu caja.`);
                broadcastSync();
            } else {
                toast.error(data.error || 'No se pudo tomar el pedido.');
            }
        } catch {
            toast.error('Error al tomar el pedido.');
        } finally {
            setClaimingOrderId(null);
        }
    };

    const PENDING_CASHIER_STATUSES = [
        'pending_payment',
        'pending_confirmation',
        'pending',
        'paid',
        'PREPARANDO',
        'EN_ESPERA',
        'READY_TO_SHIP',
        'READY_FOR_PICKUP',
        'READY_FOR_PICKUP_PAID',
        'pending_delivery',
        'NIGHT_QUEUE',
        'cancelled',
        'refunded'
    ];

    const isStoreOrder = (o: any) => o.deliveryType !== 'DELIVERY' && o.deliveryMethod !== 'repartidor';

    const pendingOrders = orders.filter(o => isStoreOrder(o) && PENDING_CASHIER_STATUSES.includes(o.status) && !isTestOrder(o));

    const pendingPrepOrders = orders.filter(o => isStoreOrder(o) && !o.isLoaded && !['DELIVERED', 'COMPLETED', 'cancelled', 'refunded'].includes(o.status) && !isTestOrder(o));
    const readyToPayOrders = orders.filter(o => isStoreOrder(o) && (o.isLoaded || ['READY_TO_SHIP', 'READY_FOR_PICKUP'].includes(o.status)) && !o.confirmedAt && o.status !== 'paid' && o.status !== 'READY_FOR_PICKUP_PAID' && !['DELIVERED', 'COMPLETED', 'cancelled', 'refunded'].includes(o.status) && !isTestOrder(o));
    const cancelledOrders = orders.filter(o => isStoreOrder(o) && (o.status === 'cancelled' || o.status === 'refunded') && !isTestOrder(o));
    const cancelledReacomodoOrders = cancelledOrders.filter(o => o.rejectionReason !== 'CANCELADA_STOCK_RESTITUIDO');

    const filterBySearch = (o: any) => {
        if (!onlineSearch.trim()) return true;
        const term = onlineSearch.toLowerCase().trim();
        const matchesId = (o.id || '').toLowerCase().includes(term);
        const matchesCustomer = (o.customer?.name || '').toLowerCase().includes(term);
        const matchesPhone = (o.customer?.phone || '').includes(term);
        const matchesItems = (o.items || []).some((it: any) =>
            (it.name || it.productName || it.productId || '').toLowerCase().includes(term)
        );
        return matchesId || matchesCustomer || matchesPhone || matchesItems;
    };

    // 🟢 VERDE: "Los que pueden tomar" (pedidos libres sin asignar o no tomados por mí)
    const greenCanClaimOrders = orders.filter(o => {
        if (!isStoreOrder(o) || isTestOrder(o)) return false;
        const isUnpaid = !o.confirmedAt && o.status !== 'paid' && o.status !== 'READY_FOR_PICKUP_PAID';
        const isNotLoaded = !o.isLoaded && !['READY_TO_SHIP', 'READY_FOR_PICKUP'].includes(o.status);
        const isTerminal = ['DELIVERED', 'COMPLETED', 'cancelled', 'refunded'].includes(o.status);
        if (!isUnpaid || !isNotLoaded || isTerminal) return false;
        // Libre para tomar si no tiene cajero asignado o fue iniciado por otro usuario
        const canTake = !o.vendedorId || o.vendedorId !== profile?.uid;
        return canTake;
    }).filter(filterBySearch);

    // 🟡 AMARILLO: "Los que tienes que preparar" (en almacén / mostrador pendientes de surtido)
    const yellowNeedPrepOrders = orders.filter(o => {
        if (!isStoreOrder(o) || isTestOrder(o)) return false;
        const isUnpaid = !o.confirmedAt && o.status !== 'paid' && o.status !== 'READY_FOR_PICKUP_PAID';
        const isNotLoaded = !o.isLoaded && !['READY_TO_SHIP', 'READY_FOR_PICKUP'].includes(o.status);
        const isTerminal = ['DELIVERED', 'COMPLETED', 'cancelled', 'refunded'].includes(o.status);
        if (!isUnpaid || !isNotLoaded || isTerminal) return false;
        if (onlyMyOrders && o.vendedorId !== profile?.uid) return false;
        return true;
    }).filter(filterBySearch);

    // 🔵 AZUL: "Los que ya puedes cobrar" (surtidos listos para cobrar)
    // REGLA CRUCIAL DEL USUARIO: "caja cobra todos asi que ahi aparacen los de todos y el cobra ok"
    const blueReadyToPayOrders = orders.filter(o => {
        if (!isStoreOrder(o) || isTestOrder(o)) return false;
        const isReady = (Boolean(o.isLoaded) || ['READY_TO_SHIP', 'READY_FOR_PICKUP'].includes(o.status));
        const isUnpaid = !o.confirmedAt && o.status !== 'paid' && o.status !== 'READY_FOR_PICKUP_PAID';
        const isTerminal = ['DELIVERED', 'COMPLETED', 'cancelled', 'refunded'].includes(o.status);
        // ¡NO se aplica onlyMyOrders aquí! Caja cobra absolutamente todos los pedidos listos.
        return isReady && isUnpaid && !isTerminal;
    }).filter(filterBySearch);

    // 📦 LISTOS ENTREGA: Surtidos y cobrados listos para entregar físicamente al cliente con firma y foto (PoD)
    const readyToDeliverOrders = orders.filter(o => {
        if (!isStoreOrder(o) || isTestOrder(o)) return false;
        const isReady = ['READY_TO_SHIP', 'READY_FOR_PICKUP_PAID'].includes(o.status) || (Boolean(o.isLoaded) && (Boolean(o.confirmedAt) || o.status === 'paid')) || o.status === 'READY_FOR_PICKUP';
        const isTerminal = ['DELIVERED', 'COMPLETED', 'cancelled', 'refunded'].includes(o.status);
        const isPaid = Boolean(o.confirmedAt) || o.status === 'paid' || o.status === 'READY_FOR_PICKUP_PAID';
        if (onlyMyOrders && o.vendedorId && o.vendedorId !== profile?.uid) return false;
        return isReady && isPaid && !isTerminal;
    }).filter(filterBySearch);

    const totalBlueReadyCash = blueReadyToPayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const displayedOrders = pendingOrders.filter(o => {
        if (onlyMyOrders) {
            const isMine = o.vendedorId === profile?.uid || o.loadedByUid === profile?.uid || o.vendedorName === profile?.displayName;
            if (!isMine) return false;
        }
        if (orderFilter === 'pending') {
            const isUnpaid = !o.confirmedAt && o.status !== 'paid' && o.status !== 'READY_FOR_PICKUP_PAID';
            if (!isUnpaid || !['pending_payment', 'pending_confirmation', 'pending', 'NIGHT_QUEUE', 'READY_FOR_PICKUP'].includes(o.status)) return false;
        } else if (orderFilter === 'ready') {
            const isReady = ['READY_TO_SHIP', 'READY_FOR_PICKUP_PAID'].includes(o.status) || (Boolean(o.isLoaded) && (Boolean(o.confirmedAt) || o.status === 'paid')) || o.status === 'READY_FOR_PICKUP';
            if (!isReady) return false;
        } else if (orderFilter === 'delivery') {
            if (o.status !== 'pending_delivery') return false;
        } else if (orderFilter === 'cancelled') {
            if (o.status !== 'cancelled' && o.status !== 'refunded') return false;
        }

        return filterBySearch(o);
    });

    return (
        <div className="fixed inset-0 z-50 flex flex-col h-screen bg-slate-950 text-white overflow-hidden font-sans">
            {/* Background blobs for Glassmorphism */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/40 blur-[120px] rounded-full mix-blend-screen pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-900/30 blur-[120px] rounded-full mix-blend-screen pointer-events-none"></div>

            {/* Top Header */}
            <header className="bg-zinc-900/40 backdrop-blur-xl border-b border-white/10 p-3 sm:px-6 flex items-center justify-between shrink-0 shadow-lg relative z-20 w-full">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-500/20 text-blue-400 p-1.5 rounded-lg flex items-center justify-center border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                        <TerminalSquare className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-sm font-bold tracking-wide">CAJA MÓVIL</h1>
                        <div
                            id="pos-connection-status"
                            data-status={connectionView.statusType}
                            onClick={() => setIsHardwareModalOpen(true)}
                            className="flex items-center gap-2 flex-wrap mt-0.5 cursor-pointer group"
                            title="Haz clic para abrir la configuración e inicialización de hardware (Impresora USB/Serial, Láser, QR y NFC)"
                        >
                            <span
                                className={`text-[10px] font-mono inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all group-hover:brightness-110 ${
                                    connectionView.isDisconnected
                                        ? 'bg-red-500/15 text-red-300 border-red-500/40'
                                        : connectionView.isDegraded
                                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                }`}
                                title={connectionView.detail}
                            >
                                {connectionView.isDisconnected ? (
                                    <WifiOff className="w-3 h-3 text-red-400 shrink-0" />
                                ) : (
                                    <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${
                                            connectionView.isDegraded
                                                ? 'bg-amber-400 animate-ping'
                                                : 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse'
                                        }`}
                                    />
                                )}
                                <span className="font-bold">{connectionView.label}</span>
                            </span>

                            {connectionView.isDisconnected && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void handleRetryInventoryConnection();
                                    }}
                                    disabled={isReconnectingSockets}
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                                    title="Forzar reconexión de los Sockets de Inventario y sincronización SSE"
                                >
                                    <RotateCcw className={`w-3 h-3 ${isReconnectingSockets ? 'animate-spin' : ''}`} />
                                    {isReconnectingSockets ? 'Reconectando...' : 'Reintentar Conexión'}
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsHardwareModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border border-cyan-500/35 text-[10px] font-bold transition-all cursor-pointer"
                                title="Seleccionar e inicializar impresora USB/Serial, escáner láser, QR y NFC"
                            >
                                <Sliders className="w-3 h-3 text-cyan-400" />
                                <span>
                                    {hardwareConfig.printerMode === 'serial'
                                        ? 'USB/Serial'
                                        : hardwareConfig.printerMode === 'bluetooth'
                                            ? 'BT'
                                            : hardwareConfig.printerMode === 'network'
                                                ? 'Red'
                                                : 'Digital'}
                                    {' · '}
                                    {hardwareConfig.scannerMode === 'hid' ? 'Láser' : 'QR'}
                                    {hardwareConfig.nfcEnabled ? ' · NFC' : ''}
                                </span>
                            </button>

                            {hardwareConfig.nfcEnabled && hardwareConfig.nfcMode === 'web_nfc' && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (nfcScanner.isListening) {
                                            nfcScanner.stopScan();
                                        } else {
                                            void nfcScanner.startScan();
                                        }
                                    }}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold transition-all cursor-pointer ${
                                        nfcScanner.isListening
                                            ? 'bg-amber-500/25 text-amber-200 border-amber-400 animate-pulse'
                                            : 'bg-zinc-800/80 text-zinc-300 border-white/15 hover:border-amber-400/50'
                                    }`}
                                    title="Activar o detener lectura NFC en caja"
                                >
                                    <Nfc className="w-3 h-3 text-amber-400" />
                                    <span>{nfcScanner.isListening ? 'NFC Escuchando' : 'Activar NFC'}</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Central Tabs for POS and Online - Botones Grandes y Táctiles */}
                <div className="flex bg-black/50 p-1.5 rounded-2xl border border-white/10 mx-2 sm:mx-4 shadow-inner gap-1.5">
                    <button
                        onClick={() => setActiveTab('pos')}
                        className={`flex items-center gap-2 px-4 sm:px-7 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-black transition-all active:scale-95 ${
                            activeTab === 'pos' 
                                ? 'bg-white/15 text-white shadow-lg border border-white/20' 
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                        }`}
                    >
                        <Store className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" /> <span className="hidden xs:inline">PUNTO DE</span> VENTA
                    </button>
                    <button
                        onClick={() => setActiveTab('online')}
                        className={`flex items-center gap-2 px-4 sm:px-7 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-black transition-all active:scale-95 relative ${
                            activeTab === 'online' 
                                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-lg' 
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                        }`}
                    >
                        <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" /> COLA ({pendingOrders.length})
                        {pendingOrders.length > 0 && (
                            <span className="absolute top-1 right-2 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                        )}
                        {pendingOrders.length > 0 && (
                            <span className="absolute top-1 right-2 w-2.5 h-2.5 rounded-full bg-red-500"></span>
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 text-zinc-300">
                    <ThemeToggle className="text-zinc-300" />

                    {/* Botón Báscula Bluetooth / Serial */}
                    <button
                        onClick={() => setIsScaleOpen(true)}
                        className={`transition-all flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border text-xs sm:text-sm font-bold active:scale-95 ${
                            scale.isConnected
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                                : 'bg-white/5 hover:text-white border-white/10'
                        }`}
                        title="Báscula de Pesaje BLE / Serial (F3)"
                    >
                        <Scale className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400 shrink-0" />
                        <span className="hidden md:inline font-mono">
                            {scale.isConnected ? `${scale.weight.toFixed(3)} ${scale.unit}` : 'BÁSCULA'}
                        </span>
                    </button>

                    {/* Botón Bitácora / Historial de Tickets */}
                    <button
                        onClick={() => setIsHistoryOpen(true)}
                        className="hover:text-white transition-all active:scale-95 flex items-center gap-1.5 bg-white/5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-white/10 text-xs sm:text-sm font-bold shadow-sm"
                        title="Historial de Tickets y Reimpresión (F8)"
                    >
                        <History className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400 shrink-0" />
                        <span className="hidden sm:inline">TICKETS</span>
                    </button>

                    {/* Botón Configuración de Caja */}
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="hover:text-white transition-all active:scale-95 flex items-center gap-1 bg-white/5 p-2 sm:p-2.5 rounded-xl border border-white/10 text-xs sm:text-sm font-bold shadow-sm"
                        title="Configuración de Caja y Panel"
                    >
                        <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400 hover:text-cyan-300 shrink-0" />
                    </button>

                    {hasStockIssues && (
                        <button
                            onClick={() => setIsStockAlertOpen(true)}
                            className="px-3.5 py-2 rounded-xl bg-red-600/30 border-2 border-red-500/80 text-red-300 hover:bg-red-600/40 text-xs sm:text-sm font-black tracking-wider flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse active:scale-95"
                            title="Venta bloqueada: Clic para resolver faltantes de stock"
                        >
                            <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping"></span>
                            STOCK INSUFICIENTE ({stockIssues.length})
                        </button>
                    )}
                    <div className="hidden lg:flex items-center gap-1.5 text-xs sm:text-sm bg-black/40 border border-white/5 py-2 px-3.5 rounded-full">
                        <Clock className="h-4 w-4 text-zinc-400" />
                        <span className="font-mono">{currentTime}</span>
                    </div>
                    <button
                        className={`transition-all active:scale-95 flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border text-xs sm:text-sm font-bold ${
                            isKioskMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/5 hover:text-white border-white/10'
                        }`}
                        onClick={() => setIsKioskMode(!isKioskMode)}
                        title="Modo Kiosco (Bloquear Pantalla)"
                    >
                        {isKioskMode ? <Lock className="h-4 w-4 sm:h-5 sm:w-5" /> : <Unlock className="h-4 w-4 sm:h-5 sm:w-5" />}
                        <span className="hidden xl:block">{isKioskMode ? 'KIOSCO ACTIVO' : 'FIJAR'}</span>
                    </button>
                    <button
                        className="hover:text-white transition-all active:scale-95 flex items-center gap-1.5 bg-white/5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-white/10 text-xs sm:text-sm font-bold shadow-sm"
                        onClick={() => setShowCorteCaja(true)}
                    >
                        <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5 text-rose-400" />
                        <span className="hidden sm:block">CORTE</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleRunMobileOptimize}
                        disabled={isOptimizingMobile}
                        className="hover:text-white transition-all active:scale-95 flex items-center gap-1.5 bg-white/5 px-3 py-2 rounded-xl border border-white/10 text-xs font-bold shadow-sm disabled:opacity-50"
                        title="Liberar caché y memoria móvil"
                    >
                        <Sparkles className={`h-4 w-4 text-emerald-400 shrink-0 ${isOptimizingMobile ? 'animate-spin' : ''}`} />
                        <span className="hidden xl:inline">{isOptimizingMobile ? 'Limpiando...' : 'Caché'}</span>
                    </button>

                    {/* Botón Salir al Dashboard */}
                    <button
                        onClick={() => {
                            if (posCart.length > 0) {
                                setCartGuardAction('leave_dashboard');
                            } else {
                                router.push('/dashboard');
                            }
                        }}
                        className="hover:text-white transition-all active:scale-95 flex items-center gap-1.5 bg-cyan-950/70 hover:bg-cyan-900/90 text-cyan-200 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-cyan-700/60 text-xs sm:text-sm font-black shadow-sm"
                        title="Volver al Menú Principal del Dashboard"
                    >
                        <LayoutDashboard className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="hidden sm:inline">DASHBOARD</span>
                    </button>

                    {/* Botón Cerrar Sesión */}
                    <button
                        onClick={async () => {
                            if (posCart.length > 0) {
                                setCartGuardAction('logout');
                                return;
                            }
                            await signOut();
                            window.location.href = '/login';
                        }}
                        className="hover:text-red-300 transition-all active:scale-95 flex items-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-300 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-red-500/40 text-xs sm:text-sm font-black shadow-sm"
                        title="Cerrar sesión del cajero"
                    >
                        <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="hidden sm:inline">SALIR</span>
                    </button>

                    <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-white/10">
                        <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center border border-white/10 text-zinc-400">
                            <User className="h-4 w-4" />
                        </div>
                        <div className="hidden lg:block text-xs">
                            <p className="font-semibold text-white">{profile?.displayName || 'Cajero'}</p>
                            <p className="text-zinc-400">{profile?.role || 'Piso Local'}</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Barra de Atajos Táctiles y Teclado para Pantallas Touch y Mostrador */}
            {posConfig.showTouchShortcuts && activeTab === 'pos' && (
                <TactileShortcutsBar
                    onSearchClick={() => searchInputRef.current?.focus()}
                    onCobrarClick={handleCheckoutClick}
                    onScaleClick={() => setIsScaleOpen(true)}
                    onClearClick={() => {
                        if (posCart.length > 0) {
                            setCartGuardAction('clear');
                        }
                    }}
                    onCameraClick={() => setShowCameraScanner(true)}
                    onHistoryClick={() => setIsHistoryOpen(true)}
                    onCorteClick={() => setShowCorteCaja(true)}
                    onSettingsClick={() => setIsSettingsOpen(true)}
                    canCobrar={posCart.length > 0 && !hasStockIssues}
                    scaleWeight={scale.weight}
                    scaleUnit={scale.unit}
                    isScaleConnected={scale.isConnected}
                />
            )}

            {/* Bandeja de Tickets en Espera para Cajero (Recuperación inmediata sin pérdida de captura) */}
            {activeTab === 'pos' && heldCarts.length > 0 && (
                <div className="bg-slate-900/95 border-b border-amber-500/30 px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0 z-20">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 shrink-0 mr-1">
                        <PauseCircle size={15} />
                        <span>En espera ({heldCarts.length}):</span>
                    </div>
                    {heldCarts.map((held) => (
                        <div
                            key={held.id}
                            className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 shrink-0"
                        >
                            <button
                                type="button"
                                onClick={() => handleRestoreHeldCart(held.id)}
                                className="min-h-[36px] text-xs font-semibold text-white hover:text-amber-300 flex items-center gap-2"
                                title="Retomar este ticket en caja"
                            >
                                <span>{held.label}</span>
                                <span className="font-mono tabular-nums text-emerald-400">
                                    {held.itemCount} pzas · ${held.total.toFixed(2)}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPendingCartPinAction({ type: 'discard_held', holdId: held.id })}
                                className="min-w-[32px] min-h-[32px] rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center"
                                title="Descartar ticket en espera (Requiere NIP)"
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Main Content Workspace */}
            <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative w-full h-full z-10">

                {activeTab === 'pos' ? (
                    <>
                        {/* Left Side: Catalog */}
                        <div className="flex-[3] md:flex-[2] lg:flex-[3] h-full overflow-hidden border-r border-white/10 bg-white/[0.02]">
                            <Catalog
                                products={products}
                                cartItems={posCart}
                                onAddProduct={handleAddProduct}
                                onOpenScanner={() => setShowCameraScanner(true)}
                                searchTerm={posSearch}
                                setSearchTerm={setPosSearch}
                                searchInputRef={searchInputRef}
                                showAisleInfo={posConfig.showAisleInfo}
                            />
                        </div>

                        {/* Right Side: Cart / POS */}
                        <div className={`flex-[2] md:flex-1 h-[45vh] md:h-full transition-transform duration-300 ease-in-out border-t border-white/10 md:border-t-0 md:relative absolute bottom-0 left-0 right-0 md:translate-y-0 ${posCart.length > 0 ? 'translate-y-0 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] md:shadow-none' : 'translate-y-full md:translate-y-0 z-0'}`}>
                            <Cart
                                items={posCart}
                                products={products}
                                orderType={orderType}
                                setOrderType={setOrderType}
                                updateQuantity={handleUpdateQuantity}
                                removeItem={(id) => setPosCart(prev => prev.filter(i => i.id !== id))}
                                onClear={() => {
                                    if (posCart.length > 0) setCartGuardAction('clear');
                                }}
                                onCheckout={handleCheckoutClick}
                            />
                        </div>
                    </>
                ) : (
                    /* COLA ONLINE */
                    <div className="flex-1 overflow-y-auto p-4 sm:p-[8px] bg-transparent custom-scrollbar space-y-6">
                        {/* Barra de Búsqueda Táctil de Pedidos Online */}
                        <div className="max-w-7xl mx-auto space-y-3">
                            <div className="relative flex-1">
                                <Search className="w-5 h-5 text-zinc-400 absolute left-4 top-3.5" />
                                <input
                                    type="text"
                                    placeholder="Buscar pedido por folio, cliente, teléfono o nombre de producto..."
                                    value={onlineSearch}
                                    onChange={(e) => setOnlineSearch(e.target.value)}
                                    className="w-full pl-12 pr-12 py-3 bg-zinc-900/90 border border-white/10 rounded-2xl text-sm sm:text-base font-medium text-white placeholder-zinc-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/30 transition-all shadow-md backdrop-blur-md"
                                />
                                {onlineSearch && (
                                    <button
                                        onClick={() => setOnlineSearch('')}
                                        className="absolute right-3.5 top-3 p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                                        title="Limpiar búsqueda de pedidos"
                                    >
                                        <XCircle size={20} />
                                    </button>
                                )}
                            </div>

                            {/* Selector de Filtros de Cola - Botones Grandes y Táctiles */}
                            <div className="flex flex-wrap gap-2.5 items-center justify-between">
                                <div className="flex flex-wrap gap-2 sm:gap-2.5">
                                    <button
                                        onClick={() => setOrderFilter('all')}
                                        className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm ${orderFilter === 'all'
                                                ? 'bg-blue-600 text-white shadow-blue-600/30 shadow-lg'
                                                : 'bg-zinc-900/80 text-zinc-300 hover:text-white border border-white/10 hover:bg-zinc-800'
                                            }`}
                                    >
                                        Todos ({pendingOrders.length})
                                    </button>
                                    <button
                                        onClick={() => setOrderFilter('pending')}
                                        className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm ${orderFilter === 'pending'
                                                ? 'bg-amber-600 text-white shadow-amber-600/30 shadow-lg'
                                                : 'bg-zinc-900/80 text-zinc-300 hover:text-white border border-white/10 hover:bg-zinc-800'
                                            }`}
                                    >
                                        Por Cobrar ({pendingOrders.filter(o => ['pending_payment', 'pending_confirmation', 'pending', 'NIGHT_QUEUE', 'READY_FOR_PICKUP'].includes(o.status) && !o.confirmedAt && o.status !== 'paid' && o.status !== 'READY_FOR_PICKUP_PAID').length})
                                    </button>
                                    <button
                                        onClick={() => setOrderFilter('ready')}
                                        className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm ${orderFilter === 'ready'
                                                ? 'bg-emerald-600 text-white shadow-emerald-600/30 shadow-lg'
                                                : 'bg-zinc-900/80 text-zinc-300 hover:text-white border border-white/10 hover:bg-zinc-800'
                                            }`}
                                    >
                                        Listos Entrega ({pendingOrders.filter(o => ['READY_TO_SHIP', 'READY_FOR_PICKUP_PAID'].includes(o.status) || (Boolean(o.isLoaded) && (Boolean(o.confirmedAt) || o.status === 'paid')) || o.status === 'READY_FOR_PICKUP').length})
                                    </button>
                                    <button
                                        onClick={() => setOrderFilter('delivery')}
                                        className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm ${orderFilter === 'delivery'
                                                ? 'bg-indigo-600 text-white shadow-indigo-600/30 shadow-lg'
                                                : 'bg-zinc-900/80 text-zinc-300 hover:text-white border border-white/10 hover:bg-zinc-800'
                                            }`}
                                    >
                                        Repartos ({pendingOrders.filter(o => o.status === 'pending_delivery').length})
                                    </button>
                                    <button
                                        onClick={() => setOrderFilter('cancelled')}
                                        className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm ${orderFilter === 'cancelled'
                                                ? 'bg-rose-600 text-white shadow-rose-600/30 shadow-lg'
                                                : 'bg-zinc-900/80 text-rose-300 hover:text-white border border-rose-500/20 hover:bg-rose-950/20'
                                            }`}
                                    >
                                        Cancelados ({cancelledOrders.length})
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setColaViewMode('board')}
                                        className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 border active:scale-95 ${colaViewMode === 'board'
                                                ? 'bg-gradient-to-r from-emerald-600 via-amber-600 to-sky-600 text-white border-cyan-400 shadow-md shadow-cyan-500/20'
                                                : 'bg-zinc-900/80 text-zinc-400 hover:text-white border-white/10'
                                            }`}
                                        title="Vista Tablero 3 Colores (Verde: Por Tomar, Amarillo: Por Preparar, Azul: Listos p/ Cobro)"
                                    >
                                        <Columns size={16} /> Tablero 3 Colores
                                    </button>
                                    <button
                                        onClick={() => setColaViewMode('list')}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95 ${colaViewMode === 'list'
                                                ? 'bg-zinc-800 text-white border-white/20'
                                                : 'bg-zinc-900/80 text-zinc-400 hover:text-white border-white/10'
                                            }`}
                                        title="Vista Lista Clásica"
                                    >
                                        Lista
                                    </button>
                                    <button
                                        onClick={() => setOnlyMyOrders(prev => !prev)}
                                        className={`px-3.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 border active:scale-95 ${onlyMyOrders
                                                ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/20'
                                                : 'bg-zinc-900/80 text-zinc-300 hover:text-white border-white/10'
                                            }`}
                                        title="Filtrar solo pedidos atendidos o surtidos por mí"
                                    >
                                        <span>👤</span> {onlyMyOrders ? 'Mis Pedidos' : 'Todos'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 🦁 LION Guía Conversacional en Caja con Respuestas Sugeridas Rápidas */}
                        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-sky-500/30 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 max-w-7xl mx-auto">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-xl shrink-0 shadow-sm">
                                    🦁
                                </div>
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-sky-400 flex items-center gap-2">
                                        LION Asistente en Caja
                                        <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full font-mono font-bold">
                                            IA OPERATIVA
                                        </span>
                                    </h4>
                                    <p className="text-sm text-slate-200 mt-0.5">
                                        Bien, tienes <strong className="text-amber-400">{pendingPrepOrders.length} pedido(s) pendientes</strong> en espera del designado o prepáralos tú mismo, y <strong className="text-emerald-400">{readyToPayOrders.length} listo(s) para cobrar</strong> en caja.
                                        {cancelledReacomodoOrders.length > 0 && (
                                            <span className="text-rose-400 block sm:inline sm:ml-2 font-medium">
                                                • ⚠️ {cancelledReacomodoOrders.length} cancelado(s) pendiente(s) de reacomodo.
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Botones sugeridos rápidos sin necesidad de escribir */}
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                                {pendingPrepOrders.length > 0 && (
                                    <button
                                        onClick={() => setPickingOrder(pendingPrepOrders[0])}
                                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all"
                                    >
                                        <Zap size={14} />
                                        <span>⚡ Preparar #{pendingPrepOrders[0].id.slice(0, 6)}</span>
                                    </button>
                                )}
                                {readyToPayOrders.length > 0 && (
                                    <button
                                        onClick={() => setCashTenderOrder(readyToPayOrders[0])}
                                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                                    >
                                        <CheckCircle2 size={14} />
                                        <span>💰 Cobrar #{readyToPayOrders[0].id.slice(0, 6)}</span>
                                    </button>
                                )}
                                {cancelledReacomodoOrders.length > 0 && (
                                    <button
                                        onClick={() => setOrderFilter('cancelled')}
                                        className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-xs flex items-center gap-1.5 transition-colors"
                                    >
                                        <RefreshCw size={12} />
                                        <span>Reacomodar ({cancelledReacomodoOrders.length})</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {colaViewMode === 'board' ? (
                            <TriColorOrdersBoard
                                greenOrders={greenCanClaimOrders}
                                yellowOrders={yellowNeedPrepOrders}
                                blueOrders={blueReadyToPayOrders}
                                readyOrders={readyToDeliverOrders}
                                onClaimOrder={handleClaimOrder}
                                onLoadToPos={(order) => {
                                    if (order.items && order.items.length > 0) {
                                        const converted = order.items.map((it: any) => ({
                                            id: it.productId || it.id,
                                            name: it.name || it.productName || 'Producto',
                                            price: it.price || 0,
                                            stock: 99,
                                            quantity: it.quantity || 1
                                        }));
                                        setPosCart(converted);
                                        setActiveTab('pos');
                                        showToast(`Pedido ${order.id} cargado en Punto de Venta.`);
                                    }
                                }}
                                onPicking={(order) => setPickingOrder(order)}
                                onTender={(order) => setCashTenderOrder(order)}
                                onDeliveryProof={(order) => setOrderForDeliveryProof(order)}
                                onCancel={(orderId) => setOrderToCancel(orderId)}
                                onDelete={(orderId) => handleDeleteOrder(orderId)}
                                onOpenHistory={() => setIsHistoryOpen(true)}
                                onOpenCorte={() => setShowCorteCaja(true)}
                                formatCurrency={formatCurrency}
                                claimingOrderId={claimingOrderId}
                            />
                        ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[8px] max-w-7xl mx-auto">
                            {displayedOrders.length === 0 ? (
                                <div className="col-span-full py-20 text-center bg-zinc-900/40 backdrop-blur-md rounded-[32px] border border-white/10 shadow-lg">
                                    <Globe size={50} className="mx-auto text-blue-500/50 mb-3" />
                                    <h2 className="text-xl font-extrabold text-white mb-1">Sin Pedidos Pendientes</h2>
                                    <p className="text-zinc-400 text-sm">No hay pedidos en la categoría seleccionada.</p>
                                </div>
                            ) : (
                                displayedOrders.map(order => {
                                    const isLoadedByAlmacen = Boolean(order.isLoaded) || ['READY_TO_SHIP', 'READY_FOR_PICKUP', 'READY_FOR_PICKUP_PAID', 'COMPLETED', 'DELIVERED'].includes(order.status);
                                    const isPaid = Boolean(order.confirmedAt) || order.status === 'paid' || order.status === 'READY_FOR_PICKUP_PAID' || order.status === 'DELIVERED' || order.status === 'COMPLETED';
                                    const isPendingAlmacen = !isLoadedByAlmacen;
                                    const isReadyForCashierPayment = isLoadedByAlmacen && !isPaid;
                                    const isReadyToDeliver = isLoadedByAlmacen && isPaid && !['DELIVERED', 'COMPLETED'].includes(order.status);

                                    return (
                                        <div key={order.id} className="bg-zinc-900/60 backdrop-blur-md rounded-[5px] p-[8px] sm:p-[8px] border border-white/10 shadow-lg flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start mb-3 border-b border-white/10 pb-3">
                                                    <div>
                                                        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Folio / Pedido</p>
                                                        <p className="text-base font-black text-white font-mono">{order.id}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${isPendingAlmacen ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                                                isReadyForCashierPayment ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse' :
                                                                    isReadyToDeliver ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                                                                        order.status === 'DELIVERED' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                                                            'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                                                            }`}>
                                                            {isPendingAlmacen ? '⏳ EN ALMACÉN' : isReadyForCashierPayment ? '✓ LISTO P/ COBRO' : isReadyToDeliver ? '📦 LISTO ENTREGA' : order.status}
                                                        </span>
                                                        <button
                                                            onClick={() => handleDeleteOrder(order.id)}
                                                            title="Eliminar este pedido permanentemente"
                                                            className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all hover:scale-105"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5 mb-3 text-xs">
                                                    <p className="font-medium text-zinc-200 flex items-center gap-2">
                                                        <User size={13} className="text-blue-400 shrink-0" /> {order.customer?.name || 'Cliente Mostrador'}
                                                    </p>
                                                    {order.customer?.phone && (
                                                        <p className="font-medium text-zinc-400 flex items-center gap-2">
                                                            <Phone size={13} className="text-blue-400 shrink-0" /> {order.customer?.phone}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Detalle de Artículos */}
                                                {order.items && order.items.length > 0 && (
                                                    <div className="bg-black/30 rounded-xl p-3 mb-4 border border-white/5 max-h-32 overflow-y-auto custom-scrollbar text-xs space-y-1">
                                                        <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Artículos ({order.items.length}):</span>
                                                        {order.items.map((it: any, idx: number) => (
                                                            <div key={idx} className="flex justify-between text-zinc-300 text-[11px]">
                                                                <span className="truncate max-w-[180px]">{it.quantity}x {it.name || it.productName || it.productId || 'Item'}</span>
                                                                <span className="font-mono text-zinc-400">${Number(it.price * it.quantity).toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="bg-black/40 rounded-xl p-3 mb-4 border border-white/5 flex justify-between items-center">
                                                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Total a Pagar</span>
                                                    <span className="text-lg font-extrabold text-blue-400">{formatCurrency(order.total)}</span>
                                                </div>
                                            </div>

                                            {/* Acciones de Caja */}
                                            <div className="space-y-2 pt-2 border-t border-white/5">
                                                {/* Estado de atención del cajero */}
                                                <div className="flex items-center justify-between text-[11px] px-1 py-0.5 text-zinc-400">
                                                    <span>Atención:</span>
                                                    <span className={`font-semibold ${order.vendedorId === profile?.uid ? 'text-green-400' : order.vendedorName ? 'text-amber-400' : 'text-blue-400'}`}>
                                                        {order.vendedorName ? (order.vendedorId === profile?.uid ? '✓ Atendido en tu caja' : `Tomado por ${order.vendedorName}`) : '⚡ Libre para tomar'}
                                                    </span>
                                                </div>

                                                {/* Botones Tomar y Cargar al POS */}
                                                <div className="flex gap-2">
                                                    {(!order.vendedorId || order.vendedorId !== profile?.uid) && (
                                                        <button
                                                            onClick={() => handleClaimOrder(order.id)}
                                                            disabled={claimingOrderId === order.id}
                                                            className="flex-1 py-3 px-3 bg-blue-600/30 border border-blue-500/40 text-blue-200 font-black rounded-xl hover:bg-blue-600/40 text-xs sm:text-sm transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                                                            title="Asignar este pedido a mi caja"
                                                        >
                                                            <UserCheck size={16} /> Tomar
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            if (order.items && order.items.length > 0) {
                                                                const converted = order.items.map((it: any) => ({
                                                                    id: it.productId || it.id,
                                                                    name: it.name || it.productName || 'Producto',
                                                                    price: it.price || 0,
                                                                    stock: 99,
                                                                    quantity: it.quantity || 1
                                                                }));
                                                                setPosCart(converted);
                                                                setActiveTab('pos');
                                                                showToast(`Pedido ${order.id} cargado en Punto de Venta.`);
                                                            }
                                                        }}
                                                        className="flex-1 py-3 px-3 bg-purple-600/30 border border-purple-500/40 text-purple-200 font-black rounded-xl hover:bg-purple-600/40 text-xs sm:text-sm transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                                                        title="Cargar artículos al POS para modificar o cobrar"
                                                    >
                                                        <ShoppingCart size={16} /> Cargar POS
                                                    </button>
                                                </div>

                                                {isPendingAlmacen ? (
                                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center space-y-2">
                                                        <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                                                            <div className="flex items-center gap-1.5">
                                                                <Clock size={14} className="animate-spin text-amber-400" />
                                                                <span>En Almacén</span>
                                                            </div>
                                                            <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-300 font-mono">
                                                                Operador Único Disponible
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <button
                                                                onClick={() => setPickingOrder(order)}
                                                                className="py-3 px-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                                                                title="Recolectar producto por producto con asistencia de IA LION"
                                                            >
                                                                <Package size={15} /> Recolectar IA
                                                            </button>
                                                            <button
                                                                onClick={() => setCashTenderOrder(order)}
                                                                className="py-3 px-2 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 font-black rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                                                                title="Auto-surtir en mostrador y cobrar de inmediato"
                                                            >
                                                                <Zap size={15} /> Surtir y Cobrar
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : isReadyForCashierPayment ? (
                                                    <div className="space-y-2">
                                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 text-center text-xs font-bold text-emerald-400 flex flex-col items-center justify-center gap-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <CheckCircle2 size={14} /> Surtido listo por {order.loadedBy || 'Almacén'}.
                                                            </div>
                                                            {order.deliveryType === 'PATIO' ? (
                                                                <span className="text-[11px] font-black uppercase text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                                                    🏗️ Ubicación: BAHÍA DE CARGA / PATIO
                                                                </span>
                                                            ) : (
                                                                <span className="text-[11px] font-black uppercase text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                                                    📦 Ubicación: CAJA / MOSTRADOR
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => setCashTenderOrder(order)}
                                                            className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-black rounded-2xl hover:from-emerald-500 hover:to-green-500 uppercase tracking-widest text-xs sm:text-sm shadow-[0_0_20px_rgba(16,185,129,0.35)] flex justify-center items-center gap-2 transition-all active:scale-95 cursor-pointer"
                                                        >
                                                            <CheckCircle2 size={18} /> Cobrar en Caja (${Number(order.total).toFixed(2)})
                                                        </button>
                                                    </div>
                                                ) : isReadyToDeliver ? (
                                                    <div className="space-y-2">
                                                        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-2 text-center text-xs font-bold text-cyan-400 flex flex-col items-center justify-center gap-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <ShieldAlert size={14} /> Cobro verificado. Listo para entrega al cliente.
                                                            </div>
                                                            {order.deliveryType === 'PATIO' ? (
                                                                <span className="text-[11px] font-black uppercase text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                                                    🏗️ Entrega asignada a: BAHÍA DE CARGA (Patio)
                                                                </span>
                                                            ) : (
                                                                <span className="text-[11px] font-black uppercase text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                                                    📦 Entrega asignada a: CAJA (Mostrador)
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => setOrderForDeliveryProof(order)}
                                                            className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black rounded-2xl hover:from-cyan-500 hover:to-blue-500 uppercase tracking-widest text-xs sm:text-sm shadow-[0_0_20px_rgba(6,182,212,0.35)] flex justify-center items-center gap-2 transition-all active:scale-95"
                                                        >
                                                            <PenTool size={18} /> Validar Entrega (Foto + Firma PoD)
                                                        </button>
                                                    </div>
                                                ) : order.status === 'DELIVERED' ? (
                                                    <div className="bg-zinc-800/80 border border-white/5 rounded-xl p-2.5 text-center text-xs sm:text-sm text-zinc-300">
                                                        <span className="text-emerald-400 font-bold flex items-center justify-center gap-1.5">
                                                            <CheckCircle2 size={16} /> Entregado con Foto y Firma
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setOrderForDeliveryProof(order)}
                                                        className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl text-xs sm:text-sm flex justify-center items-center gap-2 active:scale-95 transition-all"
                                                    >
                                                        <PenTool size={16} /> Entrega de Pedido
                                                    </button>
                                                )}

                                                {/* Estado y Acciones de Cancelación / Deconstrucción */}
                                                {(order.status === 'cancelled' || order.status === 'refunded') && (
                                                    <div className="space-y-1.5 pt-1">
                                                        {order.rejectionReason === 'CANCELADA_STOCK_RESTITUIDO' ? (
                                                             <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl p-2.5 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5">
                                                                <CheckCircle2 size={15} className="text-emerald-400" />
                                                                <span>Cancelada — Stock de vuelta en anaquel</span>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-1.5">
                                                                <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl p-2 text-center text-xs font-bold flex items-center justify-center gap-1.5">
                                                                    <AlertCircle size={14} className="text-rose-400" />
                                                                    <span>Cancelado — Pendiente de reacomodo</span>
                                                                </div>
                                                                <button
                                                                    onClick={() => setDeconstructingOrder(order)}
                                                                    className="w-full py-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
                                                                >
                                                                    <RefreshCw size={15} /> Deconstrucción: Devolver a Anaquel
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Botón de Devolución Administrativa para el Dueño (Ingreso nuevo a stock sin alterar contabilidad) */}
                                                {(order.status === 'DELIVERED' || order.status === 'COMPLETED' || order.status === 'paid') &&
                                                    (profile?.role === 'superadmin' || profile?.role === 'admin') && (
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm(`¿Registrar devolución de venta #${order.id}? El stock entrará a almacén como nuevo ingreso sin alterar el histórico contable.`)) {
                                                                    try {
                                                                        const res = await fetch('/api/orders', {
                                                                            method: 'PATCH',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({ id: order.id, action: 'admin_return_as_new_intake' })
                                                                        });
                                                                        const data = await res.json();
                                                                        if (data.success) {
                                                                            showToast('✅ Devolución registrada como dato del dueño. Stock reingresado.');
                                                                            broadcastSync();
                                                                        } else {
                                                                            toast.error(data.error || 'Error al procesar devolución');
                                                                        }
                                                                    } catch {
                                                                        toast.error('Error de red al registrar devolución.');
                                                                    }
                                                                }
                                                            }}
                                                            className="w-full py-2 sm:py-2.5 bg-zinc-800/80 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-300 border border-white/5 hover:border-rose-500/30 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                                                            title="Registrar devolución como dato del dueño y dar ingreso nuevo a stock"
                                                        >
                                                            <RefreshCw size={14} /> Devolución Dueño (Ingreso Nuevo a Almacén)
                                                        </button>
                                                    )}

                                                {/* Botones Rechazar / Cancelar y Eliminar */}
                                                <div className="flex gap-2 pt-1">
                                                    <button
                                                        onClick={() => setOrderToCancel(order.id)}
                                                        className="flex-1 py-2.5 sm:py-3 bg-amber-500/10 border border-amber-500/25 text-amber-300 font-bold rounded-xl hover:bg-amber-500/20 text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
                                                    >
                                                        <XCircle size={15} /> Cancelar
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteOrder(order.id)}
                                                        className="flex-1 py-2.5 sm:py-3 bg-red-500/10 border border-red-500/25 text-red-300 font-bold rounded-xl hover:bg-red-500/20 text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
                                                    >
                                                        <Trash2 size={15} /> Eliminar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        )}
                    </div>
                )}
            </main>

            <DeliveryModal
                isOpen={isDeliveryOpen}
                onClose={() => setIsDeliveryOpen(false)}
                onConfirm={handleDeliveryConfirm}
            />

            <PaymentModal
                isOpen={isPaymentOpen}
                onClose={() => setIsPaymentOpen(false)}
                total={posTotal}
                orderType={orderType}
                onConfirm={handleConfirmPayment}
                isProcessing={processingId === 'checkout'}
                hasStockIssues={hasStockIssues}
                stockIssuesCount={stockIssues.length}
            />

            <StockAlertModal
                isOpen={isStockAlertOpen}
                onClose={() => setIsStockAlertOpen(false)}
                issues={stockIssues}
                onAdjustItem={handleAdjustStockItem}
                onRemoveItem={handleRemoveStockItem}
                onAdjustAll={handleAdjustAllStock}
                onRemoveAllDeficits={handleRemoveAllDeficits}
            />

            {showCameraScanner && (
                <BarcodeScanner
                    isOpen={showCameraScanner}
                    onClose={() => setShowCameraScanner(false)}
                    continuousModeDefault={hardwareConfig.qrContinuousMode}
                    onScanSuccess={(decodedText) => {
                        handleCodeLookup(decodedText, 'qr');
                    }}
                />
            )}

            <HardwareSettingsModal
                isOpen={isHardwareModalOpen}
                onClose={() => {
                    setIsHardwareModalOpen(false);
                    setHardwareConfig(loadHardwareConfig());
                }}
            />

            {/* Modal de Báscula Electrónica BLE / Serial */}
            <ScaleModal
                isOpen={isScaleOpen}
                onClose={() => setIsScaleOpen(false)}
                scale={scale}
                cartItems={posCart}
                onApplyWeightToItem={handleApplyWeightToItem}
            />

            {/* Modal de Comprobante / Ticket Dual (Copia Cliente + Copia Tienda/Vendedor + Factura SAT) */}
            <TicketReceiptModal
                isOpen={isTicketModalOpen}
                onClose={() => setIsTicketModalOpen(false)}
                ticket={currentTicket}
                siteConfig={siteConfig}
                cajaId="caja_1"
            />

            {/* Modal de Bitácora e Historial de Tickets de Caja */}
            <TicketHistoryModal
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                cajaId="caja_1"
                onSelectTicket={(ticket) => {
                    setCurrentTicket(ticket);
                    setIsTicketModalOpen(true);
                }}
            />

            {/* Modal de Cobro en Caja (Monto Recibido, Cambio, Serial y Ticket Digital) */}
            <CashTenderModal
                isOpen={Boolean(cashTenderOrder)}
                onClose={() => setCashTenderOrder(null)}
                order={cashTenderOrder}
                cashierName={profile?.displayName || 'Cajero de Turno'}
                cashierUid={profile?.uid || 'CAJA-1'}
                onPaymentSuccess={(ticket, updatedOrder) => {
                    setCashTenderOrder(null);
                    broadcastSync();
                    if (ticket) {
                        setCurrentTicket(ticket);
                        setIsTicketModalOpen(true);
                    }
                    const isPatio = updatedOrder.deliveryType === 'PATIO' || updatedOrder.deliveryMethod === 'patio';
                    if (isPatio) {
                        toast.success('✅ Cobro completado. El cliente ahora puede pasar al patio con su Ticket/QR para que el personal de patio escanee y entregue con firma y foto.');
                    } else {
                        // En mostrador/caja, permitir cerrar la entrega directamente
                        setOrderForDeliveryProof(updatedOrder);
                    }
                }}
            />

            {/* Modal de Validación de Entrega con Foto y Firma de Cliente (PoD) */}
            {orderForDeliveryProof && (
                <DeliveryProofModal
                    isOpen={Boolean(orderForDeliveryProof)}
                    onClose={() => setOrderForDeliveryProof(null)}
                    order={orderForDeliveryProof}
                    cajaId="caja_1"
                    cashierName={profile?.displayName || 'Cajero de Turno'}
                    onSuccess={(updatedOrder, savedTicket) => {
                        broadcastSync();
                        if (savedTicket) {
                            setCurrentTicket(savedTicket);
                            setIsTicketModalOpen(true);
                        } else {
                            showToast(`✅ Entrega de orden ${updatedOrder?.id || ''} completada.`);
                        }
                    }}
                />
            )}

            {/* Modal de Configuración de Caja y Panel */}
            <PosSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                config={posConfig}
                onSaveConfig={(newConfig) => {
                    setPosConfig(newConfig);
                    try {
                        localStorage.setItem('_bunkker_pos_config', JSON.stringify(newConfig));
                    } catch { }
                }}
            />

            {/* Modal Corte de Caja Ciego */}
            <CorteCajaCiego
                isOpen={showCorteCaja && !corteResult}
                onClose={() => setShowCorteCaja(false)}
                onConfirm={async (montoDeclarado) => {
                    try {
                        const res = await fetch('/api/sales/close-register', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                declaredAmount: montoDeclarado,
                                cashierId: profile?.uid || 'unknown',
                                cashierName: profile?.displayName || 'Cajero'
                            })
                        });
                        const result = await res.json();
                        if (result.success) {
                            await logAudit({
                                type: 'CORTE_CAJA_CIEGO',
                                userId: profile?.uid || 'POS',
                                userName: profile?.displayName || 'Cajero',
                                userRole: profile?.role || 'sales',
                                description: `Corte Ciego Procesado. Declarado: $${montoDeclarado.toFixed(2)}, Descuadre: $${result.data.discrepancy.toFixed(2)}`,
                                metadata: { montoDeclarado, discrepancy: result.data.discrepancy }
                            });

                            if (result.data.discrepancy < 0) {
                                setCorteResult({ type: 'mismatch', data: result.data });
                            } else {
                                setCorteResult({ type: 'success', data: result.data });
                            }
                        } else {
                            toast.error(`Error: ${result.error}`);
                        }
                    } catch (e) {
                        toast.error('Error de red al procesar el corte.');
                    }
                }}
            />

            {/* Resultado del Corte */}
            {corteResult && (
                <div className="fixed inset-0 z-[5000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-[5px] p-8 max-w-md w-full text-center shadow-2xl">
                        {corteResult.type === 'success' ? (
                            <>
                                <CheckCircle2 size={80} className="text-emerald-500 mx-auto mb-6" />
                                <h2 className="text-3xl font-black text-white mb-2">¡Corte Perfecto!</h2>
                                <p className="text-emerald-400 font-medium mb-8">El efectivo físico coincide o excede el esperado. Turno cerrado con éxito.</p>
                                <button onClick={() => { setCorteResult(null); setShowCorteCaja(false); window.location.href = '/dashboard'; }} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                                    Finalizar y Salir
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                                    <AlertCircle size={60} className="text-red-500" />
                                </div>
                                <h2 className="text-3xl font-black text-white mb-2">Descuadre Detectado</h2>
                                <p className="text-slate-300 text-sm mb-6">
                                    El sistema detectó un faltante en tu caja. Esto ha sido reportado en la bitácora inmutable de auditoría para el dueño.
                                </p>
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-8">
                                    <span className="text-red-400 font-black text-2xl uppercase">Faltante: ${Math.abs(corteResult.data.discrepancy).toFixed(2)}</span>
                                </div>
                                <div className="flex gap-[8px]">
                                    <button onClick={() => window.open(`/dashboard/sales/my-day`, '_blank')} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-slate-600">
                                        Ver Historial
                                    </button>
                                    <button onClick={() => { setCorteResult(null); setShowCorteCaja(false); window.location.href = '/dashboard'; }} className="flex-1 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                                        Aceptar y Salir
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Protección contra Abandono de Ticket POS */}
            {cartGuardAction && (
                <div className="fixed inset-0 z-[4100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                                <ShieldAlert size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Protección de Venta en Curso</h3>
                                <p className="text-xs text-slate-400 font-mono tabular-nums">
                                    {posCart.length} producto(s) · Total ${posTotal.toFixed(2)}
                                </p>
                            </div>
                        </div>

                        <p className="text-sm text-slate-300 leading-relaxed">
                            Para no perder esta captura, puedes guardar el ticket en espera o autorizar su cancelación con tu NIP.
                        </p>

                        <div className="flex flex-col gap-2.5">
                            <button
                                type="button"
                                onClick={() => setCartGuardAction(null)}
                                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm"
                            >
                                Seguir atendiendo este ticket
                            </button>
                            <button
                                type="button"
                                onClick={handleHoldCurrentPosCart}
                                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-semibold text-sm flex items-center justify-center gap-2"
                            >
                                <PauseCircle size={16} />
                                <span>Poner ticket en espera (Guardar)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setPendingCartPinAction({
                                        type: 'clear_cart',
                                        afterAction: cartGuardAction === 'clear' ? undefined : cartGuardAction,
                                    })
                                }
                                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-200 font-semibold text-sm flex items-center justify-center gap-2"
                            >
                                <LockKeyhole size={15} />
                                <span>Cancelar y vaciar (Requiere NIP)</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal NIP Real para Cancelación de Orden en Cola */}
            <PinAuthorizationModal
                isOpen={Boolean(orderToCancel)}
                title="Autorizar Cancelación de Orden"
                description={`Ingresa tu NIP de operador o supervisor para cancelar la orden ${orderToCancel || ''}.`}
                actionLabel="Cancelar Orden"
                actionTone="danger"
                requireReason={true}
                defaultReason="Cancelación autorizada en caja"
                onClose={() => setOrderToCancel(null)}
                onAuthorized={handleAuthorizedOrderCancel}
            />

            {/* Modal NIP Real para Abandono / Descarte de Carrito en Caja */}
            <PinAuthorizationModal
                isOpen={Boolean(pendingCartPinAction)}
                title="Autorizar Cancelación de Ticket POS"
                description="Ingresa tu NIP de operador o supervisor para descartar el ticket sin cobrar."
                actionLabel="Descartar Ticket"
                actionTone="danger"
                requireReason={true}
                defaultReason="Ticket cancelado en mostrador"
                onClose={() => setPendingCartPinAction(null)}
                onAuthorized={handleAuthorizedCartAbandon}
            />

            {/* Asistente de Recolección IA (Picking) */}
            {pickingOrder && (
                <OrderPickingAssistant
                    order={pickingOrder}
                    role="sales"
                    mode="picking"
                    onClose={() => setPickingOrder(null)}
                    onComplete={handlePickingComplete}
                    onDelegate={async (id, target) => {
                        try {
                            const res = await fetch('/api/orders', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id, action: 'delegate_order', targetRole: target })
                            });
                            if (!res.ok) {
                                const err = await res.json().catch(() => ({}));
                                throw new Error(err.error || 'Error al delegar pedido');
                            }
                            setPickingOrder(null);
                            broadcastSync();
                            showToast(`📦 Pedido delegado exitosamente a ${target.toUpperCase()}`);
                        } catch (err: any) {
                            showToast(`❌ ${err.message || 'Error al delegar'}`);
                        }
                    }}
                />
            )}

            {/* Asistente de Deconstrucción IA (Devolución a Anaqueles) */}
            {deconstructingOrder && (
                <OrderPickingAssistant
                    order={deconstructingOrder}
                    role="inventory"
                    mode="deconstruction"
                    onClose={() => setDeconstructingOrder(null)}
                    onComplete={handleDeconstructComplete}
                />
            )}

            {/* Toast Notification */}
            <AnimatePresence>
                {bannerMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center justify-center"
                    >
                        <div className="bg-zinc-800/95 backdrop-blur-xl border border-white/10 text-white px-6 py-3 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] font-medium text-sm flex items-center gap-2">
                            {bannerMessage.includes('⚠️') || bannerMessage.includes('❌') ? (
                                <AlertCircle className="w-4 h-4 text-orange-400" />
                            ) : (
                                <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
                            )}
                            {bannerMessage}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

