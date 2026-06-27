"use client";

import { useState, useEffect } from 'react';
import { useCart, type Product } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { db } from '@bunkker/core';
import { doc, setDoc, updateDoc, serverTimestamp, collection, addDoc, getDocs, query, where, orderBy, onSnapshot, writeBatch } from 'firebase/firestore';
import { logAudit } from '@bunkker/core';
import { QRCodeSVG } from 'qrcode.react';
import { 
    Package, Plus, Search, Edit3, Camera, MapPin, 
    Barcode, ArrowRight, ArrowLeft, Save, Loader2, X,
    Folder, FolderOpen, ChevronDown, ChevronUp, Shield, QrCode,
    Download, Upload, AlertTriangle, TrendingDown, History, Sparkles, Database, FileText,
    Mic, Printer, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, KeyboardSensor } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import BarcodeScanner from '@/components/BarcodeScanner';
import Link from 'next/link';
import ShelfColumn from './components/ShelfColumn';
import ProductCard from './components/ProductCard';
import { arrayMove } from '@dnd-kit/sortable';

export default function InventoryDashboard() {
    const { products, formatCurrency } = useCart();
    const { profile, isReadOnly } = useAuth();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [localProducts, setLocalProducts] = useState<Product[]>([]);

    useEffect(() => {
        // Sort products by orderIndex to keep them stable
        const sorted = [...products].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        setLocalProducts(sorted);
    }, [products]);

    // Tabs
    const [activeTab, setActiveTab] = useState<'shelves' | 'transfer' | 'shrinkage'>('shelves');

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

    // Carpetas y Escaneo
    const [customEstantes, setCustomEstantes] = useState<string[]>([]);
    const [expandedEstantes, setExpandedEstantes] = useState<Record<string, boolean>>({});
    const [activeEstante, setActiveEstante] = useState<string | null>(null);
    const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
    const [isListeningVoice, setIsListeningVoice] = useState(false);
    const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
    const [qrPrintData, setQrPrintData] = useState<{ estante: string, nivel: string } | null>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [newEstanteName, setNewEstanteName] = useState('');
    const [showNewEstanteModal, setShowNewEstanteModal] = useState(false);

    // Formulario de Nuevo Producto
    const [formData, setFormData] = useState({
        name: '', category: '', description: '',
        barcode: '', image: '',
        estante: '', fila: '',
        price: '', stock: '',
        warranty: '', unitType: 'PZA'
    });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragOver = (event: any) => {
        const { active, over } = event;
        if (!over) return;
        const activeId = active.id;
        const overId = over.id;
        if (activeId === overId) return;

        setLocalProducts(prev => {
            const activeIndex = prev.findIndex(p => p.id === activeId);
            const activeProduct = prev[activeIndex];
            if (!activeProduct) return prev;

            let targetShelfName = activeProduct.location?.estante || 'Sin Asignar';
            let targetLevelName = activeProduct.location?.fila || 'Nivel 1';

            if (typeof overId === 'string' && overId.includes('::')) {
                const parts = overId.split('::');
                targetShelfName = parts[0];
                targetLevelName = parts[1];
            } else {
                const overProduct = prev.find(p => p.id === overId);
                if (overProduct) {
                    targetShelfName = overProduct.location?.estante || 'Sin Asignar';
                    targetLevelName = overProduct.location?.fila || 'Nivel 1';
                }
            }

            const currentShelfName = activeProduct.location?.estante || 'Sin Asignar';
            const currentLevelName = activeProduct.location?.fila || 'Nivel 1';

            if (targetShelfName !== currentShelfName || targetLevelName !== currentLevelName) {
                // Moving between lists
                const newProducts = [...prev];
                newProducts[activeIndex] = {
                    ...activeProduct,
                    location: {
                        estante: targetShelfName === 'Sin Asignar' ? '' : targetShelfName,
                        fila: targetLevelName
                    }
                };
                return newProducts;
            }
            return prev;
        });
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setDraggedProductId(null);
        if (!over) return;

        const productId = active.id as string;
        const overId = over.id as string;
        
        let targetShelfName = '';
        let targetLevelName = '';
        let overIndex = localProducts.findIndex(p => p.id === overId);

        if (overId.includes('::')) {
            const parts = overId.split('::');
            targetShelfName = parts[0];
            targetLevelName = parts[1];
        } else {
            const targetProduct = localProducts.find(p => p.id === overId);
            if (targetProduct) {
                targetShelfName = targetProduct.location?.estante || 'Sin Asignar';
                targetLevelName = targetProduct.location?.fila || 'Nivel 1';
            }
        }

        const activeIndex = localProducts.findIndex(p => p.id === productId);
        const product = localProducts[activeIndex];
        if (!product) return;

        const currentShelfName = product.location?.estante || 'Sin Asignar';
        const currentLevelName = product.location?.fila || 'Nivel 1';

        // Reordering within the same level
        if (targetShelfName === currentShelfName && targetLevelName === currentLevelName) {
            if (active.id !== over.id) {
                const newProducts = arrayMove(localProducts, activeIndex, overIndex);
                // Update indexes for products in this level
                const levelProducts = newProducts.filter(p => 
                    (p.location?.estante || 'Sin Asignar') === currentShelfName && 
                    (p.location?.fila || 'Nivel 1') === currentLevelName
                );
                
                setLocalProducts(newProducts);

                try {
                    const batch = writeBatch(db);
                    levelProducts.forEach((p, idx) => {
                        batch.update(doc(db, 'products', p.id), {
                            orderIndex: idx
                        });
                    });
                    await batch.commit();
                } catch (error) {
                    console.error('Error actualizando orden:', error);
                }
            }
        } else {
            // Reubicación entre niveles (Cross-list drop)
            try {
                const finalShelfName = targetShelfName === 'Sin Asignar' ? '' : targetShelfName;
                
                // Optimizamos localmente
                const newProducts = [...localProducts];
                newProducts[activeIndex] = {
                    ...product,
                    location: { estante: finalShelfName, fila: targetLevelName }
                };
                setLocalProducts(newProducts);

                await updateDoc(doc(db, 'products', productId), {
                    'location.estante': finalShelfName,
                    'location.fila': targetLevelName,
                    updatedAt: serverTimestamp()
                });

                await logAudit({
                    type: 'INVENTORY_MOVE',
                    userId: profile?.uid || 'SYSTEM',
                    userName: profile?.displayName || 'Almacenista',
                    userRole: profile?.role || 'inventory',
                    description: `Movió "${product.name}" a ${targetShelfName} / ${targetLevelName}`,
                    metadata: { productId, from: currentShelfName, to: targetShelfName, level: targetLevelName }
                });
            } catch (error) {
                console.error('Error moviendo producto:', error);
                alert('No se pudo reubicar el producto.');
            }
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setDraggedProductId(event.active.id as string);
    };

    const handleExportJSON = () => {
        try {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(products, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `inventario-admincom-${Date.now()}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        } catch (err) {
            alert('Error al exportar inventario.');
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
                    alert('Archivo vacío o formato inválido.');
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
                alert('Error al leer el archivo. Asegúrate de que sea un JSON válido o un CSV delimitado por comas.');
            } finally {
                setIsAnalyzing(false);
            }
        };
        fileReader.readAsText(file);
    };

    const handleSyncImport = async () => {
        if (isReadOnly) {
            alert('Modo Demostración: No se pueden guardar cambios.');
            return;
        }
        if (rawImportedProducts.length === 0) return;

        setSyncingImport(true);
        try {
            for (const item of rawImportedProducts) {
                const productId = item.id || `PROD-${Date.now().toString().slice(-6)}`;
                await setDoc(doc(db, 'products', productId), {
                    ...item,
                    id: productId,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }

            await logAudit({
                type: 'CONFIG_UPDATE',
                userId: profile?.uid || 'SYSTEM',
                userName: profile?.displayName || 'Almacenista',
                userRole: profile?.role || 'almacen',
                description: `Importación completa de inventario (${rawImportedProducts.length} productos sincronizados).`,
                metadata: { count: rawImportedProducts.length }
            });

            alert('¡Sincronización completada con éxito!');
            setImportDiscrepancies([]);
            setRawImportedProducts([]);
        } catch (error) {
            console.error(error);
            alert('Ocurrió un error al sincronizar el inventario.');
        } finally {
            setSyncingImport(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'shrinkage') {
            const q = query(collection(db, 'shrinkage_logs'), orderBy('createdAt', 'desc'));
            const unsubscribe = onSnapshot(q, (snap: any) => {
                const list: any[] = [];
                snap.forEach((d: any) => list.push({ id: d.id, ...d.data() }));
                setShrinkageLogs(list);
            });
            return () => unsubscribe();
        }
    }, [activeTab]);

    const handleSaveShrinkageReport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly) {
            alert('Modo Demostración: Operación no permitida.');
            return;
        }
        if (!reportProductId || !reportQty) {
            alert('Por favor selecciona un producto y especifica la cantidad.');
            return;
        }

        const selectedProd = products.find(p => p.id === reportProductId);
        if (!selectedProd) return;

        setSavingReport(true);
        try {
            const qty = Number(reportQty);
            const loss = qty * selectedProd.price;
            const newStock = reportType === 'missing' 
                ? Math.max(0, selectedProd.stock - qty)
                : selectedProd.stock + qty;

            await addDoc(collection(db, 'shrinkage_logs'), {
                productId: selectedProd.id,
                productName: selectedProd.name,
                productCategory: selectedProd.category || 'General',
                discrepancyType: reportType,
                qty,
                estimatedLoss: reportType === 'missing' ? loss : 0,
                notes: reportNotes.trim() || 'Sin comentarios.',
                reportedBy: profile?.displayName || 'Almacenista',
                createdAt: serverTimestamp()
            });

            await setDoc(doc(db, 'products', selectedProd.id), {
                stock: newStock,
                updatedAt: serverTimestamp()
            }, { merge: true });

            await logAudit({
                type: 'SECURITY_ALERT',
                userId: profile?.uid || 'SYSTEM',
                userName: profile?.displayName || 'Almacenista',
                userRole: profile?.role || 'almacen',
                description: `Reporte de Producto Fantasma: ${selectedProd.name} (${reportType === 'missing' ? `Faltante de ${qty} pzas` : `Sobrante de ${qty} pzas`})`,
                metadata: { productId: selectedProd.id, qty, discrepancyType: reportType }
            });

            alert('¡Incidencia registrada y existencias corregidas en el sistema!');
            setIsReportModalOpen(false);
            setReportProductId('');
            setReportQty(1);
            setReportNotes('');
        } catch (err) {
            console.error(err);
            alert('Error al registrar incidencia.');
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
            barcode: '', image: '',
            estante: shelfName === 'Sin Asignar' ? '' : shelfName, 
            fila: levelName,
            price: '', stock: '',
            warranty: '', unitType: 'PZA'
        });
        setIsCreating(true);
        setStep(1);
    };

    const handleEditProduct = (p: Product) => {
        setEditingProductId(p.id);
        setFormData({
            name: p.name,
            category: p.category,
            description: p.description || '',
            barcode: p.barcode || '',
            image: p.image || '',
            estante: p.location?.estante || '',
            fila: p.location?.fila || '',
            price: String(p.price),
            stock: String(p.stock),
            warranty: (p as any).warranty || '',
            unitType: p.unitType || 'PZA'
        });
        setIsCreating(true);
        setStep(1);
    };

    const handleSaveProduct = async () => {
        if (isReadOnly) {
            alert('Modo Demostración: No se pueden guardar productos.');
            return;
        }

        if (!formData.name || !formData.price || !formData.stock) {
            alert('Nombre, Precio y Stock son obligatorios.');
            return;
        }

        // Regla: Forzar a almacenistas a poner estante y nivel
        if (profile?.role === 'inventory' && (!formData.estante || !formData.fila)) {
            alert('Atención Almacenista: Es obligatorio asignar Estante y Nivel/Fila para el producto.');
            return;
        }

        setLoading(true);
        const productId = editingProductId || `PROD-${Date.now().toString().slice(-6)}`;
        
        const newProduct: Product = {
            id: productId,
            name: formData.name,
            category: formData.category || 'General',
            description: formData.description,
            barcode: formData.barcode,
            image: formData.image || 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=400&q=80',
            price: parseFloat(formData.price),
            stock: parseFloat(formData.stock), // Acepta decimales para granel
            location: {
                estante: formData.estante || 'PISO/GRANEL',
                fila: formData.fila || 'PISO/GRANEL'
            },
            warranty: formData.warranty || '',
            unitType: (formData as any).unitType || 'PZA'
        };

        try {
            const dataToSave: any = {
                ...newProduct,
                updatedAt: new Date().toISOString()
            };
            if (!editingProductId) {
                dataToSave.createdAt = new Date().toISOString();
            }

            // ─── LOCAL EDGE API SYNC ───
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSave)
            });

            if (!res.ok) throw new Error('Error guardando en Edge API local');

            await logAudit({
                type: 'CONFIG_UPDATE',
                userId: profile?.uid || 'SYSTEM',
                userName: profile?.displayName || 'Almacenista',
                userRole: profile?.role || 'almacen',
                description: editingProductId 
                    ? `Producto Modificado: ${newProduct.name} (${newProduct.stock} uds)`
                    : `Nuevo Producto Ingresado: ${newProduct.name} (${newProduct.stock} uds)`,
                metadata: { productId, action: editingProductId ? 'update_product' : 'create_product' }
            });

            alert(editingProductId ? '✅ Producto actualizado con éxito.' : '✅ Producto registrado con éxito.');
            setIsCreating(false);
            setEditingProductId(null);
            setStep(1);
            setFormData({ name: '', category: '', description: '', barcode: '', image: '', estante: '', fila: '', price: '', stock: '', warranty: '', unitType: 'PZA' });
        } catch (error: any) {
            console.error(error);
            alert('Error al guardar el producto: ' + (error.message || 'Error desconocido'));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProduct = async (productId: string, productName: string) => {
        if (isReadOnly) {
            alert('Modo Demostración: Operación no permitida.');
            return;
        }
        if (profile?.role !== 'superadmin' && profile?.role !== 'admin') {
            alert('Solo el dueño o administrador general puede eliminar productos permanentemente.');
            return;
        }
        
        if (confirm(`¿ESTÁS SEGURO? Eliminarás definitivamente "${productName}" del sistema. Esta acción es irreversible y resolverá cualquier estado de "fantasma" / "merma" pendiente para este artículo.`)) {
            try {
                const { deleteDoc } = await import('firebase/firestore');
                await deleteDoc(doc(db, 'products', productId));
                
                await logAudit({
                    type: 'SECURITY_ALERT',
                    userId: profile?.uid || 'SYSTEM',
                    userName: profile?.displayName || 'Dueño',
                    userRole: profile?.role || 'admin',
                    description: `Producto Eliminado Definitivamente (Resolución de Pérdida): ${productName}`,
                    metadata: { productId, action: 'delete_product' }
                });
                
                alert('Producto marcado como pérdida/eliminado correctamente.');
                
                if (editingProductId === productId) {
                    setIsCreating(false);
                    setEditingProductId(null);
                }
            } catch (err) {
                console.error(err);
                alert('Error al eliminar el producto.');
            }
        }
    };

    const handleScanSuccess = (code: string) => {
        setIsScannerOpen(false);
        const p = products.find(prod => prod.id === code || prod.barcode === code);
        if (p) {
            const estante = (p.location?.estante || 'GENERAL').toUpperCase().trim();
            // Abrir la carpeta
            setExpandedEstantes(prev => ({ ...prev, [estante]: true }));
            // Resaltar en verde
            setHighlightedProductId(p.id);
            // Hacer scroll
            setTimeout(() => {
                const element = document.getElementById(`product-${p.id}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
            // Quitar el resaltado
            setTimeout(() => {
                setHighlightedProductId(null);
            }, 6000);
            
            // Auto-abrir la ficha técnica directamente en el Paso 3 (Stock) para agilizar recarga
            handleEditProduct(p);
            setStep(3);
            alert(`✅ Producto encontrado: ${p.name}. Listo para actualizar stock.`);
        } else {
            // No existe, abrir formulario con código pre-rellenado
            setEditingProductId(null);
            setFormData({
                name: '', category: '', description: '',
                barcode: code, image: '',
                estante: '', fila: '',
                price: '', stock: '', warranty: '', unitType: 'PZA'
            });
            setIsCreating(true);
            setStep(1);
            alert(`🔍 Código "${code}" no registrado. Completando formulario de nuevo ingreso...`);
        }
    };

    // Filtrar y agrupar productos por Estante (Folder)
    const filteredProducts = localProducts.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode?.includes(searchTerm)
    );

    const estantesMap = filteredProducts.reduce((acc: Record<string, Product[]>, p) => {
        const estante = (p.location?.estante || 'GENERAL').toUpperCase().trim();
        if (!acc[estante]) acc[estante] = [];
        acc[estante].push(p);
        return acc;
    }, {});

    const allEstantes = Array.from(new Set([
        ...Object.keys(estantesMap),
        ...customEstantes.map(e => e.toUpperCase().trim())
    ])).sort();

    const toggleEstante = (estante: string) => {
        setExpandedEstantes(prev => ({ ...prev, [estante]: !prev[estante] }));
    };

    return (
        <div className="bg-transparent min-h-screen p-4 md:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-[#0ea5e9] font-bold uppercase text-xs tracking-wider mb-4 transition-colors">
                    <ArrowLeft size={16} /> Volver al Tablero
                </Link>
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-slate-800/80 p-6 rounded-[32px] shadow-lg border border-slate-700/50">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#0ea5e9] p-4 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                            <Package size={32} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-[900] text-white uppercase tracking-tighter">ALMACÉN DE ESTANTES</h1>
                            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-1">Gestión de Inventario por Carpetas y Pasillos</p>
                        </div>
                    </div>
                    
                    <div className="flex gap-3 w-full md:w-auto">
                        <button 
                            onClick={() => setIsScannerOpen(true)}
                            className="bg-[#0ea5e9] text-white px-5 py-3 rounded-xl font-bold uppercase text-xs tracking-widest flex items-center gap-2 hover:bg-blue-600 transition-all shadow-md active:scale-95 flex-1 md:flex-none justify-center"
                        >
                            <QrCode size={16} /> Escanear Estante
                        </button>
                        
                        {!isCreating && (
                            <button 
                                onClick={() => { setEditingProductId(null); setIsCreating(true); setStep(1); }}
                                className="bg-emerald-500 text-white px-5 py-3 rounded-xl font-bold uppercase text-xs tracking-widest flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-md active:scale-95 flex-1 md:flex-none justify-center"
                            >
                                <Plus size={16} /> Nuevo Ingreso
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
                            className="bg-slate-800/80 rounded-[32px] p-8 border border-slate-700/50 shadow-xl max-w-4xl mx-auto"
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
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Categoría</label>
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

                            {/* STEP 2: IDENTIDAD Y FOTO */}
                            {step === 2 && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                    <div className="bg-blue-900/20 border border-blue-500/20 p-6 rounded-2xl flex flex-col md:flex-row gap-6 items-center">
                                        <div className="bg-slate-800/80 p-4 rounded-xl shadow-lg text-blue-500"><Barcode size={40}/></div>
                                        <div className="flex-1 w-full">
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Código de Barras / Serial</label>
                                            <input type="text" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl font-medium text-white placeholder-slate-500 focus:border-[#0ea5e9] outline-none transition-all" placeholder="Escanee o teclee el código" />
                                        </div>
                                    </div>
                                    <div className="bg-slate-900/50 border border-slate-700/50 p-6 rounded-2xl flex flex-col md:flex-row gap-6 items-center">
                                        <div className="bg-slate-800/80 p-4 rounded-xl shadow-lg text-slate-400"><Camera size={40}/></div>
                                        <div className="flex-1 w-full">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Cámara / Archivo</label>
                                            <input 
                                                type="file" 
                                                accept="image/*"
                                                capture="environment"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const img = new Image();
                                                        const objectUrl = URL.createObjectURL(file);
                                                        img.src = objectUrl;
                                                        img.onload = () => {
                                                            const canvas = document.createElement('canvas');
                                                            const MAX_WIDTH = 800;
                                                            const MAX_HEIGHT = 800;
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
                                                            
                                                            // Comprimir a WEBP con 70% de calidad para ahorrar muchísimo espacio (Offline Friendly)
                                                            const dataUrl = canvas.toDataURL('image/webp', 0.7);
                                                            setFormData({ ...formData, image: dataUrl });
                                                            URL.revokeObjectURL(objectUrl);
                                                        };
                                                    }
                                                }}
                                                className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl font-medium text-white focus:border-[#0ea5e9] outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-[#0ea5e9] file:text-white hover:file:bg-[#0ea5e9]/80 cursor-pointer" 
                                            />
                                            {formData.image && (
                                                <div className="mt-4 h-32 w-32 rounded-xl overflow-hidden border-2 border-[#0ea5e9] shadow-lg shadow-blue-500/20">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* STEP 3: STOCK Y UBICACIÓN */}
                            {step === 3 && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="bg-emerald-900/20 border border-emerald-500/20 p-6 rounded-2xl">
                                            <label className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-2 block">Precio (MXN) *</label>
                                            <input type="number" step="0.01" disabled={profile?.role === 'inventory' && !!editingProductId} value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-slate-900 border border-emerald-500/30 p-4 rounded-xl font-black text-2xl text-emerald-400 placeholder-emerald-900/50 outline-none transition-all disabled:opacity-50" placeholder="0.00" />
                                        </div>
                                        <div className="bg-blue-900/20 border border-blue-500/20 p-6 rounded-2xl">
                                            <label className="text-xs font-black text-blue-400 uppercase tracking-widest mb-2 block">Unidad de Medida *</label>
                                            <select disabled={profile?.role === 'marketing'} value={formData.unitType || 'PZA'} onChange={e => setFormData({...formData, unitType: e.target.value as any})} className="w-full bg-slate-900 border border-blue-500/30 p-4 rounded-xl font-black text-xl text-blue-400 outline-none transition-all disabled:opacity-50">
                                                <option value="PZA">Pieza (PZA)</option>
                                                <option value="KG">Kilos (KG)</option>
                                                <option value="M">Metros (M)</option>
                                                <option value="M3">Metros Cúbicos (M³)</option>
                                                <option value="BOLSA">Bolsa</option>
                                                <option value="CAJA">Caja</option>
                                            </select>
                                        </div>
                                        <div className="bg-amber-900/20 border border-amber-500/20 p-6 rounded-2xl">
                                            <label className="text-xs font-black text-amber-400 uppercase tracking-widest mb-2 block">Stock Físico *</label>
                                            <input type="number" step="any" disabled={profile?.role === 'marketing'} value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full bg-slate-900 border border-amber-500/30 p-4 rounded-xl font-black text-2xl text-amber-400 placeholder-amber-900/50 outline-none transition-all disabled:opacity-50" placeholder="0" />
                                        </div>
                                    </div>
                                    <div className="bg-indigo-900/20 border border-indigo-500/20 p-6 rounded-2xl">
                                        <div className="flex items-center gap-3 mb-4">
                                            <MapPin className="text-indigo-400" />
                                            <h3 className="font-black text-indigo-400 uppercase tracking-widest text-sm">Ubicación Física en Almacén</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
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
                            {/* TAB NAVIGATION */}
                            <div className="flex gap-2 mb-8 border-b-2 border-slate-700/50">
                                <button 
                                    type="button"
                                    onClick={() => setActiveTab('shelves')}
                                    className={`py-3 px-6 font-bold text-sm transition-all border-b-3 outline-none ${activeTab === 'shelves' ? 'text-[#0ea5e9] border-[#0ea5e9]' : 'text-slate-400 border-transparent hover:text-slate-300'}`}
                                >
                                    🗂️ Estantes
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setActiveTab('transfer')}
                                    className={`py-3 px-6 font-bold text-sm transition-all border-b-3 outline-none ${activeTab === 'transfer' ? 'text-[#0ea5e9] border-[#0ea5e9]' : 'text-slate-400 border-transparent hover:text-slate-300'}`}
                                >
                                    🔌 Importación/Exportación
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setActiveTab('shrinkage')}
                                    className={`py-3 px-6 font-bold text-sm transition-all border-b-3 outline-none ${activeTab === 'shrinkage' ? 'text-[#0ea5e9] border-[#0ea5e9]' : 'text-slate-400 border-transparent hover:text-slate-300'}`}
                                >
                                    🚨 Baúl de Robo Hormiga
                                </button>
                            </div>

                            {activeTab === 'shelves' && (
                                <>
                                    {/* BÚSQUEDA Y CREACIÓN DE SECCIONES */}
                                    <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-8">
                                        <div className="relative flex-1 max-w-md">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input 
                                                type="text" 
                                                placeholder="Buscar por código, nombre, estante..."
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                                className="w-full bg-slate-800/80 border border-slate-700/50 pl-12 pr-12 py-4 rounded-2xl font-medium outline-none focus:border-[#0ea5e9] shadow-lg transition-all"
                                            />

                                        </div>
                                        <button 
                                            onClick={() => setShowNewEstanteModal(true)}
                                            className="bg-slate-800/80 border border-slate-700/50 text-slate-200 px-6 py-4 rounded-2xl font-bold uppercase text-xs tracking-wider flex items-center gap-2 hover:bg-slate-50 transition-all shadow-lg active:scale-95 justify-center"
                                        >
                                            <Folder size={16} className="text-[#0ea5e9]" /> Nueva Sección
                                        </button>
                                    </div>

                                    {/* NUEVO DISEÑO KANBAN: COLUMNAS POR ESTANTE CON SCROLL INFINITO */}
                                    <div className="flex overflow-x-auto gap-6 pb-8 snap-x hide-scrollbar items-start h-[calc(100vh-300px)]">
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCorners}
                                            onDragStart={handleDragStart}
                                            onDragOver={handleDragOver}
                                            onDragEnd={handleDragEnd}
                                        >
                                            {allEstantes.length === 0 && (
                                                <div className="text-sm font-bold text-slate-400 py-2 w-full text-center">No hay estantes creados. Utiliza "Nueva Sección".</div>
                                            )}
                                            {allEstantes.map(estante => {
                                                const productsInEstante = estantesMap[estante] || [];
                                                
                                                return (
                                                    <ShelfColumn 
                                                        key={estante} 
                                                        shelfName={estante} 
                                                        products={productsInEstante} 
                                                        onProductClick={handleEditProduct}
                                                        onAddProductClick={handleAddProductClick}
                                                    />
                                                );
                                            })}
                                            <button 
                                                onClick={() => setShowNewEstanteModal(true)} 
                                                className="w-[340px] flex-shrink-0 flex flex-col items-center justify-center bg-slate-900/40 border-2 border-dashed border-slate-700/50 hover:border-[#0ea5e9] hover:bg-[#0ea5e9]/10 rounded-2xl h-full transition-all group"
                                            >
                                                <Plus size={48} className="text-slate-600 group-hover:text-[#0ea5e9] mb-4 transition-colors" />
                                                <span className="text-sm font-bold text-slate-500 group-hover:text-[#0ea5e9] uppercase tracking-widest transition-colors">Añadir Estante</span>
                                            </button>
                                            <DragOverlay>
                                                {draggedProductId ? (
                                                    <ProductCard product={products.find(p => p.id === draggedProductId)!} />
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
                                        <div className="bg-slate-800/80 p-8 rounded-[32px] border border-slate-700/50 shadow-lg flex flex-col justify-between">
                                            <div>
                                                <div className="bg-blue-50 text-blue-600 p-4 rounded-2xl w-fit mb-6">
                                                    <Download size={28} />
                                                </div>
                                                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Exportar Inventario</h3>
                                                <p className="text-sm text-slate-400 font-medium leading-relaxed mb-6">
                                                    Descarga el catálogo completo de productos actuales en un archivo estructurado JSON. Ideal para realizar respaldos o traspasos rápidos a otras sucursales.
                                                </p>
                                            </div>
                                            <button 
                                                onClick={handleExportJSON}
                                                className="w-full py-4 bg-[#0ea5e9] text-white font-bold uppercase text-xs tracking-widest rounded-2xl hover:bg-blue-600 transition-colors shadow-md flex items-center justify-center gap-2"
                                            >
                                                <Download size={16} /> Descargar archivo JSON
                                            </button>
                                        </div>

                                        {/* Import Panel */}
                                        <div className="bg-slate-800/80 p-8 rounded-[32px] border border-slate-700/50 shadow-lg">
                                            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl w-fit mb-6">
                                                <Upload size={28} />
                                            </div>
                                            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Importar Inventario Massivo</h3>
                                            <p className="text-sm text-slate-400 font-medium leading-relaxed mb-6">
                                                Sube un archivo <strong>CSV o JSON</strong> para cargar tus productos masivamente. Columnas recomendadas: Nombre, Precio, Stock, Categoria.
                                            </p>
                                            <label className="border-2 border-dashed border-slate-700/50 hover:border-[#0ea5e9] rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center group">
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
                                        <div className="bg-slate-800/80 p-8 rounded-[32px] border border-slate-700/50 shadow-lg flex items-center justify-center py-16">
                                            <div className="text-center space-y-3">
                                                <Loader2 size={32} className="animate-spin text-[#0ea5e9] mx-auto" />
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI Sentinel analizando discrepancias...</p>
                                            </div>
                                        </div>
                                    )}

                                    {!isAnalyzing && importDiscrepancies.length > 0 && (
                                        <div className="bg-slate-800/80 p-8 rounded-[32px] border border-slate-700/50 shadow-lg space-y-6">
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-700/50">
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

                            {activeTab === 'shrinkage' && (
                                <div className="space-y-8">
                                    {/* AI Sentinel Panel & Header */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        <div className="lg:col-span-2 bg-gradient-to-r from-red-500 to-red-600 p-8 rounded-2xl text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
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
                                            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 relative z-10 mt-4">
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
                                        <div className="bg-slate-800/80 p-8 rounded-[32px] border border-slate-700/50 shadow-lg flex flex-col justify-between">
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
                                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-700/50 flex items-center gap-3">
                                                <History className="text-slate-400" size={20} />
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Último Recuento</span>
                                                    <span className="text-xs font-bold text-slate-200">
                                                        {shrinkageLogs.length > 0 ? new Date(shrinkageLogs[0].createdAt?.seconds * 1000 || Date.now()).toLocaleDateString() : 'Ninguno registrado'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Logs Table */}
                                    <div className="bg-slate-800/80 p-8 rounded-[32px] border border-slate-700/50 shadow-lg">
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
                                            <div className="text-center py-12 border-2 border-dashed border-slate-700/50 rounded-2xl">
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
                                                                    {log.createdAt ? new Date(log.createdAt.seconds * 1000).toLocaleString() : 'Reciente'}
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
                            className="bg-[#1a1d2d] border border-white/10 rounded-[32px] p-8 w-full max-w-[550px] shadow-2xl relative overflow-hidden"
                        >
                            {/* Decorative Background Blob */}
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#0ea5e9]/20 blur-3xl rounded-full pointer-events-none" />

                            <button onClick={() => setShowNewEstanteModal(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors z-10 bg-black/20 p-2 rounded-full">
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
                                    className="w-full bg-black/50 border border-white/10 p-4 rounded-2xl font-bold text-white outline-none focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 transition-all uppercase placeholder-gray-600"
                                    placeholder="EJ. PASILLO B"
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateEstante(); }}
                                    autoFocus
                                />
                            </div>
                            
                            <div className="flex gap-4 relative z-10">
                                <button 
                                    onClick={() => setShowNewEstanteModal(false)}
                                    className="flex-1 py-4 border border-white/10 text-gray-400 font-bold uppercase text-sm tracking-wider rounded-2xl hover:bg-slate-800/80/5 hover:text-white transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleCreateEstante}
                                    className="flex-1 py-4 bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] text-white font-black uppercase text-sm tracking-wider rounded-2xl hover:scale-105 transition-transform shadow-[0_0_20px_rgba(14,165,233,0.3)]"
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
                            className="bg-slate-800/80 rounded-[32px] p-8 w-full max-w-[500px] shadow-2xl relative border border-slate-700/50"
                        >
                            <button onClick={() => setIsReportModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-200 transition-colors">
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
                                    <div className="grid grid-cols-2 gap-4">
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

                                <div className="flex gap-4 pt-4">
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
                            className="bg-slate-800/80 rounded-[32px] p-8 w-full max-w-[400px] shadow-2xl relative border border-slate-700/50 text-center"
                        >
                            <button onClick={() => setQrPrintData(null)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-200 transition-colors">
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
            </AnimatePresence>

            {/* CÁMARA ESCÁNER */}
            {isScannerOpen && (
                <BarcodeScanner
                    onScanSuccess={handleScanSuccess}
                    onClose={() => setIsScannerOpen(false)}
                    isOpen={isScannerOpen}
                />
            )}
        </div>
    );
}
