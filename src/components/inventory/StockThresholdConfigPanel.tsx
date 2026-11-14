"use client";

import React, { useState, useMemo } from 'react';
import { 
  Bell, BellOff, Volume2, VolumeX, ShieldAlert, AlertTriangle, 
  CheckCircle2, Search, Filter, Save, RefreshCw, Sliders, 
  Sparkles, Package, Layers, Info, Check, ArrowRight
} from 'lucide-react';
import type { Product } from '@/lib/types';
import { 
  type StockThresholdConfig, 
  type StockAlertSummary,
  loadStockThresholdConfig, 
  saveStockThresholdConfig, 
  computeInventoryStockAlerts,
  DEFAULT_STOCK_THRESHOLD_CONFIG
} from '@/lib/stockThresholds';
import { toast } from '@/lib/toast';
import { playErrorBeep, playIncrementBeep } from '@/lib/scannerAudio';
import { broadcastSync } from '@/lib/syncNotifier';

interface StockThresholdConfigPanelProps {
  products: Product[];
  config?: StockThresholdConfig;
  onSaveConfig?: (newConfig: StockThresholdConfig) => void;
  onProductUpdated?: (productId: string, newMinStock: number) => void;
  onUpdateProductThreshold?: (productId: string, newMinStock: number) => void;
  onOpenAlertModal?: () => void;
  formatCurrency?: (val: number) => string;
}

