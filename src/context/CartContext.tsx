"use client";

import { createContext, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import { logAudit } from '@/lib/audit';
import { useAuth } from './AuthContext';
import { useERPStore, fallbackProducts, defaultSiteConfig } from '@/store/useERPStore';
import type { BlockConfig } from '@/components/marketing/builder/Types';
import type { Product, CartItem, Order } from '@/lib/types';
import { toast } from '@/lib/toast';
import { checkLicenseStatus } from '@/lib/license';
import { shouldApplyCatalogSnapshot } from '@/lib/catalogSync';
import { enqueueOfflineOrder, flushOfflineOrderQueue, getQueuedOfflineOrders } from '@/lib/indexedDBCart';
import { getCustomerAuthHeaders } from '@/lib/customerAuth';
import { broadcastSync, inferSyncScope } from '@/lib/syncNotifier';
import type { BunkkerSyncErrorCode } from '@/lib/syncErrorCodes';
import type { TimedOfferBanner } from '@/lib/storefrontBuilder';
import {
    loadOfflineSiteConfigSnapshot,
    saveOfflineSiteConfigSnapshot,
    syncStorefrontAssetsWithServiceWorker,
} from '@/lib/storefrontOfflineCache';
import {
    INVENTORY_SOCKET_RECONNECT_EVENT,
    INVENTORY_SOCKET_STATUS_EVENT,
    type InventorySocketState,
} from '@/lib/inventorySocketControl';

export type { Product, CartItem, Order };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketSection {
    id: string;
    title: string;
    description?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    filterType?: 'category' | 'all';
    filterValue?: string;
}

export interface PromoWidget {
    id: string;
    title: string;
    content: string;
    isActive: boolean;
    page?: string;
    subtitle?: string;
    actionText?: string;
    imageUrl?: string;
}

export interface VisualLayoutBlock {
    id: string;
    type: 'hero' | 'catalog' | 'map' | 'custom_text' | 'image' | 'widget' | 'about' | 'banner' | 'video';
    order: number;
    visible: boolean;
    settings?: {
        fontSize?: number;
        alignment?: 'left' | 'center' | 'right';
        columns?: number;
        categoryFilter?: string;
        categoryTarget?: string;
        showRatings?: boolean;
        borderRadius?: number;
        buttonText?: string;
        backgroundColor?: string;
        textColor?: string;
        titleColor?: string;
        whatsappNumber?: string;
        questionsText?: string;
        titleText?: string;
        subtitleText?: string;
        imageUrl?: string;
        mediaUrl?: string;
        mediaType?: 'image' | 'gif' | 'video';
        emojiIcon?: string;
        sizePreset?: 'sm' | 'md' | 'lg' | 'full';
        minHeight?: number;
        glassBlur?: boolean;
        surfaceMode?: 'solid' | 'glass' | 'media';
        scrimStrength?: number;
        zIndex?: number;
        screenDurationSec?: number;
        endsAt?: string;
        ctaHref?: string;
    };
}

export type CanvasLayer = {
    id: string;
    type: 'text' | 'image' | 'video' | 'sticker' | 'container' | 'banner';
    x: number;
    y: number;
    width: number;
    height?: number;
    content: string;
    title?: string;
    subtitle?: string;
    ctaText?: string;
    ctaHref?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'gif' | 'video';
    fontSize?: number;
    fontFamily?: string;
    fontEffect?: string;
    color?: string;
    backdropColor?: string;
    glassBlur?: boolean;
    borderRadius?: number;
    opacity?: number;
    scrimStrength?: number;
    screenDurationSec?: number;
    endsAt?: string;
    rotation?: number;
    zIndex?: number;
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    italic?: boolean;
};


export interface SiteConfig {
    businessName: string;
    businessPhone: string;
    businessAddress?: string;
    contactEmail?: string;
    whatsappNumber?: string;
    currency: string;
    currencySymbol: string;
    marketTitle: string;
    marketSubtitle: string;
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
    banners?: string[];
    heroMedia?: string;
    heroMediaType?: 'image' | 'video';
    sections: MarketSection[];
    widgets?: PromoWidget[];
    activeModules?: string[];
    businessHours?: {
        open: string;
        close: string;
        isNightModeSimulated: boolean;
    };
    blocks?: BlockConfig[];
    themeGradient?: string;
    themeFont?: string;
    heroImage?: string;
    mapLocationUrl?: string;
    layout?: VisualLayoutBlock[];
    productOrder?: string[];
    builderMode?: 'PRE' | 'CLEAN';
    publishedAt?: string;
    heroData?: {
        badgeText?: string;
        ctaPrimaryText?: string;
        ctaSecondaryText?: string;
        scrimOpacity?: number;
        heightVh?: number;
        cardWidth?: 'sm' | 'md' | 'lg' | 'full';
        cardGlass?: boolean;
    };
    aboutData?: {
        title: string;
        subtitle: string;
        description: string;
        imageUrl?: string;
        mediaType?: 'image' | 'gif' | 'video';
        ctaPrimaryText?: string;
        ctaSecondaryText?: string;
        highlights?: Array<{
            id: string;
            emoji: string;
            title: string;
            desc: string;
            active: boolean;
        }>;
    };
    contactData?: {
        title: string;
        subtitle: string;
        formTitle?: string;
        showMap?: boolean;
        extraChannels?: Array<{
            id: string;
            emoji: string;
            label: string;
            value: string;
            active: boolean;
        }>;
    };
    timedBanners?: TimedOfferBanner[];
    pagesData?: Record<string, {
        layout: VisualLayoutBlock[];
        canvasLayers: CanvasLayer[];
    }>;
    operationRange?: 'local' | 'regional' | 'nacional' | 'global';
    enableWebPayments?: boolean;
    allowWebCheckout?: boolean;
    requireCashierInspection?: boolean;
    deliveryZone?: {
        enabled: boolean;
        center: [number, number];
        radiusKm: number;
        address?: string;
        updatedAt?: string;
    };
    servicesData?: {
        title?: string;
        subtitle?: string;
        items: Array<{
            id: string;
            title: string;
            desc: string;
            icon?: string;
            emoji?: string;
            active?: boolean;
            sizePreset?: 'sm' | 'md' | 'lg' | 'full';
        }>;
    };
}

export type FirebaseStatus = 'connecting' | 'online' | 'offline' | 'demo';


// ============================================================================
// NUEVA LÓGICA (FASE 6): Zustand Integrado + CartProvider Ligero
// ============================================================================

const CartContext = createContext<any>(null); // Dummy context por compatibilidad

export function CartProvider({ children }: { children: React.ReactNode }) {
    const { isReadOnly, profile } = useAuth();
    const setProducts       = useERPStore((s) => s.setProducts);
    const setOrders         = useERPStore((s) => s.setOrders);
    const setOwnerConfig    = useERPStore((s) => s.setOwnerConfig);
    const _setSiteConfig    = useERPStore((s) => s.setSiteConfig);
    const setFirebaseStatus = useERPStore((s) => s.setFirebaseStatus);
    const setSyncHealth     = useERPStore((s) => s.setSyncHealth);
    const setLoading        = useERPStore((s) => s.setLoading);
    const localMutationInFlight = useRef(0);
    const profileRoleRef = useRef<string | null>(null);

    useEffect(() => {
        profileRoleRef.current = profile?.role || null;
    }, [profile?.role]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).__bunkkerMutationLock = localMutationInFlight;
        }
    }, []);

    // ─── Local API Sync + Same-Origin SSE + Exponential Backoff Reconnect ───
    useEffect(() => {
        try {
            const cached = localStorage.getItem('_bunkker_cached_products');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setProducts(parsed);
                }
            }
        } catch {}

        let unmounted = false;
        let isFetching = false;
        let refetchQueued = false;
        let consecutiveFailures = 0;
        let pollTimer: ReturnType<typeof setTimeout> | null = null;
        let sseConnected = false;
        let sseSource: EventSource | null = null;
        let sseRetryTimer: ReturnType<typeof setTimeout> | null = null;
        let sseAttempts = 0;
        let sseConnectedOnce = false;
        let lastSseTs = 0;
        const seenSseTx = new Set<string>();

        const scheduleNextPoll = () => {
            if (unmounted) return;
            if (pollTimer) clearTimeout(pollTimer);
            const delay = consecutiveFailures > 0
                ? Math.min(25_000, 3_000 * Math.pow(2, Math.min(consecutiveFailures - 1, 3)))
                : sseConnected
                    ? 15_000
                    : 5_000;
            pollTimer = setTimeout(() => {
                void fetchLocalData();
            }, delay);
        };

        const fetchLocalData = async () => {
            if (unmounted) return;
            if (isFetching) {
                refetchQueued = true;
                return;
            }
            if (localMutationInFlight.current > 0) {
                refetchQueued = true;
                scheduleNextPoll();
                return;
            }
            isFetching = true;
            refetchQueued = false;
            const productsAtRequestStart = useERPStore.getState().products;

            try {
                if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                    const queued = await getQueuedOfflineOrders();
                    setFirebaseStatus('offline');
                    setSyncHealth({
                        syncErrorCode: 'ERR_NET_OFFLINE',
                        syncErrorDetail: 'El dispositivo está sin conexión de red.',
                        pendingOfflineCount: queued.length,
                        reconnectAttempt: consecutiveFailures + 1,
                    });
                    consecutiveFailures++;
                    return;
                }

                // 1. Vaciar cola offline de IndexedDB al recuperar red
                const flushResult = await flushOfflineOrderQueue((syncedOrderId) => {
                    toast.success(`Pedido offline ${syncedOrderId} sincronizado desde IndexedDB.`, '☁️ Sincronizado');
                });
                if (flushResult.synced > 0) {
                    broadcastSync({ action: 'OFFLINE_QUEUE_SYNCED', scope: 'orders', skipServerPost: true });
                }

                const [prodRes, ordRes] = await Promise.all([
                    fetch('/api/products', {
                        cache: 'no-store',
                        credentials: 'include',
                        headers: { 'Cache-Control': 'no-cache' },
                    }),
                    fetch('/api/orders', {
                        cache: 'no-store',
                        credentials: 'include',
                        headers: { 'Cache-Control': 'no-cache' },
                    }),
                ]);

                let detectedErrorCode: BunkkerSyncErrorCode | null = null;
                let detectedErrorDetail: string | null = null;

                if (prodRes.ok) {
                    const prodData = await prodRes.json().catch(() => null);
                    if (prodData?.success && Array.isArray(prodData.data)) {
                        const currentProducts = useERPStore.getState().products;
                        const canApplySnapshot = shouldApplyCatalogSnapshot(
                            productsAtRequestStart,
                            currentProducts,
                            localMutationInFlight.current
                        );

                        if (!canApplySnapshot) {
                            if (currentProducts !== productsAtRequestStart) {
                                refetchQueued = true;
                            }
                        } else {
                            const mappedProducts = prodData.data.map((p: any) => ({
                                ...p,
                                category: p.category || 'General',
                                location: { estante: p.estante || '', fila: p.fila || '' }
                            }));
                            const serverIds = new Set(mappedProducts.map((p: any) => p.id));
                            const freshlyCreated = currentProducts.filter(
                                (p) => !serverIds.has(p.id) && (Date.now() - (new Date(p.createdAt || 0).getTime())) < 60000
                            );
                            const finalProducts = [...mappedProducts, ...freshlyCreated];
                            setProducts(finalProducts);
                            try {
                                localStorage.setItem('_bunkker_cached_products', JSON.stringify(finalProducts));
                                localStorage.setItem('_bunkker_last_catalog_sync', new Date().toISOString());
                            } catch {}
                        }
                    }
                } else {
                    detectedErrorCode = prodRes.status >= 500 ? 'ERR_SYNC_HTTP_5XX' : 'ERR_SERVER_UNREACHABLE';
                    detectedErrorDetail = `Catálogo HTTP ${prodRes.status}`;
                }

                const queued = await getQueuedOfflineOrders();

                if (ordRes.ok) {
                    const ordData = await ordRes.json().catch(() => null);
                    if (ordData?.success) {
                        const serverOrders = ordData.data || [];
                        const serverIds = new Set(serverOrders.map((o: any) => o.id));
                        const pendingOfflineOrders = queued
                            .filter((q) => !serverIds.has(q.orderId))
                            .map((q) => ({
                                ...q.payload,
                                id: q.orderId,
                                offlineQueued: true,
                            }));
                        const combined = [...pendingOfflineOrders, ...serverOrders];
                        setOrders(combined.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || '')));
                    }
                } else if (ordRes.status === 401) {
                    // En tienda pública (invitado sin perfil de staff), 401 en /api/orders es comportamiento esperado.
                    if (profileRoleRef.current) {
                        detectedErrorCode = 'ERR_SESSION_EXPIRED';
                        detectedErrorDetail = 'La sesión de trabajo requiere revalidación.';
                    }
                } else {
                    detectedErrorCode = ordRes.status >= 500 ? 'ERR_SYNC_HTTP_5XX' : 'ERR_SERVER_UNREACHABLE';
                    detectedErrorDetail = `Órdenes HTTP ${ordRes.status}`;
                }

                if (detectedErrorCode) {
                    consecutiveFailures++;
                    setFirebaseStatus(detectedErrorCode === 'ERR_SESSION_EXPIRED' ? 'online' : 'offline');
                    setSyncHealth({
                        syncErrorCode: detectedErrorCode,
                        syncErrorDetail: detectedErrorDetail,
                        pendingOfflineCount: queued.length,
                        reconnectAttempt: consecutiveFailures,
                    });
                } else {
                    consecutiveFailures = 0;
                    setFirebaseStatus('online');
                    setSyncHealth({
                        syncErrorCode: null,
                        syncErrorDetail: null,
                        pendingOfflineCount: queued.length,
                        lastSyncAt: new Date().toISOString(),
                        reconnectAttempt: 0,
                    });
                }
            } catch (err) {
                consecutiveFailures++;
                const queued = await getQueuedOfflineOrders().catch(() => []);
                const offlineNow = typeof navigator !== 'undefined' && navigator.onLine === false;
                console.warn('[BUNKKER ERP] Reintento de sincronización programado:', err);
                setFirebaseStatus('offline');
                setSyncHealth({
                    syncErrorCode: offlineNow ? 'ERR_NET_OFFLINE' : 'ERR_SERVER_UNREACHABLE',
                    syncErrorDetail: err instanceof Error ? err.message : 'Fallo de red',
                    pendingOfflineCount: queued.length,
                    reconnectAttempt: consecutiveFailures,
                });
            } finally {
                setLoading(false);
                isFetching = false;
                if (refetchQueued && !unmounted) {
                    refetchQueued = false;
                    void fetchLocalData();
                } else {
                    scheduleNextPoll();
                }
            }
        };

        const connectSse = () => {
            if (unmounted || typeof window === 'undefined' || typeof EventSource === 'undefined') return;
            if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

            if (sseSource) {
                try { sseSource.close(); } catch {}
                sseSource = null;
            }

            const sinceParam = lastSseTs > 0 ? `?since=${lastSseTs}` : '';
            const es = new EventSource(`/api/sync/events${sinceParam}`, { withCredentials: true });
            sseSource = es;

            es.addEventListener('connected', () => {
                const wasReconnect = sseConnectedOnce;
                sseConnectedOnce = true;
                sseConnected = true;
                sseAttempts = 0;
                if (wasReconnect) {
                    // Reconciliación completa tras reconexión SSE
                    void fetchLocalData();
                    broadcastSync({ action: 'RECONCILE_ALL', scope: 'all', fromRemote: true, skipServerPost: true });
                }
            });

            es.addEventListener('sync', (msg: MessageEvent) => {
                try {
                    const ev = JSON.parse(msg.data);
                    if (ev?.timestamp && Number(ev.timestamp) > lastSseTs) {
                        lastSseTs = Number(ev.timestamp);
                    }
                    if (ev?.txId) {
                        if (seenSseTx.has(ev.txId)) return;
                        if (seenSseTx.size >= 400) {
                            const oldest = seenSseTx.values().next().value;
                            if (oldest) seenSseTx.delete(oldest);
                        }
                        seenSseTx.add(ev.txId);
                    }
                    broadcastSync({
                        action: ev?.action || 'GLOBAL_SYNC',
                        id: ev?.entityId,
                        scope: ev?.scope || 'all',
                        txId: ev?.txId,
                        payload: ev?.payload,
                        fromRemote: true,
                        skipServerPost: true,
                    });
                    if (ev?.scope !== 'settings' && ev?.scope !== 'devices') {
                        void fetchLocalData();
                    }
                } catch {}
            });

            es.onerror = () => {
                sseConnected = false;
                try { es.close(); } catch {}
                sseSource = null;
                if (unmounted) return;
                sseAttempts++;
                const retryDelay = Math.min(30_000, 2_000 * Math.pow(2, Math.min(sseAttempts - 1, 4)));
                if (sseRetryTimer) clearTimeout(sseRetryTimer);
                sseRetryTimer = setTimeout(connectSse, retryDelay);
            };
        };

        void fetchLocalData();
        connectSse();

        const handleOnline = () => {
            consecutiveFailures = 0;
            sseAttempts = 0;
            void fetchLocalData();
            connectSse();
        };

        const handleOffline = async () => {
            const queued = await getQueuedOfflineOrders().catch(() => []);
            setFirebaseStatus('offline');
            setSyncHealth({
                syncErrorCode: 'ERR_NET_OFFLINE',
                syncErrorDetail: 'Conexión perdida en este dispositivo.',
                pendingOfflineCount: queued.length,
            });
        };

        const handleVisibilityOrFocus = () => {
            if (typeof document === 'undefined' || document.visibilityState === 'visible') {
                void fetchLocalData();
                if (!sseSource && navigator.onLine !== false) {
                    connectSse();
                }
            }
        };

        const handleForceResync = () => {
            consecutiveFailures = 0;
            sseAttempts = 0;
            if (sseRetryTimer) {
                clearTimeout(sseRetryTimer);
                sseRetryTimer = null;
            }
            if (sseSource) {
                try { sseSource.close(); } catch {}
                sseSource = null;
                sseConnected = false;
            }
            void fetchLocalData();
            connectSse();
        };

        const handleLocalSyncEvent = (ev: Event) => {
            const detail = (ev as CustomEvent<any>).detail;
            if (detail?.fromRemote) return;
            const scope = inferSyncScope(detail?.action, detail?.scope);
            if (scope === 'orders' || scope === 'products' || scope === 'all') {
                void fetchLocalData();
            }
        };

        let tabChannel: BroadcastChannel | null = null;
        if (typeof window !== 'undefined') {
            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);
            window.addEventListener('focus', handleVisibilityOrFocus);
            window.addEventListener('bunkker_force_resync', handleForceResync);
            window.addEventListener('bunkker_sync_event', handleLocalSyncEvent);
            document.addEventListener('visibilitychange', handleVisibilityOrFocus);

            if (typeof BroadcastChannel !== 'undefined') {
                try {
                    tabChannel = new BroadcastChannel('bunkker_tab_sync');
                    tabChannel.onmessage = (event) => {
                        if (event.data?.type === 'SYNC_REFETCH') {
                            const scope = inferSyncScope(event.data?.payload?.action, event.data?.payload?.scope);
                            if (scope === 'orders' || scope === 'products' || scope === 'all') {
                                void fetchLocalData();
                            }
                        }
                    };
                } catch {}
            }
        }

        return () => {
            unmounted = true;
            if (pollTimer) clearTimeout(pollTimer);
            if (sseRetryTimer) clearTimeout(sseRetryTimer);
            if (sseSource) {
                try { sseSource.close(); } catch {}
            }
            if (typeof window !== 'undefined') {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
                window.removeEventListener('focus', handleVisibilityOrFocus);
                window.removeEventListener('bunkker_force_resync', handleForceResync);
                window.removeEventListener('bunkker_sync_event', handleLocalSyncEvent);
                document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
                if (tabChannel) {
                    try { tabChannel.close(); } catch {}
                }
            }
        };
    }, [setProducts, setOrders, setFirebaseStatus, setSyncHealth, setLoading]);

    // ─── Puente Opcional Socket.IO LAN (solo HTTP local; en HTTPS usa SSE) ───
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const isLocalHttp = window.location.protocol === 'http:';

        const reservationCheckInterval = setInterval(() => {
            const state = useERPStore.getState();
            if (state.cleanExpiredReservations) {
                state.cleanExpiredReservations();
            }
        }, 60 * 1000);

        if (!isLocalHttp) {
            return () => clearInterval(reservationCheckInterval);
        }

        const emitSocketState = (status: InventorySocketState) => {
            (window as any).__inventorySocketState = status;
            window.dispatchEvent(new CustomEvent(INVENTORY_SOCKET_STATUS_EVENT, { detail: { status } }));
        };

        let newSocket: any = null;
        let isDisposed = false;

        const createOrConnectSocket = (forceRecreate = false) => {
            if (isDisposed) return;

            if (newSocket && !forceRecreate) {
                try {
                    emitSocketState('reconnecting');
                    if (newSocket.io?.opts) {
                        newSocket.io.opts.reconnectionAttempts = 5;
                    }
                    newSocket.disconnect();
                    newSocket.connect();
                    return;
                } catch {
                    forceRecreate = true;
                }
            }

            if (newSocket && forceRecreate) {
                try {
                    newSocket.removeAllListeners?.();
                    newSocket.disconnect();
                } catch {}
                newSocket = null;
            }

            try {
                emitSocketState('reconnecting');
                const { io } = require('socket.io-client');
                newSocket = io('http://' + window.location.hostname + ':3001', {
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1500,
                    reconnectionDelayMax: 8000,
                    timeout: 4000,
                });

                newSocket.on('connect', () => {
                    console.log('🟢 Puente LAN :3001 activo');
                    emitSocketState('connected');
                    try {
                        newSocket.emit('request_inventory_sync');
                    } catch {}
                });

                newSocket.on('disconnect', () => {
                    emitSocketState('disconnected');
                });

                newSocket.on('connect_error', () => {
                    emitSocketState('disconnected');
                });

                newSocket.io?.on('reconnect_attempt', () => {
                    emitSocketState('reconnecting');
                });

                newSocket.io?.on('reconnect_failed', () => {
                    emitSocketState('disconnected');
                });

                newSocket.on('floating_stock_update', (floatingMap: Record<string, number>) => {
                    const state = useERPStore.getState();
                    if (state.setFloatingStock) {
                        state.setFloatingStock(floatingMap);
                    }
                });

                newSocket.on('sync_db_event', (payload?: any) => {
                    broadcastSync({
                        action: payload?.action || 'GLOBAL_SYNC',
                        id: payload?.id,
                        scope: payload?.scope,
                        txId: payload?.txId,
                        fromRemote: true,
                        skipServerPost: true,
                    });
                    window.dispatchEvent(new CustomEvent('bunkker_force_resync'));
                });

                newSocket.on('order_claimed', (data: { orderId: string; claimedBy: string; claimedRole: string }) => {
                    const state = useERPStore.getState();
                    if (state.claimOrder) {
                        state.claimOrder(data.orderId, { name: data.claimedBy, role: data.claimedRole });
                    }
                });

                newSocket.on('order_released', (data: { orderId: string; releasedBy: string; role: string; reason?: string }) => {
                    const state = useERPStore.getState();
                    if (state.releaseOrder) {
                        state.releaseOrder(data.orderId, { name: data.releasedBy, role: data.role }, data.reason);
                    }
                });

                (window as any).__inventorySocket = newSocket;
            } catch {
                newSocket = null;
                emitSocketState('disconnected');
            }
        };

        createOrConnectSocket(false);

        const handleForceSocketReconnect = () => {
            createOrConnectSocket(true);
        };

        window.addEventListener(INVENTORY_SOCKET_RECONNECT_EVENT, handleForceSocketReconnect);

        return () => {
            isDisposed = true;
            window.removeEventListener(INVENTORY_SOCKET_RECONNECT_EVENT, handleForceSocketReconnect);
            try {
                newSocket?.removeAllListeners?.();
                newSocket?.disconnect();
            } catch {}
            clearInterval(reservationCheckInterval);
        };
    }, []);
    // ───────────────────────────────────────────────────────────────────────────

    // ─── Local + Server Settings Init (Hydration Instantánea + Sync Publicado) ─
    useEffect(() => {
        let cancelled = false;
        const SITE_CONFIG_KEY = '_bunkker_site_config';
        const LEGACY_KEY      = '_admincom_site_config';

        const hydrateConfig = async () => {
            try {
                let raw = localStorage.getItem(SITE_CONFIG_KEY);
                if (!raw) {
                    const legacy = localStorage.getItem(LEGACY_KEY);
                    if (legacy) {
                        localStorage.setItem(SITE_CONFIG_KEY, legacy);
                        localStorage.removeItem(LEGACY_KEY);
                        raw = legacy;
                    }
                }

                if (raw && !cancelled) {
                    const parsedLocal = { ...defaultSiteConfig, ...JSON.parse(raw) };
                    _setSiteConfig(parsedLocal);
                } else {
                    const idbSnap = await loadOfflineSiteConfigSnapshot();
                    if (idbSnap && !cancelled) {
                        _setSiteConfig({ ...defaultSiteConfig, ...idbSnap });
                    }
                }
            } catch {}

            try {
                const res = await fetch('/api/settings', { cache: 'no-store', credentials: 'include' });
                if (res.ok) {
                    const json = await res.json();
                    if (json?.success && json?.data && Object.keys(json.data).length > 1 && !cancelled) {
                        const mergedServer = { ...defaultSiteConfig, ...json.data } as SiteConfig;
                        _setSiteConfig(mergedServer);
                        try {
                            localStorage.setItem(SITE_CONFIG_KEY, JSON.stringify(mergedServer));
                        } catch {}
                        saveOfflineSiteConfigSnapshot(mergedServer);
                        syncStorefrontAssetsWithServiceWorker(mergedServer);
                    }
                }
            } catch {}
            setOwnerConfig(0, 0, 0);
        };

        hydrateConfig();
        const onSync = (ev: Event) => {
            const detail = (ev as CustomEvent<any>).detail;
            const scope = inferSyncScope(detail?.action, detail?.scope);
            if (scope === 'settings' || scope === 'all' || detail?.action === 'RECONCILE_ALL') {
                void hydrateConfig();
            }
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('bunkker_sync_event', onSync);
        }
        return () => {
            cancelled = true;
            if (typeof window !== 'undefined') {
                window.removeEventListener('bunkker_sync_event', onSync);
            }
        };
    }, [_setSiteConfig, setOwnerConfig]);

    return <>{children}</>;
}

