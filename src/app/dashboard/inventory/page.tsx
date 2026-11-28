"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useCart, type Product } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { logAudit } from '@/lib/audit';
import { QRCodeSVG } from 'qrcode.react';
import { 
    Package, Plus, Search, Edit3, Camera, MapPin, 
    Barcode, ArrowRight, ArrowLeft, Save, Loader2, X,
    Folder, FolderOpen, ChevronDown, ChevronUp, Shield, QrCode,
    Download, Upload, AlertTriangle, TrendingDown, History, Sparkles, Database, FileText,
    Mic, Printer, Trash2, FileSpreadsheet, Layers, CheckCircle2, Filter, Clock,
    PauseCircle, Play, LockKeyhole, PackagePlus, RefreshCw, Film, Link2, Star,
    Eye, EyeOff, Check
} from 'lucide-react';
import { exportToExcel } from '@/lib/excelExport';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, KeyboardSensor } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false });
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import Link from 'next/link';
import ShelfColumn from './components/ShelfColumn';
import ProductCard from './components/ProductCard';
import TrashDropZone from './components/TrashDropZone';
import ImportCSVButton from './ImportCSVButton';
import { arrayMove } from '@dnd-kit/sortable';
import { toast } from '@/lib/toast';
import { useERPStore } from '@/store/useERPStore';
import { broadcastSync } from '@/lib/syncNotifier';
import CloudBackupConfigWidget from '@/components/admin/CloudBackupConfigWidget';
import OrderPickingAssistant from '@/components/orders/OrderPickingAssistant';
import MultiOrderPickingAssistant from '@/components/orders/MultiOrderPickingAssistant';
import StockThresholdConfigPanel from '@/components/inventory/StockThresholdConfigPanel';
import StockThresholdAlertModal from '@/components/inventory/StockThresholdAlertModal';
import StockThresholdAlertToast from '@/components/inventory/StockThresholdAlertToast';
import {
    computeInventoryStockAlerts,
    loadStockThresholdConfig,
    saveStockThresholdConfig,
    isAlertSnoozed,
    setAlertSnooze,
    findNewlyBreachedProducts,
    formatBreachToastMessage,
    getProductEffectiveThreshold,
    type StockAlertSummary,
    type StockThresholdConfig
} from '@/lib/stockThresholds';
import { playErrorBeep } from '@/lib/scannerAudio';
import PinAuthorizationModal from '@/components/security/PinAuthorizationModal';
import QuickRestockModal from '@/components/inventory/QuickRestockModal';
import { type RestockAuditEntry } from '@/lib/restockConfirmation';
import { clearPickingDraft } from '@/lib/operationGuard';
import { findProductByBarcodeOrCode, matchesProductSearch } from '@/lib/barcodeLookup';
import {
    MAX_PRODUCT_MEDIA_ITEMS,
    getPrimaryProductImage,
    inferProductMediaType,
    normalizeProductMedia,
    normalizeProductMediaList,
    type ProductMediaItem,
} from '@/lib/productMedia';
import ConfigHelpButton from '@/components/common/ConfigHelpButton';
import HybridInferenceBadge from '@/components/ai/HybridInferenceBadge';
import {
    runHybridProductClassification,
    type FirebaseAiEngineSource,
} from '@/lib/firebaseAiLogic';
import InventorySummaryCards from '@/components/inventory/InventorySummaryCards';
import { calculateInventorySummary } from '@/lib/inventoryMetrics';

