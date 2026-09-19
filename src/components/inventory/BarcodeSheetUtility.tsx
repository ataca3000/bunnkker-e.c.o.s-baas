"use client";

import React, { useState, useMemo } from 'react';
import { useCart, type Product } from '@/context/CartContext';
import BarcodeSVG from './BarcodeSVG';
import {
  Printer, Search, CheckSquare, Square, Filter, RefreshCw,
  Plus, Minus, Tag, LayoutGrid, Layers, Settings, FileText,
  Copy, Eye, ArrowLeft, CheckCircle2, AlertCircle, Package, MapPin, DollarSign,
  FileDown, Loader2, ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight, X,
  Sliders, Settings2, Sparkles
} from 'lucide-react';
import Link from 'next/link';

export type PresetType = 'avery30' | 'shelf14' | 'compact40' | 'thermal';

interface PresetConfig {
  id: PresetType;
  name: string;
  description: string;
  cols: number;
  rows: number;
  perPage: number;
  paperSize: string; // CSS page size
  labelWidthMm: string;
  labelHeightMm: string;
  gridStyleClass: string;
  barcodeHeight: number;
  barcodeWidth: number;
  fontSize: number;
}

const PRESETS: Record<PresetType, PresetConfig> = {
  avery30: {
    id: 'avery30',
    name: 'Avery 30-up (3x10)',
    description: 'Estándar 30 etiquetas por hoja Carta (66.7 x 25.4 mm)',
    cols: 3,
    rows: 10,
    perPage: 30,
    paperSize: 'letter portrait',
    labelWidthMm: '66.7mm',
    labelHeightMm: '25.4mm',
    gridStyleClass: 'grid-cols-3 gap-1.5',
    barcodeHeight: 28,
    barcodeWidth: 1.3,
    fontSize: 9,
  },
  shelf14: {
    id: 'shelf14',
    name: 'Etiquetas de Anaquel (2x7)',
    description: '14 etiquetas grandes para estantes/racks físicos (100 x 36 mm)',
    cols: 2,
    rows: 7,
    perPage: 14,
    paperSize: 'letter portrait',
    labelWidthMm: '100mm',
    labelHeightMm: '36mm',
    gridStyleClass: 'grid-cols-2 gap-2',
    barcodeHeight: 38,
    barcodeWidth: 1.6,
    fontSize: 11,
  },
  compact40: {
    id: 'compact40',
    name: 'Rejilla Compacta (4x10)',
    description: '40 etiquetas pequeñas para cajones y piezas (48 x 24 mm)',
    cols: 4,
    rows: 10,
    perPage: 40,
    paperSize: 'letter portrait',
    labelWidthMm: '48mm',
    labelHeightMm: '24mm',
    gridStyleClass: 'grid-cols-4 gap-1',
    barcodeHeight: 22,
    barcodeWidth: 1.1,
    fontSize: 8,
  },
  thermal: {
    id: 'thermal',
    name: 'Rollo Térmico Continuo (1 col)',
    description: 'Impresoras térmicas de etiquetas (Zebra, Xprinter, 50x25 mm)',
    cols: 1,
    rows: 1,
    perPage: 1,
    paperSize: '58mm 30mm',
    labelWidthMm: '50mm',
    labelHeightMm: '25mm',
    gridStyleClass: 'grid-cols-1 gap-2',
    barcodeHeight: 32,
    barcodeWidth: 1.5,
    fontSize: 10,
  },
};