export const useCart = () => {
    const { isReadOnly, profile } = useAuth();
    
    // Al no suscribir a useERPStore() completo, evitamos re-renders en cascada.
    // Solo extraemos getters para las funciones, o devolvemos todo el store proxy
    // NOTA: Para mantener la API intacta sin reescribir docenas de archivos,
    // exportaremos el proxy del store COMPLETO, pero los componentes usarán selectores 
    // específicos para su estado, y estas funciones NO causarán renders internos aquí.
    const store = useERPStore();

    const createOrder = useCallback(async (
        customerData: { name: string; phone: string; address: string; orderId?: string; rfc?: string; regimenFiscal?: string; usoCFDI?: string; deliveryMethod?: string; paymentMethod?: string; tip?: number; lat?: number; lng?: number; gpsCoords?: { lat: number; lng: number }; pickupTime?: string },
        requiresInvoice: boolean = false,
        isOnline: boolean = false,
        asRequest: boolean = false 
    ) => {
        const state = useERPStore.getState();
        if (isReadOnly) { toast.warning('Los pedidos no se guardan en Modo Demostración.', '🔒 Demo'); return; }

        // Validación Límite Freemium (300 Ventas Máximo sin Licencia Activa)
        const lic = checkLicenseStatus();
        const VALID_SALES = ['paid', 'COMPLETED', 'READY_TO_SHIP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'READY_FOR_PICKUP_PAID'];
        const completedSalesCount = state.orders.filter(o => VALID_SALES.includes(o.status)).length;
        if (lic.status !== 'active' && completedSalesCount >= 300) {
            toast.error('⚠️ Límite Freemium alcanzado (300/300 ventas). Para continuar vendiendo, activa tu Suscripción Mensual PRO ($200 MXN / mes).', '🔒 Límite Alcanzado');
            throw new Error('Límite Freemium alcanzado (300/300 ventas). Suscripción requerida.');
        }

        if (state.firebaseStatus === 'offline') { console.warn('⚠️ Sin conexión. El pedido se encolará localmente en IndexedDB.'); }
        if (state.cart.length === 0) { toast.warning('El carrito está vacío.'); return; }

        const orderId = customerData.orderId || `ORD-${Date.now().toString().slice(-6)}`;
        let orderTotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        orderTotal += (customerData.tip || 0);

        let isNightQueue = false;
        if (state.siteConfig.businessHours?.isNightModeSimulated) {
            isNightQueue = true;
        } else if (state.siteConfig.businessHours?.open && state.siteConfig.businessHours?.close) {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const [openH, openM] = state.siteConfig.businessHours.open.split(':').map(Number);
            const [closeH, closeM] = state.siteConfig.businessHours.close.split(':').map(Number);
            const openMinutes = openH * 60 + openM;
            const closeMinutes = closeH * 60 + closeM;
            if (currentMinutes < openMinutes || currentMinutes > closeMinutes) {
                isNightQueue = true;
            }
        }

        const isStaff = ['sales', 'billing', 'admin', 'superadmin'].includes(profile?.role || '');
        const shouldBePending = asRequest || !isStaff || customerData.paymentMethod === 'pago_caja';
        let finalStatus = shouldBePending ? 'pending_payment' : 'paid';
        const expiresAt = asRequest ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() : null;

        // BUG-7 FIX: Usar crypto.getRandomValues en lugar de Math.random() para el PIN de entrega.
        const pinArray = new Uint16Array(1);
        crypto.getRandomValues(pinArray);
        const deliveryPin = (1000 + (pinArray[0] % 9000)).toString();

        const newOrder = {
            id: orderId, customer: customerData, customerEmail: customerData.phone,
            items: [...state.cart], total: orderTotal,
            date: new Date().toISOString(), status: isNightQueue ? 'NIGHT_QUEUE' : finalStatus as any,
            expiresAt,
            asRequest,
            paymentMethod: asRequest ? 'pago_caja' : (isOnline ? 'Online' : 'Venta Directa'), requiresInvoice,
            deliveryMethod: customerData.deliveryMethod || 'tienda',
            deliveryType: customerData.deliveryMethod === 'repartidor' ? 'DELIVERY' : ['patio', 'PATIO'].includes(customerData.deliveryMethod || '') ? 'PATIO' : ['pickup', 'tienda', 'piso'].includes(customerData.deliveryMethod || '') ? 'PICKUP' : 'LOCAL',
            lat: customerData.lat ?? customerData.gpsCoords?.lat,
            lng: customerData.lng ?? customerData.gpsCoords?.lng,
            deliveryPin
        };

        const apiPayload = {
            ...newOrder,
            id: orderId,
            asRequest,
            stockDeducted: true,
            items: state.cart.map(i => ({ productId: i.id, quantity: i.quantity, price: i.price, name: i.name }))
        };

        // 1. Pre-guardar en IndexedDB ANTES de la petición de red (Write-Ahead Log).
        // Si el navegador se cierra a mitad del request o la conexión cae, el pedido no se pierde jamás.
        await enqueueOfflineOrder({
            orderId,
            payload: apiPayload,
            deliveryPin,
            source: 'storefront'
        });

        const lock = typeof window !== 'undefined' ? ((window as any).__bunkkerMutationLock as { current: number } | undefined) : undefined;
        if (lock) lock.current += 1;

        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                throw new TypeError('Failed to fetch (Offline)');
            }

            const authHeaders = getCustomerAuthHeaders();
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...authHeaders
                },
                credentials: 'include',
                body: JSON.stringify(apiPayload)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                // Si el servidor respondió (cualquier código 4xx o 5xx), eliminar de IndexedDB porque fue un rechazo activo del servidor
                const { removeQueuedOfflineOrder } = await import('@/lib/indexedDBCart');
                await removeQueuedOfflineOrder(orderId);
                const detail = errData.error || errData.message || (res.status === 401 ? 'Acceso denegado (Inicia sesión como cliente o personal)' : `Error en servidor local (HTTP ${res.status})`);
                throw new Error(detail);
            }

            // Confirmado en el servidor: eliminar de la cola de pendientes en IndexedDB
            const { removeQueuedOfflineOrder } = await import('@/lib/indexedDBCart');
            await removeQueuedOfflineOrder(orderId);

            // Actualizar store local de inmediato con la nueva orden
            state.setOrders([newOrder as any, ...state.orders.filter(o => o.id !== orderId)]);
            state.clearCart();
            await logAudit({
                type: 'ORDER_CREATE', userId: profile?.uid || 'GUEST',
                userName: profile?.displayName || customerData.name,
                userRole: profile?.role || 'customer',
                description: `Pedido: ${orderId} por ${state.formatCurrency(orderTotal)}`,
                metadata: { paymentMethod: asRequest ? 'pago_caja' : (isOnline ? 'Online' : 'Venta Directa') }
            });

            // El servidor ya publicó en el bus SSE; notificamos localmente y otras pestañas sin re-publicar
            broadcastSync({ action: 'NEW_ORDER', id: orderId, scope: 'orders', skipServerPost: true });

            return { orderId, deliveryPin, queuedOffline: false };
        } catch (err: any) {
            const isNetworkFailure =
                (typeof navigator !== 'undefined' && navigator.onLine === false) ||
                (err instanceof TypeError && (
                    String(err.message).includes('Failed to fetch') ||
                    String(err.message).includes('NetworkError') ||
                    String(err.message).includes('fetch failed')
                ));

            if (isNetworkFailure) {
                // Mantener en IndexedDB, agregar optimísticamente al store local y limpiar el carrito
                state.setOrders([{ ...newOrder, offlineQueued: true } as any, ...state.orders]);
                state.clearCart();
                const queuedNow = await getQueuedOfflineOrders().catch(() => []);
                state.setSyncHealth({
                    syncErrorCode: 'ERR_NET_OFFLINE',
                    pendingOfflineCount: queuedNow.length,
                });
                toast.warning(
                    `Sin conexión: Tu pedido ${orderId} se guardó de forma segura en tu dispositivo (IndexedDB) y se enviará al reconectar.`,
                    '💾 Guardado Offline (IndexedDB)',
                    8000
                );
                return { orderId, deliveryPin, queuedOffline: true };
            }

            console.error('Order error:', err);
            toast.error(err.message, '❌ Venta rechazada');
            throw err;
        } finally {
            if (lock) lock.current = Math.max(0, lock.current - 1);
        }
    }, [isReadOnly, profile]);

    const confirmRequest = useCallback(async (orderId: string, locationAssignment?: { ventanilla?: string; cajon?: string }) => {
        const state = useERPStore.getState();
        if (isReadOnly) return;
        if (state.firebaseStatus === 'offline') console.warn('⚠️ Sin conexión. Reintentando confirmar cobro.');
        
        const order = state.orders.find(o => o.id === orderId);
        if (!order) return;

        const sellerName = profile?.displayName || 'Vendedor';
        const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
        const plainAudit = `[${timestamp}] ${sellerName.toUpperCase()}: CONFIRMÓ COBRO ${orderId} - TOTAL ${state.formatCurrency(order.total)}`;
        const lock = typeof window !== 'undefined' ? ((window as any).__bunkkerMutationLock as { current: number } | undefined) : undefined;
        if (lock) lock.current += 1;

        try {
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    id: orderId,
                    action: 'cashier_payment',
                    paymentMethod: 'cash',
                    ...locationAssignment
                })
            });

            const result = await res.json().catch(() => null);
            if (!res.ok || !result?.success) throw new Error(result?.error || 'No se pudo confirmar el pago.');

            // Actualización optimista inmediata en memoria
            state.setOrders(state.orders.map(o => {
                if (o.id === orderId) {
                    return {
                        ...o,
                        ...(result?.data || {}),
                        status: result?.data?.status || (o.isLoaded ? 'READY_FOR_PICKUP_PAID' : 'paid'),
                        confirmedAt: result?.data?.confirmedAt || new Date().toISOString()
                    };
                }
                return o;
            }));

            await logAudit({
                type: 'ORDER_CREATE', userId: profile?.uid || 'SYSTEM',
                userName: sellerName, userRole: 'sales',
                description: plainAudit, 
                metadata: { orderId }
            });

            broadcastSync({ action: 'ORDER_CONFIRMED', id: orderId, scope: 'orders', skipServerPost: true });
            if (typeof window !== 'undefined' && (window as any).__inventorySocket?.connected) {
                (window as any).__inventorySocket.emit('commit_stock', orderId);
            }
        } catch (err) {
            console.error("Error confirmando cobro:", err);
            toast.error(err instanceof Error ? err.message : 'Error confirmando el pago.');
            throw err;
        } finally {
            if (lock) lock.current = Math.max(0, lock.current - 1);
        }
    }, [isReadOnly, profile]);

    const claimCashierOrder = useCallback(async (orderId: string) => {
        if (isReadOnly) throw new Error('Operación no disponible en Modo Demostración.');
        const lock = typeof window !== 'undefined' ? ((window as any).__bunkkerMutationLock as { current: number } | undefined) : undefined;
        if (lock) lock.current += 1;
        try {
            const response = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ id: orderId, action: 'claim_cashier' })
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) throw new Error(result?.error || 'No se pudo tomar este pedido.');
            broadcastSync({ action: 'ORDER_CASHIER_CLAIMED', id: orderId, scope: 'orders', skipServerPost: true });
        } finally {
            if (lock) lock.current = Math.max(0, lock.current - 1);
        }
    }, [isReadOnly]);

    const startLoading = useCallback(async (orderId: string) => {
        const state = useERPStore.getState();
        if (isReadOnly || state.firebaseStatus === 'offline') return;
        const workerName = profile?.displayName || 'Cargador';
        const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
        const plainAudit = `[${timestamp}] ${workerName.toUpperCase()}: INICIÓ CARGA DE ORDEN ${orderId}`;
        const lock = typeof window !== 'undefined' ? ((window as any).__bunkkerMutationLock as { current: number } | undefined) : undefined;
        if (lock) lock.current += 1;

        try {
            const response = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    id: orderId,
                    action: 'claim_loading'
                })
            });
            const resData = await response.json().catch(() => null);
            if (!response.ok) throw new Error(resData?.error || 'No se pudo iniciar la preparación de la orden.');

            // Actualización optimista de recolección iniciada
            state.setOrders(state.orders.map(o => {
                if (o.id === orderId) {
                    return {
                        ...o,
                        ...(resData?.data || {}),
                        loadedBy: workerName,
                        loadedByUid: profile?.uid,
                        status: 'PREPARANDO'
                    };
                }
                return o;
            }));

            broadcastSync({ action: 'ORDER_LOADING_STARTED', id: orderId, scope: 'orders', skipServerPost: true });
            await logAudit({
                type: 'CONFIG_UPDATE', userId: profile?.uid || 'SYSTEM',
                userName: workerName, userRole: 'carga_descarga',
                description: plainAudit, metadata: { orderId, action: 'start_loading' }
            });
        } finally {
            if (lock) lock.current = Math.max(0, lock.current - 1);
        }
    }, [isReadOnly, profile]);

    const completeLoading = useCallback(async (orderId: string, targetLocation?: 'caja' | 'carga') => {
        const state = useERPStore.getState();
        if (isReadOnly || state.firebaseStatus === 'offline') return;
        const workerName = profile?.displayName || 'Cargador';
        const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
        const locationText = targetLocation === 'carga' ? 'EN BAHÍA DE CARGA / PATIO' : 'EN CAJA / MOSTRADOR';
        const plainAudit = `[${timestamp}] ${workerName.toUpperCase()}: FINALIZÓ CARGA DE ORDEN ${orderId} (${locationText})`;
        const lock = typeof window !== 'undefined' ? ((window as any).__bunkkerMutationLock as { current: number } | undefined) : undefined;
        if (lock) lock.current += 1;

        try {
            const response = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    id: orderId,
                    action: 'complete_loading',
                    targetLocation: targetLocation || 'caja'
                })
            });
            const resData = await response.json().catch(() => null);
            if (!response.ok) throw new Error(resData?.error || 'No se pudo finalizar la preparación de la orden.');

            // Actualización optimista en el store de Zustand
            state.setOrders(state.orders.map(o => {
                if (o.id === orderId) {
                    const isPaid = Boolean(o.confirmedAt) || o.status === 'paid' || o.status === 'READY_FOR_PICKUP_PAID';
                    const target = targetLocation || 'caja';
                    const nextStatus = (target === 'caja' || target === 'carga')
                        ? (isPaid ? 'READY_FOR_PICKUP_PAID' : 'READY_FOR_PICKUP')
                        : 'COMPLETED';
                    return {
                        ...o,
                        ...(resData?.data || {}),
                        isLoaded: true,
                        status: resData?.data?.status || nextStatus,
                        loadedBy: resData?.data?.loadedBy || workerName
                    };
                }
                return o;
            }));

            broadcastSync({ 
                action: 'ORDER_LOADING_COMPLETED', 
                id: orderId,
                scope: 'orders',
                targetLocation: targetLocation || 'caja',
                skipServerPost: true,
            });

            await logAudit({
                type: 'CONFIG_UPDATE', userId: profile?.uid || 'SYSTEM',
                userName: workerName, userRole: 'carga_descarga',
                description: plainAudit, metadata: { orderId, action: 'complete_loading' }
            });
        } finally {
            if (lock) lock.current = Math.max(0, lock.current - 1);
        }
    }, [isReadOnly, profile]);

    const exportInventoryToCSV = useCallback(() => {
        const state = useERPStore.getState();
        if (state.products.length === 0) return;
        const headers = ['ID', 'Nombre', 'Categoria', 'Precio', 'Stock', 'Barcode'];
        const rows = state.products.map(p => [
            p.id, p.name, p.category, p.price, p.stock, p.barcode || ''
        ]);
        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `inventario_brecha_${new Date().toLocaleDateString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, []);

    const sendDailyClosing = useCallback(async () => {
        const state = useERPStore.getState();
        if (isReadOnly) return;
        const today = new Date().toISOString().split('T')[0];
        const todaysOrders = state.orders.filter(o => (o.date || '').startsWith(today) && o.status === 'paid');
        const totalSales = todaysOrders.reduce((sum, o) => sum + o.total, 0);
        const salesCount = todaysOrders.length;
        const reportText = `CORTE DE CAJA - ${today}\n---------------------------\nVentas Totales: ${state.formatCurrency(totalSales)}\nNúmero de Pedidos: ${salesCount}\nVendedor Activo: ${profile?.displayName || 'Admin'}\n`;

        try {
            const res = await fetch('/api/admin/daily-closing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ report: reportText, ownerEmail: state.siteConfig.businessPhone })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await logAudit({
                type: 'CONFIG_UPDATE', userId: profile?.uid || 'SYSTEM',
                userName: profile?.displayName || 'Admin', userRole: 'admin',
                description: `CORTE DE CAJA GENERADO: Total ${state.formatCurrency(totalSales)}`,
                metadata: { total: totalSales, count: salesCount }
            });
            toast.success('Corte de caja enviado al correo del dueño.', '✅ Corte de Caja');
        } catch (e) {
            console.error(e);
            toast.error('No se pudo enviar el corte de caja.');
        }
    }, [isReadOnly, profile]);

    const updateProductPrice = useCallback(async (productId: string, newPrice: number, adminName: string) => {
        const state = useERPStore.getState();
        if (isReadOnly) { toast.warning('Operación no disponible en Modo Demostración.', '🔒 Demo'); return; }
        if (state.firebaseStatus === 'offline') { toast.warning('Sin conexión. Intenta cuando haya internet.', '⚠️ Offline'); return; }
        const product = state.products.find(p => p.id === productId);
        if (!product) return;
        const lock = typeof window !== 'undefined' ? ((window as any).__bunkkerMutationLock as { current: number } | undefined) : undefined;
        if (lock) lock.current += 1;
        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ id: productId, price: newPrice })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'No se pudo actualizar el precio.');
            }
            broadcastSync({ action: 'PRODUCT_UPDATED', id: productId, scope: 'products', skipServerPost: true });
            await logAudit({
                type: 'PRICE_CHANGE', userId: adminName, userName: adminName, userRole: 'admin',
                description: `Precio ${product.name}: ${state.formatCurrency(product.price)} → ${state.formatCurrency(newPrice)}`,
                metadata: { productId, oldPrice: product.price, newPrice },
            });
        } catch (err: any) {
            console.error('Error actualizando precio', err);
            toast.error(err?.message || 'Error actualizando precio.');
            throw err;
        } finally {
            if (lock) lock.current = Math.max(0, lock.current - 1);
        }
    }, [isReadOnly]);

    const updateProduct = useCallback(async (productId: string, updates: Partial<Product>, adminName: string) => {
        const state = useERPStore.getState();
        if (isReadOnly) { toast.warning('Operación no disponible en Modo Demostración.', '🔒 Demo'); return; }
        if (state.firebaseStatus === 'offline') { toast.warning('Sin conexión. Intenta cuando haya internet.', '⚠️ Offline'); return; }
        const product = state.products.find(p => p.id === productId);
        if (!product) return;
        const lock = typeof window !== 'undefined' ? ((window as any).__bunkkerMutationLock as { current: number } | undefined) : undefined;
        if (lock) lock.current += 1;
        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ id: productId, ...updates })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'No se pudo actualizar el producto.');
            }
            broadcastSync({ action: 'PRODUCT_UPDATED', id: productId, scope: 'products', skipServerPost: true });
            await logAudit({
                type: 'CONFIG_UPDATE', userId: profile?.uid || 'SYSTEM', userName: adminName, userRole: profile?.role || 'admin',
                description: `Producto editado: ${product.name}`, metadata: { productId, updates },
            });
        } catch (err: any) {
            console.error('Error actualizando producto', err);
            toast.error(err?.message || 'Error actualizando producto.');
            throw err;
        } finally {
            if (lock) lock.current = Math.max(0, lock.current - 1);
        }
    }, [isReadOnly, profile]);

    const purchaseCredits = useCallback(async (amount: number, type: 'invoice' | 'maintenance') => {
        if (isReadOnly) { toast.warning('Operación no disponible en Modo Demostración.', '🔒 Demo'); return; }
        try {
            await logAudit({
                type: 'CONFIG_UPDATE', userId: 'SYSTEM', userName: 'Admin', userRole: 'admin',
                description: `Recarga ${type}: +${amount}`, metadata: { amount, type },
            });
            toast.info('Recarga local registrada (Pendiente de implementación en SQLite).');
        } catch (err: any) { console.error(err); }
    }, [isReadOnly]);

    const cancelOrder = useCallback(async (orderId: string) => {
        const state = useERPStore.getState();
        if (isReadOnly || state.firebaseStatus === 'offline') return;
        const order = state.orders.find(o => o.id === orderId);
        if (!order) return;

        // BUG-6 FIX: Guardia contra doble cancelación.
        // Si ya está cancelada, no continuar para evitar doble devolución de stock.
        if ((order as any).status === 'cancelled') {
            console.warn(`[BUNKKER/Cancel] La orden ${orderId} ya está cancelada. Ignorando.`);
            return;
        }

        const lock = typeof window !== 'undefined' ? ((window as any).__bunkkerMutationLock as { current: number } | undefined) : undefined;
        if (lock) lock.current += 1;

        try {
            const response = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    id: orderId,
                    status: 'cancelled',
                    cancelledAt: new Date().toISOString()
                })
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) throw new Error(result?.error || 'No se pudo cancelar la orden.');

            if (typeof window !== 'undefined' && (window as any).__inventorySocket?.connected) {
                (window as any).__inventorySocket.emit('release_stock', orderId);
            }

            await logAudit({
                type: 'ORDER_CANCEL', userId: profile?.uid || 'SYSTEM',
                userName: profile?.displayName || 'Sistema', userRole: profile?.role || 'admin',
                description: `Pedido cancelado: ${orderId}`, metadata: { orderId, refundTotal: order.total },
            });

            state.setOrders(state.orders.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o));

            // El servidor ya publicó en SSE; notificamos localmente sin re-publicar
            broadcastSync({ action: 'ORDER_CANCELLED', id: orderId, scope: 'orders', skipServerPost: true });
        } catch (err: any) {
            console.error('Error cancelando orden:', err);
            toast.error(err?.message || 'No se pudo cancelar la orden.');
            throw err;
        } finally {
            if (lock) lock.current = Math.max(0, lock.current - 1);
        }
    }, [isReadOnly, profile]);

    const updateSiteConfig = useCallback(async (config: Partial<SiteConfig>) => {
        const state = useERPStore.getState();
        if (isReadOnly) {
            throw new Error('Operación no disponible en Modo Demostración.');
        }
        const merged: SiteConfig = {
            ...state.siteConfig,
            ...config,
            publishedAt: new Date().toISOString(),
        };

        const lock = typeof window !== 'undefined' ? ((window as any).__bunkkerMutationLock as React.MutableRefObject<number> | undefined) : undefined;
        if (lock) lock.current += 1;

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(merged)
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.success) {
                throw new Error(json?.error || `No se pudo publicar la tienda (HTTP ${res.status}).`);
            }

            const published = { ...merged, ...(json.data || {}) } as SiteConfig;
            state.setSiteConfig(published);
            try {
                localStorage.setItem('_bunkker_site_config', JSON.stringify(published));
            } catch {}
            await saveOfflineSiteConfigSnapshot(published);
            await syncStorefrontAssetsWithServiceWorker(published);
            broadcastSync({ action: 'SITE_CONFIG_PUBLISHED', scope: 'settings', skipServerPost: true });

            try {
                await logAudit({
                    type: 'CONFIG_UPDATE', userId: profile?.uid || 'SYSTEM',
                    userName: profile?.displayName || 'Admin', userRole: 'admin',
                    description: 'Fachada y configuración publicada exitosamente', metadata: { builderMode: published.builderMode, publishedAt: published.publishedAt },
                });
            } catch {}
        } finally {
            if (lock) lock.current = Math.max(0, lock.current - 1);
        }
    }, [isReadOnly, profile]);

    return {
        ...store,
        total: store.getTotal(),
        itemCount: store.getItemCount(),
        floatingStock: store.floatingStock || {},
        createOrder, cancelOrder, confirmRequest, claimCashierOrder, startLoading, completeLoading,
        exportInventoryToCSV, sendDailyClosing, updateProductPrice, updateProduct,
        purchaseCredits, updateSiteConfig
    };
};