export default function InventoryDashboard() {
    const { products, formatCurrency, orders, startLoading, completeLoading } = useCart();
    const { profile, isReadOnly } = useAuth();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [localProducts, setLocalProducts] = useState<Product[]>([]);
    const mutationInFlight = useRef(0);

    // Control de visibilidad pública y selección múltiple tipo galería (SOLO SuperAdmin)
    const isSuperAdmin = profile?.role === 'superadmin';
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [visibilityPopoverId, setVisibilityPopoverId] = useState<string | null>(null);
    const [visibilityBusyId, setVisibilityBusyId] = useState<string | null>(null);
    const [bulkActionBusy, setBulkActionBusy] = useState(false);
    const [bulkTrashConfirmOpen, setBulkTrashConfirmOpen] = useState(false);
    const [classifyingHybrid, setClassifyingHybrid] = useState(false);
    const [classificationSource, setClassificationSource] = useState<{
        source: FirebaseAiEngineSource;
        model: string;
        latencyMs: number;
    } | null>(null);

    // Picking / Deconstrucción IA para Almacén (Individual y Multipedido)
    const [pickingOrder, setPickingOrder] = useState<any | null>(null);
    const [multiPickingOrders, setMultiPickingOrders] = useState<any[] | null>(null);
    const [selectedOrderIdsForBatch, setSelectedOrderIdsForBatch] = useState<string[]>([]);
    const [deconstructingOrder, setDeconstructingOrder] = useState<any | null>(null);
    const [onlyMyOrders, setOnlyMyOrders] = useState(false);
    const [abandonTargetOrder, setAbandonTargetOrder] = useState<any | null>(null);
    const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

    const acquireMutationLock = () => {
        mutationInFlight.current += 1;
        if (typeof window !== 'undefined') {
            const lock = (window as any).__bunkkerMutationLock as { current: number } | undefined;
            if (lock) lock.current += 1;
        }
    };

    const releaseMutationLock = () => {
        mutationInFlight.current = Math.max(0, mutationInFlight.current - 1);
        if (typeof window !== 'undefined') {
            const lock = (window as any).__bunkkerMutationLock as { current: number } | undefined;
            if (lock) lock.current = Math.max(0, lock.current - 1);
        }
    };

    const syncCachedProducts = (nextProducts: Product[]) => {
        try {
            localStorage.setItem('_bunkker_cached_products', JSON.stringify(nextProducts));
            localStorage.setItem('_bunkker_last_catalog_sync', new Date().toISOString());
        } catch {}
    };

    useEffect(() => {
        if (mutationInFlight.current > 0) return;
        // Sort products by orderIndex to keep them stable
        const sorted = [...products].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        setLocalProducts(sorted);
    }, [products]);

    // Tabs
    const [activeTab, setActiveTab] = useState<'catalog' | 'shelves' | 'transfer' | 'backup' | 'shrinkage' | 'trash' | 'orders' | 'thresholds' | 'restock'>('catalog');

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const query = new URLSearchParams(window.location.search).get('search');
        if (query && query.trim()) {
            setSearchTerm(query.trim());
            setActiveTab('catalog');
        }
        const onSearchEvent = (event: Event) => {
            const custom = event as CustomEvent<{ search?: string }>;
            const nextQuery = custom.detail?.search?.trim();
            if (nextQuery) {
                setSearchTerm(nextQuery);
                setActiveTab('catalog');
            }
        };
        window.addEventListener('bunkker_inventory_search', onSearchEvent);
        return () => window.removeEventListener('bunkker_inventory_search', onSearchEvent);
    }, []);

    // Recarga Rápida de Stock Bajo + Auditoría
    const [restockTargetProduct, setRestockTargetProduct] = useState<Product | null>(null);
    const [restockHistory, setRestockHistory] = useState<RestockAuditEntry[]>([]);
    const [restockHistoryLoading, setRestockHistoryLoading] = useState(false);
    const [restockSearch, setRestockSearch] = useState('');
    
    // Estados de umbrales y alertas automáticas de stock
    const [thresholdConfig, setThresholdConfig] = useState<StockThresholdConfig>(() => loadStockThresholdConfig());
    const [isThresholdAlertModalOpen, setIsThresholdAlertModalOpen] = useState(false);
    const [isThresholdToastVisible, setIsThresholdToastVisible] = useState(true);
    const lastAlertedProductIdsRef = useRef<Set<string>>(new Set());

    // Resumen reactivo de alertas de stock y valuación de inventario
    const alertSummary: StockAlertSummary = useMemo(() => {
        return computeInventoryStockAlerts(localProducts, thresholdConfig);
    }, [localProducts, thresholdConfig]);

    const inventorySummary = useMemo(() => {
        const sourceProducts = localProducts.length > 0 || products.length === 0 ? localProducts : products;
        return calculateInventorySummary(sourceProducts);
    }, [localProducts, products]);

    // Disparo de notificación visual (toast), aviso flotante y alerta auditiva cuando cualquier producto cae debajo de su mínimo configurado
    useEffect(() => {
        const currentBreachedIds = new Set<string>([
            ...alertSummary.criticalItems.map((i) => i.productId),
            ...alertSummary.lowStockItems.map((i) => i.productId),
        ]);

        if (!thresholdConfig.alertsEnabled || currentBreachedIds.size === 0) {
            lastAlertedProductIdsRef.current = currentBreachedIds;
            return;
        }

        const newlyBreached = findNewlyBreachedProducts(lastAlertedProductIdsRef.current, alertSummary);
        lastAlertedProductIdsRef.current = currentBreachedIds;

        if (newlyBreached.length > 0 && !isAlertSnoozed()) {
            const { title, message, isCritical } = formatBreachToastMessage(newlyBreached);
            if (isCritical) {
                toast.error(message, title);
            } else {
                toast.warning(message, title);
            }
            if (thresholdConfig.soundAlerts) {
                playErrorBeep(0.35);
            }
            setIsThresholdToastVisible(true);
        }
    }, [alertSummary, thresholdConfig.alertsEnabled, thresholdConfig.soundAlerts]);
    const [hydratedChunksMap, setHydratedChunksMap] = useState<Record<string, boolean>>({});
    const [trashedProducts, setTrashedProducts] = useState<Product[]>([]);
    const [trashLoading, setTrashLoading] = useState(false);

    // Import / Export
    const [importDiscrepancies, setImportDiscrepancies] = useState<any[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [rawImportedProducts, setRawImportedProducts] = useState<Product[]>([]);
    const [syncingImport, setSyncingImport] = useState(false);

    // Shrinkage (Robo Hormiga)
    const [shrinkageLogs, setShrinkageLogs] = useState<any[]>([]);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportProductId, setReportProductId] = useState('');
    const [reportQty, setReportQty] = useState<number>(1);
    const [reportType, setReportType] = useState<'missing' | 'surplus'>('missing');
    const [reportNotes, setReportNotes] = useState('');
    const [savingReport, setSavingReport] = useState(false);

    useEffect(() => {
        if (activeTab !== 'trash') return;
        let cancelled = false;
        setTrashLoading(true);
        fetch('/api/products?includeDeleted=true')
            .then(async (response) => {
                const result = await response.json().catch(() => null);
                if (!response.ok || !result?.success) throw new Error(result?.error || 'No se pudo cargar la papelera.');
                if (!cancelled) {
                    setTrashedProducts((result.data || []).map((product: any) => ({
                        ...product,
                        location: product.location || { estante: product.estante || '', fila: product.fila || '' }
                    })));
                }
            })
            .catch((error) => {
                if (!cancelled) toast.error(error instanceof Error ? error.message : 'No se pudo cargar la papelera.');
            })
            .finally(() => {
                if (!cancelled) setTrashLoading(false);
            });
        return () => { cancelled = true; };
    }, [activeTab]);

    // Carpetas y Escaneo + Enfoque de Estante y Chunks (estilo Minecraft)
    const [customEstantes, setCustomEstantes] = useState<string[]>([]);
    const [expandedEstantes, setExpandedEstantes] = useState<Record<string, boolean>>({});
    const [activeEstante, setActiveEstante] = useState<string | null>(null);
    const [shelfSearchQuery, setShelfSearchQuery] = useState('');
    const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
    const [isListeningVoice, setIsListeningVoice] = useState(false);
    const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
    const [qrPrintData, setQrPrintData] = useState<{ estante: string, nivel: string } | null>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [newEstanteName, setNewEstanteName] = useState('');
    const [showNewEstanteModal, setShowNewEstanteModal] = useState(false);

    // ─── SISTEMA DE CHUNKS / SLOTS (INSPIRADO EN MINECRAFT) ───
    // Cada estante actúa como un "Chunk" en memoria. Al mover o reordenar productos (Slots),
    // las mutaciones se acumulan en el buffer del Chunk ("Dirty Chunks") y se vuelcan a la BD
    // en una sola transacción por lote (Autosave por Debounce de 2.5s o Flush manual),
    // reduciendo hasta en un 90% las escrituras IOPS a PostgreSQL/SQLite.
    const dirtySlotUpdatesRef = useRef<Map<string, { id: string; estante?: string; fila?: string; orderIndex?: number; shelfChunk: string }>>(new Map());
    const [dirtyChunksMap, setDirtyChunksMap] = useState<Record<string, number>>({});
    const [isFlushingChunks, setIsFlushingChunks] = useState(false);
    const [totalSavedWrites, setTotalSavedWrites] = useState(0);
    const chunkFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const syncDirtyChunksState = () => {
        const counts: Record<string, number> = {};
        dirtySlotUpdatesRef.current.forEach((val) => {
            counts[val.shelfChunk] = (counts[val.shelfChunk] || 0) + 1;
        });
        setDirtyChunksMap(counts);
    };

    const flushDirtyChunks = async (manual = false) => {
        if (chunkFlushTimerRef.current) {
            clearTimeout(chunkFlushTimerRef.current);
            chunkFlushTimerRef.current = null;
        }
        const pendingEntries = Array.from(dirtySlotUpdatesRef.current.values());
        if (pendingEntries.length === 0) return;

        dirtySlotUpdatesRef.current.clear();
        syncDirtyChunksState();
        setIsFlushingChunks(true);
        acquireMutationLock();

        try {
            const batchUpdates = pendingEntries.map(({ id, estante, fila, orderIndex }) => ({
                id,
                ...(estante !== undefined ? { estante } : {}),
                ...(fila !== undefined ? { fila } : {}),
                ...(orderIndex !== undefined ? { orderIndex } : {}),
            }));

            const response = await fetch('/api/products', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ batchUpdates }),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) {
                throw new Error(result?.error || 'No se pudo sincronizar el lote de estantes.');
            }

            if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                (window as any).__inventorySocket.emit('sync_db_event', {
                    action: 'INVENTORY_FLUSHED',
                    slotsUpdated: batchUpdates.length,
                });
            }
            if (manual) {
                toast.success(`Estantes sincronizados: ${batchUpdates.length} ubicaciones guardadas en BD.`, ' Guardado');
            }
        } catch (error) {
            console.error('Error en sincronización de estantes:', error);
            toast.error(error instanceof Error ? error.message : 'Error al sincronizar estantes de inventario.');
        } finally {
            setIsFlushingChunks(false);
            releaseMutationLock();
        }
    };

    const queueSlotMutation = (
        mutations: Array<{ id: string; estante?: string; fila?: string; orderIndex?: number; shelfChunk: string }>
    ) => {
        if (mutations.length > 1) {
            setTotalSavedWrites((prev) => prev + (mutations.length - 1));
        } else if (dirtySlotUpdatesRef.current.size > 0) {
            setTotalSavedWrites((prev) => prev + 1);
        }

        mutations.forEach((m) => {
            const prev = dirtySlotUpdatesRef.current.get(m.id);
            dirtySlotUpdatesRef.current.set(m.id, {
                ...prev,
                ...m,
            });
        });

        syncDirtyChunksState();

        if (chunkFlushTimerRef.current) {
            clearTimeout(chunkFlushTimerRef.current);
        }
        chunkFlushTimerRef.current = setTimeout(() => {
            flushDirtyChunks(false);
        }, 2400);
    };

    useEffect(() => {
        return () => {
            if (chunkFlushTimerRef.current) {
                clearTimeout(chunkFlushTimerRef.current);
            }
        };
    }, []);

    const focusAndScrollToShelf = (shelfName: string | null) => {
        const nextShelf = activeEstante === shelfName ? null : shelfName;
        setActiveEstante(nextShelf);
        if (nextShelf && typeof document !== 'undefined') {
            setTimeout(() => {
                const el = document.getElementById(`shelf-col-${nextShelf}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }
            }, 60);
        }
    };

    // Formulario de Nuevo Producto con Doble Confirmación de Precio (Anti-Dedos) y Media Multi-Vista (hasta 4)
    const [formData, setFormData] = useState({
        name: '', category: '', description: '',
        barcode: '', image: '', media: [] as ProductMediaItem[],
        estante: '', fila: '',
        price: '', confirmPrice: '', stock: '',
        minStock: '',
        warranty: '', unitType: 'PZA', isBulk: false
    });
    const [priceMismatchCount, setPriceMismatchCount] = useState(0);
    const [mediaUrlInput, setMediaUrlInput] = useState('');
    const [uploadingMedia, setUploadingMedia] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setDraggedProductId(null);
        const previousProducts = localProducts;

        try {
            if (!over) return;

            const productId = String(active.id);
            const overId = String(over.id);
            const product = localProducts.find(item => item.id === productId);
            if (!product) return;

            if (overId === 'inventory-trash') {
                await handleDeleteProduct(productId, product.name);
                return;
            }

            const overData = over.data.current as { shelfName?: string; levelName?: string } | undefined;
            const targetProduct = localProducts.find(item => item.id === overId);
            const targetParts = overId.includes('::') ? overId.split('::') : [];
            let targetShelfName = (overData?.shelfName || (targetParts[0] === 'shelf' ? targetParts[1] : targetParts[0]) || targetProduct?.location?.estante || 'Sin Asignar').toUpperCase().trim();
            let targetLevelName = overData?.levelName || (targetParts[0] === 'shelf' ? 'Nivel 1' : targetParts[1]) || targetProduct?.location?.fila || 'Nivel 1';
            if (targetLevelName === 'GENERAL') targetLevelName = 'Nivel 1';
            const currentShelfName = (product.location?.estante || 'Sin Asignar').toUpperCase().trim();
            let currentLevelName = product.location?.fila || 'Nivel 1';
            if (currentLevelName === 'GENERAL') currentLevelName = 'Nivel 1';

            if (targetShelfName === currentShelfName && targetLevelName === currentLevelName) {
                const levelProducts = localProducts.filter(item =>
                    (item.location?.estante || 'Sin Asignar').toUpperCase().trim() === currentShelfName &&
                    (item.location?.fila || 'GENERAL') === currentLevelName
                );
                const fromIndex = levelProducts.findIndex(item => item.id === productId);
                const targetIndex = targetProduct
                    ? levelProducts.findIndex(item => item.id === targetProduct.id)
                    : levelProducts.length - 1;
                if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return;

                const reordered = arrayMove(levelProducts, fromIndex, targetIndex)
                    .map((item, index) => ({ ...item, orderIndex: index }));
                const reorderedById = new Map(reordered.map(item => [item.id, item]));
                setLocalProducts(localProducts.map(item => reorderedById.get(item.id) || item));

                // En vez de disparar N peticiones HTTP por cada ítem reordenado, marcamos los Slots sucios en el Chunk
                queueSlotMutation(
                    reordered.map((item) => ({
                        id: item.id,
                        orderIndex: item.orderIndex,
                        shelfChunk: currentShelfName,
                    }))
                );
                return;
            }

            const finalShelfName = targetShelfName === 'SIN ASIGNAR' ? '' : targetShelfName;
            const destinationProducts = localProducts.filter(item =>
                (item.location?.estante || 'Sin Asignar').toUpperCase().trim() === targetShelfName &&
                (item.location?.fila || 'GENERAL') === targetLevelName
            );
            const orderIndex = destinationProducts.reduce((maximum, item) => Math.max(maximum, item.orderIndex || 0), -1) + 1;
            const updatedProduct = {
                ...product,
                location: { estante: finalShelfName, fila: targetLevelName },
                orderIndex
            };
            setLocalProducts(localProducts.map(item => item.id === productId ? updatedProduct : item));

            // Encolar mutación en el Chunk destino (persistencia diferida por lote estilo Minecraft)
            queueSlotMutation([
                {
                    id: productId,
                    estante: finalShelfName,
                    fila: targetLevelName,
                    orderIndex,
                    shelfChunk: targetShelfName,
                },
            ]);

            await logAudit({
                type: 'INVENTORY_MOVE',
                userId: profile?.uid || 'SYSTEM',
                userName: profile?.displayName || 'Almacenista',
                userRole: profile?.role || 'inventory',
                description: `Movió "${product.name}" a ${targetShelfName} / ${targetLevelName}`,
                metadata: { productId, from: currentShelfName, to: targetShelfName, level: targetLevelName }
            });
        } catch (error) {
            console.error('Error guardando movimiento de producto:', error);
            setLocalProducts(previousProducts);
            toast.error(error instanceof Error ? error.message : 'No se pudo guardar el movimiento.');
        } finally {
            mutationInFlight.current = Math.max(0, mutationInFlight.current - 1);
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        mutationInFlight.current += 1;
        setDraggedProductId(event.active.id as string);
    };

    const handleExportJSON = () => {
        try {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(products, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            // BUG-SYNC-3 FIX: nombre del archivo con branding BUNKKER
            downloadAnchor.setAttribute("download", `inventario-bunkker-${Date.now()}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        } catch (err) {
            toast.error('Error al exportar el inventario.');
        }
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileReader = new FileReader();
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAnalyzing(true);
        setImportDiscrepancies([]);

        fileReader.onload = (event) => {
            try {
                const resultStr = event.target?.result as string;
                let parsed: any[] = [];

                if (file.name.endsWith('.csv')) {
                    // Basic CSV Parser
                    const lines = resultStr.split(/\r?\n/).filter(line => line.trim());
                    if (lines.length > 0) {
                        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                        const nameIdx = headers.findIndex(h => h.includes('nombre') || h.includes('name'));
                        const priceIdx = headers.findIndex(h => h.includes('precio') || h.includes('price'));
                        const stockIdx = headers.findIndex(h => h.includes('stock') || h.includes('cantidad'));
                        const catIdx = headers.findIndex(h => h.includes('categor') || h.includes('category'));
                        const barIdx = headers.findIndex(h => h.includes('codigo') || h.includes('bar'));

                        parsed = lines.slice(1).map((line, idx) => {
                            // Match commas not inside quotes
                            const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
                            return {
                                id: `CSV-PROD-${Date.now()}-${idx}`,
                                name: nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx] : `Producto Importado ${idx}`,
                                price: priceIdx !== -1 && cols[priceIdx] ? Number(cols[priceIdx]) : 0,
                                stock: stockIdx !== -1 && cols[stockIdx] ? Number(cols[stockIdx]) : 0,
                                category: catIdx !== -1 && cols[catIdx] ? cols[catIdx] : 'General',
                                barcode: barIdx !== -1 && cols[barIdx] ? cols[barIdx] : ''
                            };
                        });
                    }
                } else {
                    parsed = JSON.parse(resultStr);
                    if (!Array.isArray(parsed)) {
                        throw new Error('JSON format invalid: expected an array.');
                    }
                }

                if (!Array.isArray(parsed) || parsed.length === 0) {
                    toast.warning('Archivo vacío o formato inválido.');
                    setIsAnalyzing(false);
                    return;
                }

                setRawImportedProducts(parsed);

                const list: any[] = [];
                parsed.forEach((imported: any) => {
                    const local = products.find(p => p.id === imported.id || p.name.toLowerCase() === imported.name.toLowerCase() || (imported.barcode && p.barcode === imported.barcode));
                    if (!local) {
                        list.push({
                            type: 'new',
                            name: imported.name,
                            category: imported.category || 'General',
                            importPrice: imported.price || 0,
                            importStock: imported.stock || 0,
                            details: `Producto nuevo: "${imported.name}"`
                        });
                    } else {
                        const priceDiff = Number(imported.price) !== Number(local.price);
                        const stockDiff = Number(imported.stock) !== Number(local.stock);

                        if (priceDiff || stockDiff) {
                            const shrinkageWarning = Number(local.stock) < Number(imported.stock);

                            list.push({
                                type: 'discrepancy',
                                id: local.id,
                                name: local.name,
                                category: local.category || 'General',
                                localPrice: local.price,
                                importPrice: imported.price,
                                localStock: local.stock,
                                importStock: imported.stock,
                                priceDiff,
                                stockDiff,
                                shrinkageWarning,
                                details: `${priceDiff ? `Diferencia precio ($${local.price} vs $${imported.price}). ` : ''}${stockDiff ? `Diferencia stock (${local.stock} pzas vs ${imported.stock} pzas).` : ''}`
                            });
                        }
                    }
                });

                products.forEach((local) => {
                    const existsInImport = parsed.some((imported: any) => imported.id === local.id || imported.name.toLowerCase() === local.name.toLowerCase() || (imported.barcode && imported.barcode === local.barcode));
                    if (!existsInImport) {
                        list.push({
                            type: 'missing_in_import',
                            id: local.id,
                            name: local.name,
                            localStock: local.stock,
                            details: `Producto local ausente en archivo de importación.`
                        });
                    }
                });

                setImportDiscrepancies(list);
            } catch (err) {
                console.error(err);
                toast.error('Error al leer el archivo. Asegúrate de que sea un JSON válido o CSV delimitado por comas.');
            } finally {
                setIsAnalyzing(false);
            }
        };
        fileReader.readAsText(file);
    };

    const handleSyncImport = async () => {
        if (isReadOnly) {
            toast.warning('No se pueden guardar cambios en Modo Demostración.', '🔒 Demo');
            return;
        }
        if (rawImportedProducts.length === 0) return;

        setSyncingImport(true);
        try {
            // BUG-SYNC-2 FIX: Importar a SQLite (fuente de verdad) en lugar de directamente a Firestore.
            // Antes usaba setDoc(doc(db, 'products', ...)) de firebase/firestore — los productos
            // llegaban al espejo pero el .exe (que lee de SQLite vía polling) nunca los veía.
            // La sincronización a Firebase es responsabilidad de localSync.ts, no del cliente.
            let successCount = 0;
            const errors: string[] = [];

            for (const item of rawImportedProducts) {
                const productId = item.id || `PROD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 6)}`;
                try {
                    const res = await fetch('/api/products', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: productId,
                            name: item.name,
                            price: Number(item.price) || 0,
                            stock: Math.floor(Number(item.stock)) || 0,
                            category: item.category || 'General',
                            barcode: item.barcode || null,
                            description: item.description || null,
                            image: item.image || null,
                            estante: item.location?.estante || item.estante || null,
                            fila: item.location?.fila || item.fila || null,
                        })
                    });
                    if (res.ok) successCount++;
                    else errors.push(item.name);
                } catch { errors.push(item.name); }
            }

            await logAudit({
                type: 'CONFIG_UPDATE',
                userId: profile?.uid || 'SYSTEM',
                userName: profile?.displayName || 'Almacenista',
                userRole: profile?.role || 'inventory',
                description: `Importación de inventario: ${successCount}/${rawImportedProducts.length} productos sincronizados a SQLite.`,
                metadata: { successCount, errors }
            });

            // Notificar a otros dispositivos en la red
            if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                (window as any).__inventorySocket.emit('sync_db_event', { action: 'INVENTORY_IMPORTED', count: successCount });
            }

            if (errors.length > 0) {
                toast.warning(`${successCount} importados. Fallaron: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`, '⚠️ Importación parcial');
            } else {
                toast.success(`¡${successCount} productos importados a la base local con éxito!`, '✅ Importación');
            }
            setImportDiscrepancies([]);
            setRawImportedProducts([]);
        } catch (error) {
            console.error(error);
            toast.error('Ocurrió un error al sincronizar el inventario.');
        } finally {
            setSyncingImport(false);
        }
    };

    const fetchShrinkageLogs = async () => {
        try {
            const res = await fetch('/api/inventory/shrinkage');
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setShrinkageLogs(data.data);
                }
            }
        } catch (err) {
            console.error('Error fetching shrinkage logs:', err);
        }
    };

    const parseShrinkageDate = (val: any): Date | null => {
        if (!val) return null;
        if (typeof val === 'object' && typeof val?.seconds === 'number') {
            return new Date(val.seconds * 1000);
        }
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    };

    useEffect(() => {
        if (activeTab === 'shrinkage') {
            fetchShrinkageLogs();
        }
    }, [activeTab]);

    const handleSaveShrinkageReport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly) {
            toast.warning('Operación no permitida en Modo Demostración.', '🔒 Demo');
            return;
        }
        if (!reportProductId || !reportQty) {
            toast.warning('Selecciona un producto y especifica la cantidad.');
            return;
        }

        const selectedProd = products.find(p => p.id === reportProductId);
        if (!selectedProd) return;

        setSavingReport(true);
        try {
            const qty = Number(reportQty);
            const loss = qty * selectedProd.price;

            const res = await fetch('/api/inventory/shrinkage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: selectedProd.id,
                    productName: selectedProd.name,
                    productCategory: selectedProd.category || 'General',
                    discrepancyType: reportType,
                    qty,
                    estimatedLoss: reportType === 'missing' ? loss : 0,
                    notes: reportNotes.trim() || 'Sin comentarios.',
                    reportedBy: profile?.displayName || 'Almacenista',
                })
            });

            if (!res.ok) throw new Error('Error al guardar reporte');

            await logAudit({
                type: 'SECURITY_ALERT',
                userId: profile?.uid || 'SYSTEM',
                userName: profile?.displayName || 'Almacenista',
                userRole: profile?.role || 'almacen',
                description: `Reporte de Producto Fantasma: ${selectedProd.name} (${reportType === 'missing' ? `Faltante de ${qty} pzas` : `Sobrante de ${qty} pzas`})`,
                metadata: { productId: selectedProd.id, qty, discrepancyType: reportType }
            });

            fetchShrinkageLogs(); // Refresh the list


            toast.success('¡Incidencia registrada y existencias corregidas en el sistema!', '✅ Merma');
            setIsReportModalOpen(false);
            setReportProductId('');
            setReportQty(1);
            setReportNotes('');
        } catch (err) {
            console.error(err);
            toast.error('Error al registrar la incidencia.');
        } finally {
            setSavingReport(false);
        }
    };

    const handleCreateEstante = () => {
        if (!newEstanteName.trim()) return;
        const name = newEstanteName.trim().toUpperCase();
        if (!customEstantes.includes(name)) {
            setCustomEstantes(prev => [...prev, name]);
            setExpandedEstantes(prev => ({ ...prev, [name]: true }));
        }
        
        // Auto-select in form if creating/editing product
        if (isCreating || editingProductId) {
            setFormData(prev => ({ ...prev, estante: name }));
        }

        setNewEstanteName('');
        setShowNewEstanteModal(false);
    };

    const handleAddProductClick = (shelfName: string, levelName: string) => {
        setEditingProductId(null);
        setFormData({
            name: '', category: '', description: '',
            barcode: '', image: '', media: [],
            estante: shelfName === 'Sin Asignar' ? '' : shelfName,
            fila: levelName,
            price: '', confirmPrice: '', stock: '',
            minStock: '',
            warranty: '', unitType: 'PZA',
            isBulk: false
        });
        setMediaUrlInput('');
        setPriceMismatchCount(0);
        setIsCreating(true);
        setStep(1);
    };

    const handleEditProduct = (p: Product) => {
        setEditingProductId(p.id);
        setPriceMismatchCount(0);
        const initialMedia = normalizeProductMedia(p);
        setFormData({
            name: p.name,
            category: p.category || '',
            description: p.description || '',
            barcode: p.barcode || '',
            image: p.image || getPrimaryProductImage(initialMedia),
            media: initialMedia,
            estante: p.location?.estante || '',
            fila: p.location?.fila || '',
            price: String(p.price),
            confirmPrice: String(p.price),
            stock: String(p.stock),
            minStock: p.minStock !== undefined && p.minStock !== null ? String(p.minStock) : '',
            warranty: (p as any).warranty || '',
            unitType: p.unitType || 'PZA',
            isBulk: !!p.isBulk
        });
        setMediaUrlInput('');
        setIsCreating(true);
        setStep(1);
    };

    const compressImageFileToWebP = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 900;
                    const MAX_HEIGHT = 900;
                    let width = img.width;
                    let height = img.height;

                    if (width > height && width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    } else if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/webp', 0.75);
                    URL.revokeObjectURL(objectUrl);
                    resolve(dataUrl);
                } catch (err) {
                    URL.revokeObjectURL(objectUrl);
                    reject(err);
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('No se pudo procesar la imagen seleccionada.'));
            };
            img.src = objectUrl;
        });

    const handleProductMediaFilesSelected = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const currentMedia = normalizeProductMediaList(formData.media);
        const remainingSlots = MAX_PRODUCT_MEDIA_ITEMS - currentMedia.length;

        if (remainingSlots <= 0) {
            toast.warning(`Máximo ${MAX_PRODUCT_MEDIA_ITEMS} archivos multimedia por producto (fotos o videos).`);
            return;
        }

        const selectedFiles = Array.from(files).slice(0, remainingSlots);
        setUploadingMedia(true);

        try {
            const addedItems: ProductMediaItem[] = [];
            for (const file of selectedFiles) {
                const isVideoOrGif = file.type.startsWith('video/') || file.type === 'image/gif';
                if (isVideoOrGif) {
                    const uploadBody = new FormData();
                    uploadBody.append('file', file);
                    const uploadRes = await fetch('/api/media/upload', {
                        method: 'POST',
                        headers: {
                            'x-user-role': profile?.role || 'superadmin',
                            'x-user-id': profile?.uid || 'local_owner',
                        },
                        credentials: 'include',
                        body: uploadBody,
                    });
                    const uploadData = await uploadRes.json().catch(() => null);
                    if (!uploadRes.ok || !uploadData?.success || !uploadData?.url) {
                        throw new Error(uploadData?.error || `No se pudo subir ${file.name}.`);
                    }
                    addedItems.push({
                        url: uploadData.url,
                        type: inferProductMediaType(file.type, uploadData.mediaType),
                    });
                } else if (file.type.startsWith('image/')) {
                    const dataUrl = await compressImageFileToWebP(file);
                    addedItems.push({ url: dataUrl, type: 'image' });
                } else {
                    toast.warning(`Formato no compatible en "${file.name}". Usa imágenes o videos MP4/WEBM/MOV.`);
                }
            }

            if (addedItems.length > 0) {
                setFormData((prev) => {
                    const nextMedia = normalizeProductMediaList([...prev.media, ...addedItems]);
                    return {
                        ...prev,
                        media: nextMedia,
                        image: getPrimaryProductImage(nextMedia, prev.image),
                    };
                });
                toast.success(`${addedItems.length} vista(s) multimedia agregada(s).`, '📸 Galería');
            }
        } catch (err: any) {
            toast.error(err?.message || 'Error al cargar el archivo multimedia.');
        } finally {
            setUploadingMedia(false);
        }
    };

    const handleAddProductMediaUrl = () => {
        const cleanUrl = mediaUrlInput.trim();
        if (!cleanUrl) return;
        const currentMedia = normalizeProductMediaList(formData.media);
        if (currentMedia.length >= MAX_PRODUCT_MEDIA_ITEMS) {
            toast.warning(`Máximo ${MAX_PRODUCT_MEDIA_ITEMS} vistas por producto.`);
            return;
        }
        const newItem: ProductMediaItem = {
            url: cleanUrl,
            type: inferProductMediaType(cleanUrl),
        };
        const nextMedia = normalizeProductMediaList([...currentMedia, newItem]);
        setFormData((prev) => ({
            ...prev,
            media: nextMedia,
            image: getPrimaryProductImage(nextMedia, prev.image),
        }));
        setMediaUrlInput('');
    };

    const handleRemoveMediaSlot = (indexToRemove: number) => {
        setFormData((prev) => {
            const nextMedia = prev.media.filter((_, idx) => idx !== indexToRemove);
            return {
                ...prev,
                media: nextMedia,
                image: getPrimaryProductImage(nextMedia),
            };
        });
    };

    const handleMakePrimaryMedia = (indexToPromote: number) => {
        setFormData((prev) => {
            const target = prev.media[indexToPromote];
            if (!target) return prev;
            const reordered = [target, ...prev.media.filter((_, idx) => idx !== indexToPromote)];
            return {
                ...prev,
                media: reordered,
                image: getPrimaryProductImage(reordered),
            };
        });
    };

    const handleSaveProduct = async () => {
        if (isReadOnly) {
            toast.warning('No se pueden guardar productos en Modo Demostración.', '🔒 Demo');
            return;
        }

        if (!formData.name || !formData.price || !formData.stock) {
            toast.warning('Nombre, Precio y Stock son obligatorios.');
            return;
        }

        // DOBLE CONFIRMACIÓN DE PRECIO PARA SUPERADMIN / ADMIN:
        // Evita el dedo chueco (ej. poner 134 en lugar de 184).
        // Error 1: aviso. Error 2: aviso. Al 3er intento o cuando sea correcto: sigue como si nada.
        if (profile?.role !== 'inventory') {
            const pVal = parseFloat(formData.price);
            const cVal = parseFloat((formData as any).confirmPrice);
            if (!Number.isFinite(cVal) || Math.abs(pVal - cVal) > 0.001) {
                const fails = priceMismatchCount + 1;
                setPriceMismatchCount(fails);
                if (fails === 1) {
                    toast.error(`Error 1: Los precios no coinciden ($${formData.price || '0'} vs $${(formData as any).confirmPrice || '0'}). Escríbelo idéntico dos veces.`, '🛑 Validador Anti-Dedos');
                } else if (fails === 2) {
                    toast.error(`Error 2: Siguen sin coincidir ($${formData.price} vs ${(formData as any).confirmPrice}). Verifica el precio oficial antes de guardar.`, '🛑 Validador Anti-Dedos');
                } else {
                    toast.warning(`Intento #${fails}: Cuando ingreses el precio idéntico en ambas casillas, el sistema continuará normalmente.`, '⚠️ Atención de Precios');
                }
                return;
            }
        }
        setPriceMismatchCount(0);

        if (profile?.role === 'inventory' && (!formData.estante || !formData.fila)) {
            toast.warning('Es obligatorio asignar Estante y Nivel/Fila para el producto.', '📦 Almacenista');
            return;
        }

        setLoading(true);
        acquireMutationLock();
        const productId = editingProductId || `PROD-${Date.now().toString().slice(-6)}`;
        
        const parsedMinStock = (formData as any).minStock !== '' && !isNaN(Number((formData as any).minStock))
            ? Number((formData as any).minStock)
            : undefined;

        const normalizedMedia = normalizeProductMedia({
            media: formData.media,
            image: formData.image,
        });
        const primaryImage =
            getPrimaryProductImage(normalizedMedia, formData.image) ||
            'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=400&q=80';

        const newProduct: Product = {
            id: productId,
            name: formData.name,
            category: formData.category || 'General',
            description: formData.description,
            barcode: formData.barcode,
            image: primaryImage,
            media: normalizedMedia,
            price: parseFloat(formData.price),
            stock: parseFloat(formData.stock), // Acepta decimales para granel
            minStock: parsedMinStock,
            location: {
                estante: formData.estante || 'PISO/GRANEL',
                fila: formData.fila || 'PISO/GRANEL'
            },
            orderIndex: editingProductId
                ? localProducts.find(product => product.id === editingProductId)?.orderIndex || 0
                : Math.max(-1, ...localProducts.map(product => product.orderIndex || 0)) + 1,
            warranty: formData.warranty || '',
            unitType: (formData as any).unitType || 'PZA',
            isBulk: !!(formData as any).isBulk
        };

        try {
            const dataToSave: any = {
                ...newProduct,
                media: normalizedMedia,
                confirmPrice: (formData as any).confirmPrice,
                updatedAt: new Date().toISOString()
            };
            if (!editingProductId) {
                dataToSave.createdAt = new Date().toISOString();
            }

            // ─── LOCAL EDGE API SYNC ───
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': profile?.role || 'superadmin',
                    'x-user-id': profile?.uid || 'local_owner'
                },
                credentials: 'include',
                body: JSON.stringify(dataToSave)
            });

            const result = await res.json().catch(() => null);
            if (!res.ok || !result?.success) {
                throw new Error(result?.error || 'Error guardando en Edge API local');
            }

            const savedProduct: Product = {
                ...result.data,
                minStock: result.data.minStock ?? newProduct.minStock,
                location: {
                    estante: result.data.estante || newProduct.location?.estante || '',
                    fila: result.data.fila || newProduct.location?.fila || ''
                },
                orderIndex: result.data.orderIndex ?? newProduct.orderIndex
            };
            const store = useERPStore.getState();
            const nextProducts = [...store.products.filter(product => product.id !== productId), savedProduct];
            store.setProducts(nextProducts);
            setLocalProducts(previous => [...previous.filter(product => product.id !== productId), savedProduct]);
            syncCachedProducts(nextProducts);
            setSearchTerm('');
            setActiveTab('catalog');

            await logAudit({
                type: 'CONFIG_UPDATE',
                userId: profile?.uid || 'SYSTEM',
                userName: profile?.displayName || 'Almacenista',
                userRole: profile?.role || 'almacen',
                description: editingProductId 
                    ? `Producto Modificado: ${newProduct.name} (${newProduct.stock} uds, mín: ${newProduct.minStock ?? 'N/A'})`
                    : `Nuevo Producto Ingresado: ${newProduct.name} (${newProduct.stock} uds, mín: ${newProduct.minStock ?? 'N/A'})`,
                metadata: { productId, action: editingProductId ? 'update_product' : 'create_product' }
            });

            broadcastSync({ action: 'PRODUCT_SAVED', id: productId, scope: 'products', skipServerPost: true });
            // Disparar sincronización en tiempo real a otras pestañas/dispositivos
            if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                (window as any).__inventorySocket.emit('sync_db_event', { action: 'PRODUCT_SAVED', id: productId });
            }

            toast.success(editingProductId ? 'Producto actualizado con éxito.' : 'Producto registrado con éxito.', '✅ Inventario');
            setIsCreating(false);
            setEditingProductId(null);
            setStep(1);
            setMediaUrlInput('');
            setFormData({ name: '', category: '', description: '', barcode: '', image: '', media: [], estante: '', fila: '', price: '', confirmPrice: '', stock: '', minStock: '', warranty: '', unitType: 'PZA', isBulk: false });
        } catch (error: any) {
            console.error(error);
            toast.error('Error al guardar el producto: ' + (error.message || 'Error desconocido'), 'Error');
        } finally {
            setLoading(false);
            releaseMutationLock();
        }
    };

    const handleUpdateProductThreshold = async (productId: string, newThreshold: number) => {
        if (isReadOnly) {
            toast.warning('Operación no permitida en Modo Demostración.', '🔒 Demo');
            return;
        }
        acquireMutationLock();
        try {
            const res = await fetch('/api/products', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': profile?.role || 'superadmin',
                    'x-user-id': profile?.uid || 'local_owner'
                },
                credentials: 'include',
                body: JSON.stringify({
                    id: productId,
                    minStock: newThreshold
                })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'Error al actualizar el umbral mínimo');
            }

            // Sincronizar estado local y store ERP
            setLocalProducts(prev => prev.map(p => p.id === productId ? { ...p, minStock: newThreshold } : p));
            const store = useERPStore.getState();
            const nextProducts = store.products.map(p => p.id === productId ? { ...p, minStock: newThreshold } : p);
            store.setProducts(nextProducts);
            syncCachedProducts(nextProducts);

            toast.success(`Umbral mínimo actualizado a ${newThreshold} uds`);
            broadcastSync({ action: 'PRODUCT_SAVED', id: productId, scope: 'products', skipServerPost: true });
            if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                (window as any).__inventorySocket.emit('sync_db_event', { action: 'PRODUCT_SAVED', id: productId });
            }
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Error al actualizar umbral de producto');
        } finally {
            releaseMutationLock();
        }
    };

    const fetchRestockHistory = async () => {
        setRestockHistoryLoading(true);
        try {
            const res = await fetch('/api/inventory/restock-history?limit=120', {
                headers: {
                    'x-user-role': profile?.role || 'superadmin',
                    'x-user-id': profile?.uid || 'local_owner',
                },
                credentials: 'include',
            });
            const data = await res.json().catch(() => null);
            if (res.ok && data?.success && Array.isArray(data.data)) {
                setRestockHistory(data.data);
            }
        } catch (err) {
            console.warn('[RestockHistory] Error cargando auditoría:', err);
        } finally {
            setRestockHistoryLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'restock' || restockTargetProduct) {
            fetchRestockHistory();
        }
    }, [activeTab, restockTargetProduct?.id]);

    const handleConfirmQuickRestock = async ({
        product,
        qtyToAdd,
        confirmQtyToAdd,
        notes,
    }: {
        product: Product;
        qtyToAdd: number;
        confirmQtyToAdd: number;
        notes: string;
    }) => {
        if (isReadOnly) {
            toast.warning('Operación no permitida en Modo Demostración.', '🔒 Demo');
            throw new Error('Operación no permitida en Modo Demostración.');
        }

        const previousStock = Number(product.stock) || 0;
        const operatorName = profile?.displayName || profile?.uid || 'Operador Almacén';
        const effectiveMin = getProductEffectiveThreshold(product, thresholdConfig);

        acquireMutationLock();
        try {
            const res = await fetch('/api/products', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': profile?.role || 'superadmin',
                    'x-user-id': profile?.uid || 'local_owner',
                },
                credentials: 'include',
                body: JSON.stringify({
                    id: product.id,
                    stockIncrement: qtyToAdd,
                    confirmStockIncrement: confirmQtyToAdd,
                    unitType: product.unitType || 'PZA',
                    isBulk: Boolean(product.isBulk),
                    minStock: effectiveMin,
                    mode: 'quick_restock',
                    notes,
                    operatorName,
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success || !data?.data) {
                throw new Error(data?.error || 'No se pudo aplicar la recarga de piezas.');
            }

            const updatedProduct: Product = {
                ...product,
                ...data.data,
                stock: Number(data.data.stock),
                location: {
                    estante: data.data.estante ?? product.location?.estante ?? '',
                    fila: data.data.fila ?? product.location?.fila ?? '',
                },
            };

            setLocalProducts((prev) => prev.map((p) => (p.id === product.id ? updatedProduct : p)));
            const store = useERPStore.getState();
            const nextProducts = store.products.map((p) => (p.id === product.id ? updatedProduct : p));
            store.setProducts(nextProducts);
            syncCachedProducts(nextProducts);

            if (data.restockAudit) {
                setRestockHistory((prev) => [data.restockAudit as RestockAuditEntry, ...prev.filter((x) => x.id !== data.restockAudit.id)]);
            }

            await logAudit({
                type: 'STOCK_UPDATE',
                userId: profile?.uid || 'SYSTEM',
                userName: operatorName,
                userRole: profile?.role || 'inventory',
                description: `Recarga rápida de stock: ${product.name} (${previousStock} + ${qtyToAdd} = ${updatedProduct.stock} ${product.unitType || 'PZA'})${notes ? ` · Nota: ${notes}` : ''}`,
                metadata: {
                    productId: product.id,
                    productName: product.name,
                    previousStock,
                    stockIncrement: qtyToAdd,
                    newStock: updatedProduct.stock,
                    doubleConfirmed: true,
                    notes,
                },
            });

            broadcastSync({ action: 'PRODUCT_UPDATED', id: product.id, scope: 'products', skipServerPost: true });
            if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                (window as any).__inventorySocket.emit('sync_db_event', { action: 'PRODUCT_SAVED', id: product.id });
            }

            toast.success(
                `${product.name}: ${previousStock} + ${qtyToAdd} = ${updatedProduct.stock} ${product.unitType || 'PZA'}`,
                '✅ Stock Recargado y Auditado'
            );
        } finally {
            releaseMutationLock();
        }
    };

    const handleDeleteProduct = async (productId: string, productName: string) => {
        if (isReadOnly) {
            toast.warning('Operación no permitida en Modo Demostración.', '🔒 Demo');
            return;
        }
        if (profile?.role !== 'superadmin' && profile?.role !== 'inventory') {
            toast.error('No tienes permisos para mover productos a la papelera.');
            return;
        }
        
        if (confirm(`¿Mover "${productName}" a la papelera? Podrás restaurarlo después. El historial de ventas se conservará.`)) {
            try {
                const res = await fetch(`/api/products?id=${encodeURIComponent(productId)}`, {
                    method: 'DELETE',
                    headers: {
                        'x-user-role': profile?.role || 'superadmin',
                        'x-user-id': profile?.uid || 'local_owner'
                    },
                    credentials: 'include'
                });
                const result = await res.json().catch(() => null);
                if (!res.ok || !result?.success) {
                    throw new Error(result?.error || 'No se pudo eliminar el producto');
                }

                setLocalProducts(previous => previous.filter(product => product.id !== productId));
                const store = useERPStore.getState();
                store.setProducts(store.products.filter(product => product.id !== productId));
                if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                    (window as any).__inventorySocket.emit('sync_db_event', { action: 'PRODUCT_ARCHIVED', id: productId });
                }

                await logAudit({
                    type: 'SECURITY_ALERT',
                    userId: profile?.uid || 'SYSTEM',
                    userName: profile?.displayName || 'Dueño',
                    userRole: profile?.role || 'superadmin',
                    description: `Producto movido a la papelera: ${productName}`,
                    metadata: { productId, action: 'archive_product' }
                });
                
                toast.success('Producto enviado a la papelera. Puedes restaurarlo desde la pestaña Papelera.', 'Papelera');
                
                if (editingProductId === productId) {
                    setIsCreating(false);
                    setEditingProductId(null);
                }
            } catch (err) {
                console.error(err);
                toast.error(err instanceof Error ? err.message : 'Error al enviar el producto a la papelera.');
            }
        }
    };

    const handleRestoreProduct = async (product: Product) => {
        try {
            const response = await fetch('/api/products', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': profile?.role || 'superadmin',
                    'x-user-id': profile?.uid || 'local_owner'
                },
                credentials: 'include',
                body: JSON.stringify({ id: product.id, restore: true })
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) throw new Error(result?.error || 'No se pudo restaurar el producto.');

            const restored: Product = {
                ...result.data,
                location: { estante: result.data.estante || '', fila: result.data.fila || '' }
            };
            const store = useERPStore.getState();
            store.setProducts([...store.products.filter(item => item.id !== restored.id), restored]);
            setLocalProducts(previous => [...previous.filter(item => item.id !== restored.id), restored]);
            setTrashedProducts(previous => previous.filter(item => item.id !== restored.id));
            if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                (window as any).__inventorySocket.emit('sync_db_event', { action: 'PRODUCT_RESTORED', id: restored.id });
            }
            toast.success(`Producto restaurado: ${restored.name}.`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo restaurar el producto.');
        }
    };

    const handleToggleProductVisibility = async (
        productId: string,
        patch: { hidePublicStock?: boolean; hideFromPublic?: boolean }
    ) => {
        if (!isSuperAdmin) {
            toast.error('Solo el SuperAdmin puede modificar la visibilidad pública.');
            return;
        }
        if (isReadOnly) {
            toast.warning('Operación no permitida en Modo Demostración.', '🔒 Demo');
            return;
        }
        setVisibilityBusyId(productId);
        acquireMutationLock();
        try {
            const res = await fetch('/api/products', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': profile?.role || 'superadmin',
                    'x-user-id': profile?.uid || 'local_owner',
                },
                credentials: 'include',
                body: JSON.stringify({ id: productId, ...patch }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'No se pudo actualizar la visibilidad.');
            }
            const applyPatch = (p: Product): Product =>
                p.id === productId
                    ? {
                          ...p,
                          ...(typeof patch.hidePublicStock === 'boolean' ? { hidePublicStock: patch.hidePublicStock } : {}),
                          ...(typeof patch.hideFromPublic === 'boolean' ? { hideFromPublic: patch.hideFromPublic } : {}),
                      }
                    : p;

            setLocalProducts((prev) => prev.map(applyPatch));
            const store = useERPStore.getState();
            const nextProducts = store.products.map(applyPatch);
            store.setProducts(nextProducts);
            syncCachedProducts(nextProducts);
            broadcastSync({ action: 'PRODUCT_UPDATED', id: productId, scope: 'products', skipServerPost: true });
            toast.success('Visibilidad pública actualizada.');
        } catch (err: any) {
            toast.error(err?.message || 'Error cambiando visibilidad pública.');
        } finally {
            setVisibilityBusyId(null);
            releaseMutationLock();
        }
    };

    const handleBatchVisibility = async (patch: { hidePublicStock?: boolean; hideFromPublic?: boolean }) => {
        if (!isSuperAdmin) return;
        if (isReadOnly) {
            toast.warning('Operación no permitida en Modo Demostración.', '🔒 Demo');
            return;
        }
        const activeIds = selectedProductIds.filter((id) => localProducts.some((p) => p.id === id));
        if (activeIds.length === 0) return;

        setBulkActionBusy(true);
        acquireMutationLock();
        try {
            const res = await fetch('/api/products', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': profile?.role || 'superadmin',
                    'x-user-id': profile?.uid || 'local_owner',
                },
                credentials: 'include',
                body: JSON.stringify({
                    batchVisibility: {
                        ids: activeIds,
                        ...patch,
                    },
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'No se pudo actualizar el lote.');
            }
            const selectedSet = new Set(activeIds);
            const applyBatch = (p: Product): Product =>
                selectedSet.has(p.id)
                    ? {
                          ...p,
                          ...(typeof patch.hidePublicStock === 'boolean' ? { hidePublicStock: patch.hidePublicStock } : {}),
                          ...(typeof patch.hideFromPublic === 'boolean' ? { hideFromPublic: patch.hideFromPublic } : {}),
                      }
                    : p;

            setLocalProducts((prev) => prev.map(applyBatch));
            const store = useERPStore.getState();
            const nextProducts = store.products.map(applyBatch);
            store.setProducts(nextProducts);
            syncCachedProducts(nextProducts);
            broadcastSync({ action: 'PRODUCTS_VISIBILITY_UPDATED', scope: 'products', skipServerPost: true });
            toast.success(`Visibilidad aplicada a ${activeIds.length} producto(s).`);
        } catch (err: any) {
            toast.error(err?.message || 'Error en configuración masiva.');
        } finally {
            setBulkActionBusy(false);
            releaseMutationLock();
        }
    };

    const handleBatchArchiveSelected = async () => {
        if (!isSuperAdmin) return;
        if (isReadOnly) {
            toast.warning('Operación no permitida en Modo Demostración.', '🔒 Demo');
            return;
        }
        const activeIds = selectedProductIds.filter((id) => localProducts.some((p) => p.id === id));
        if (activeIds.length === 0) return;

        setBulkActionBusy(true);
        acquireMutationLock();
        try {
            const res = await fetch('/api/products', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': profile?.role || 'superadmin',
                    'x-user-id': profile?.uid || 'local_owner',
                },
                credentials: 'include',
                body: JSON.stringify({ batchArchive: { ids: activeIds } }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'No se pudieron mover a la papelera.');
            }
            const archivedSet = new Set(activeIds);
            setLocalProducts((prev) => prev.filter((p) => !archivedSet.has(p.id)));
            const store = useERPStore.getState();
            const nextProducts = store.products.filter((p) => !archivedSet.has(p.id));
            store.setProducts(nextProducts);
            syncCachedProducts(nextProducts);
            setSelectedProductIds([]);
            setBulkTrashConfirmOpen(false);
            broadcastSync({ action: 'PRODUCTS_BATCH_ARCHIVED', scope: 'products', skipServerPost: true });
            toast.success(`${activeIds.length} producto(s) movidos a la papelera.`);
        } catch (err: any) {
            toast.error(err?.message || 'Error al mover lote a la papelera.');
        } finally {
            setBulkActionBusy(false);
            releaseMutationLock();
        }
    };

    const handlePermanentDeleteProduct = async (product: Product) => {
        if (profile?.role !== 'superadmin') return;
        if (!confirm(`¿Borrar definitivamente "${product.name}"? Esta acción no se puede deshacer.`)) return;
        try {
            const response = await fetch(`/api/products?id=${encodeURIComponent(product.id)}&permanent=true`, {
                method: 'DELETE',
                headers: {
                    'x-user-role': profile?.role || 'superadmin',
                    'x-user-id': profile?.uid || 'local_owner'
                },
                credentials: 'include'
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) throw new Error(result?.error || 'No se pudo borrar definitivamente.');
            setTrashedProducts(previous => previous.filter(item => item.id !== product.id));
            toast.success(`Producto eliminado definitivamente: ${product.name}.`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo borrar definitivamente.');
        }
    };

    const handleScanSuccess = (code: string) => {
        setIsScannerOpen(false);
        const cleanCode = code.trim();
        const p = findProductByBarcodeOrCode(localProducts, cleanCode);

        // Si el formulario está abierto en Paso 2 (Identidad), rellena el código de barras original directamente
        if (isCreating && step === 2 && !p) {
            setFormData((prev) => ({ ...prev, barcode: cleanCode }));
            toast.success(`Código de barras capturado: ${cleanCode}`, '📦 Escáner');
            return;
        }

        if (p) {
            if (activeTab === 'restock') {
                setRestockSearch(p.barcode || cleanCode);
                setRestockTargetProduct(p);
                toast.info(`Producto localizado para recarga rápida: ${p.name}`, `✅ ${p.name}`);
                return;
            }

            setSearchTerm(p.barcode || cleanCode);
            const estante = (p.location?.estante || 'GENERAL').toUpperCase().trim();
            setExpandedEstantes(prev => ({ ...prev, [estante]: true }));
            setHighlightedProductId(p.id);
            setTimeout(() => {
                const element = document.getElementById(`product-${p.id}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
            setTimeout(() => {
                setHighlightedProductId(null);
            }, 6000);

            handleEditProduct(p);
            setStep(3);
            toast.info(`Listo para actualizar stock de ${p.name}.`, `✅ ${p.name}`);
        } else {
            setEditingProductId(null);
            setFormData({
                name: '', category: '', description: '',
                barcode: cleanCode, image: '', media: [],
                estante: '', fila: '',
                price: '', confirmPrice: '', stock: '',
                minStock: '',
                warranty: '', unitType: 'PZA', isBulk: false
            });
            setMediaUrlInput('');
            setIsCreating(true);
            setStep(1);
            toast.info(`Código "${cleanCode}" no registrado. Completa el formulario de nuevo ingreso.`, '🔍 Nuevo producto');
        }
    };

    // Escáner láser nativo para Almacén (pistola hardware)
    useBarcodeScanner(handleScanSuccess);

    // Filtrar y agrupar productos por Estante (Folder) incluyendo búsqueda por código de barras original EAN/UPC
    const filteredProducts = localProducts.filter(product => matchesProductSearch(product, searchTerm));

    const estantesMap = filteredProducts.reduce((acc: Record<string, Product[]>, p) => {
        const estante = (p.location?.estante || 'GENERAL').toUpperCase().trim();
        if (!acc[estante]) acc[estante] = [];
        acc[estante].push(p);
        return acc;
    }, {});
    Object.values(estantesMap).forEach(items => items.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)));

    const allEstantes = Array.from(new Set([
        ...Object.keys(estantesMap),
        ...customEstantes.map(e => e.toUpperCase().trim())
    ])).sort();

    const toggleEstante = (estante: string) => {
        setExpandedEstantes(prev => ({ ...prev, [estante]: !prev[estante] }));
    };

    const pendingPrepOrders = (orders || []).filter(o => {
        const isNotLoaded = !o.isLoaded && !['DELIVERED', 'COMPLETED', 'cancelled', 'refunded'].includes(o.status);
        if (onlyMyOrders && o.loadedByUid && o.loadedByUid !== profile?.uid) return false;
        return isNotLoaded;
    }).sort((a, b) => {
        const aMine = a.loadedByUid === profile?.uid ? 0 : 1;
        const bMine = b.loadedByUid === profile?.uid ? 0 : 1;
        if (aMine !== bMine) return aMine - bMine;
        const aHold = a.status === 'EN_ESPERA' ? 0 : 1;
        const bHold = b.status === 'EN_ESPERA' ? 0 : 1;
        return aHold - bHold;
    });

    const applyServerOrderUpdate = (orderId: string, updatedOrder?: any) => {
        if (!updatedOrder) return;
        const st = useERPStore.getState();
        st.setOrders(st.orders.map((o) => (o.id === orderId ? { ...o, ...updatedOrder } : o)));
    };

    const handleStartPicking = async (order: any) => {
        try {
            if (!order.loadedByUid || order.loadedByUid !== profile?.uid) {
                await startLoading(order.id);
            } else if (order.status === 'EN_ESPERA') {
                const res = await fetch('/api/orders', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: order.id, action: 'resume_preparation' })
                });
                const data = await res.json().catch(() => null);
                applyServerOrderUpdate(order.id, data?.order);
            }
            setPickingOrder(order);
        } catch (err: any) {
            toast.error(err.message || 'No se pudo tomar el pedido. Puede que otro operador ya lo haya tomado.');
        }
    };

    const handleHoldOrder = async (order: any) => {
        setBusyOrderId(order.id);
        try {
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: order.id,
                    action: 'hold_preparation',
                    reason: 'En espera temporal en almacén'
                })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'No se pudo poner en espera');
            }
            applyServerOrderUpdate(order.id, data.order);
            broadcastSync({ action: 'ORDER_HOLD_UPDATED', id: order.id });
            toast.info(`Pedido #${order.id.slice(-6).toUpperCase()} en pausa operativa (En Espera).`);
        } catch (err: any) {
            toast.error(err?.message || 'Error al poner en espera');
        } finally {
            setBusyOrderId(null);
        }
    };

    const handleResumeOrder = async (order: any) => {
        setBusyOrderId(order.id);
        try {
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: order.id, action: 'resume_preparation' })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'No se pudo retomar el pedido');
            }
            applyServerOrderUpdate(order.id, data.order);
            broadcastSync({ action: 'ORDER_RESUMED', id: order.id });
            setPickingOrder({ ...order, status: data.order?.status || 'IN_PROGRESS' });
        } catch (err: any) {
            toast.error(err?.message || 'Error al retomar');
        } finally {
            setBusyOrderId(null);
        }
    };

    const handleUpdateOrderStatus = async (orderId: string, nextStatus: string) => {
        setBusyOrderId(orderId);
        try {
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    id: orderId,
                    action: 'update_order_status',
                    status: nextStatus
                })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'No se pudo actualizar el estado del pedido');
            }
            applyServerOrderUpdate(orderId, data.order);
            broadcastSync({ action: 'ORDER_STATUS_UPDATED', id: orderId });
            toast.success(`Pedido #${orderId.slice(-6).toUpperCase()} → ${nextStatus}`);
        } catch (err: any) {
            toast.error(err?.message || 'Error al actualizar estado');
        } finally {
            setBusyOrderId(null);
        }
    };

    const handleReleaseOrderClaim = async (orderId: string) => {
        setBusyOrderId(orderId);
        try {
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    id: orderId,
                    action: 'release_claim',
                    slot: 'loading'
                })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'No se pudo liberar el pedido');
            }
            applyServerOrderUpdate(orderId, data.order);
            broadcastSync({ action: 'ORDER_CLAIM_RELEASED', id: orderId });
            toast.info(`Pedido #${orderId.slice(-6).toUpperCase()} liberado en Pizarra.`);
        } catch (err: any) {
            toast.error(err?.message || 'Error al liberar pedido');
        } finally {
            setBusyOrderId(null);
        }
    };

    const handleAuthorizedAbandon = async (authResult: { pin: string; reason?: string; verifiedBy: { uid: string; name: string; role: string } }) => {
        if (!abandonTargetOrder) return;
        const target = abandonTargetOrder;
        const res = await fetch('/api/orders', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: target.id,
                action: 'abandon_preparation',
                verificationPin: authResult.pin,
                reason: authResult.reason || 'Liberado desde tablero de almacén'
            })
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
            throw new Error(data?.error || 'No se pudo liberar el pedido');
        }
        clearPickingDraft(target.id, 'picking');
        applyServerOrderUpdate(target.id, data.order);
        broadcastSync({ action: 'ORDER_ABANDONED', id: target.id });
        toast.warning(`Pedido #${target.id.slice(-6).toUpperCase()} liberado por ${authResult.verifiedBy.name}.`);
        setAbandonTargetOrder(null);
    };

    const cancelledRestockOrders = (orders || []).filter(o => 
        (o.status === 'cancelled' || o.status === 'refunded') && 
        o.rejectionReason !== 'CANCELADA_STOCK_RESTITUIDO'
    );

    const finalizeOrderAndNotify = async (orderId: string, targetLocation: 'caja' | 'carga' = 'caja') => {
        try {
            await completeLoading(orderId, targetLocation);
            const locationName = targetLocation === 'carga' ? 'Bahía de Carga / Patio' : 'Caja / Mostrador';
            toast.success(`✅ Pedido ${orderId} surtido y marcado LISTO en [${locationName}].`);
        } catch (e: any) {
            toast.error(e?.message || 'Error al completar el pedido.');
        }
    };

    return (
        <div className="relative min-h-[100dvh] bg-slate-950 text-white p-4 md:p-8">
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/40 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-900/30 blur-[120px] rounded-full"></div>
            </div>
            
            <div className="relative z-10 max-w-7xl mx-auto">
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-bold uppercase text-xs tracking-wider mb-4 transition-colors drop-shadow-[0_0_5px_rgba(0,242,255,0.5)]">
                    <ArrowLeft size={16} /> Volver al Tablero
                </Link>
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3 bg-slate-900/70 backdrop-blur-md px-4 py-3 rounded-xl shadow-lg border border-cyan-500/30">
                    <div className="flex items-center gap-3">
                        <div className="bg-cyan-900/40 p-2.5 rounded-lg text-cyan-400 border border-cyan-500/50 shadow-[0_0_12px_rgba(0,242,255,0.25)] shrink-0">
                            <Package size={22} />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight leading-none">ALMACÉN</h1>
                            <p className="text-cyan-400 font-bold uppercase text-[10px] tracking-widest mt-1">Estantes y Existencias</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                        <button 
                            onClick={() => {
                                const rows = localProducts.map(p => ({
                                    'ID': p.id,
                                    'Nombre': p.name,
                                    'Categoría': p.category || 'General',
                                    'Precio ($)': p.price,
                                    'Stock Disponible': p.stock,
                                    'Código de Barras': p.barcode || 'N/A',
                                    'Estante': p.location?.estante || p.estante || 'Sin Asignar',
                                    'Fila / Nivel': p.location?.fila || p.fila || 'N/A'
                                }));
                                exportToExcel('Inventario_Almacen', rows);
                            }}
                            className="bg-emerald-600/20 text-emerald-300 px-3.5 py-2 rounded-lg font-bold uppercase text-xs tracking-wider flex items-center gap-1.5 hover:bg-emerald-600/30 transition-all border border-emerald-500/40 active:scale-95"
                            title="Exportar a Excel"
                        >
                            <FileSpreadsheet size={14} /> Excel
                        </button>
                        
                        <ImportCSVButton onSuccess={() => {
                            window.location.reload();
                        }} />

                        <button 
                            onClick={() => setIsScannerOpen(true)}
                            className="bg-cyan-600/20 text-cyan-300 px-3.5 py-2 rounded-lg font-bold uppercase text-xs tracking-wider flex items-center gap-1.5 hover:bg-cyan-600/30 transition-all border border-cyan-500/40 active:scale-95"
                            title="Escanear con Cámara o Láser"
                        >
                            <QrCode size={14} /> Escanear
                        </button>
                        
                        {!isCreating && (
                            <button 
                                onClick={() => { setEditingProductId(null); setIsCreating(true); setStep(1); }}
                                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-lg font-black uppercase text-xs tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                            >
                                <Plus size={15} /> Nuevo
                            </button>
                        )}
                    </div>
                </header>

                <AnimatePresence mode="wait">
                    {isCreating ? (
                        <motion.div 
                            key="create-form"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-slate-800/80 rounded-sm p-8 border border-slate-700/50 shadow-xl max-w-4xl mx-auto"
                        >
                            <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-700/50">
                                <div>
                                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                                        {editingProductId ? 'Modificar Ficha de Producto' : 'Alta de Producto'}
                                    </h2>
                                    {editingProductId && (
                                        <button 
                                            onClick={() => handleDeleteProduct(editingProductId, formData.name)}
                                            className="mt-2 flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={14} /> Marcar como Inexistente / Eliminar
                                        </button>
                                    )}
                                </div>
                                <button onClick={() => { setIsCreating(false); setEditingProductId(null); }} className="text-slate-400 hover:text-red-500 transition-colors">
                                    <X size={28} />
                                </button>
                            </div>

                            {/* STEPS INDICATOR */}
                            <div className="flex items-center justify-between mb-12 relative">
                                <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 z-0"></div>
                                <div className="absolute top-1/2 left-0 h-1 bg-[#0ea5e9] -translate-y-1/2 z-0 transition-all duration-500" style={{ width: `${(step - 1) * 50}%` }}></div>
                                
                                {[1, 2, 3].map(s => (
                                    <div key={s} className="relative z-10 flex flex-col items-center gap-2">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg transition-all duration-300 ${step >= s ? 'bg-[#0ea5e9] text-white shadow-lg shadow-blue-500/30' : 'bg-slate-200 text-slate-400'}`}>
                                            {s}
                                        </div>
                                        <span className={`text-xs font-bold uppercase tracking-widest ${step >= s ? 'text-[#0ea5e9]' : 'text-slate-400'}`}>
                                            {s === 1 ? 'Ficha' : s === 2 ? 'Identidad' : 'Stock & Ubicación'}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* STEP 1: FICHA TÉCNICA */}
                            {step === 1 && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                    <div>
                                        <label className="text-xs font-black text-white uppercase tracking-widest mb-2 block">Nombre del Producto *</label>
                                        <input type="text" disabled={profile?.role === 'inventory' && !!editingProductId} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl font-medium text-white placeholder-slate-500 focus:border-[#0ea5e9] outline-none transition-all disabled:opacity-50" placeholder="Ej. Cemento Cruz Azul 50kg" />
                                    </div>
                                    <div>
                                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Categoría</label>
                                            <div className="flex items-center gap-2">
                                                {classificationSource && (
                                                    <HybridInferenceBadge
                                                        source={classificationSource.source}
                                                        model={classificationSource.model}
                                                        latencyMs={classificationSource.latencyMs}
                                                        compact
                                                    />
                                                )}
                                                <button
                                                    type="button"
                                                    disabled={classifyingHybrid || !formData.name.trim()}
                                                    onClick={async () => {
                                                        if (!formData.name.trim()) return;
                                                        setClassifyingHybrid(true);
                                                        try {
                                                            const res = await runHybridProductClassification(formData.name);
                                                            setFormData((prev) => ({
                                                                ...prev,
                                                                category: res.category,
                                                                description:
                                                                    prev.description.trim()
                                                                        ? prev.description
                                                                        : `${res.subcategory} · Material: ${res.material} · Medida: ${res.measure}`,
                                                            }));
                                                            setClassificationSource({
                                                                source: res.source,
                                                                model: res.model,
                                                                latencyMs: res.latencyMs,
                                                            });
                                                            toast.success(`Categoría sugerida: ${res.category}`);
                                                        } finally {
                                                            setClassifyingHybrid(false);
                                                        }
                                                    }}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-950/40 px-2.5 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-900/50 cursor-pointer disabled:opacity-50"
                                                >
                                                    {classifyingHybrid ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                                    {classifyingHybrid ? 'Clasificando...' : 'Sugerir con IA Híbrida'}
                                                </button>
                                            </div>
                                        </div>
                                        <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl font-medium text-white placeholder-slate-500 focus:border-[#0ea5e9] outline-none transition-all" placeholder="Ej. Materiales de Construcción" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ficha Técnica / Descripción / Especificaciones</label>
                                        <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl font-medium text-white placeholder-slate-500 focus:border-[#0ea5e9] outline-none transition-all min-h-[100px]" placeholder="Detalles técnicos, medidas, peso..."></textarea>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Garantía</label>
                                        <input type="text" value={formData.warranty} onChange={e => setFormData({...formData, warranty: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl font-medium text-white placeholder-slate-500 focus:border-[#0ea5e9] outline-none transition-all" placeholder="Ej. Garantía de 1 año con fabricante" />
                                    </div>
                                </motion.div>
                            )}

                            {/* STEP 2: IDENTIDAD Y MULTIMEDIA (HASTA 4 VISTAS: FOTOS / GIF / VIDEO) */}
                            {step === 2 && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                    <div className="bg-blue-900/20 border border-blue-500/20 p-3.5 rounded-xl flex flex-col md:flex-row gap-3 items-center">
                                        <div className="bg-slate-800/80 p-3.5 rounded-xl shadow-lg text-blue-400 shrink-0"><Barcode size={34}/></div>
                                        <div className="flex-1 w-full">
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                                Código de Barras Original / Serial (EAN-13, UPC, Code128)
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={formData.barcode}
                                                    onChange={e => setFormData({...formData, barcode: e.target.value})}
                                                    className="flex-1 bg-slate-900 border border-slate-700 p-3.5 rounded-xl font-mono font-medium text-white placeholder-slate-500 focus:border-[#0ea5e9] outline-none transition-all"
                                                    placeholder="Escanea el código de fábrica o escríbelo"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setIsScannerOpen(true)}
                                                    className="min-h-[46px] px-4 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                                                >
                                                    <QrCode size={16} /> Escanear
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-900/60 border border-slate-700/60 p-4 rounded-xl space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className="bg-slate-800 p-2.5 rounded-xl text-cyan-400">
                                                    <Camera size={22}/>
                                                </div>
                                                <div>
                                                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                                                        Galería Multimedia del Producto (Fotos, GIF o Video)
                                                    </h3>
                                                    <p className="text-[11px] text-slate-400">
                                                        Carga hasta {MAX_PRODUCT_MEDIA_ITEMS} vistas distintas (ángulos, uso o video corto MP4/WEBM).
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-slate-800 text-cyan-300 border border-cyan-500/30 tabular-nums">
                                                {formData.media.length} / {MAX_PRODUCT_MEDIA_ITEMS} vistas
                                            </span>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-2.5">
                                            <label className={`flex-1 min-h-[46px] px-4 py-2.5 rounded-xl border border-dashed flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                                                formData.media.length >= MAX_PRODUCT_MEDIA_ITEMS || uploadingMedia
                                                    ? 'bg-slate-800/40 border-slate-700 text-slate-500 cursor-not-allowed'
                                                    : 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-400/50 text-sky-300 cursor-pointer'
                                            }`}>
                                                {uploadingMedia ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                                <span>
                                                    {uploadingMedia
                                                        ? 'Subiendo archivo multimedia...'
                                                        : formData.media.length >= MAX_PRODUCT_MEDIA_ITEMS
                                                            ? 'Límite de 4 vistas alcanzado'
                                                            : 'Subir Fotos o Video (hasta 4 vistas)'}
                                                </span>
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept="image/*,video/mp4,video/webm,video/quicktime"
                                                    disabled={formData.media.length >= MAX_PRODUCT_MEDIA_ITEMS || uploadingMedia}
                                                    onChange={(e) => {
                                                        void handleProductMediaFilesSelected(e.target.files);
                                                        e.currentTarget.value = '';
                                                    }}
                                                    className="sr-only"
                                                />
                                            </label>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <div className="relative flex-1">
                                                <Link2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="url"
                                                    value={mediaUrlInput}
                                                    onChange={(e) => setMediaUrlInput(e.target.value)}
                                                    disabled={formData.media.length >= MAX_PRODUCT_MEDIA_ITEMS}
                                                    placeholder="O pega URL directa de foto o video (.jpg, .png, .mp4)..."
                                                    className="w-full min-h-[42px] pl-10 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-[#0ea5e9] disabled:opacity-50"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleAddProductMediaUrl}
                                                disabled={!mediaUrlInput.trim() || formData.media.length >= MAX_PRODUCT_MEDIA_ITEMS}
                                                className="min-h-[42px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-bold border border-white/10 cursor-pointer shrink-0"
                                            >
                                                + Agregar URL
                                            </button>
                                        </div>

                                        {formData.media.length > 0 ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                                                {formData.media.map((item, idx) => (
                                                    <div
                                                        key={`${item.url}-${idx}`}
                                                        className={`relative rounded-xl overflow-hidden border bg-slate-950 flex flex-col ${
                                                            idx === 0 ? 'border-emerald-400 ring-2 ring-emerald-500/20' : 'border-slate-700'
                                                        }`}
                                                    >
                                                        <div className="relative h-28 bg-black flex items-center justify-center overflow-hidden">
                                                            {item.type === 'video' ? (
                                                                <video
                                                                    src={item.url}
                                                                    muted
                                                                    loop
                                                                    playsInline
                                                                    autoPlay
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                /* eslint-disable-next-line @next/next/no-img-element */
                                                                <img src={item.url} alt={`Vista ${idx + 1}`} className="w-full h-full object-cover" />
                                                            )}
                                                            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-950/80 text-[10px] font-bold text-white flex items-center gap-1">
                                                                {item.type === 'video' && <Film size={10} className="text-cyan-300" />}
                                                                {idx === 0 ? 'Principal' : `Vista ${idx + 1}`}
                                                            </span>
                                                        </div>
                                                        <div className="p-1.5 flex items-center justify-between gap-1 bg-slate-900">
                                                            {idx > 0 ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleMakePrimaryMedia(idx)}
                                                                    className="flex-1 py-1 px-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                                                                    title="Usar como vista principal"
                                                                >
                                                                    <Star size={10} /> Principal
                                                                </button>
                                                            ) : (
                                                                <span className="flex-1 text-center text-[10px] font-bold text-emerald-400">
                                                                    Portada
                                                                </span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveMediaSlot(idx)}
                                                                className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/35 text-rose-300 cursor-pointer"
                                                                title="Quitar vista"
                                                                aria-label={`Quitar vista ${idx + 1}`}
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-5 rounded-xl border border-dashed border-slate-700 text-center text-xs text-slate-400">
                                                Aún no agregas vistas multimedia. Puedes subir hasta 4 fotos, GIFs o videos del producto.
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {/* STEP 3: STOCK Y UBICACIÓN */}
                            {step === 3 && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-[8px]">
                                        <div className="bg-emerald-900/20 border border-emerald-500/20 p-4 rounded-xl space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-black text-emerald-400 uppercase tracking-widest block">
                                                    {profile?.role === 'inventory' ? 'Precio Oficial (SuperAdmin)' : 'Precio de Venta (MXN) *'}
                                                </label>
                                                {profile?.role === 'inventory' && (
                                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Solo Lectura</span>
                                                )}
                                            </div>
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                disabled={profile?.role === 'inventory'} 
                                                value={formData.price} 
                                                onChange={e => setFormData({...formData, price: e.target.value})} 
                                                className="w-full bg-slate-900 border border-emerald-500/30 p-3 rounded-lg font-black text-2xl text-emerald-400 placeholder-emerald-900/50 outline-none transition-all disabled:opacity-50" 
                                                placeholder="0.00" 
                                            />

                                            {/* DOBLE CONFIRMACIÓN PARA SUPERADMIN / ADMIN */}
                                            {profile?.role !== 'inventory' && (
                                                <div className="pt-2 border-t border-emerald-500/20">
                                                    <label className="text-[11px] font-black text-emerald-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                                                        <span>Repetir Precio *</span>
                                                        {formData.price && (formData as any).confirmPrice && (
                                                            formData.price === (formData as any).confirmPrice ? (
                                                                <span className="text-emerald-400 flex items-center gap-1 text-[10px] font-bold">
                                                                    <CheckCircle2 size={12} /> Coincide
                                                                </span>
                                                            ) : (
                                                                <span className="text-rose-400 flex items-center gap-1 text-[10px] font-bold">
                                                                    <AlertTriangle size={12} /> Difieren
                                                                </span>
                                                            )
                                                        )}
                                                    </label>
                                                    <input 
                                                        type="number" 
                                                        step="0.01" 
                                                        value={(formData as any).confirmPrice || ''} 
                                                        onChange={e => setFormData({...formData, confirmPrice: e.target.value})} 
                                                        className={`w-full bg-slate-900 border p-3 rounded-lg font-black text-xl placeholder-emerald-900/50 outline-none transition-all ${
                                                            !(formData as any).confirmPrice 
                                                                ? 'border-emerald-500/30 text-emerald-400' 
                                                                : (formData as any).confirmPrice === formData.price 
                                                                    ? 'border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/20' 
                                                                    : 'border-rose-500 text-rose-300 ring-2 ring-rose-500/20'
                                                        }`}
                                                        placeholder="Repetir precio exacto" 
                                                    />
                                                    {priceMismatchCount > 0 && formData.price !== (formData as any).confirmPrice && (
                                                        <p className="text-[10px] font-bold text-rose-400 mt-1">
                                                            {priceMismatchCount === 1 && "Error 1: Los precios no coinciden. Escribe el mismo precio."}
                                                            {priceMismatchCount === 2 && "Error 2: Siguen sin coincidir. Verifica el valor oficial."}
                                                            {priceMismatchCount >= 3 && "Intento fallido. Cuando el valor sea idéntico, guardará normalmente."}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-blue-900/20 border border-blue-500/20 p-[8px] rounded-[5px]">
                                            <label className="text-xs font-black text-blue-400 uppercase tracking-widest mb-2 block">Unidad de Medida *</label>
                                            <select disabled={profile?.role === 'marketing'} value={formData.unitType || 'PZA'} onChange={e => setFormData({...formData, unitType: e.target.value as any})} className="w-full bg-slate-900 border border-blue-500/30 p-4 rounded-xl font-black text-xl text-blue-400 outline-none transition-all disabled:opacity-50">
                                                <option value="PZA">Pieza (PZA)</option>
                                                <option value="KG">Kilos (KG)</option>
                                                <option value="M">Metros (M)</option>
                                                <option value="M3">Metros Cúbicos (M³)</option>
                                                <option value="BOLSA">Bolsa</option>
                                                <option value="CAJA">Caja</option>
                                            </select>
                                            <div className="mt-4 flex items-center gap-3 bg-blue-950/30 p-3 rounded-lg border border-blue-500/20">
                                                <input 
                                                    type="checkbox" 
                                                    id="isBulk"
                                                    disabled={profile?.role === 'marketing'} 
                                                    checked={formData.isBulk}
                                                    onChange={e => setFormData({...formData, isBulk: e.target.checked})}
                                                    className="w-5 h-5 accent-blue-500 rounded bg-slate-800 border-blue-500/30"
                                                />
                                                <label htmlFor="isBulk" className="text-[11px] font-bold text-blue-300 uppercase tracking-wide cursor-pointer">
                                                    Venta a Granel (Fracciones)
                                                </label>
                                            </div>
                                        </div>
                                        <div className="bg-amber-900/20 border border-amber-500/20 p-[8px] rounded-[5px]">
                                            <label className="text-xs font-black text-amber-400 uppercase tracking-widest mb-2 block">Stock Físico *</label>
                                            <input type="number" step="any" disabled={profile?.role === 'marketing'} value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full bg-slate-900 border border-amber-500/30 p-4 rounded-xl font-black text-2xl text-amber-400 placeholder-amber-900/50 outline-none transition-all disabled:opacity-50" placeholder="0" />
                                        </div>
                                        <div className="bg-rose-950/30 border border-rose-500/40 p-[8px] rounded-[5px]">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-xs font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                                                    <AlertTriangle size={14} /> Umbral Mínimo de Alerta
                                                </label>
                                                <span className="text-[10px] text-zinc-400 font-bold bg-slate-900 px-2 py-0.5 rounded border border-rose-500/20">
                                                    Opcional (predet: 5)
                                                </span>
                                            </div>
                                            <input 
                                                type="number" 
                                                step="any" 
                                                min="0"
                                                disabled={profile?.role === 'marketing'}
                                                value={(formData as any).minStock} 
                                                onChange={e => setFormData({...formData, minStock: e.target.value})} 
                                                className="w-full bg-slate-900 border border-rose-500/40 p-4 rounded-xl font-black text-2xl text-rose-300 placeholder-rose-900/50 outline-none transition-all focus:border-rose-400 disabled:opacity-50" 
                                                placeholder="Ej. 5" 
                                            />
                                            <p className="text-[10px] text-zinc-400 mt-1.5 leading-tight">
                                                Dispara alertas audibles y visuales cuando el stock físico sea menor o igual a este valor.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="bg-indigo-900/20 border border-indigo-500/20 p-[8px] rounded-[5px]">
                                        <div className="flex items-center gap-3 mb-4">
                                            <MapPin className="text-indigo-400" />
                                            <h3 className="font-black text-indigo-400 uppercase tracking-widest text-sm">Ubicación Física en Almacén</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-[8px]">
                                            <div>
                                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 block">Estante / Pasillo</label>
                                                <div className="flex items-center gap-2">
                                                    <select 
                                                        disabled={profile?.role === 'marketing'} 
                                                        value={formData.estante} 
                                                        onChange={e => setFormData({...formData, estante: e.target.value})} 
                                                        className="flex-1 bg-slate-900 border border-indigo-500/30 p-3 rounded-xl font-bold text-indigo-300 outline-none uppercase disabled:opacity-50"
                                                    >
                                                        <option value="">-- Sin Asignar --</option>
                                                        {allEstantes.map(estante => (
                                                            <option key={estante} value={estante}>{estante}</option>
                                                        ))}
                                                        {formData.estante && !allEstantes.includes(formData.estante) && (
                                                            <option value={formData.estante}>{formData.estante}</option>
                                                        )}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowNewEstanteModal(true)}
                                                        className="w-12 h-12 flex-shrink-0 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl flex items-center justify-center hover:bg-indigo-500/40 hover:text-indigo-300 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                                        title="Agregar Estante Rápido"
                                                    >
                                                        <Plus size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 block">Fila / Nivel</label>
                                                <input type="text" disabled={profile?.role === 'marketing'} value={formData.fila} onChange={e => setFormData({...formData, fila: e.target.value})} className="w-full bg-slate-900 border border-indigo-500/30 p-3 rounded-xl font-bold text-indigo-300 placeholder-indigo-900/50 outline-none uppercase disabled:opacity-50" placeholder="Ej. Nivel 3" />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* CONTROLES FORMULARIO */}
                            <div className="flex justify-between items-center mt-10 pt-6 border-t border-slate-700/50">
                                {step > 1 ? (
                                    <button onClick={() => setStep(s => s - 1)} className="px-6 py-3 bg-slate-100 text-slate-300 font-bold uppercase text-xs tracking-widest rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-2">
                                        <ArrowLeft size={16} /> Atrás
                                    </button>
                                ) : <div />}
                                
                                {step < 3 ? (
                                    <button onClick={() => setStep(s => s + 1)} className="px-8 py-3 bg-[#0ea5e9] text-white font-bold uppercase text-xs tracking-widest rounded-xl hover:bg-blue-600 transition-all shadow-md active:scale-95 flex items-center gap-2">
                                        Siguiente <ArrowRight size={16} />
                                    </button>
                                ) : (
                                    <button onClick={handleSaveProduct} disabled={loading} className="px-8 py-4 bg-emerald-500 text-white font-black uppercase text-sm tracking-widest rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/30 active:scale-95 flex items-center gap-2">
                                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} 
                                        {editingProductId ? 'Actualizar Producto' : 'Guardar Producto'}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="list"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {/* RESUMEN EJECUTIVO DE INVENTARIO */}
                            <InventorySummaryCards
                                summary={inventorySummary}
                                totalAlerts={alertSummary.totalAlerts}
                                criticalCount={alertSummary.criticalCount}
                                lowStockCount={alertSummary.lowStockCount}
                                formatCurrency={formatCurrency}
                            />

                            {/* BANNER DE ALERTA DE STOCK CRÍTICO */}
                            {alertSummary.totalAlerts > 0 && (
                                <div className="mb-4 bg-gradient-to-r from-rose-950/70 via-red-900/40 to-slate-900/90 border border-rose-500/50 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-rose-950/30">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 animate-pulse">
                                            <AlertTriangle size={18} />
                                        </div>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-xs font-black uppercase text-rose-300 tracking-wide">
                                                    Alerta de Stock Crítico / Mínimo
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
                                                    {alertSummary.totalAlerts} {alertSummary.totalAlerts === 1 ? 'producto' : 'productos'}
                                                </span>
                                                {alertSummary.criticalCount > 0 && (
                                                    <span className="px-2 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-700 text-[10px] font-bold">
                                                        {alertSummary.criticalCount} agotados
                                                    </span>
                                                )}
                                                {alertSummary.lowStockCount > 0 && (
                                                    <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700 text-[10px] font-bold">
                                                        {alertSummary.lowStockCount} bajo umbral
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-zinc-300 mt-0.5">
                                                Hay existencias por debajo del umbral mínimo definido. Se requiere resurtido para evitar quiebres de inventario.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('restock')}
                                            className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                                        >
                                            <PackagePlus size={14} /> Recargar Piezas
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsThresholdAlertModalOpen(true)}
                                            className="flex-1 sm:flex-none px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                                        >
                                            <Shield size={14} /> Ver Alertas
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('thresholds')}
                                            className="flex-1 sm:flex-none px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold transition-all border border-zinc-700 whitespace-nowrap"
                                        >
                                            ⚙️ Umbrales
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* TAB NAVIGATION: Compact Single-Row Toolbar with Colored Indicators */}
                            <div className="flex items-center gap-1.5 mb-5 bg-slate-900/80 p-1.5 rounded-xl border border-cyan-500/30 overflow-x-auto hide-scrollbar backdrop-blur-md shadow-lg">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('orders')}
                                    className={`py-1.5 px-3.5 font-bold text-xs rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'orders' ? 'bg-amber-400 text-slate-950 font-black shadow-sm' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                                >
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] shrink-0"></span>
                                    <Clock size={14} /> Surtido
                                    {pendingPrepOrders.length > 0 && (
                                        <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                                            {pendingPrepOrders.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('catalog')}
                                    className={`py-1.5 px-3.5 font-bold text-xs rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'catalog' ? 'bg-yellow-400 text-slate-950 font-black shadow-sm' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                                >
                                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.9)] shrink-0"></span>
                                    <Package size={14} /> Productos ({filteredProducts.length})
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setActiveTab('thresholds')}
                                    className={`py-1.5 px-3.5 font-bold text-xs rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                                        activeTab === 'thresholds'
                                            ? 'bg-rose-600 text-white font-black shadow-sm'
                                            : alertSummary.totalAlerts > 0
                                                ? 'text-rose-300 hover:text-white hover:bg-rose-950/30 border border-rose-500/30'
                                                : 'text-slate-300 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                        alertSummary.criticalCount > 0
                                            ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse'
                                            : alertSummary.lowStockCount > 0
                                                ? 'bg-amber-400 shadow-[0_0_8px_rgba(250,204,21,0.9)]'
                                                : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                                    }`}></span>
                                    <Shield size={14} /> Umbrales y Alertas
                                    {alertSummary.totalAlerts > 0 && (
                                        <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                                            {alertSummary.totalAlerts}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('restock')}
                                    className={`py-1.5 px-3.5 font-bold text-xs rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                                        activeTab === 'restock'
                                            ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                                            : 'text-emerald-300 hover:text-white hover:bg-emerald-950/30 border border-emerald-500/20'
                                    }`}
                                >
                                    <PackagePlus size={14} /> Recarga & Auditoría
                                    {alertSummary.totalAlerts > 0 && (
                                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                                            activeTab === 'restock' ? 'bg-slate-950 text-emerald-300' : 'bg-amber-500/25 text-amber-300'
                                        }`}>
                                            {alertSummary.totalAlerts}
                                        </span>
                                    )}
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setActiveTab('shelves')}
                                    className={`py-1.5 px-3.5 font-bold text-xs rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'shelves' ? 'bg-emerald-400 text-slate-950 font-black shadow-sm' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                                >
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] shrink-0"></span>
                                    <Layers size={14} /> Estantes ({allEstantes.length})
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setActiveTab('transfer')}
                                    className={`py-1.5 px-3.5 font-bold text-xs rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'transfer' ? 'bg-indigo-500 text-white font-black shadow-sm' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                                >
                                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.9)] shrink-0"></span>
                                    <Upload size={14} /> Import/Export
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setActiveTab('backup')}
                                    className={`py-1.5 px-3.5 font-bold text-xs rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'backup' ? 'bg-cyan-500 text-slate-950 font-black shadow-sm' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                                >
                                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] shrink-0"></span>
                                    <Database size={14} /> Respaldos USB
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setActiveTab('shrinkage')}
                                    className={`py-1.5 px-3.5 font-bold text-xs rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'shrinkage' ? 'bg-slate-100 text-slate-950 font-black shadow-sm' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                                >
                                    <span className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] shrink-0"></span>
                                    <AlertTriangle size={14} /> Merma
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('trash')}
                                    className={`py-1.5 px-3.5 font-bold text-xs rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'trash' ? 'bg-red-600 text-white font-black shadow-sm' : 'text-slate-300 hover:text-red-300 hover:bg-white/5'}`}
                                >
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.9)] shrink-0"></span>
                                    <Trash2 size={14} /> Papelera {trashedProducts.length > 0 && `(${trashedProducts.length})`}
                                </button>
                            </div>

                            {activeTab === 'orders' && (
                                <section className="space-y-4">
                                    {/* Encabezado Compacto de Pizarra de Surtido */}
                                    <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl px-4 py-3 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-lg shrink-0">
                                                🦁
                                            </div>
                                            <div>
                                                <h3 className="text-xs sm:text-sm font-black uppercase text-amber-300 tracking-wide flex items-center gap-2 leading-none">
                                                    Surtido en Almacén
                                                    <span className="text-[10px] text-zinc-400 font-normal">
                                                        ({pendingPrepOrders.length} {pendingPrepOrders.length === 1 ? 'pedido pendiente' : 'pedidos pendientes'})
                                                    </span>
                                                </h3>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setOnlyMyOrders(prev => !prev)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                                onlyMyOrders
                                                    ? 'bg-amber-500 text-slate-950 font-black border-amber-400 shadow-md'
                                                    : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
                                            }`}
                                        >
                                            <span>👤</span> {onlyMyOrders ? 'Viendo: Mis Asignados' : 'Ver solo mis asignados'}
                                        </button>
                                    </div>

                                    {/* Si hay cancelaciones pendientes de reacomodo */}
                                    {cancelledRestockOrders.length > 0 && (
                                        <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl p-4 shadow-lg">
                                            <h4 className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-2 mb-3">
                                                <span>⚠️</span> Deconstrucción: {cancelledRestockOrders.length} pedido(s) cancelado(s) pendiente(s) de devolver a estante
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {cancelledRestockOrders.map(o => (
                                                    <div key={o.id} className="bg-slate-900/90 border border-rose-500/20 p-4 rounded-xl flex justify-between items-center">
                                                        <div>
                                                            <div className="font-mono text-xs font-bold text-white">{o.id}</div>
                                                            <div className="text-[11px] text-slate-400">{o.customer?.name || o.customerName || 'Cliente'}</div>
                                                            <div className="text-[10px] text-rose-300 font-bold mt-1">{(o.items || []).length} artículos a reacomodar</div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeconstructingOrder(o)}
                                                            className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-black uppercase transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                                                        >
                                                            <span>↩️</span> Reacomodar
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Barra de acción para recolección multipedido seleccionada */}
                                    {selectedOrderIdsForBatch.length > 0 && (
                                        <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                                                    <Layers size={18} />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-black uppercase text-white tracking-wide">
                                                        {selectedOrderIdsForBatch.length} {selectedOrderIdsForBatch.length === 1 ? 'pedido seleccionado' : 'pedidos seleccionados'} para recolección conjunta
                                                    </div>
                                                    <div className="text-[11px] text-zinc-400">
                                                        Se agruparán en una sola cesta de recolección con checklist y ruta de estantes.
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedOrderIdsForBatch([])}
                                                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-all"
                                                >
                                                    Deseleccionar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const batch = pendingPrepOrders.filter(o => selectedOrderIdsForBatch.includes(o.id));
                                                        setMultiPickingOrders(batch);
                                                    }}
                                                    className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                                >
                                                    <span>📦</span> Iniciar Recolección Multipedido ({selectedOrderIdsForBatch.length})
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Grilla de Pedidos Pendientes de Surtido */}
                                    {pendingPrepOrders.length === 0 ? (
                                        <div className="border border-slate-800 bg-slate-900/40 rounded-2xl p-16 text-center">
                                            <Package size={48} className="mx-auto text-slate-700 mb-3" />
                                            <h4 className="text-base font-bold text-slate-300 uppercase">Sin pedidos pendientes</h4>
                                            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                                Cuando un cliente levante una orden en tienda o en línea, aparecerá aquí al instante para iniciar el surtido por estantes.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {pendingPrepOrders.map(order => {
                                                const isClaimedByMe = order.loadedByUid === profile?.uid;
                                                const isClaimedByOther = order.loadedByUid && order.loadedByUid !== profile?.uid;
                                                const isOnHold = order.status === 'EN_ESPERA';
                                                const isBusy = busyOrderId === order.id;

                                                return (
                                                    <div 
                                                        key={order.id}
                                                        className={`bg-slate-900/90 border rounded-2xl p-5 shadow-xl flex flex-col justify-between transition-all ${
                                                            isOnHold
                                                                ? 'border-amber-500/70 ring-1 ring-amber-400/30'
                                                                : isClaimedByMe 
                                                                    ? 'border-sky-500 ring-1 ring-sky-400/50' 
                                                                    : isClaimedByOther 
                                                                        ? 'border-slate-800 opacity-60' 
                                                                        : 'border-slate-700/80 hover:border-amber-400/50'
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="flex justify-between items-start gap-2 mb-3">
                                                                <div className="flex items-center gap-2">
                                                                    <input 
                                                                        type="checkbox"
                                                                        checked={selectedOrderIdsForBatch.includes(order.id)}
                                                                        onChange={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedOrderIdsForBatch(prev =>
                                                                                prev.includes(order.id) ? prev.filter(id => id !== order.id) : [...prev, order.id]
                                                                            );
                                                                        }}
                                                                        className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                                                                        title="Seleccionar para recolección multipedido"
                                                                    />
                                                                    <span className="font-mono text-xs font-black text-white bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                                                                        {order.id}
                                                                    </span>
                                                                </div>
                                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                                                                    isOnHold
                                                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                                                        : order.status === 'paid' 
                                                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                                                            : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                                                                }`}>
                                                                    {isOnHold ? 'En Espera' : order.status === 'paid' ? 'Pagado · Surtir' : 'Por Cobrar'}
                                                                </span>
                                                            </div>

                                                            <h4 className="text-sm font-black text-white uppercase tracking-tight">
                                                                {order.customer?.name || order.customerName || 'Cliente Mostrador'}
                                                            </h4>
                                                            <p className="text-xs text-slate-400 mt-0.5">
                                                                Destino:{' '}
                                                                <span className="font-bold text-slate-300">
                                                                    {order.deliveryType === 'DELIVERY' || (order as any).deliveryMethod === 'repartidor'
                                                                        ? '🛵 Reparto a Domicilio'
                                                                        : order.deliveryType === 'PATIO' || (order as any).deliveryMethod === 'patio'
                                                                            ? '🏗️ Bahía de Carga / Patio'
                                                                            : '📦 Caja / Mostrador'}
                                                                </span>
                                                            </p>

                                                            {/* Lista compacta de artículos con ubicación */}
                                                            <div className="mt-3 bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80 max-h-36 overflow-y-auto custom-scrollbar space-y-1.5">
                                                                {(order.items || []).map((item: any, idx: number) => {
                                                                    const prod = products.find(p => p.id === item.id);
                                                                    return (
                                                                        <div key={idx} className="flex justify-between items-center text-xs">
                                                                            <span className="text-slate-200 truncate flex-1 pr-2">
                                                                                <span className="font-bold text-amber-400 mr-1">{item.quantity}x</span> {item.name}
                                                                            </span>
                                                                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                                                                📍 {prod?.location?.estante || 'Bodega'} / {prod?.location?.fila || 'Gral'}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        {/* Acciones */}
                                                        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-col gap-2">
                                                            {isClaimedByOther ? (
                                                                <div className="space-y-2">
                                                                    <div className="text-center py-2 text-xs text-slate-400 font-bold bg-slate-800/40 rounded-xl">
                                                                        🔒 Bloqueado por {order.loadedBy || 'otro operador'}{isOnHold ? ' (En Espera)' : ''}
                                                                    </div>
                                                                    {['admin', 'superadmin'].includes(profile?.role || '') && (
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleReleaseOrderClaim(order.id)}
                                                                                disabled={isBusy}
                                                                                className="min-h-[40px] py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-all"
                                                                            >
                                                                                Soltar
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setAbandonTargetOrder(order)}
                                                                                disabled={isBusy}
                                                                                className="min-h-[40px] py-2 bg-rose-950/50 hover:bg-rose-900/60 text-rose-200 border border-rose-500/40 font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all"
                                                                            >
                                                                                <LockKeyhole size={14} /> NIP
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : isClaimedByMe ? (
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="flex items-center justify-between gap-2 bg-slate-950/80 border border-sky-500/30 rounded-xl px-2.5 py-1.5">
                                                                        <span className="text-[10px] font-black uppercase text-sky-300">
                                                                            Estado:
                                                                        </span>
                                                                        <select
                                                                            value={order.status}
                                                                            disabled={isBusy}
                                                                            onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                                                            className="bg-slate-900 border border-slate-700 text-xs font-bold text-white rounded-lg px-2 py-1 outline-none"
                                                                        >
                                                                            <option value="PREPARANDO">PREPARANDO</option>
                                                                            <option value="EN_ESPERA">EN_ESPERA</option>
                                                                            <option value="PENDIENTE_LLEGADA">PENDIENTE_LLEGADA</option>
                                                                            <option value={order.deliveryType === 'DELIVERY' ? 'READY_TO_SHIP' : 'READY_FOR_PICKUP'}>
                                                                                {order.deliveryType === 'DELIVERY' ? 'LISTO P/ REPARTO (CAJA)' : 'LISTO P/ COBRO'}
                                                                            </option>
                                                                        </select>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        disabled={isBusy}
                                                                        onClick={() => isOnHold ? handleResumeOrder(order) : handleStartPicking(order)}
                                                                        className="w-full min-h-[44px] py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                                                                    >
                                                                        {isOnHold ? <Play size={15} /> : <span>📦</span>}
                                                                        {isOnHold ? 'Retomar Surtido' : 'Continuar Surtido (1 a 1)'}
                                                                    </button>
                                                                    <div className="grid grid-cols-3 gap-2">
                                                                        {!isOnHold && (
                                                                            <button
                                                                                type="button"
                                                                                disabled={isBusy}
                                                                                onClick={() => handleHoldOrder(order)}
                                                                                className="min-h-[40px] py-2 px-2 bg-amber-950/50 hover:bg-amber-900/60 text-amber-200 border border-amber-500/40 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 transition-all"
                                                                            >
                                                                                <PauseCircle size={13} /> Espera
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            disabled={isBusy}
                                                                            onClick={() => handleReleaseOrderClaim(order.id)}
                                                                            className="min-h-[40px] py-2 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 transition-all"
                                                                            title="Liberar orden a la pizarra sin penalización"
                                                                        >
                                                                            Soltar
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            disabled={isBusy}
                                                                            onClick={() => setAbandonTargetOrder(order)}
                                                                            className={`${isOnHold ? 'col-span-2' : ''} min-h-[40px] py-2 px-2 bg-rose-950/50 hover:bg-rose-900/60 text-rose-200 border border-rose-500/40 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 transition-all`}
                                                                        >
                                                                            <LockKeyhole size={13} /> NIP
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStartPicking(order)}
                                                                    className="w-full min-h-[44px] py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                                                                >
                                                                    <span>📦</span> Tomar Pedido y Surtir (1 a 1)
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>
                            )}

                            {activeTab === 'thresholds' && (
                                <section>
                                    <StockThresholdConfigPanel
                                        products={localProducts}
                                        config={thresholdConfig}
                                        onSaveConfig={(newConfig) => {
                                            setThresholdConfig(newConfig);
                                            saveStockThresholdConfig(newConfig);
                                            toast.success('Configuración de umbrales guardada correctamente', '⚙️ Almacén');
                                        }}
                                        onUpdateProductThreshold={handleUpdateProductThreshold}
                                        onOpenAlertModal={() => setIsThresholdAlertModalOpen(true)}
                                        onQuickRestock={(prod) => setRestockTargetProduct(prod)}
                                    />
                                </section>
                            )}

                            {activeTab === 'restock' && (
                                <section className="space-y-6">
                                    {/* Cabecera de Modo Recarga Rápida */}
                                    <div className="bg-slate-900/90 border border-emerald-500/35 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                                                <PackagePlus size={22} />
                                            </div>
                                            <div>
                                                <h2 className="text-base sm:text-lg font-black uppercase text-white tracking-tight">
                                                    Recarga Rápida de Productos Bajo Stock
                                                </h2>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    Agrega únicamente el número de piezas que entran a almacén con doble confirmación anti-error y registro automático en auditoría.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="relative w-full sm:w-72">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                            <input
                                                type="search"
                                                value={restockSearch}
                                                onChange={(e) => setRestockSearch(e.target.value)}
                                                placeholder="Filtrar producto o barra..."
                                                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Lista de productos bajo mínimo (prioridad críticos + bajos; si busca, muestra coincidencias de todo el catálogo) */}
                                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                                        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
                                                <AlertTriangle size={15} />
                                                {restockSearch.trim()
                                                    ? 'Coincidencias de Catálogo para Recarga'
                                                    : `Productos en Alerta de Stock (${alertSummary.criticalItems.length + alertSummary.lowStockItems.length})`}
                                            </h3>
                                            <span className="text-[11px] text-slate-400">
                                                Click en &ldquo;+ Agregar Pzas&rdquo; para recargar con confirmación doble
                                            </span>
                                        </div>

                                        {(() => {
                                            const q = restockSearch.trim().toLowerCase();
                                            const baseList = q
                                                ? localProducts.filter((p) =>
                                                    p.name.toLowerCase().includes(q) ||
                                                    (p.barcode || '').toLowerCase().includes(q) ||
                                                    (p.category || '').toLowerCase().includes(q)
                                                )
                                                : localProducts
                                                    .filter((p) => {
                                                        const analysis = alertSummary.itemsMap[p.id];
                                                        return analysis && (analysis.status === 'out_of_stock' || analysis.status === 'low_stock');
                                                    })
                                                    .sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0));

                                            if (baseList.length === 0) {
                                                return (
                                                    <div className="p-10 text-center text-slate-400 text-xs">
                                                        {q
                                                            ? 'No hay productos que coincidan con esa búsqueda.'
                                                            : 'Todos los productos cumplen su nivel mínimo configurado. Usa el buscador si deseas recargar otro producto.'}
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="divide-y divide-slate-800/80">
                                                    {baseList.map((product) => {
                                                        const analysis = alertSummary.itemsMap[product.id];
                                                        const minLevel = analysis?.effectiveThreshold ?? getProductEffectiveThreshold(product, thresholdConfig);
                                                        const isOut = (Number(product.stock) || 0) <= 0;
                                                        const isLow = (Number(product.stock) || 0) <= minLevel;

                                                        return (
                                                            <div
                                                                key={product.id}
                                                                className="p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors"
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                                                                            isOut
                                                                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                                                                : isLow
                                                                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                                                                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                                                        }`}>
                                                                            {isOut ? 'Agotado' : isLow ? 'Bajo Mínimo' : 'Saludable'}
                                                                        </span>
                                                                        <h4 className="font-bold text-sm text-white truncate">{product.name}</h4>
                                                                    </div>
                                                                    <p className="text-[11px] text-slate-400 mt-1">
                                                                        {product.category || 'General'} · Ubicación: {product.location?.estante || product.estante || 'Sin asignar'} / {product.location?.fila || product.fila || 'General'}
                                                                    </p>
                                                                </div>

                                                                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                                                                    <div className="text-left sm:text-right font-mono tabular-nums">
                                                                        <div className="text-xs font-black text-white">
                                                                            Actual: <span className={isOut ? 'text-rose-400' : isLow ? 'text-amber-300' : 'text-emerald-300'}>{product.stock}</span> {product.unitType || 'PZA'}
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-400">
                                                                            Mínimo: {minLevel} {product.unitType || 'PZA'}
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setRestockTargetProduct(product)}
                                                                        className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-md"
                                                                    >
                                                                        <PackagePlus size={15} />
                                                                        <span>Agregar Pzas</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Historial de Auditoría de Recargas */}
                                    <div className="bg-slate-900/80 border border-cyan-500/25 rounded-2xl overflow-hidden shadow-lg">
                                        <div className="px-4 py-3 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <History size={16} className="text-cyan-400" />
                                                <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300">
                                                    Historial de Auditoría de Recargas ({restockHistory.length})
                                                </h3>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={fetchRestockHistory}
                                                disabled={restockHistoryLoading}
                                                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
                                            >
                                                <RefreshCw size={13} className={restockHistoryLoading ? 'animate-spin' : ''} />
                                                <span>Actualizar</span>
                                            </button>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[740px] text-left text-xs">
                                                <thead className="bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-400">
                                                    <tr>
                                                        <th className="px-4 py-2.5">Fecha y Hora</th>
                                                        <th className="px-4 py-2.5">Producto</th>
                                                        <th className="px-4 py-2.5 text-right">Stock Anterior</th>
                                                        <th className="px-4 py-2.5 text-right">Agregado</th>
                                                        <th className="px-4 py-2.5 text-right">Nuevo Stock</th>
                                                        <th className="px-4 py-2.5">Operador</th>
                                                        <th className="px-4 py-2.5">Validación / Nota</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800">
                                                    {restockHistoryLoading && restockHistory.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                                                                Cargando historial de auditoría...
                                                            </td>
                                                        </tr>
                                                    ) : restockHistory.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                                                                Aún no hay recargas auditadas registradas. Agrega piezas a un producto bajo mínimo para generar el primer registro.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        restockHistory
                                                            .filter((entry) => {
                                                                const q = restockSearch.trim().toLowerCase();
                                                                if (!q) return true;
                                                                return (
                                                                    entry.productName.toLowerCase().includes(q) ||
                                                                    entry.operatorName.toLowerCase().includes(q) ||
                                                                    entry.notes.toLowerCase().includes(q)
                                                                );
                                                            })
                                                            .map((entry) => (
                                                                <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors">
                                                                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                                                                        {new Date(entry.timestamp).toLocaleString('es-MX', {
                                                                            dateStyle: 'short',
                                                                            timeStyle: 'short',
                                                                        })}
                                                                    </td>
                                                                    <td className="px-4 py-2.5">
                                                                        <div className="font-bold text-white">{entry.productName}</div>
                                                                        {(entry.estante || entry.fila) && (
                                                                            <div className="text-[10px] text-slate-500">
                                                                                {entry.estante || 'N/A'} / {entry.fila || 'General'}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-300">
                                                                        {entry.previousStock !== null ? `${entry.previousStock} ${entry.unitType}` : '—'}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-black text-emerald-400">
                                                                        {entry.addedQty !== null ? `+${entry.addedQty} ${entry.unitType}` : '—'}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-cyan-300">
                                                                        {entry.newStock !== null ? `${entry.newStock} ${entry.unitType}` : '—'}
                                                                    </td>
                                                                    <td className="px-4 py-2.5">
                                                                        <div className="font-semibold text-slate-200">{entry.operatorName}</div>
                                                                        <div className="text-[10px] uppercase text-slate-500">{entry.operatorRole}</div>
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-[11px] text-slate-300 max-w-xs">
                                                                        {entry.doubleConfirmed && (
                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold mr-1.5">
                                                                                <CheckCircle2 size={10} /> Doble Conf.
                                                                            </span>
                                                                        )}
                                                                        <span className="text-slate-400">{entry.notes || 'Sin nota'}</span>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {activeTab === 'catalog' && (
                                <section className="overflow-hidden border border-slate-700/70 bg-slate-900/70 shadow-xl rounded-xl">
                                    <div className="flex flex-col gap-2 border-b border-slate-700/70 p-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <h2 className="text-base font-black uppercase text-white tracking-wide">Inventario de Productos</h2>
                                            <p className="text-[11px] text-slate-400">{filteredProducts.length} productos registrados</p>
                                        </div>
                                        <div className="flex w-full flex-wrap gap-2 md:w-auto md:flex-nowrap">
                                            <div className="relative min-w-0 flex-1 md:w-80">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                                <input
                                                    type="search"
                                                    value={searchTerm}
                                                    onChange={event => setSearchTerm(event.target.value)}
                                                    placeholder="Buscar por nombre, código o ubicación..."
                                                    className="w-full border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white rounded-lg outline-none focus:border-cyan-400"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setIsScannerOpen(true)}
                                                className="flex h-9 w-9 shrink-0 items-center justify-center border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 rounded-lg"
                                                aria-label="Escanear código con la cámara"
                                                title="Escanear código con la cámara"
                                            >
                                                <Camera size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleAddProductClick('BODEGA GENERAL', 'GENERAL')}
                                                className="flex h-9 shrink-0 items-center justify-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 px-3.5 text-xs font-black uppercase text-white rounded-lg shadow-sm"
                                            >
                                                <Plus size={14} /> Nuevo
                                            </button>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        {isSuperAdmin && (
                                            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-slate-800/80 bg-slate-950/50 text-[11px] text-slate-400">
                                                <div className="flex items-center gap-2">
                                                    <span>Control de visibilidad pública (SuperAdmin)</span>
                                                    <ConfigHelpButton settingKey="hidePublicStock" align="left" />
                                                </div>
                                                {selectedProductIds.filter((id) => localProducts.some((p) => p.id === id)).length > 0 && (
                                                    <div className="flex items-center gap-2 text-cyan-300 font-semibold">
                                                        <span>
                                                            {selectedProductIds.filter((id) => localProducts.some((p) => p.id === id)).length} seleccionado(s)
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedProductIds([]);
                                                                setBulkTrashConfirmOpen(false);
                                                            }}
                                                            className="text-slate-400 hover:text-white underline cursor-pointer"
                                                        >
                                                            Limpiar selección
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <table className="w-full min-w-[760px] text-left text-sm">
                                            <thead className="bg-slate-800/80 text-[10px] uppercase tracking-wider text-slate-400">
                                                <tr>
                                                    {isSuperAdmin && (
                                                        <th className="px-3 py-2.5 w-10 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={
                                                                    filteredProducts.length > 0 &&
                                                                    filteredProducts.every((p) => selectedProductIds.includes(p.id))
                                                                }
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        const nextIds = Array.from(
                                                                            new Set([
                                                                                ...selectedProductIds,
                                                                                ...filteredProducts.map((p) => p.id),
                                                                            ])
                                                                        );
                                                                        setSelectedProductIds(nextIds);
                                                                    } else {
                                                                        const filteredSet = new Set(filteredProducts.map((p) => p.id));
                                                                        setSelectedProductIds((prev) => prev.filter((id) => !filteredSet.has(id)));
                                                                    }
                                                                }}
                                                                aria-label="Seleccionar todos los productos visibles"
                                                                title="Seleccionar todos"
                                                                className="w-4 h-4 accent-cyan-400 cursor-pointer rounded"
                                                            />
                                                        </th>
                                                    )}
                                                    <th className="px-4 py-2.5 w-14 text-center">Foto</th>
                                                    <th className="px-4 py-2.5">Producto</th>
                                                    <th className="px-4 py-2.5">Barras / Código</th>
                                                    <th className="px-4 py-2.5">Ubicación</th>
                                                    <th className="px-4 py-2.5 text-right">Existencia</th>
                                                    <th className="px-4 py-2.5 text-right">Precio</th>
                                                    <th className="px-4 py-2.5 text-right">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800">
                                                {filteredProducts.map(product => {
                                                    const isSelected = isSuperAdmin && selectedProductIds.includes(product.id);
                                                    const isVisibilityMenuOpen = isSuperAdmin && visibilityPopoverId === product.id;
                                                    const hasAnyVisibilityRestriction = Boolean(
                                                        product.hideFromPublic || product.hidePublicStock
                                                    );
                                                    return (
                                                    <tr
                                                        key={product.id}
                                                        className={`transition-colors ${
                                                            isSelected
                                                                ? 'bg-cyan-500/10 hover:bg-cyan-500/15'
                                                                : 'hover:bg-slate-800/40'
                                                        }`}
                                                    >
                                                        {isSuperAdmin && (
                                                            <td className="px-3 py-2.5 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => {
                                                                        setSelectedProductIds((prev) =>
                                                                            prev.includes(product.id)
                                                                                ? prev.filter((id) => id !== product.id)
                                                                                : [...prev, product.id]
                                                                        );
                                                                    }}
                                                                    aria-label={`Seleccionar ${product.name}`}
                                                                    className="w-4 h-4 accent-cyan-400 cursor-pointer rounded"
                                                                />
                                                            </td>
                                                        )}

                                                        {/* Columna Foto */}
                                                        <td className="px-4 py-2.5 text-center">
                                                            <div className="w-11 h-11 rounded-lg bg-zinc-800 border border-white/10 overflow-hidden flex items-center justify-center mx-auto shrink-0 shadow-sm">
                                                                {product.image ? (
                                                                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <Package size={18} className="text-zinc-500" />
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* Columna Producto */}
                                                        <td className="px-4 py-2.5">
                                                            <button type="button" onClick={() => handleEditProduct(product)} className="text-left font-bold text-white hover:text-cyan-300 text-xs sm:text-sm">
                                                                {product.name}
                                                            </button>
                                                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                                                                <span>{product.category || 'General'}</span>
                                                                {isSuperAdmin && product.hideFromPublic && (
                                                                    <span className="text-rose-300 font-medium">· Oculto al público</span>
                                                                )}
                                                                {isSuperAdmin && !product.hideFromPublic && product.hidePublicStock && (
                                                                    <span className="text-amber-300 font-medium">· Piezas ocultas</span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* Columna Barras */}
                                                        <td className="px-4 py-2.5">
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 font-mono text-xs text-cyan-300 font-bold shadow-sm">
                                                                <Barcode size={14} className="text-cyan-400 shrink-0" />
                                                                {product.barcode || product.id}
                                                            </span>
                                                        </td>

                                                        {/* Columna Ubicación */}
                                                        <td className="px-4 py-2.5 text-xs text-slate-300">
                                                            <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium">
                                                                {(product.location?.estante || product.estante || 'Sin asignar')} / {(product.location?.fila || product.fila || 'General')}
                                                            </span>
                                                        </td>

                                                        {/* Columna Existencia */}
                                                        <td className="px-4 py-2.5 text-right font-bold text-cyan-300 font-mono text-xs sm:text-sm tabular-nums">
                                                            {product.stock} {product.unitType || 'PZA'}
                                                        </td>

                                                        {/* Columna Precio */}
                                                        <td className="px-4 py-2.5 text-right text-slate-200 font-semibold font-mono text-xs sm:text-sm tabular-nums">
                                                            {formatCurrency(product.price)}
                                                        </td>

                                                        {/* Columna Acción */}
                                                        <td className="px-4 py-2.5 text-right relative">
                                                            <div className="flex items-center justify-end gap-1">
                                                                {isSuperAdmin && (
                                                                    <div className="relative">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                setVisibilityPopoverId((prev) =>
                                                                                    prev === product.id ? null : product.id
                                                                                )
                                                                            }
                                                                            disabled={visibilityBusyId === product.id}
                                                                            aria-expanded={isVisibilityMenuOpen}
                                                                            aria-label={`Visibilidad pública de ${product.name}`}
                                                                            title={
                                                                                product.hideFromPublic
                                                                                    ? 'Oculto totalmente al público'
                                                                                    : product.hidePublicStock
                                                                                      ? 'Piezas ocultas (solo precio público)'
                                                                                      : 'Visible al público (clic para configurar)'
                                                                            }
                                                                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                                                                product.hideFromPublic
                                                                                    ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                                                                                    : product.hidePublicStock
                                                                                      ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                                                                                      : 'text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-300'
                                                                            }`}
                                                                        >
                                                                            {hasAnyVisibilityRestriction ? <EyeOff size={15} /> : <Eye size={15} />}
                                                                        </button>

                                                                        {isVisibilityMenuOpen && (
                                                                            <div
                                                                                role="dialog"
                                                                                aria-label={`Opciones de visibilidad para ${product.name}`}
                                                                                className="absolute right-0 top-full mt-1.5 z-[600] w-64 rounded-xl border border-slate-700 bg-slate-950 p-3 text-left shadow-2xl space-y-2"
                                                                            >
                                                                                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
                                                                                    <span className="text-[11px] font-bold text-slate-200 truncate">
                                                                                        Visibilidad Pública
                                                                                    </span>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => setVisibilityPopoverId(null)}
                                                                                        className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                                                                                        aria-label="Cerrar menú"
                                                                                    >
                                                                                        <X size={13} />
                                                                                    </button>
                                                                                </div>

                                                                                <button
                                                                                    type="button"
                                                                                    disabled={visibilityBusyId === product.id}
                                                                                    onClick={() =>
                                                                                        void handleToggleProductVisibility(product.id, {
                                                                                            hidePublicStock: !product.hidePublicStock,
                                                                                        })
                                                                                    }
                                                                                    className="w-full flex items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/80 p-2 text-left hover:border-amber-500/50 transition-colors cursor-pointer"
                                                                                >
                                                                                    <div className="min-w-0">
                                                                                        <span className="text-[11px] font-semibold text-slate-100 block">
                                                                                            Ocultar número de piezas
                                                                                        </span>
                                                                                        <span className="text-[10px] text-slate-400 block">
                                                                                            Al público solo muestra precio y &ldquo;Disponible&rdquo;.
                                                                                        </span>
                                                                                    </div>
                                                                                    <span
                                                                                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                                                                            product.hidePublicStock
                                                                                                ? 'bg-amber-400 border-amber-400 text-slate-950'
                                                                                                : 'border-slate-600'
                                                                                        }`}
                                                                                    >
                                                                                        {product.hidePublicStock && <Check size={11} strokeWidth={3} />}
                                                                                    </span>
                                                                                </button>

                                                                                <button
                                                                                    type="button"
                                                                                    disabled={visibilityBusyId === product.id}
                                                                                    onClick={() =>
                                                                                        void handleToggleProductVisibility(product.id, {
                                                                                            hideFromPublic: !product.hideFromPublic,
                                                                                        })
                                                                                    }
                                                                                    className="w-full flex items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/80 p-2 text-left hover:border-rose-500/50 transition-colors cursor-pointer"
                                                                                >
                                                                                    <div className="min-w-0">
                                                                                        <span className="text-[11px] font-semibold text-slate-100 block">
                                                                                            Ocultar tarjeta completa
                                                                                        </span>
                                                                                        <span className="text-[10px] text-slate-400 block">
                                                                                            No aparece en tienda pública; sigue en POS/Almacén.
                                                                                        </span>
                                                                                    </div>
                                                                                    <span
                                                                                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                                                                            product.hideFromPublic
                                                                                                ? 'bg-rose-500 border-rose-500 text-white'
                                                                                                : 'border-slate-600'
                                                                                        }`}
                                                                                    >
                                                                                        {product.hideFromPublic && <Check size={11} strokeWidth={3} />}
                                                                                    </span>
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setRestockTargetProduct(product)}
                                                                    className={`px-2 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition-colors ${
                                                                        alertSummary.itemsMap[product.id]?.isAlert
                                                                            ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                                                                            : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30'
                                                                    }`}
                                                                    title="Agregar piezas rápido con doble confirmación"
                                                                >
                                                                    <PackagePlus size={13} />
                                                                    <span>+ Pzas</span>
                                                                </button>
                                                                <button type="button" onClick={() => handleEditProduct(product)} className="p-1.5 text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-300 rounded-lg transition-colors" title="Editar producto">
                                                                    <Edit3 size={15} />
                                                                </button>
                                                                <button type="button" onClick={() => handleDeleteProduct(product.id, product.name)} className="p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors" title="Mover a papelera">
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    );
                                                })}
                                                {filteredProducts.length === 0 && (
                                                    <tr>
                                                        <td colSpan={isSuperAdmin ? 8 : 7} className="px-5 py-12 text-center text-xs text-slate-500">
                                                            {localProducts.length === 0 ? 'Todavía no hay productos. Registra el primero desde Estantes.' : 'No hay coincidencias para esa búsqueda.'}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            )}

                            {activeTab === 'shelves' && (
                                <>
                                    {/* BÚSQUEDA DE PRODUCTOS, FILTRO FÍSICO POR ESTANTE Y CONTROL DE CHUNKS */}
                                    <div className="flex flex-col gap-4 mb-6">
                                        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
                                            {/* Buscador de Productos */}
                                            <div className="relative flex-1 max-w-md">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                <input 
                                                    type="text" 
                                                    placeholder="Buscar producto por código o nombre..."
                                                    value={searchTerm}
                                                    onChange={e => setSearchTerm(e.target.value)}
                                                    className="w-full bg-slate-800/80 border border-slate-700/50 pl-11 pr-12 py-3 rounded-[5px] text-sm font-medium outline-none focus:border-[#0ea5e9] shadow-lg transition-all"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setIsScannerOpen(true)}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-sky-300 hover:bg-sky-500/10"
                                                    aria-label="Escanear código con la cámara"
                                                    title="Escanear código con la cámara"
                                                >
                                                    <Camera size={18} />
                                                </button>
                                            </div>

                                            {/* Buscador / Filtro directo de Estante Físico (Highlight & Dim) */}
                                            <div className="relative flex-1 max-w-sm">
                                                <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-400" size={16} />
                                                <input
                                                    type="text"
                                                    placeholder="Localizar o filtrar estante físico (ej. A1, GENERAL)..."
                                                    value={shelfSearchQuery}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setShelfSearchQuery(val);
                                                        const trimmed = val.trim().toUpperCase();
                                                        if (!trimmed) {
                                                            setActiveEstante(null);
                                                            return;
                                                        }
                                                        const match = allEstantes.find(est => est.includes(trimmed));
                                                        if (match) {
                                                            setActiveEstante(match);
                                                            const el = document.getElementById(`shelf-col-${match}`);
                                                            if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                                                        }
                                                    }}
                                                    className="w-full bg-slate-900/90 border border-sky-500/40 pl-10 pr-9 py-3 rounded-[5px] text-sm font-medium text-white outline-none focus:border-sky-400 shadow-lg transition-all"
                                                />
                                                {(shelfSearchQuery || activeEstante) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setShelfSearchQuery('');
                                                            setActiveEstante(null);
                                                        }}
                                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                                                        title="Limpiar filtro de estante"
                                                    >
                                                        <X size={15} />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {/* Estado de Sincronización de Estantes */}
                                                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/70 rounded-[5px] text-xs font-mono tabular-nums">
                                                    <Layers size={15} className={Object.keys(dirtyChunksMap).length > 0 ? 'text-amber-400' : 'text-emerald-400'} />
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-bold text-slate-200 whitespace-nowrap">
                                                            { isFlushingChunks
                                                                ? 'Guardando en BD...'
                                                                : Object.keys(dirtyChunksMap).length > 0
                                                                ? `${Object.keys(dirtyChunksMap).length} cambio(s) pendiente(s)`
                                                                : 'Estantes Sincronizados' }
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                                            {totalSavedWrites} escrituras BD ahorradas
                                                        </span>
                                                    </div>
                                                    {Object.keys(dirtyChunksMap).length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => flushDirtyChunks(true)}
                                                            disabled={isFlushingChunks}
                                                            className="ml-2 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase text-[10px] rounded transition-colors whitespace-nowrap shrink-0"
                                                            title="Guardar cambios de estantes inmediatamente en la base de datos"
                                                        >
                                                            Guardar ya
                                                        </button>
                                                    )}
                                                </div>

                                                <button 
                                                    type="button"
                                                    onClick={() => setShowNewEstanteModal(true)}
                                                    className="bg-slate-800/80 border border-slate-700/50 text-slate-200 px-5 py-3 rounded-[5px] font-bold uppercase text-xs tracking-wider flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg active:scale-95 justify-center whitespace-nowrap shrink-0"
                                                >
                                                    <Folder size={16} className="text-[#0ea5e9]" /> Nueva Sección
                                                </button>
                                            </div>
                                        </div>

                                        {/* Barra Interactiva de Enfoque Rápido por Estante (Highlight seleccionado / Atenuar resto) */}
                                        {allEstantes.length > 0 && (
                                            <div className="flex items-center gap-1.5 overflow-x-auto py-2 px-3 bg-slate-900/70 border border-slate-800 rounded-[5px] hide-scrollbar">
                                                <span className="text-xs font-semibold text-slate-400 mr-2 flex items-center gap-1.5 whitespace-nowrap shrink-0">
                                                    <MapPin size={14} className="text-sky-400" />
                                                    Enfocar Estante:
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveEstante(null);
                                                        setShelfSearchQuery('');
                                                    }}
                                                    className={`px-3 py-1.5 text-xs font-bold rounded transition-colors whitespace-nowrap shrink-0 ${
                                                        activeEstante === null && !shelfSearchQuery.trim()
                                                            ? 'bg-sky-500 text-white shadow-sm'
                                                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                                    }`}
                                                >
                                                    Todos ({allEstantes.length})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNewEstanteModal(true)}
                                                    title="Crear un nuevo estante físico o pasillo (Widget Android)"
                                                    className="px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 bg-sky-500/15 border border-sky-400/40 text-sky-300 hover:bg-sky-500 hover:text-white shadow-sm active:scale-95"
                                                >
                                                    <div className="w-4 h-4 rounded bg-sky-500 text-white flex items-center justify-center font-bold text-[10px]">
                                                        +
                                                    </div>
                                                    <span>+ Estante</span>
                                                </button>
                                                {allEstantes.map((estante, idx) => {
                                                    const count = (estantesMap[estante] || []).length;
                                                    const isSelected = activeEstante === estante;
                                                    const dirtyCount = dirtyChunksMap[estante] || 0;
                                                    return (
                                                        <button
                                                            key={estante}
                                                            type="button"
                                                            onClick={() => focusAndScrollToShelf(estante)}
                                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 font-mono tabular-nums ${
                                                                isSelected
                                                                    ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                                                                    : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
                                                            }`}
                                                        >
                                                            <span className={`w-5 h-5 rounded text-[10px] font-black flex items-center justify-center shrink-0 ${
                                                                isSelected 
                                                                    ? 'bg-slate-950 text-cyan-300' 
                                                                    : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                                                            }`}>
                                                                {idx + 1}
                                                            </span>
                                                            <span>{estante === 'Sin Asignar' ? 'BODEGA GENERAL' : estante}</span>
                                                            <span className={isSelected ? 'text-slate-800' : 'text-slate-400'}>({count})</span>
                                                            {dirtyCount > 0 && (
                                                                <span className="text-amber-400 font-bold" title={`${dirtyCount} pendientes de guardar`}>
                                                                    *
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* DISEÑO KANBAN: COLUMNAS POR ESTANTE CON DESTACADO FÍSICO Y SCROLL LATERAL */}
                                    <div className="flex overflow-x-auto gap-5 pb-8 snap-x hide-scrollbar items-start h-[calc(100vh-300px)]">
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCorners}
                                            onDragStart={handleDragStart}
                                            onDragEnd={handleDragEnd}
                                        >
                                            <TrashDropZone />
                                            {allEstantes.length === 0 && (
                                                <div className="text-sm font-bold text-slate-400 py-2 w-full text-center">No hay estantes creados. Utiliza el widget "+ Añadir Estante".</div>
                                            )}
                                            {allEstantes.map((estante, chunkIdx) => {
                                                const productsInEstante = estantesMap[estante] || [];
                                                const normalizedShelfQuery = shelfSearchQuery.trim().toUpperCase();
                                                const matchesShelfQuery = normalizedShelfQuery
                                                    ? estante.toUpperCase().includes(normalizedShelfQuery)
                                                    : false;
                                                const hasActiveFilter = Boolean(activeEstante || normalizedShelfQuery);
                                                const isHighlighted = activeEstante === estante || ( !activeEstante && matchesShelfQuery );
                                                const isDimmed = hasActiveFilter && !isHighlighted;
                                                const dirtySlotsCount = dirtyChunksMap[estante] || 0;
                                                
                                                return (
                                                    <ShelfColumn 
                                                        key={estante}
                                                        id={`shelf-col-${estante}`}
                                                        chunkIndex={chunkIdx}
                                                        shelfName={estante} 
                                                        products={productsInEstante} 
                                                        onProductClick={handleEditProduct}
                                                        onAddProductClick={handleAddProductClick}
                                                        isHighlighted={isHighlighted}
                                                        isDimmed={isDimmed}
                                                        isDirtyChunk={dirtySlotsCount > 0}
                                                        dirtySlotsCount={dirtySlotsCount}
                                                        onSelectShelf={(name) => focusAndScrollToShelf(name)}
                                                        onChunkRenderStateChange={(name, isHydrated) => {
                                                            setHydratedChunksMap(prev =>
                                                                prev[name] === isHydrated ? prev : { ...prev, [name]: isHydrated }
                                                            );
                                                        }}
                                                    />
                                                );
                                            })}

                                            {/* WIDGET ESTILO ANDROID: BOTÓN DE CREACIÓN DE ESTANTES */}
                                            <button 
                                                type="button"
                                                onClick={() => setShowNewEstanteModal(true)} 
                                                className="w-[300px] min-h-[460px] flex-shrink-0 flex flex-col items-center justify-between p-6 bg-gradient-to-b from-slate-900/90 to-slate-950/95 border-2 border-dashed border-sky-500/40 hover:border-sky-400 rounded-[32px] transition-all group shadow-2xl hover:shadow-[0_0_35px_rgba(14,165,233,0.3)] hover:scale-[1.01] active:scale-[0.99] cursor-pointer relative overflow-hidden backdrop-blur-xl"
                                                title="Toca para crear un nuevo estante físico con niveles automáticos"
                                            >
                                                {/* Android Widget Header Badge */}
                                                <div className="w-full flex items-center justify-between pb-3 border-b border-white/5">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
                                                        WIDGET ALMACÉN
                                                    </span>
                                                    <span className="text-[10px] font-mono text-slate-500 uppercase">ANDROID UI</span>
                                                </div>

                                                {/* Android Launcher Squircle Icon */}
                                                <div className="flex flex-col items-center justify-center my-auto text-center py-4">
                                                    <div className="w-24 h-24 rounded-[28px] bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600 shadow-[0_12px_30px_rgba(14,165,233,0.45)] flex items-center justify-center text-white transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 active:scale-95 mb-5 ring-4 ring-white/10">
                                                        <Plus size={48} strokeWidth={2.8} />
                                                    </div>
                                                    <h3 className="text-lg font-black text-white tracking-tight uppercase group-hover:text-sky-300 transition-colors">
                                                        Crear Estante
                                                    </h3>
                                                    <p className="text-xs text-slate-400 mt-2 max-w-[220px] leading-relaxed">
                                                        Añade un nuevo pasillo o rack físico. Se generarán automáticamente los niveles para organizar productos.
                                                    </p>
                                                </div>

                                                {/* Android Widget Pill Action */}
                                                <div className="w-full pt-3 border-t border-white/5 flex justify-center">
                                                    <div className="px-5 py-2.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300 group-hover:bg-sky-500 group-hover:text-white text-xs font-black uppercase tracking-wider transition-all shadow-md">
                                                        + Añadir Sección
                                                    </div>
                                                </div>
                                            </button>
                                            <DragOverlay>
                                                {draggedProductId ? (
                                                    <ProductCard product={localProducts.find(p => p.id === draggedProductId)!} />
                                                ) : null}
                                            </DragOverlay>
                                        </DndContext>
                                    </div>
                                </>
                            )}

                            {activeTab === 'transfer' && (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Export Panel */}
                                        <div className="bg-slate-800/80 p-8 rounded-sm border border-slate-700/50 shadow-lg flex flex-col justify-between">
                                            <div>
                                                <div className="bg-blue-50 text-blue-600 p-4 rounded-[5px] w-fit mb-6">
                                                    <Download size={28} />
                                                </div>
                                                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Exportar Inventario</h3>
                                                <p className="text-sm text-slate-400 font-medium leading-relaxed mb-6">
                                                    Descarga el catálogo completo de productos actuales en un archivo estructurado JSON. Ideal para realizar respaldos o traspasos rápidos a otras sucursales.
                                                </p>
                                            </div>
                                            <button 
                                                onClick={handleExportJSON}
                                                className="w-full py-4 bg-[#0ea5e9] text-white font-bold uppercase text-xs tracking-widest rounded-[5px] hover:bg-blue-600 transition-colors shadow-md flex items-center justify-center gap-2"
                                            >
                                                <Download size={16} /> Descargar archivo JSON
                                            </button>
                                        </div>

                                        {/* Import Panel */}
                                        <div className="bg-slate-800/80 p-8 rounded-sm border border-slate-700/50 shadow-lg">
                                            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-[5px] w-fit mb-6">
                                                <Upload size={28} />
                                            </div>
                                            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Importar Inventario Massivo</h3>
                                            <p className="text-sm text-slate-400 font-medium leading-relaxed mb-6">
                                                Sube un archivo <strong>CSV o JSON</strong> para cargar tus productos masivamente. Columnas recomendadas: Nombre, Precio, Stock, Categoria.
                                            </p>
                                            <label className="border-2 border-dashed border-slate-700/50 hover:border-[#0ea5e9] rounded-[5px] p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center group">
                                                <Database size={32} className="text-slate-400 group-hover:text-[#0ea5e9] mb-2 transition-colors" />
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-slate-200">Seleccionar CSV o JSON</span>
                                                <input 
                                                    type="file" 
                                                    accept=".json,.csv"
                                                    onChange={handleImportFile}
                                                    className="hidden" 
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    {/* AI Discrepancies Table */}
                                    {isAnalyzing && (
                                        <div className="bg-slate-800/80 p-8 rounded-sm border border-slate-700/50 shadow-lg flex items-center justify-center py-16">
                                            <div className="text-center space-y-3">
                                                <Loader2 size={32} className="animate-spin text-[#0ea5e9] mx-auto" />
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI Sentinel analizando discrepancias...</p>
                                            </div>
                                        </div>
                                    )}

                                    {!isAnalyzing && importDiscrepancies.length > 0 && (
                                        <div className="bg-slate-800/80 p-8 rounded-sm border border-slate-700/50 shadow-lg space-y-6">
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-[8px] pb-6 border-b border-slate-700/50">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
                                                        <Sparkles size={24} />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Análisis de Discrepancias AI Sentinel</h3>
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">Se detectaron {importDiscrepancies.length} variaciones con respecto al catálogo actual</p>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={handleSyncImport}
                                                    disabled={syncingImport}
                                                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 text-white font-bold uppercase text-xs tracking-widest rounded-xl transition-colors shadow-md flex items-center gap-2"
                                                >
                                                    {syncingImport ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                                                    Aplicar Cambios en Nube
                                                </button>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-slate-700/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                            <th className="py-4">Producto</th>
                                                            <th className="py-4">Tipo</th>
                                                            <th className="py-4 text-center">Precio (Local vs Importado)</th>
                                                            <th className="py-4 text-center">Existencia (Local vs Importado)</th>
                                                            <th className="py-4">Detalle / Análisis de Fuga</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-200">
                                                        {importDiscrepancies.map((disc, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="py-4 font-bold text-white">{disc.name}</td>
                                                                <td className="py-4">
                                                                    {disc.type === 'new' && (
                                                                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">Nuevo</span>
                                                                    )}
                                                                    {disc.type === 'discrepancy' && (
                                                                        <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">Discrepante</span>
                                                                    )}
                                                                    {disc.type === 'missing_in_import' && (
                                                                        <span className="bg-red-50 text-red-700 border border-red-100 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">Faltante Importación</span>
                                                                    )}
                                                                </td>
                                                                <td className="py-4 text-center font-mono">
                                                                    {disc.type === 'new' ? (
                                                                        <span className="text-emerald-600 font-bold">${disc.importPrice}</span>
                                                                    ) : disc.priceDiff ? (
                                                                        <span className="text-amber-600 font-bold">${disc.localPrice} ➔ ${disc.importPrice}</span>
                                                                    ) : (
                                                                        <span className="text-slate-400">${disc.localPrice || 0}</span>
                                                                    )}
                                                                </td>
                                                                <td className="py-4 text-center font-mono">
                                                                    {disc.type === 'new' ? (
                                                                        <span className="text-emerald-600 font-bold">{disc.importStock} pzas</span>
                                                                    ) : disc.stockDiff ? (
                                                                        <span className="text-amber-600 font-bold">{disc.localStock} pzas ➔ {disc.importStock} pzas</span>
                                                                    ) : (
                                                                        <span className="text-slate-400">{disc.localStock || 0} pzas</span>
                                                                    )}
                                                                </td>
                                                                <td className="py-4">
                                                                    <div className="space-y-1">
                                                                        <span className="text-slate-400 block">{disc.details}</span>
                                                                        {disc.shrinkageWarning && (
                                                                            <span className="text-red-500 font-bold flex items-center gap-1 text-[10px] uppercase tracking-wider">
                                                                                <AlertTriangle size={12} /> Pérdida/Robo Hormiga Detectado
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'backup' && (
                                <div className="space-y-6">
                                    <CloudBackupConfigWidget compact={false} />
                                </div>
                            )}

                            {activeTab === 'trash' && (
                                <section className="border border-red-500/20 bg-slate-900/70 p-[8px] shadow-xl">
                                    <div className="mb-5 flex items-center gap-3 border-b border-slate-700 pb-4">
                                        <div className="bg-red-500/10 p-3 text-red-300"><Trash2 size={21} /></div>
                                        <div>
                                            <h2 className="font-black uppercase text-white">Papelera de reciclaje</h2>
                                            <p className="mt-1 text-xs text-slate-400">Los productos archivados no afectan el inventario activo ni el historial de ventas.</p>
                                        </div>
                                    </div>
                                    {trashLoading ? (
                                        <div className="py-12 text-center text-sm text-slate-400">Cargando papelera...</div>
                                    ) : trashedProducts.length === 0 ? (
                                        <div className="border border-dashed border-slate-700 py-14 text-center text-sm text-slate-500">La papelera está vacía.</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[680px] text-left text-sm">
                                                <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                                                    <tr>
                                                        <th className="px-3 py-3">Producto</th>
                                                        <th className="px-3 py-3">Código</th>
                                                        <th className="px-3 py-3">Archivado</th>
                                                        <th className="px-3 py-3 text-right">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800">
                                                    {trashedProducts.map(product => (
                                                        <tr key={product.id} className="hover:bg-slate-800/40">
                                                            <td className="px-3 py-3 font-semibold text-white">{product.name}</td>
                                                            <td className="px-3 py-3 font-mono text-xs text-slate-400">{product.barcode || product.id}</td>
                                                            <td className="px-3 py-3 text-xs text-slate-400">{product.deletedAt ? new Date(product.deletedAt).toLocaleString() : 'Sin fecha'}</td>
                                                            <td className="px-3 py-3 text-right">
                                                                <button type="button" onClick={() => handleRestoreProduct(product)} className="mr-2 inline-flex items-center gap-1 border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/10">
                                                                    <ArrowLeft size={14} /> Restaurar
                                                                </button>
                                                                {profile?.role === 'superadmin' && (
                                                                    <button type="button" onClick={() => handlePermanentDeleteProduct(product)} className="inline-flex items-center gap-1 border border-red-500/30 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10">
                                                                        <X size={14} /> Borrar
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </section>
                            )}

                            {activeTab === 'shrinkage' && (
                                <div className="space-y-8">
                                    {/* AI Sentinel Panel & Header */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        <div className="lg:col-span-2 bg-gradient-to-r from-red-500 to-red-600 p-8 rounded-[5px] text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
                                            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                                                <TrendingDown size={300} />
                                            </div>
                                            <div className="relative z-10">
                                                <div className="flex items-center gap-2 mb-4 bg-white/20 px-3 py-1 rounded-lg w-fit border border-white/30">
                                                    <Sparkles size={14} className="text-white" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-white">AI Sentinel Inteligencia</span>
                                                </div>
                                                <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Estimado de Pérdida por Robo Hormiga</h3>
                                                <p className="text-red-50 text-sm font-medium mb-6 max-w-lg leading-relaxed">
                                                    AI Sentinel monitorea las discrepancias físicas registradas por el personal y calcula la pérdida financiera total basada en costos de reposición y precios de venta.
                                                </p>
                                            </div>
                                            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-[8px] relative z-10 mt-4">
                                                <div>
                                                    <span className="text-[10px] font-bold text-red-100 uppercase tracking-wider">Pérdida Total Acumulada</span>
                                                    <h4 className="text-4xl font-[900] tracking-tighter text-white">
                                                        {formatCurrency(shrinkageLogs.reduce((acc, curr) => acc + (curr.estimatedLoss || 0), 0))}
                                                    </h4>
                                                </div>
                                                <button 
                                                    onClick={() => setIsReportModalOpen(true)}
                                                    className="px-6 py-4 bg-white text-red-700 font-black uppercase text-xs tracking-widest rounded-lg hover:bg-slate-100 transition-colors shadow-lg active:scale-95 text-center flex items-center justify-center gap-2"
                                                >
                                                    <AlertTriangle size={16} /> Reportar Producto Fantasma
                                                </button>
                                            </div>
                                        </div>

                                        {/* Sentinel Audit Insights */}
                                        <div className="bg-slate-800/80 p-8 rounded-sm border border-slate-700/50 shadow-lg flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-4 text-[#0ea5e9]">
                                                    <Shield size={20} />
                                                    <span className="text-xs font-black uppercase tracking-widest">Auditoría Preventiva</span>
                                                </div>
                                                <h4 className="font-extrabold text-white uppercase tracking-tight mb-3">Recomendación IA</h4>
                                                <p className="text-xs font-medium text-slate-400 leading-relaxed mb-4">
                                                    {shrinkageLogs.length > 0 ? (
                                                        `Se han detectado ${shrinkageLogs.filter(l => l.discrepancyType === 'missing').length} faltantes físicos en las últimas semanas. AI Sentinel sugiere realizar una auditoría forense especial en los estantes con categorías de mayor rotación.`
                                                    ) : (
                                                        "No se han registrado discrepancias físicas recientemente. El inventario actual se encuentra estable y alineado con los recuentos reportados."
                                                    )}
                                                </p>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded-[5px] border border-slate-700/50 flex items-center gap-3">
                                                <History className="text-slate-400" size={20} />
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Último Recuento</span>
                                                    <span className="text-xs font-bold text-slate-200">
                                                        {shrinkageLogs.length > 0 && parseShrinkageDate(shrinkageLogs[0].createdAt)
                                                            ? parseShrinkageDate(shrinkageLogs[0].createdAt)!.toLocaleDateString()
                                                            : 'Ninguno registrado'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Logs Table */}
                                    <div className="bg-slate-800/80 p-8 rounded-sm border border-slate-700/50 shadow-lg">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="bg-slate-100 text-slate-300 p-2.5 rounded-xl">
                                                <FileText size={20} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-white uppercase tracking-tight">Registro de Existencias Fantasma (Shrinkage Logs)</h3>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">Historial inmutable de discrepancias y pérdidas físicas</p>
                                            </div>
                                        </div>

                                        {shrinkageLogs.length === 0 ? (
                                            <div className="text-center py-12 border-2 border-dashed border-slate-700/50 rounded-[5px]">
                                                <Package size={48} className="text-slate-200 mx-auto mb-3" />
                                                <p className="text-slate-400 font-bold uppercase tracking-wider text-xs">Sin incidencias reportadas en el baúl</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-slate-700/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                            <th className="py-4">Fecha</th>
                                                            <th className="py-4">Producto</th>
                                                            <th className="py-4">Categoría</th>
                                                            <th className="py-4">Tipo</th>
                                                            <th className="py-4 text-center">Cant.</th>
                                                            <th className="py-4 text-right">Pérdida ($)</th>
                                                            <th className="py-4">Reportado Por</th>
                                                            <th className="py-4">Comentarios</th>
                                                            <th className="py-4 text-center">Acción</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-200">
                                                        {shrinkageLogs.map((log) => (
                                                            <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="py-4 text-slate-400 whitespace-nowrap">
                                                                    {parseShrinkageDate(log.createdAt)?.toLocaleString() || 'Reciente'}
                                                                </td>
                                                                <td className="py-4 font-bold text-white">{log.productName}</td>
                                                                <td className="py-4 text-slate-400">{log.productCategory}</td>
                                                                <td className="py-4">
                                                                    {log.discrepancyType === 'missing' ? (
                                                                        <span className="bg-red-50 text-red-700 border border-red-100 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">Faltante</span>
                                                                    ) : (
                                                                        <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">Sobrante</span>
                                                                    )}
                                                                </td>
                                                                <td className="py-4 text-center font-bold font-mono">{log.qty} pzas</td>
                                                                <td className="py-4 text-right font-bold font-mono text-red-600">
                                                                    {log.estimatedLoss > 0 ? formatCurrency(log.estimatedLoss) : '-'}
                                                                </td>
                                                                <td className="py-4 text-slate-400">{log.reportedBy}</td>
                                                                <td className="py-4 text-slate-400 italic max-w-xs truncate" title={log.notes}>
                                                                    {log.notes}
                                                                </td>
                                                                <td className="py-4 text-center">
                                                                    <button
                                                                        onClick={() => handleDeleteProduct(log.productId, log.productName)}
                                                                        className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"
                                                                        title="Confirmar pérdida total y eliminar producto"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* MODAL PARA CREAR ESTANTE/SECCIÓN */}
            <AnimatePresence>
                {showNewEstanteModal && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center p-4 backdrop-blur-md"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-[#1a1d2d] border border-white/10 rounded-sm p-8 w-full max-w-[550px] shadow-2xl relative overflow-hidden"
                        >
                            {/* Decorative Background Blob */}
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#0ea5e9]/20 blur-3xl rounded-full pointer-events-none" />

                            <button onClick={() => setShowNewEstanteModal(false)} className="absolute top-[8px] right-6 text-gray-500 hover:text-white transition-colors z-10 bg-black/20 p-2 rounded-full">
                                <X size={20} />
                            </button>
                            
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2 flex items-center gap-3 relative z-10">
                                <div className="bg-[#0ea5e9]/20 p-3 rounded-xl text-[#0ea5e9]">
                                    <Folder size={24} />
                                </div>
                                Crear Estante
                            </h3>
                            
                            <p className="text-sm text-gray-400 font-medium mb-6 relative z-10 leading-relaxed">
                                Ingresa el nombre o identificador del pasillo o sección física en bodega para organizar tu inventario.
                            </p>
                            
                            <div className="relative z-10 mb-8">
                                <input 
                                    type="text"
                                    value={newEstanteName}
                                    onChange={e => setNewEstanteName(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 p-4 rounded-[5px] font-bold text-white outline-none focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 transition-all uppercase placeholder-gray-600"
                                    placeholder="EJ. PASILLO B"
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateEstante(); }}
                                    autoFocus
                                />
                            </div>
                            
                            <div className="flex gap-[8px] relative z-10">
                                <button 
                                    onClick={() => setShowNewEstanteModal(false)}
                                    className="flex-1 py-4 border border-white/10 text-gray-400 font-bold uppercase text-sm tracking-wider rounded-[5px] hover:bg-slate-800/80/5 hover:text-white transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleCreateEstante}
                                    className="flex-1 py-4 bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] text-white font-black uppercase text-sm tracking-wider rounded-[5px] hover:scale-105 transition-transform shadow-[0_0_20px_rgba(14,165,233,0.3)]"
                                >
                                    Crear Estante
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MODAL REPORTAR ROBO HORMIGA / PRODUCTO FANTASMA */}
            <AnimatePresence>
                {isReportModalOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm"
                    >
                        <motion.div 
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="bg-slate-800/80 rounded-sm p-8 w-full max-w-[500px] shadow-2xl relative border border-slate-700/50"
                        >
                            <button onClick={() => setIsReportModalOpen(false)} className="absolute top-[8px] right-6 text-slate-400 hover:text-slate-200 transition-colors">
                                <X size={24} />
                            </button>
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2 flex items-center gap-2">
                                <AlertTriangle className="text-red-500 animate-bounce" size={28} /> Reportar Producto Fantasma
                            </h3>
                            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-6">
                                Registra pérdidas o sobrantes físicos identificados en bodega para ajustar stock de forma inmutable.
                            </p>
                            
                            <form onSubmit={handleSaveShrinkageReport} className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Seleccionar Producto *</label>
                                    <select 
                                        value={reportProductId}
                                        onChange={e => setReportProductId(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-700/50 p-4 rounded-xl font-bold text-white focus:border-[#0ea5e9] outline-none transition-all"
                                        required
                                    >
                                        <option value="">-- Selecciona el artículo --</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} (Stock registrado: {p.stock} {p.unitType || 'PZA'})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tipo de Incidencia *</label>
                                    <div className="grid grid-cols-2 gap-[8px]">
                                        <button
                                            type="button"
                                            onClick={() => setReportType('missing')}
                                            className={`py-3 rounded-xl font-bold uppercase text-xs tracking-wider border-2 transition-all ${reportType === 'missing' ? 'bg-red-50 text-red-600 border-red-500' : 'bg-slate-800/80 text-slate-400 border-slate-700/50'}`}
                                        >
                                            Faltante Físico
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setReportType('surplus')}
                                            className={`py-3 rounded-xl font-bold uppercase text-xs tracking-wider border-2 transition-all ${reportType === 'surplus' ? 'bg-blue-50 text-blue-600 border-blue-500' : 'bg-slate-800/80 text-slate-400 border-slate-700/50'}`}
                                        >
                                            Sobrante Físico
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Cantidad de Piezas (Discrepancia) *</label>
                                    <input 
                                        type="number"
                                        min="1"
                                        value={reportQty}
                                        onChange={e => setReportQty(Number(e.target.value))}
                                        className="w-full bg-slate-50 border border-slate-700/50 p-4 rounded-xl font-bold text-white focus:border-[#0ea5e9] outline-none transition-all"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Comentarios / Observaciones</label>
                                    <textarea 
                                        value={reportNotes}
                                        onChange={e => setReportNotes(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-700/50 p-4 rounded-xl font-medium text-white focus:border-[#0ea5e9] outline-none transition-all min-h-[80px]"
                                        placeholder="Ej. Faltante detectado durante inventario cíclico en pasillo principal..."
                                    />
                                </div>

                                <div className="flex gap-[8px] pt-4">
                                    <button 
                                        type="button"
                                        onClick={() => setIsReportModalOpen(false)}
                                        className="flex-1 py-4 border border-slate-700/50 text-slate-400 font-bold uppercase text-xs tracking-wider rounded-xl hover:bg-slate-50 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={savingReport}
                                        className="flex-1 py-4 bg-red-500 text-white font-bold uppercase text-xs tracking-wider rounded-xl hover:bg-red-600 transition-colors shadow-md shadow-red-500/20 disabled:bg-slate-300 flex items-center justify-center gap-2"
                                    >
                                        {savingReport ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        Registrar Incidencia
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MODAL IMPRIMIR QR ESTANTE */}
            <AnimatePresence>
                {qrPrintData && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm"
                    >
                        <motion.div 
                            initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            className="bg-slate-800/80 rounded-sm p-8 w-full max-w-[400px] shadow-2xl relative border border-slate-700/50 text-center"
                        >
                            <button onClick={() => setQrPrintData(null)} className="absolute top-[8px] right-6 text-slate-400 hover:text-slate-200 transition-colors">
                                <X size={24} />
                            </button>
                            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">
                                Etiqueta de Estante
                            </h3>
                            <p className="text-sm text-slate-400 font-bold uppercase tracking-wider mb-8">
                                {qrPrintData.estante} - {qrPrintData.nivel}
                            </p>
                            
                            <div className="flex justify-center mb-8 bg-slate-800/80 p-4 rounded-xl shadow-inner border border-slate-700/50 inline-block">
                                <QRCodeSVG 
                                    value={`{"type":"shelf","estante":"${qrPrintData.estante}","nivel":"${qrPrintData.nivel}"}`}
                                    size={200}
                                    level="H"
                                    includeMargin={true}
                                />
                            </div>

                            <button 
                                onClick={() => {
                                    window.print();
                                    setQrPrintData(null);
                                }}
                                className="w-full py-4 bg-[#0ea5e9] text-white font-bold uppercase text-xs tracking-wider rounded-xl hover:bg-sky-600 transition-colors shadow-md flex items-center justify-center gap-2"
                            >
                                <Printer size={18} /> Imprimir Etiqueta
                            </button>
                        </motion.div>
                    </motion.div>
                )}

                {/* Asistente de Recolección / Picking IA en Almacén */}
                {pickingOrder && (
                    <OrderPickingAssistant
                        order={pickingOrder}
                        role="inventory"
                        mode="picking"
                        onClose={() => setPickingOrder(null)}
                        onComplete={async (orderId) => {
                            setPickingOrder(null);
                            await finalizeOrderAndNotify(orderId, pickingOrder.deliveryType === 'PATIO' ? 'carga' : 'caja');
                        }}
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
                                broadcastSync({ action: 'ORDER_DELEGATED', id, target });
                                if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                                    (window as any).__inventorySocket.emit('sync_db_event', { action: 'ORDER_DELEGATED', id, target });
                                }
                                toast.success(`📦 Pedido delegado exitosamente a ${target.toUpperCase()}`);
                            } catch (err: any) {
                                toast.error(err.message || 'Error al delegar');
                            }
                        }}
                    />
                )}

                {/* Asistente de Recolección Multipedido en Cesta */}
                {multiPickingOrders && (
                    <MultiOrderPickingAssistant
                        orders={multiPickingOrders}
                        role="inventory"
                        onClose={() => setMultiPickingOrders(null)}
                        onCompleteOrder={async (orderId, target) => {
                            await finalizeOrderAndNotify(orderId, target === 'carga' ? 'carga' : 'caja');
                            setSelectedOrderIdsForBatch(prev => prev.filter(id => id !== orderId));
                        }}
                    />
                )}

                {/* Asistente de Deconstrucción / Reacomodo IA en Almacén */}
                {deconstructingOrder && (
                    <OrderPickingAssistant
                        order={deconstructingOrder}
                        role="inventory"
                        mode="deconstruction"
                        onClose={() => setDeconstructingOrder(null)}
                        onComplete={async (orderId) => {
                            try {
                                const res = await fetch('/api/orders', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: orderId, action: 'return_to_shelf' })
                                });
                                const data = await res.json().catch(() => null);
                                if (!res.ok || !data?.success) throw new Error(data?.error || 'Error al reincorporar artículos');
                                toast.success(`✅ Todos los materiales del pedido ${orderId} fueron restituidos a su anaquel en Almacén.`);
                                broadcastSync({ action: 'RESTOCK_COMPLETED', id: orderId });
                                if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                                    (window as any).__inventorySocket.emit('sync_db_event', { action: 'RESTOCK_COMPLETED', id: orderId });
                                }
                            } catch (err: any) {
                                toast.error(err.message || 'Error al devolver al anaquel');
                            } finally {
                                setDeconstructingOrder(null);
                            }
                        }}
                    />
                )}

                {/* MODAL DE ALERTA DE STOCK CRÍTICO */}
                <StockThresholdAlertModal
                    isOpen={isThresholdAlertModalOpen}
                    onClose={() => setIsThresholdAlertModalOpen(false)}
                    summary={alertSummary}
                    onConfigureThresholds={() => {
                        setIsThresholdAlertModalOpen(false);
                        setActiveTab('thresholds');
                    }}
                    onEditProduct={(product) => {
                        setIsThresholdAlertModalOpen(false);
                        handleEditProduct(product);
                    }}
                    onQuickRestock={(productId) => {
                        const found = localProducts.find((p) => p.id === productId);
                        if (found) {
                            setIsThresholdAlertModalOpen(false);
                            setRestockTargetProduct(found);
                        }
                    }}
                />
            </AnimatePresence>

            {/* MODAL DE RECARGA RÁPIDA DE PIEZAS (DOBLE CONFIRMACIÓN + AUDITORÍA) */}
            <QuickRestockModal
                isOpen={Boolean(restockTargetProduct)}
                product={restockTargetProduct}
                effectiveThreshold={
                    restockTargetProduct
                        ? (alertSummary.itemsMap[restockTargetProduct.id]?.effectiveThreshold ??
                           getProductEffectiveThreshold(restockTargetProduct, thresholdConfig))
                        : 5
                }
                recentEntries={restockHistory}
                onClose={() => setRestockTargetProduct(null)}
                onConfirmRestock={handleConfirmQuickRestock}
            />

            {/* TOAST FLOTANTE DE ALERTA DE STOCK MÍNIMO */}
            <StockThresholdAlertToast
                isVisible={isThresholdToastVisible && !isAlertSnoozed()}
                summary={alertSummary}
                onOpenModal={() => setIsThresholdAlertModalOpen(true)}
                onNavigateToThresholds={() => setActiveTab('thresholds')}
                onDismiss={() => setIsThresholdToastVisible(false)}
                onSnooze={() => {
                    setAlertSnooze(60);
                    setIsThresholdToastVisible(false);
                    toast.info('Alertas de stock mínimo pospuestas por 1 hora.');
                }}
            />

            {/* CÁMARA ESCÁNER */}
            {isScannerOpen && (
                <BarcodeScanner
                    onScanSuccess={handleScanSuccess}
                    onClose={() => setIsScannerOpen(false)}
                    isOpen={isScannerOpen}
                />
            )}

            <PinAuthorizationModal
                isOpen={Boolean(abandonTargetOrder)}
                onClose={() => setAbandonTargetOrder(null)}
                title="Autorizar Abandono de Surtido"
                description={`Ingresa tu NIP de operador o supervisor para liberar el pedido #${(abandonTargetOrder?.id || '').slice(-6).toUpperCase()} y devolverlo a la cola disponible.`}
                actionLabel="Liberar Pedido"
                actionTone="danger"
                requireReason={true}
                onAuthorized={handleAuthorizedAbandon}
            />

            {/* BARRA FLOTANTE DE CONFIGURACIÓN MASIVA TIPO GALERÍA (SOLO SUPERADMIN) */}
            {isSuperAdmin &&
                activeTab === 'catalog' &&
                selectedProductIds.filter((id) => localProducts.some((p) => p.id === id)).length > 0 && (
                    <div
                        role="region"
                        aria-label="Acciones masivas sobre productos seleccionados"
                        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[950] w-[calc(100%-1.5rem)] max-w-4xl rounded-2xl border border-cyan-500/40 bg-slate-950/95 px-4 py-3 shadow-2xl backdrop-blur-xl"
                    >
                        {bulkTrashConfirmOpen ? (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <span className="text-xs font-semibold text-rose-200">
                                    ¿Mover {selectedProductIds.filter((id) => localProducts.some((p) => p.id === id)).length} producto(s) seleccionado(s) a la papelera? Podrás restaurarlos después.
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={bulkActionBusy}
                                        onClick={() => setBulkTrashConfirmOpen(false)}
                                        className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        disabled={bulkActionBusy}
                                        onClick={() => void handleBatchArchiveSelected()}
                                        className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-rose-500 text-xs font-bold text-white hover:bg-rose-400 cursor-pointer disabled:opacity-60"
                                    >
                                        {bulkActionBusy ? 'Moviendo...' : 'Confirmar Papelera'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center justify-between gap-2.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-cyan-300 tabular-nums">
                                        {selectedProductIds.filter((id) => localProducts.some((p) => p.id === id)).length} seleccionados
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedProductIds([])}
                                        className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                                    >
                                        Limpiar
                                    </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                        type="button"
                                        disabled={bulkActionBusy}
                                        onClick={() => void handleBatchVisibility({ hidePublicStock: true })}
                                        className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/25 cursor-pointer disabled:opacity-50"
                                    >
                                        Ocultar piezas
                                    </button>
                                    <button
                                        type="button"
                                        disabled={bulkActionBusy}
                                        onClick={() => void handleBatchVisibility({ hidePublicStock: false })}
                                        className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-[11px] font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                                    >
                                        Mostrar piezas
                                    </button>
                                    <button
                                        type="button"
                                        disabled={bulkActionBusy}
                                        onClick={() => void handleBatchVisibility({ hideFromPublic: true })}
                                        className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/25 cursor-pointer disabled:opacity-50"
                                    >
                                        Ocultar tarjetas
                                    </button>
                                    <button
                                        type="button"
                                        disabled={bulkActionBusy}
                                        onClick={() => void handleBatchVisibility({ hideFromPublic: false })}
                                        className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/25 cursor-pointer disabled:opacity-50"
                                    >
                                        Hacer públicos
                                    </button>
                                    <button
                                        type="button"
                                        disabled={bulkActionBusy}
                                        onClick={() => setBulkTrashConfirmOpen(true)}
                                        className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-rose-500/50 bg-rose-600/20 text-[11px] font-semibold text-rose-200 hover:bg-rose-600/35 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                    >
                                        <Trash2 size={13} /> Papelera
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
        </div>
    );
}