export default function StockThresholdConfigPanel({
  products,
  config: initialConfig,
  onSaveConfig,
  onProductUpdated,
  onUpdateProductThreshold,
  onOpenAlertModal,
  formatCurrency = (v) => `$${v.toFixed(2)}`
}: StockThresholdConfigPanelProps) {
  const [config, setConfig] = useState<StockThresholdConfig>(() => initialConfig || loadStockThresholdConfig());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'alerts' | 'critical' | 'healthy'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Local state for pending minStock edits per product
  const [editingThresholds, setEditingThresholds] = useState<Record<string, number>>({});
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  // Compute live alerts summary based on current products and config
  const alertSummary: StockAlertSummary = useMemo(() => {
    return computeInventoryStockAlerts(products, config);
  }, [products, config]);

  // Handle toggles
  const handleToggleAlerts = () => {
    const nextVal = !config.alertsEnabled;
    const updated = saveStockThresholdConfig({ alertsEnabled: nextVal });
    setConfig(updated);
    if (onSaveConfig) onSaveConfig(updated);
    if (nextVal) {
      toast.success('Notificaciones automáticas de stock mínimo activadas.', '🔔 Alertas');
      if (config.soundAlerts) playIncrementBeep(0.5);
    } else {
      toast.info('Notificaciones automáticas pausadas.', '🔕 Alertas');
    }
  };

  const handleToggleSound = () => {
    const nextVal = !config.soundAlerts;
    const updated = saveStockThresholdConfig({ soundAlerts: nextVal });
    setConfig(updated);
    if (onSaveConfig) onSaveConfig(updated);
    if (nextVal) {
      playIncrementBeep(0.6);
      toast.success('Sonido de alerta habilitado.');
    } else {
      toast.info('Alertas sonoras silenciadas.');
    }
  };

  const handleDefaultThresholdChange = (val: number) => {
    const safeVal = Math.max(1, Math.floor(val));
    const updated = saveStockThresholdConfig({ defaultThreshold: safeVal });
    setConfig(updated);
    if (onSaveConfig) onSaveConfig(updated);
    toast.info(`Umbral global por defecto fijado en ${safeVal} unidades.`);
  };

  const handleCategoryThresholdChange = (cat: string, val: number) => {
    const safeVal = Math.max(0, Math.floor(val));
    const nextCategories = { ...config.categoryThresholds, [cat]: safeVal };
    const updated = saveStockThresholdConfig({ categoryThresholds: nextCategories });
    setConfig(updated);
    if (onSaveConfig) onSaveConfig(updated);
    toast.info(`Umbral para categoría "${cat}" fijado en ${safeVal} unidades.`);
  };

  const handleTestAlert = () => {
    if (config.soundAlerts) {
      playErrorBeep(0.7);
    }
    toast.warning(
      `Prueba de Alerta: ${alertSummary.totalAlerts} producto(s) en o por debajo del umbral mínimo configurado.`,
      '⚠️ Monitor de Existencias'
    );
  };

  // Save an individual product's minStock to the backend API and store
  const handleSaveProductMinStock = async (product: Product, thresholdValue: number) => {
    setSavingProductId(product.id);
    const safeVal = Math.max(0, Math.floor(thresholdValue));

    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.id,
          minStock: safeVal
        })
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        // Also save to local custom config map for instant UI reflection
        const nextCustom = { ...config.customThresholds, [product.id]: safeVal };
        const updatedConfig = saveStockThresholdConfig({ customThresholds: nextCustom });
        setConfig(updatedConfig);

        // Clear local edit draft
        setEditingThresholds(prev => {
          const copy = { ...prev };
          delete copy[product.id];
          return copy;
        });

        if (onProductUpdated) {
          onProductUpdated(product.id, safeVal);
        }
        if (onUpdateProductThreshold) {
          onUpdateProductThreshold(product.id, safeVal);
        }

        broadcastSync({ action: 'STOCK_THRESHOLD_UPDATED', productId: product.id, minStock: safeVal });
        toast.success(`Umbral de "${product.name}" actualizado a ${safeVal} unidades.`);
      } else {
        throw new Error(data?.error || 'No se pudo guardar el umbral.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al conectar con el servidor.');
    } finally {
      setSavingProductId(null);
    }
  };

  // Bulk apply category threshold to all products in that category
  const handleApplyCategoryToAllProducts = async (cat: string) => {
    const targetThreshold = config.categoryThresholds[cat] ?? config.defaultThreshold;
    const catProducts = products.filter(p => (p.category || '').trim() === cat);
    if (catProducts.length === 0) {
      toast.info(`No hay productos en la categoría "${cat}".`);
      return;
    }

    setIsBulkSaving(true);
    try {
      const batchUpdates = catProducts.map(p => ({
        id: p.id,
        minStock: targetThreshold
      }));

      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchUpdates })
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        catProducts.forEach(p => {
          if (onProductUpdated) onProductUpdated(p.id, targetThreshold);
        });

        // Update local config
        const nextCustom = { ...config.customThresholds };
        catProducts.forEach(p => { nextCustom[p.id] = targetThreshold; });
        const updated = saveStockThresholdConfig({ customThresholds: nextCustom });
        setConfig(updated);

        broadcastSync({ action: 'STOCK_THRESHOLDS_BATCH_UPDATED', category: cat, minStock: targetThreshold });
        toast.success(`Umbral de ${targetThreshold} unidades aplicado a ${catProducts.length} producto(s) de "${cat}".`);
      } else {
        throw new Error(data?.error || 'Error en actualización masiva.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al aplicar umbrales.');
    } finally {
      setIsBulkSaving(false);
    }
  };

  // Filtered list of products for the table
  const displayedProducts = useMemo(() => {
    return products.filter(p => {
      const analysis = alertSummary.itemsMap[p.id];
      if (!analysis) return true;

      // Filter by status
      if (filterStatus === 'alerts' && !analysis.isAlert) return false;
      if (filterStatus === 'critical' && analysis.status !== 'out_of_stock') return false;
      if (filterStatus === 'healthy' && analysis.status !== 'healthy') return false;

      // Filter by category
      if (selectedCategory !== 'all' && (p.category || '').trim() !== selectedCategory) {
        return false;
      }

      // Filter by search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchBarcode = (p.barcode || '').toLowerCase().includes(q);
        const matchCategory = (p.category || '').toLowerCase().includes(q);
        const matchShelf = (p.location?.estante || p.estante || '').toLowerCase().includes(q);
        if (!matchName && !matchBarcode && !matchCategory && !matchShelf) {
          return false;
        }
      }

      return true;
    });
  }, [products, alertSummary, filterStatus, selectedCategory, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ── HEADER PANEL DE CONTROL DE ALERTAS Y UMBRALES ── */}
      <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                <Sliders size={20} />
              </span>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">
                Configuración de Umbrales Mínimos & Alertas
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Define las existencias de seguridad por producto o categoría. El sistema emitirá alertas
              automáticas en pantalla y auditoría cuando las piezas lleguen al límite fijado.
            </p>
          </div>

          {/* Quick controls: Master notification toggle, Sound, and Test alert */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleToggleAlerts}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-md ${
                config.alertsEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/50 hover:bg-red-500/30'
              }`}
              title="Activar o desactivar notificaciones de stock"
            >
              {config.alertsEnabled ? <Bell size={15} /> : <BellOff size={15} />}
              {config.alertsEnabled ? 'Alertas: ACTIVAS' : 'Alertas: PAUSADAS'}
            </button>

            <button
              onClick={handleToggleSound}
              className={`p-2 rounded-xl transition-all border ${
                config.soundAlerts
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title={config.soundAlerts ? 'Sonido de alerta habilitado' : 'Sonido silenciado'}
            >
              {config.soundAlerts ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            <button
              onClick={handleTestAlert}
              className="px-3 py-2 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
              title="Probar sonido y notificación en pantalla"
            >
              <AlertTriangle size={14} /> Probar Alerta
            </button>
          </div>
        </div>

        {/* ── RESUMEN MÉTRICO DE ESTADO DE STOCK ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Catálogo Evaluado</span>
            <span className="text-2xl font-black text-white mt-1">{products.length}</span>
            <span className="text-[10px] text-cyan-400 mt-0.5">Productos en bodega</span>
          </div>

          <div className={`p-3.5 rounded-xl border flex flex-col ${
            alertSummary.criticalCount > 0 
              ? 'bg-red-950/30 border-red-500/40 text-red-200' 
              : 'bg-slate-950/60 border-slate-800 text-slate-400'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              Stock Crítico (Agotados)
            </span>
            <span className="text-2xl font-black text-red-400 mt-1">{alertSummary.criticalCount}</span>
            <span className="text-[10px] text-red-300/80 mt-0.5">Requieren compra urgente</span>
          </div>

          <div className={`p-3.5 rounded-xl border flex flex-col ${
            alertSummary.lowStockCount > 0 
              ? 'bg-amber-950/30 border-amber-500/40 text-amber-200' 
              : 'bg-slate-950/60 border-slate-800 text-slate-400'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              En Límite Mínimo
            </span>
            <span className="text-2xl font-black text-amber-400 mt-1">{alertSummary.lowStockCount}</span>
            <span className="text-[10px] text-amber-300/80 mt-0.5">Stock &le; Umbral definido</span>
          </div>

          <div className="bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-500/30 flex flex-col">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Stock Saludable</span>
            <span className="text-2xl font-black text-emerald-300 mt-1">{alertSummary.healthyCount}</span>
            <span className="text-[10px] text-emerald-400/80 mt-0.5">Existencias óptimas</span>
          </div>
        </div>

        {/* ── PARÁMETROS GLOBALES Y POR CATEGORÍA ── */}
        <div className="mt-5 pt-5 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-2 mb-2">
              <Info size={14} className="text-cyan-400" />
              Umbral Global por Defecto
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="999"
                value={config.defaultThreshold}
                onChange={(e) => handleDefaultThresholdChange(Number(e.target.value))}
                className="w-24 bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg font-black text-base text-cyan-300 outline-none focus:border-cyan-500"
              />
              <span className="text-xs text-slate-400">piezas mínimas para productos sin límite individual.</span>
            </div>
          </div>

          {/* Categorías con umbrales configurados */}
          <div className="md:col-span-2 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center justify-between mb-2">
              <span className="flex items-center gap-2">
                <Layers size={14} className="text-cyan-400" />
                Umbrales Rápidos por Categoría
              </span>
              <span className="text-[10px] text-slate-400">Aplica como regla estándar para la familia</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-28 overflow-y-auto pr-1">
              {categories.map((cat) => {
                const currentCatThreshold = config.categoryThresholds[cat] ?? config.defaultThreshold;
                return (
                  <div key={cat} className="flex items-center justify-between bg-slate-900/90 border border-slate-800 p-2 rounded-lg gap-2">
                    <span className="text-xs font-medium text-slate-300 truncate" title={cat}>{cat}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min="0"
                        max="999"
                        value={currentCatThreshold}
                        onChange={(e) => handleCategoryThresholdChange(cat, Number(e.target.value))}
                        className="w-14 bg-slate-950 border border-slate-700 px-1.5 py-1 text-center font-bold text-xs text-white rounded outline-none focus:border-cyan-500"
                        title={`Modificar umbral de categoría ${cat}`}
                      />
                      <button
                        onClick={() => handleApplyCategoryToAllProducts(cat)}
                        disabled={isBulkSaving}
                        className="p-1 bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/40 rounded transition-colors"
                        title="Aplicar este umbral a todos los productos de esta categoría"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── TABLA DE PRODUCTOS Y ASIGNACIÓN DE LÍMITES INDIVIDUALES ── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Catálogo de Existencias & Límites Mínimos ({displayedProducts.length})
            </h3>
          </div>

          {/* Filtros rápidos de estado */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 flex-wrap">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                filterStatus === 'all' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({products.length})
            </button>
            <button
              onClick={() => setFilterStatus('alerts')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                filterStatus === 'alerts' ? 'bg-amber-400 text-slate-950' : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              <AlertTriangle size={12} /> En Alerta ({alertSummary.totalAlerts})
            </button>
            <button
              onClick={() => setFilterStatus('critical')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                filterStatus === 'critical' ? 'bg-red-500 text-white' : 'text-red-400 hover:text-red-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
              Agotados ({alertSummary.criticalCount})
            </button>
            <button
              onClick={() => setFilterStatus('healthy')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                filterStatus === 'healthy' ? 'bg-emerald-500 text-slate-950' : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              Saludables ({alertSummary.healthyCount})
            </button>
          </div>
        </div>

        {/* Barra de búsqueda y categoría */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, código de barras, categoría o estante..."
              className="w-full bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500/60"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 px-3 py-2.5 rounded-xl text-xs text-slate-300 outline-none focus:border-cyan-500/60"
          >
            <option value="all">Todas las Categorías</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Tabla Responsiva de Artículos */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-widest text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Producto</th>
                <th className="py-3 px-3">Ubicación</th>
                <th className="py-3 px-3 text-right">Precio</th>
                <th className="py-3 px-3 text-center">Stock Físico</th>
                <th className="py-3 px-3 text-center">Umbral Mínimo</th>
                <th className="py-3 px-3">Estado de Alerta</th>
                <th className="py-3 px-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {displayedProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Package className="mx-auto mb-2 text-slate-600" size={32} />
                    No se encontraron productos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                displayedProducts.map((product) => {
                  const analysis = alertSummary.itemsMap[product.id];
                  const currentDraft = editingThresholds[product.id] !== undefined
                    ? editingThresholds[product.id]
                    : analysis.effectiveThreshold;
                  const isModified = editingThresholds[product.id] !== undefined && editingThresholds[product.id] !== analysis.effectiveThreshold;
                  const isSavingThis = savingProductId === product.id;

                  return (
                    <tr 
                      key={product.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        analysis.status === 'out_of_stock' 
                          ? 'bg-red-950/15' 
                          : analysis.status === 'low_stock' 
                            ? 'bg-amber-950/10' 
                            : ''
                      }`}
                    >
                      {/* Producto */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {product.image ? (
                            <img 
                              src={product.image} 
                              alt={product.name}
                              className="w-10 h-10 object-cover rounded-lg border border-slate-700 shrink-0" 
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                              <Package size={18} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-bold text-white block truncate max-w-xs">{product.name}</span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              <span className="bg-slate-800 px-1.5 py-0.2 rounded text-slate-300">{product.category || 'General'}</span>
                              {product.barcode && <span>BAR: {product.barcode}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Ubicación */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="text-[11px] font-medium text-slate-300">
                          {product.location?.estante || product.estante || 'Sin Asignar'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {product.location?.fila || product.fila || 'N/A'}
                        </div>
                      </td>

                      {/* Precio */}
                      <td className="py-3 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                        {formatCurrency(Number(product.price) || 0)}
                      </td>

                      {/* Stock actual */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`inline-block font-black text-sm px-2.5 py-1 rounded-lg ${
                          product.stock <= 0
                            ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                            : product.stock <= analysis.effectiveThreshold
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}>
                          {product.stock} {product.unitType || 'PZA'}
                        </span>
                      </td>

                      {/* Input de Umbral Mínimo */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            max="9999"
                            value={currentDraft}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setEditingThresholds(prev => ({ ...prev, [product.id]: val }));
                            }}
                            className={`w-16 bg-slate-950 border px-2 py-1.5 text-center font-black text-xs rounded-lg outline-none transition-all ${
                              isModified 
                                ? 'border-amber-400 text-amber-300 ring-2 ring-amber-400/20' 
                                : 'border-slate-700 text-white focus:border-cyan-500'
                            }`}
                            title="Modificar umbral de stock mínimo"
                          />
                          <span className="text-[10px] text-slate-400">mín</span>
                        </div>
                      </td>

                      {/* Estado de Alerta & Barra de Salud */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="space-y-1">
                          {analysis.status === 'out_of_stock' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-red-600 text-white uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                              Agotado (0 disp.)
                            </span>
                          ) : analysis.status === 'low_stock' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/30 text-amber-300 border border-amber-500/50 uppercase tracking-wider">
                              <AlertTriangle size={10} />
                              Bajo Límite (-{analysis.deficit})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                              <CheckCircle2 size={10} />
                              Óptimo
                            </span>
                          )}

                          {/* Mini barra de progreso */}
                          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-300 ${
                                analysis.status === 'out_of_stock'
                                  ? 'bg-red-500'
                                  : analysis.status === 'low_stock'
                                    ? 'bg-amber-400'
                                    : 'bg-emerald-400'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(5, analysis.healthPercentage))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Botón Guardar individual */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleSaveProductMinStock(product, currentDraft)}
                          disabled={isSavingThis || (!isModified && product.minStock === currentDraft)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 mx-auto ${
                            isModified
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/30 animate-pulse'
                              : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                          } disabled:opacity-40 disabled:pointer-events-none`}
                        >
                          {isSavingThis ? (
                            <RefreshCw size={13} className="animate-spin text-cyan-400" />
                          ) : (
                            <Save size={13} />
                          )}
                          <span>Guardar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