export default function BarcodeSheetUtility() {
  const { products, formatCurrency } = useCart();

  // Selected items map: { productId: copyQuantity }
  const [selectedMap, setSelectedMap] = useState<Record<string, number>>({});

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [shelfFilter, setShelfFilter] = useState('ALL');

  // Preset & Customization Options
  const [preset, setPreset] = useState<PresetType>('avery30');
  const [storeName, setStoreName] = useState('BUNKKER E.C.O.S.');
  const [showStoreName, setShowStoreName] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [showCodeText, setShowCodeText] = useState(true);
  const [showBorders, setShowBorders] = useState(true);
  const [barcodeFormat, setBarcodeFormat] = useState<'CODE128' | 'EAN13'>('CODE128');

  // Batch copies control
  const [batchCopyCount, setBatchCopyCount] = useState(1);

  // Active view tab: 'select' | 'preview'
  const [viewTab, setViewTab] = useState<'select' | 'preview'>('select');

  // PDF Export State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);
  const [pdfErrorMessage, setPdfErrorMessage] = useState<string | null>(null);

  // Dynamic Print Preview Modal State
  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);

  // Custom live barcode density adjustments
  const [customBarcodeWidth, setCustomBarcodeWidth] = useState<number | null>(null);
  const [customBarcodeHeight, setCustomBarcodeHeight] = useState<number | null>(null);
  const [customFontSize, setCustomFontSize] = useState<number | null>(null);

  // Extract unique categories and shelves
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const shelves = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const shelf = p.location?.estante || p.estante;
      if (shelf) set.add(shelf.toUpperCase());
    });
    return Array.from(set).sort();
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.barcode && p.barcode.toLowerCase().includes(term)) ||
        p.id.toLowerCase().includes(term) ||
        (p.category && p.category.toLowerCase().includes(term));

      const matchCategory =
        categoryFilter === 'ALL' || p.category === categoryFilter;

      const pShelf = (p.location?.estante || p.estante || '').toUpperCase();
      const matchShelf =
        shelfFilter === 'ALL' || pShelf === shelfFilter;

      return matchSearch && matchCategory && matchShelf;
    });
  }, [products, searchTerm, categoryFilter, shelfFilter]);

  // Total selected label instances
  const selectedItemsList = useMemo(() => {
    const list: Array<{ product: Product; copies: number }> = [];
    Object.entries(selectedMap).forEach(([id, copies]) => {
      if (copies > 0) {
        const prod = products.find((p) => p.id === id);
        if (prod) {
          list.push({ product: prod, copies });
        }
      }
    });
    return list;
  }, [selectedMap, products]);

  const totalLabelsCount = useMemo(() => {
    return selectedItemsList.reduce((acc, item) => acc + item.copies, 0);
  }, [selectedItemsList]);

  // Flattened array of individual labels to render
  const flatLabelsArray = useMemo(() => {
    const flat: Product[] = [];
    selectedItemsList.forEach((item) => {
      for (let i = 0; i < item.copies; i++) {
        flat.push(item.product);
      }
    });
    return flat;
  }, [selectedItemsList]);

  // Paginated labels based on current preset
  const pagesOfLabels = useMemo(() => {
    const pages: Product[][] = [];
    const perPage = PRESETS[preset].perPage;
    for (let i = 0; i < flatLabelsArray.length; i += perPage) {
      pages.push(flatLabelsArray.slice(i, i + perPage));
    }
    return pages;
  }, [flatLabelsArray, preset]);

  // Selection Actions
  const toggleSelect = (productId: string) => {
    setSelectedMap((prev) => {
      const current = prev[productId] || 0;
      if (current > 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      } else {
        return { ...prev, [productId]: batchCopyCount || 1 };
      }
    });
  };

  const setCopies = (productId: string, copies: number) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (copies <= 0) {
        delete next[productId];
      } else {
        next[productId] = copies;
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      filteredProducts.forEach((p) => {
        if (!next[p.id]) {
          next[p.id] = batchCopyCount || 1;
        }
      });
      return next;
    });
  };

  const handleSelectLowStock = () => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      products.forEach((p) => {
        const minStock = p.minStock ?? 10;
        if (p.stock <= minStock) {
          next[p.id] = Math.max(1, Math.min(10, Math.ceil(minStock - p.stock + 2)));
        }
      });
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedMap({});
  };

  const handleSetAllCopiesToBatch = () => {
    if (batchCopyCount < 1) return;
    setSelectedMap((prev) => {
      const next: Record<string, number> = {};
      Object.keys(prev).forEach((id) => {
        next[id] = batchCopyCount;
      });
      return next;
    });
  };

  // Trigger Print
  const handlePrint = () => {
    window.print();
  };

  // Export Barcode Sheets directly to PDF using jsPDF + html2canvas
  const handleExportPDF = async () => {
    if (totalLabelsCount === 0 || isGeneratingPdf) return;

    setIsGeneratingPdf(true);
    setPdfSuccessMessage(null);
    setPdfErrorMessage(null);

    try {
      // Switch to preview view if not active to ensure elements are mounted in the DOM
      if (viewTab !== 'preview') {
        setViewTab('preview');
        await new Promise((resolve) => setTimeout(resolve, 350));
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');

      const printableArea = document.getElementById('printable-area');
      if (!printableArea) {
        throw new Error('No se encontró el contenedor imprimible.');
      }

      const pageNodes = printableArea.querySelectorAll<HTMLElement>('.printable-sheet-page');
      if (!pageNodes || pageNodes.length === 0) {
        throw new Error('No hay hojas de etiquetas para exportar.');
      }

      const isThermal = preset === 'thermal';
      const pdfFormat = isThermal ? [58, 30] : 'letter';

      const pdf = new jsPDF({
        unit: 'mm',
        format: pdfFormat,
        orientation: 'portrait',
        compress: true,
      });

      for (let i = 0; i < pageNodes.length; i++) {
        const pageEl = pageNodes[i];

        const canvas = await html2canvas(pageEl, {
          scale: 2.5, // High resolution for clear barcode scanning
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          ignoreElements: (el) => el.classList.contains('no-print'),
        });

        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        if (i > 0) {
          pdf.addPage(pdfFormat, 'portrait');
        }

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      }

      const cleanStore = storeName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || 'bunkker';
      const fileName = `etiquetas_${preset}_${cleanStore}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);

      setPdfSuccessMessage(`¡Archivo PDF generado con éxito: "${fileName}"!`);
      setTimeout(() => setPdfSuccessMessage(null), 6000);
    } catch (err) {
      console.error('Error generando el archivo PDF:', err);
      setPdfErrorMessage('Ocurrió un error al generar el archivo PDF. Intenta nuevamente.');
      setTimeout(() => setPdfErrorMessage(null), 6000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const currentConfig = PRESETS[preset];
  const activeBarcodeHeight = customBarcodeHeight ?? currentConfig.barcodeHeight;
  const activeBarcodeWidth = customBarcodeWidth ?? currentConfig.barcodeWidth;
  const activeFontSize = customFontSize ?? currentConfig.fontSize;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Dynamic CSS for Print Mode */}
      <style>{`
        @media print {
          /* Hide all UI elements except printable sheets */
          body * {
            visibility: hidden !important;
          }
          #printable-area, #printable-area * {
            visibility: visible !important;
          }
          #printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
          }
          @page {
            size: ${currentConfig.paperSize};
            margin: 4mm;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header Bar */}
      <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 px-4 py-3 sm:px-6 no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/dashboard/inventory"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Volver a Inventario"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-cyan-400" />
                <h1 className="text-lg font-black text-white tracking-tight uppercase">
                  Generador de Etiquetas de Código de Barras
                </h1>
              </div>
              <p className="text-xs text-slate-400">
                Impresión de códigos para anaqueles, racks y productos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setViewTab('select')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                viewTab === 'select'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              1. Selección ({selectedItemsList.length} prod. / {totalLabelsCount} etiq.)
            </button>
            <button
              onClick={() => setViewTab('preview')}
              disabled={totalLabelsCount === 0}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                viewTab === 'preview'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : totalLabelsCount > 0
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-800/40 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Eye className="w-4 h-4" />
              2. Vista Previa Hoja
            </button>
            <button
              onClick={handleExportPDF}
              disabled={totalLabelsCount === 0 || isGeneratingPdf}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2"
              title="Descargar archivo PDF listo para imprimir"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              {isGeneratingPdf ? 'GENERANDO PDF...' : 'EXPORTAR PDF'}
            </button>
            <button
              onClick={() => setShowPrintPreviewModal(true)}
              disabled={totalLabelsCount === 0 || isGeneratingPdf}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
              title="Abrir vista previa de impresión e inspección de densidad"
            >
              <Printer className="w-4 h-4" />
              IMPRIMIR / PREVIA
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification Banners */}
      {(pdfSuccessMessage || pdfErrorMessage) && (
        <div className="max-w-7xl mx-auto px-4 pt-4 sm:px-6 no-print">
          {pdfSuccessMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{pdfSuccessMessage}</span>
            </div>
          )}
          {pdfErrorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{pdfErrorMessage}</span>
            </div>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6">
        {/* VIEW 1: PRODUCT SELECTION & CONFIGURATION */}
        {viewTab === 'select' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Inventory Selector */}
            <div className="lg:col-span-2 space-y-4">
              {/* Filter Controls */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, código de barras, SKU o ubicación..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 pl-10 pr-4 py-2 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="ALL">Todas las Categorías</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>

                    <select
                      value={shelfFilter}
                      onChange={(e) => setShelfFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="ALL">Todos los Estantes</option>
                      {shelves.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Batch Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleSelectAllFiltered}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                      Marcar Filtrados ({filteredProducts.length})
                    </button>
                    <button
                      onClick={handleSelectLowStock}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                      Auto-seleccionar Stock Bajo
                    </button>
                    {Object.keys(selectedMap).length > 0 && (
                      <button
                        onClick={handleClearSelection}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-colors"
                      >
                        Limpiar Selección
                      </button>
                    )}
                  </div>

                  {/* Batch copies setter */}
                  <div className="flex items-center gap-2 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 font-medium">
                      Copias por defecto:
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={batchCopyCount}
                      onChange={(e) =>
                        setBatchCopyCount(Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="w-12 bg-slate-900 border border-slate-700 text-center text-xs text-cyan-400 font-bold rounded py-0.5 focus:outline-none"
                    />
                    {Object.keys(selectedMap).length > 0 && (
                      <button
                        onClick={handleSetAllCopiesToBatch}
                        className="text-[10px] text-cyan-400 font-bold underline hover:text-cyan-300 ml-1"
                        title="Aplicar este número de copias a todos los seleccionados"
                      >
                        Aplicar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Product Grid / Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Catálogo de Productos ({filteredProducts.length})
                  </span>
                  <span className="text-xs font-semibold text-cyan-400">
                    {selectedItemsList.length} selecc. / {totalLabelsCount} etiquetas totales
                  </span>
                </div>

                <div className="max-h-[580px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium">No se encontraron productos con estos filtros.</p>
                    </div>
                  ) : (
                    filteredProducts.map((product) => {
                      const isSelected = !!selectedMap[product.id];
                      const copies = selectedMap[product.id] || 0;
                      const barcodeCode = product.barcode || product.id;
                      const shelf = product.location?.estante || product.estante || 'Sin Asignar';
                      const row = product.location?.fila || product.fila || 'Piso';

                      return (
                        <div
                          key={product.id}
                          className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-slate-800/80 border-cyan-500/50 shadow-md shadow-cyan-500/5'
                              : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <div
                            onClick={() => toggleSelect(product.id)}
                            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                          >
                            <div className="flex-shrink-0">
                              {isSelected ? (
                                <div className="w-5 h-5 rounded bg-cyan-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                                  ✓
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded border border-slate-700 hover:border-slate-500" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-200 text-sm truncate">
                                  {product.name}
                                </h4>
                                {product.category && (
                                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700/50">
                                    {product.category}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                                <span>CB: {barcodeCode}</span>
                                <span>•</span>
                                <span className="text-emerald-400 font-bold font-sans">
                                  {formatCurrency(product.price)}
                                </span>
                                <span>•</span>
                                <span>
                                  Estante: {shelf} ({row})
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Copy counter controls */}
                          {isSelected && (
                            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg p-1">
                              <button
                                onClick={() => setCopies(product.id, copies - 1)}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                                title="Reducir copias"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-8 text-center text-xs font-black text-cyan-400 font-mono">
                                {copies}
                              </span>
                              <button
                                onClick={() => setCopies(product.id, copies + 1)}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                                title="Aumentar copias"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right Col: Sheet Preset & Layout Settings */}
            <div className="space-y-4">
              {/* Preset Selector */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                  <LayoutGrid className="w-4 h-4" />
                  <h3>1. Formato de Hoja y Tamaño</h3>
                </div>

                <div className="space-y-2">
                  {(Object.keys(PRESETS) as PresetType[]).map((key) => {
                    const p = PRESETS[key];
                    const active = preset === key;

                    return (
                      <div
                        key={key}
                        onClick={() => setPreset(key)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          active
                            ? 'bg-cyan-950/30 border-cyan-500/80 shadow-md shadow-cyan-500/10'
                            : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                              {p.name}
                              {active && (
                                <span className="text-[10px] bg-cyan-500 text-slate-950 font-black px-1.5 rounded-full">
                                  ACTIVO
                                </span>
                              )}
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-1">
                              {p.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Label Content Options */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                  <Settings className="w-4 h-4" />
                  <h3>2. Contenido de la Etiqueta</h3>
                </div>

                <div className="space-y-2.5 text-xs text-slate-300">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                      Nombre del Negocio / Encabezado
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                        placeholder="Ej. BUNKKER E.C.O.S."
                      />
                      <button
                        onClick={() => setShowStoreName(!showStoreName)}
                        className={`px-2.5 py-1.5 rounded-xl font-bold transition-colors ${
                          showStoreName
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {showStoreName ? 'VER' : 'OCULTO'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span>Mostrar Nombre del Producto</span>
                      <input
                        type="checkbox"
                        checked={showProductName}
                        onChange={(e) => setShowProductName(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <span>Mostrar Precio ($ MXN)</span>
                      <input
                        type="checkbox"
                        checked={showPrice}
                        onChange={(e) => setShowPrice(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <span>Mostrar Ubicación (Estante / Fila)</span>
                      <input
                        type="checkbox"
                        checked={showLocation}
                        onChange={(e) => setShowLocation(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <span>Mostrar Texto del Código bajo Barras</span>
                      <input
                        type="checkbox"
                        checked={showCodeText}
                        onChange={(e) => setShowCodeText(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <span>Mostrar Borde de Corte / Guía</span>
                      <input
                        type="checkbox"
                        checked={showBorders}
                        onChange={(e) => setShowBorders(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Summary Box */}
              <div className="bg-gradient-to-br from-cyan-950/40 to-slate-900 border border-cyan-500/30 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center justify-between font-bold text-slate-200">
                  <span>Etiquetas en Total:</span>
                  <span className="text-cyan-400 font-mono text-base">{totalLabelsCount}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Hojas Estimadas:</span>
                  <span className="text-white font-mono">{pagesOfLabels.length} hoja(s)</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Formato Seleccionado:</span>
                  <span className="text-white">{currentConfig.name}</span>
                </div>

                <button
                  onClick={() => setViewTab('preview')}
                  disabled={totalLabelsCount === 0}
                  className="w-full mt-3 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-colors disabled:opacity-40 shadow-lg shadow-cyan-500/20"
                >
                  VER VISTA PREVIA DE HOJAS ({pagesOfLabels.length})
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={totalLabelsCount === 0 || isGeneratingPdf}
                  className="w-full mt-1.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold text-xs border border-cyan-500/30 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4" />
                  )}
                  {isGeneratingPdf ? 'GENERANDO ARCHIVO PDF...' : 'EXPORTAR HOJAS A PDF'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: LIVE SHEET PREVIEW */}
        {viewTab === 'preview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-4 no-print">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  Vista Previa Interactiva de Hojas de Impresión
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visualiza cómo se verán las etiquetas en las hojas físicas. Haz clic en "EXPORTAR PDF" o "IMPRIMIR" para descargar o imprimir.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">
                  {pagesOfLabels.length} hoja(s) • {totalLabelsCount} etiquetas
                </span>
                <button
                  onClick={() => setShowPrintPreviewModal(true)}
                  disabled={totalLabelsCount === 0}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold text-xs transition-colors flex items-center gap-1.5 border border-cyan-500/30"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Inspeccionar Densidad
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={totalLabelsCount === 0 || isGeneratingPdf}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-40"
                >
                  {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                  {isGeneratingPdf ? 'Generando...' : 'Descargar PDF'}
                </button>
                <button
                  onClick={() => setViewTab('select')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                >
                  Modificar Selección
                </button>
              </div>
            </div>

            {/* Printable Container */}
            <div id="printable-area" className="space-y-8">
              {pagesOfLabels.map((pageLabels, pageIdx) => (
                <div
                  key={pageIdx}
                  className={`printable-sheet-page bg-white text-black p-4 rounded-xl shadow-2xl mx-auto max-w-[215.9mm] min-h-[279.4mm] page-break font-sans border border-slate-200 relative`}
                  style={{
                    width: preset === 'thermal' ? '58mm' : '100%',
                    minHeight: preset === 'thermal' ? 'auto' : '279.4mm',
                  }}
                >
                  {/* Watermark / Page Indicator in preview only */}
                  <div className="no-print absolute top-2 right-2 bg-slate-900 text-cyan-400 text-[10px] font-bold font-mono px-2 py-0.5 rounded shadow opacity-80">
                    Página {pageIdx + 1} de {pagesOfLabels.length}
                  </div>

                  {/* Labels Grid */}
                  <div className={`grid ${currentConfig.gridStyleClass} h-full content-start`}>
                    {pageLabels.map((prod, labelIdx) => {
                      const barcodeCode = prod.barcode || prod.id;
                      const shelf = prod.location?.estante || prod.estante || '';
                      const row = prod.location?.fila || prod.fila || '';

                      return (
                        <div
                          key={`${prod.id}-${labelIdx}`}
                          className={`flex flex-col items-center justify-between text-center p-1.5 bg-white box-border overflow-hidden ${
                            showBorders ? 'border border-gray-300' : ''
                          }`}
                          style={{
                            minHeight: currentConfig.labelHeightMm,
                          }}
                        >
                          {/* Store Header */}
                          {showStoreName && storeName && (
                            <div className="text-[8px] font-black tracking-widest text-gray-500 uppercase leading-none">
                              {storeName}
                            </div>
                          )}

                          {/* Product Name */}
                          {showProductName && (
                            <div className="text-[10px] font-bold text-gray-900 line-clamp-1 leading-tight px-1">
                              {prod.name}
                            </div>
                          )}

                          {/* Location & Price row */}
                          {(showLocation || showPrice) && (
                            <div className="flex items-center justify-center gap-2 text-[9px] font-bold w-full px-1 my-0.5">
                              {showLocation && (shelf || row) && (
                                <span className="bg-gray-100 text-gray-700 px-1 py-0.2 rounded text-[8px] font-mono">
                                  {shelf ? `EST: ${shelf}` : ''} {row ? `(${row})` : ''}
                                </span>
                              )}
                              {showPrice && (
                                <span className="text-gray-950 font-black text-[11px]">
                                  {formatCurrency(prod.price)}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Barcode SVG */}
                          <div className="w-full flex justify-center items-center my-0.5">
                            <BarcodeSVG
                              value={barcodeCode}
                              format={barcodeFormat}
                              height={activeBarcodeHeight}
                              width={activeBarcodeWidth}
                              displayValue={showCodeText}
                              fontSize={activeFontSize}
                              margin={1}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* DYNAMIC PRINT PREVIEW & BARCODE DENSITY MODAL */}
      {showPrintPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 no-print overflow-hidden animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-white tracking-tight">
                      Vista Previa de Impresión y Verificación de Densidad
                    </h2>
                    <span className="bg-cyan-500/20 text-cyan-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-cyan-500/30">
                      {currentConfig.name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Inspecciona márgenes, nitidez de barras ({activeBarcodeWidth}x{activeBarcodeHeight}px) y legibilidad antes de imprimir.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPrintPreviewModal(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  title="Cerrar vista previa"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 custom-scrollbar">
              {/* Left Controls Panel */}
              <div className="lg:col-span-1 space-y-4">
                {/* Page Navigation */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <Layers className="w-4 h-4" />
                      Navegación de Hojas
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {pagesOfLabels.length} hoja(s)
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setPreviewPageIndex((prev) => Math.max(0, prev - 1))}
                      disabled={previewPageIndex === 0}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Página anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <span className="text-xs font-bold text-white font-mono">
                      Página {previewPageIndex + 1} de {Math.max(1, pagesOfLabels.length)}
                    </span>

                    <button
                      onClick={() => setPreviewPageIndex((prev) => Math.min(pagesOfLabels.length - 1, prev + 1))}
                      disabled={previewPageIndex >= pagesOfLabels.length - 1}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Siguiente página"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Zoom Control */}
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span>Zoom de inspección:</span>
                      <span className="text-cyan-400 font-bold font-mono">{previewZoom}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPreviewZoom((z) => Math.max(50, z - 25))}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors"
                        title="Alejar"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      {[75, 100, 125, 150].map((z) => (
                        <button
                          key={z}
                          onClick={() => setPreviewZoom(z)}
                          className={`flex-1 py-1 rounded-lg text-[10px] font-bold font-mono transition-colors ${
                            previewZoom === z
                              ? 'bg-cyan-500 text-slate-950'
                              : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {z}%
                        </button>
                      ))}
                      <button
                        onClick={() => setPreviewZoom((z) => Math.min(200, z + 25))}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors"
                        title="Acercar"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Barcode Density Fine-Tuning */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <Sliders className="w-4 h-4" />
                      Densidad de Código
                    </span>
                    {(customBarcodeWidth !== null || customBarcodeHeight !== null || customFontSize !== null) && (
                      <button
                        onClick={() => {
                          setCustomBarcodeWidth(null);
                          setCustomBarcodeHeight(null);
                          setCustomFontSize(null);
                        }}
                        className="text-[10px] text-amber-400 hover:underline font-semibold"
                      >
                        Restablecer
                      </button>
                    )}
                  </div>

                  {/* Width Control */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Grosor de Barras:</span>
                      <span className="text-white font-mono">{activeBarcodeWidth}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1.0, 1.2, 1.4, 1.6, 1.8, 2.0].map((w) => (
                        <button
                          key={w}
                          onClick={() => setCustomBarcodeWidth(w)}
                          className={`flex-1 py-1 rounded text-[10px] font-bold font-mono transition-colors ${
                            activeBarcodeWidth === w
                              ? 'bg-cyan-500 text-slate-950'
                              : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Height Control */}
                  <div className="space-y-1 pt-2 border-t border-slate-800">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Altura del Código:</span>
                      <span className="text-white font-mono">{activeBarcodeHeight}px</span>
                    </div>
                    <input
                      type="range"
                      min={18}
                      max={50}
                      step={2}
                      value={activeBarcodeHeight}
                      onChange={(e) => setCustomBarcodeHeight(parseInt(e.target.value))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  {/* Font Size Control */}
                  <div className="space-y-1 pt-2 border-t border-slate-800">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Tamaño de Texto:</span>
                      <span className="text-white font-mono">{activeFontSize}pt</span>
                    </div>
                    <input
                      type="range"
                      min={6}
                      max={14}
                      step={1}
                      value={activeFontSize}
                      onChange={(e) => setCustomFontSize(parseInt(e.target.value))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Scan Quality Badge */}
                <div className="bg-cyan-950/30 border border-cyan-500/20 rounded-2xl p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-cyan-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Nivel de Legibilidad</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {activeBarcodeWidth < 1.2
                      ? '⚡ Barras delgadas de alta densidad. Recomendado para impresoras térmicas de precisión.'
                      : activeBarcodeWidth > 1.8
                      ? '🔍 Barras gruesas para escaneo a distancia en anaqueles y bodegas.'
                      : '✨ Densidad balanceada óptima para lectura rápida con escáneres 1D / 2D.'}
                  </p>
                </div>
              </div>

              {/* Right Main Page Preview Canvas */}
              <div className="lg:col-span-3 flex flex-col items-center justify-start bg-slate-950 rounded-2xl p-4 sm:p-6 border border-slate-800 min-h-[460px] overflow-auto custom-scrollbar">
                <div
                  className="transition-transform duration-200 origin-top shadow-2xl rounded-xl bg-white text-black p-4 border border-slate-300 relative"
                  style={{
                    transform: `scale(${previewZoom / 100})`,
                    width: preset === 'thermal' ? '58mm' : '100%',
                    maxWidth: preset === 'thermal' ? '58mm' : '215.9mm',
                    minHeight: preset === 'thermal' ? 'auto' : '279.4mm',
                  }}
                >
                  {/* Page Watermark Badge */}
                  <div className="absolute top-2 right-2 bg-slate-900 text-cyan-400 text-[10px] font-bold font-mono px-2 py-0.5 rounded shadow opacity-90">
                    Muestra • Hoja {previewPageIndex + 1} de {pagesOfLabels.length || 1}
                  </div>

                  {/* Labels Grid */}
                  {pagesOfLabels.length > 0 && pagesOfLabels[previewPageIndex] ? (
                    <div className={`grid ${currentConfig.gridStyleClass} h-full content-start`}>
                      {pagesOfLabels[previewPageIndex].map((prod, labelIdx) => {
                        const barcodeCode = prod.barcode || prod.id;
                        const shelf = prod.location?.estante || prod.estante || '';
                        const row = prod.location?.fila || prod.fila || '';

                        return (
                          <div
                            key={`modal-${prod.id}-${labelIdx}`}
                            className={`flex flex-col items-center justify-between text-center p-1.5 bg-white box-border overflow-hidden ${
                              showBorders ? 'border border-gray-300' : ''
                            }`}
                            style={{
                              minHeight: currentConfig.labelHeightMm,
                            }}
                          >
                            {/* Store Header */}
                            {showStoreName && storeName && (
                              <div className="text-[8px] font-black tracking-widest text-gray-500 uppercase leading-none">
                                {storeName}
                              </div>
                            )}

                            {/* Product Name */}
                            {showProductName && (
                              <div className="text-[10px] font-bold text-gray-900 line-clamp-1 leading-tight px-1">
                                {prod.name}
                              </div>
                            )}

                            {/* Location & Price row */}
                            {(showLocation || showPrice) && (
                              <div className="flex items-center justify-center gap-2 text-[9px] font-bold w-full px-1 my-0.5">
                                {showLocation && (shelf || row) && (
                                  <span className="bg-gray-100 text-gray-700 px-1 py-0.2 rounded text-[8px] font-mono">
                                    {shelf ? `EST: ${shelf}` : ''} {row ? `(${row})` : ''}
                                  </span>
                                )}
                                {showPrice && (
                                  <span className="text-gray-950 font-black text-[11px]">
                                    {formatCurrency(prod.price)}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Barcode SVG */}
                            <div className="w-full flex justify-center items-center my-0.5">
                              <BarcodeSVG
                                value={barcodeCode}
                                format={barcodeFormat}
                                height={activeBarcodeHeight}
                                width={activeBarcodeWidth}
                                displayValue={showCodeText}
                                fontSize={activeFontSize}
                                margin={1}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                      <Package className="w-10 h-10 opacity-40 mb-2" />
                      <p className="text-xs font-bold">No hay etiquetas para previsualizar.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                Resumen: <span className="text-white font-bold">{totalLabelsCount} etiquetas</span> en <span className="text-white font-bold">{pagesOfLabels.length} hoja(s)</span> ({currentConfig.name})
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setShowPrintPreviewModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
                >
                  Volver a Editar
                </button>
                <button
                  onClick={() => {
                    setShowPrintPreviewModal(false);
                    handleExportPDF();
                  }}
                  disabled={totalLabelsCount === 0 || isGeneratingPdf}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-40"
                >
                  {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  Exportar a PDF
                </button>
                <button
                  onClick={() => {
                    setShowPrintPreviewModal(false);
                    handlePrint();
                  }}
                  disabled={totalLabelsCount === 0}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  CONFIRMAR E IMPRIMIR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
