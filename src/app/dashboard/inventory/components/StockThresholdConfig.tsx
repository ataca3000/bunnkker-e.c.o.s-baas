'use client';

import React, { useState, useEffect } from 'react';
import { Product } from '@/lib/types';
import { 
  AlertTriangle, 
  Settings, 
  Save, 
  Sliders, 
  Search, 
  Layers, 
  CheckCircle2, 
  RefreshCw,
  Bell,
  Package
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface StockThresholdConfigProps {
  products: Product[];
  onUpdateProductMinStock: (productId: string, minStock: number) => Promise<void>;
  onBatchUpdateMinStock: (updates: Array<{ productId: string; minStock: number }>) => Promise<void>;
  isReadOnly?: boolean;
  formatCurrency?: (amount: number) => string;
}

export default function StockThresholdConfig({
  products,
  onUpdateProductMinStock,
  onBatchUpdateMinStock,
  isReadOnly = false,
  formatCurrency = (amt) => `$${amt.toFixed(2)}`
}: StockThresholdConfigProps) {
  const [globalDefaultMin, setGlobalDefaultMin] = useState<number>(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categoryBulkMin, setCategoryBulkMin] = useState<number>(10);
  const [localMinStocks, setLocalMinStocks] = useState<Record<string, number>>({});
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // Load global threshold configuration from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('bunkker_stock_threshold_config_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.defaultMinStock !== undefined) {
            setGlobalDefaultMin(parsed.defaultMinStock);
          }
        }
      } catch (err) {
        console.error('Error loading threshold config:', err);
      }
    }
  }, []);

  // Sync initial product minStock values into local state
  useEffect(() => {
    const initialMap: Record<string, number> = {};
    products.forEach((p) => {
      initialMap[p.id] = p.minStock !== undefined && p.minStock !== null ? p.minStock : globalDefaultMin;
    });
    setLocalMinStocks(initialMap);
  }, [products, globalDefaultMin]);

  // Extract unique categories
  const categories = Array.from(
    new Set(products.map((p) => p.category || 'General').filter(Boolean))
  );

  // Save global default min threshold
  const handleSaveGlobalMin = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'bunkker_stock_threshold_config_v1',
        JSON.stringify({ defaultMinStock: globalDefaultMin, updatedAt: new Date().toISOString() })
      );
      toast.success(`Umbral global por defecto establecido en ${globalDefaultMin} unidades`);
    }
  };

  // Filter products by search term and selected category
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCategory === 'all' || (p.category || 'General') === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Save single product minStock update
  const handleSaveSingleProduct = async (product: Product) => {
    const newMin = localMinStocks[product.id] ?? globalDefaultMin;
    setSavingProductId(product.id);
    try {
      await onUpdateProductMinStock(product.id, newMin);
      toast.success(`Umbral para "${product.name}" actualizado a ${newMin} unidades`);
    } catch (error) {
      toast.error('Error al guardar el umbral del producto');
    } finally {
      setSavingProductId(null);
    }
  };

  // Bulk update category products
  const handleApplyCategoryBulk = async () => {
    if (selectedCategory === 'all') {
      toast.error('Selecciona una categoría específica para aplicar umbral masivo');
      return;
    }

    const targetProducts = products.filter(
      (p) => (p.category || 'General') === selectedCategory
    );

    if (targetProducts.length === 0) {
      toast.error('No hay productos en esta categoría');
      return;
    }

    setIsBulkSaving(true);
    try {
      const updates = targetProducts.map((p) => ({
        productId: p.id,
        minStock: categoryBulkMin
      }));

      await onBatchUpdateMinStock(updates);

      // Update local state
      setLocalMinStocks((prev) => {
        const next = { ...prev };
        targetProducts.forEach((p) => {
          next[p.id] = categoryBulkMin;
        });
        return next;
      });

      toast.success(
        `Umbral de ${categoryBulkMin} unidades aplicado a ${targetProducts.length} productos de "${selectedCategory}"`
      );
    } catch (err) {
      toast.error('Error al aplicar umbrales en lote');
    } finally {
      setIsBulkSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HEADER CONFIGURACIÓN */}
      <div className="bg-slate-900/80 border border-slate-700/60 p-6 md:p-8 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-700/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Sliders size={28} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                Configuración de Umbrales Mínimos de Stock
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Define límites de stock crítico por producto o categoría para activar alertas automáticas en el dashboard principal.
              </p>
            </div>
          </div>
        </div>

        {/* UMBRAL GLOBAL POR DEFECTO */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-800/50 p-5 rounded-xl border border-slate-700/50">
          <div className="md:col-span-2">
            <h3 className="text-sm font-black text-amber-400 uppercase tracking-wide flex items-center gap-2">
              <Bell size={16} /> Umbral Mínimo Global por Defecto
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Este valor se utilizará automáticamente para todos los productos que no tengan asignado un umbral personalizado específico.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Stock Mínimo Estándar
              </label>
              <input
                type="number"
                min="1"
                value={globalDefaultMin}
                onChange={(e) => setGlobalDefaultMin(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={isReadOnly}
                className="w-full bg-slate-900 border border-slate-700 p-2.5 rounded-xl font-mono font-bold text-amber-400 text-sm focus:border-amber-500 outline-none"
              />
            </div>
            <button
              onClick={handleSaveGlobalMin}
              disabled={isReadOnly}
              className="mt-5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
            >
              <Save size={16} /> Guardar
            </button>
          </div>
        </div>
      </div>

      {/* ACCIONES EN LOTE Y BÚSQUEDA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PANEL APLICACIÓN MASIVA POR CATEGORÍA */}
        <div className="bg-slate-900/80 border border-slate-700/60 p-6 rounded-2xl shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black text-cyan-400 uppercase tracking-wide flex items-center gap-2 mb-2">
              <Layers size={18} /> Asignación Masiva por Categoría
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Establece el mismo nivel de stock mínimo para todos los productos pertenecientes a una misma línea o categoría.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Categoría
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 p-2.5 rounded-xl font-bold text-slate-200 text-xs outline-none focus:border-cyan-500"
                >
                  <option value="all">-- Todas las Categorías --</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Nuevo Umbral Mínimo para esta Categoría
                </label>
                <input
                  type="number"
                  min="1"
                  value={categoryBulkMin}
                  onChange={(e) => setCategoryBulkMin(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-800 border border-slate-700 p-2.5 rounded-xl font-mono font-bold text-cyan-400 text-xs outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleApplyCategoryBulk}
            disabled={isReadOnly || isBulkSaving || selectedCategory === 'all'}
            className="mt-6 w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-black uppercase text-xs tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {isBulkSaving ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            Aplicar a Categoría
          </button>
        </div>

        {/* TABLA DE PRODUCTOS Y BÚSQUEDA (COLUMNAS 2 & 3) */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-700/60 p-6 rounded-2xl shadow-lg flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
                <Package size={18} className="text-amber-400" /> Ajuste Individual de Productos
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Modifica el umbral específico de cada artículo en tiempo real.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar producto o código..."
                className="w-full bg-slate-800 border border-slate-700 pl-9 pr-4 py-2 rounded-xl text-xs font-medium text-white placeholder-slate-500 focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1 max-h-[420px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-700/60 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 bg-slate-900 z-10">
                  <th className="py-3 px-3">Producto</th>
                  <th className="py-3 px-3">Categoría</th>
                  <th className="py-3 px-3 text-center">Stock Actual</th>
                  <th className="py-3 px-3 text-center">Umbral Mínimo</th>
                  <th className="py-3 px-3 text-center">Estado Alerta</th>
                  <th className="py-3 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200 font-medium">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500 text-xs">
                      No se encontraron productos coincidentes.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const currentMin = localMinStocks[product.id] ?? globalDefaultMin;
                    const isLow = product.stock <= currentMin;
                    const isCritical = product.stock <= Math.max(1, Math.floor(currentMin * 0.5));

                    return (
                      <tr key={product.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-bold text-white max-w-[180px] truncate" title={product.name}>
                          {product.name}
                        </td>
                        <td className="py-3 px-3 text-slate-400">
                          {product.category || 'General'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          {product.stock} {product.unitType || 'PZA'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            min="1"
                            disabled={isReadOnly}
                            value={localMinStocks[product.id] ?? currentMin}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              setLocalMinStocks((prev) => ({ ...prev, [product.id]: val }));
                            }}
                            className="w-20 text-center bg-slate-800 border border-slate-700 py-1.5 px-2 rounded-lg font-mono font-bold text-amber-400 text-xs outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isCritical ? (
                            <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1 animate-pulse">
                              <AlertTriangle size={12} /> Crítico
                            </span>
                          ) : isLow ? (
                            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                              ⚠️ Reabastecer
                            </span>
                          ) : (
                            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              OK
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleSaveSingleProduct(product)}
                            disabled={isReadOnly || savingProductId === product.id}
                            className="p-1.5 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 rounded-lg transition-colors border border-amber-500/30"
                            title="Guardar umbral de este producto"
                          >
                            {savingProductId === product.id ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              <Save size={14} />
                            )}
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
    </div>
  );
}
