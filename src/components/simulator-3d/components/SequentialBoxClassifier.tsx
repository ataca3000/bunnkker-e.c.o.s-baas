import React, { useState } from 'react';
import {
  Package,
  CheckCircle2,
  Scan,
  Scale,
  ShieldCheck,
  Truck,
  Store,
  ArrowRight,
  Sparkles,
  Layers,
  RotateCcw,
  Zap,
  Eye,
  AlertCircle,
  Tag,
  Clock,
} from 'lucide-react';
import {
  BoxDestination,
  BoxClassificationCategory,
  Product,
  ActiveBoxItem,
} from '../types/logistics';

interface SequentialBoxClassifierProps {
  products: Product[];
  selectedProduct: Product;
  onSelectProduct: (p: Product) => void;
  activeBoxCount: number;
  maxBoxes: number;
  activeBoxesList: ActiveBoxItem[];
  onLaunchSequentialBox: (
    destination: BoxDestination,
    productName: string,
    trackingId: string,
    category: BoxClassificationCategory,
    isValidated: boolean
  ) => void;
  onFocusBox: (boxId: string) => void;
  onClearBoxes: () => void;
}

const CATEGORY_CATALOG: Record<
  BoxClassificationCategory,
  {
    icon: string;
    color: string;
    accentBg: string;
    accentBorder: string;
    sampleProducts: { name: string; weightKg: number; sku: string; price: number }[];
    recommendedDestination: BoxDestination;
  }
> = {
  'Herramientas Eléctricas': {
    icon: '⚡',
    color: 'text-amber-400',
    accentBg: 'bg-amber-500/10',
    accentBorder: 'border-amber-500/40',
    sampleProducts: [
      { name: 'Taladro Percutor 850W', weightKg: 2.8, sku: 'HER-TAL-850', price: 89.99 },
      { name: 'Amoladora Angular 4-1/2"', weightKg: 2.1, sku: 'HER-AMO-115', price: 64.5 },
      { name: 'Sierra Circular 1400W', weightKg: 4.2, sku: 'HER-SIE-140', price: 119.0 },
    ],
    recommendedDestination: 'caja',
  },
  'Carga Pesada & Obra': {
    icon: '🏗️',
    color: 'text-orange-400',
    accentBg: 'bg-orange-500/10',
    accentBorder: 'border-orange-500/40',
    sampleProducts: [
      { name: 'Cemento Portland 50kg', weightKg: 50.0, sku: 'CON-CEM-050', price: 14.2 },
      { name: 'Carretilla Tubular 65L', weightKg: 13.5, sku: 'CON-CAR-065', price: 58.0 },
      { name: 'Varilla de Acero 3/8" (Atado)', weightKg: 28.0, sku: 'CON-VAR-038', price: 42.5 },
    ],
    recommendedDestination: 'carga',
  },
  'Fijaciones & Tornillería': {
    icon: '🔩',
    color: 'text-cyan-400',
    accentBg: 'bg-cyan-500/10',
    accentBorder: 'border-cyan-500/40',
    sampleProducts: [
      { name: 'Pack 500 Tornillos Drywall', weightKg: 1.2, sku: 'FIJ-TOR-500', price: 12.8 },
      { name: 'Caja Anclajes Expansivos 3/8"', weightKg: 3.4, sku: 'FIJ-ANC-038', price: 24.0 },
      { name: 'Remaches de Aluminio x1000', weightKg: 0.9, sku: 'FIJ-REM-100', price: 16.5 },
    ],
    recommendedDestination: 'caja',
  },
  'Pinturas & Químicos': {
    icon: '🎨',
    color: 'text-emerald-400',
    accentBg: 'bg-emerald-500/10',
    accentBorder: 'border-emerald-500/40',
    sampleProducts: [
      { name: 'Esmalte Sintético Brillante 4L', weightKg: 4.6, sku: 'PIN-ESM-004', price: 34.0 },
      { name: 'Sellador Poliuretano Cartucho', weightKg: 0.5, sku: 'QUI-SEL-300', price: 8.5 },
      { name: 'Impermeabilizante Techos 19L', weightKg: 22.0, sku: 'PIN-IMP-019', price: 78.0 },
    ],
    recommendedDestination: 'domicilio',
  },
};

export const SequentialBoxClassifier: React.FC<SequentialBoxClassifierProps> = ({
  products,
  selectedProduct,
  onSelectProduct,
  activeBoxCount,
  maxBoxes,
  activeBoxesList,
  onLaunchSequentialBox,
  onFocusBox,
  onClearBoxes,
}) => {
  // Current Sequence State
  const [sequenceIndex, setSequenceIndex] = useState<number>(1);
  const currentTrackingId = `#BX-${String(sequenceIndex).padStart(2, '0')}`;

  // Classification State
  const [selectedCategory, setSelectedCategory] =
    useState<BoxClassificationCategory>('Herramientas Eléctricas');
  const [customItemName, setCustomItemName] = useState('Taladro Percutor 850W');
  const [destination, setDestination] = useState<BoxDestination>('caja');

  // Interactive Quality Verification Checklist (Validador)
  const [valBarcode, setValBarcode] = useState(true);
  const [valWeight, setValWeight] = useState(true);
  const [valSeal, setValSeal] = useState(true);

  const isValidated = valBarcode && valWeight && valSeal;
  const verifiedCount = (valBarcode ? 1 : 0) + (valWeight ? 1 : 0) + (valSeal ? 1 : 0);

  // Auto-fill product when category changes
  const handleSelectCategory = (cat: BoxClassificationCategory) => {
    setSelectedCategory(cat);
    const catData = CATEGORY_CATALOG[cat];
    if (catData.sampleProducts.length > 0) {
      setCustomItemName(catData.sampleProducts[0].name);
      setDestination(catData.recommendedDestination);
    }
  };

  const handleLaunchThisBox = () => {
    if (activeBoxCount >= maxBoxes) return;

    onLaunchSequentialBox(
      destination,
      customItemName,
      currentTrackingId,
      selectedCategory,
      isValidated
    );

    // Advance sequence to next box (1 -> 2 -> 3 ...)
    setSequenceIndex((prev) => (prev >= 9 ? 1 : prev + 1));

    // Keep validation checked for next box by default
    setValBarcode(true);
    setValWeight(true);
    setValSeal(true);
  };

  const handleValidateAll = () => {
    setValBarcode(true);
    setValWeight(true);
    setValSeal(true);
  };

  return (
    <div className="w-full space-y-3">
      {/* 1. Header: Sequence Counter & Active Box Slots */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-950/80 border border-amber-500/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 flex items-center justify-center font-black text-sm shadow-md">
            {currentTrackingId}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide">
                DESPACHO SECUENCIAL 1 A 1
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Caja #{sequenceIndex} de {maxBoxes}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Configura, valida e introduce cajas una por una con su identificador único 3D
            </p>
          </div>
        </div>

        {/* Capacity Meter */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-medium">Capacidad Diorama:</span>
            <div className="flex items-center gap-1.5 justify-end">
              <span
                className={`font-mono text-xs font-bold ${
                  activeBoxCount >= maxBoxes
                    ? 'text-rose-400'
                    : activeBoxCount >= 6
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {activeBoxCount} / {maxBoxes} cajas
              </span>
              {activeBoxCount >= maxBoxes && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  Límite
                </span>
              )}
            </div>
          </div>

          {activeBoxCount > 0 && (
            <button
              onClick={onClearBoxes}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Vaciar todas las cajas en ruta"
            >
              <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
              Limpiar Cajas
            </button>
          )}
        </div>
      </div>

      {/* 2. Main 3-Step Classification & Validation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Column (lg:col-span-8): Category & Quality Verification */}
        <div className="lg:col-span-8 space-y-3">
          {/* STEP 1: CATEGORY CLASSIFICATION */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                Paso 1: Clasificar Categoría de Mercancía
              </span>
              <span className="text-[10px] text-slate-400">Selecciona el tipo de producto</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(CATEGORY_CATALOG) as BoxClassificationCategory[]).map((catKey) => {
                const cat = CATEGORY_CATALOG[catKey];
                const isSelected = selectedCategory === catKey;
                return (
                  <button
                    key={catKey}
                    onClick={() => handleSelectCategory(catKey)}
                    className={`p-2 rounded-xl border text-left transition active:scale-95 flex flex-col justify-between ${
                      isSelected
                        ? `${cat.accentBg} ${cat.accentBorder} text-white ring-1 ring-amber-500/40 shadow-md`
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-base">{cat.icon}</span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-xs truncate leading-tight">{catKey}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                        {cat.sampleProducts.length} ítems
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Sub-item selector inside selected category */}
            <div className="mt-2.5 pt-2 border-t border-slate-800 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-medium text-slate-400">Producto específico:</span>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {CATEGORY_CATALOG[selectedCategory].sampleProducts.map((p) => (
                  <button
                    key={p.sku}
                    onClick={() => setCustomItemName(p.name)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      customItemName === p.name
                        ? 'bg-amber-500 text-slate-950 font-bold shadow'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {p.name} <span className="opacity-75 text-[10px]">({p.weightKg}kg)</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* STEP 2: QUALITY VALIDATOR & IDENTIFIER CHECKLIST */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Paso 2: Validador de Control de Calidad ({verifiedCount}/3)
              </span>
              <button
                onClick={handleValidateAll}
                className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition"
              >
                ✓ Validar Todo
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Check 1: Barcode Scan */}
              <button
                onClick={() => setValBarcode(!valBarcode)}
                className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 ${
                  valBarcode
                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    valBarcode ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Scan className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs truncate">1. Código EAN-13</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {valBarcode ? '✓ Escaneado OK' : 'Pendiente'}
                  </div>
                </div>
              </button>

              {/* Check 2: Scale Weight */}
              <button
                onClick={() => setValWeight(!valWeight)}
                className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 ${
                  valWeight
                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    valWeight ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Scale className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs truncate">2. Báscula / Peso</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {valWeight ? '✓ Verificado OK' : 'Pendiente'}
                  </div>
                </div>
              </button>

              {/* Check 3: Seal & Package */}
              <button
                onClick={() => setValSeal(!valSeal)}
                className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 ${
                  valSeal
                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    valSeal ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs truncate">3. Precinto y Caja</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {valSeal ? '✓ Sellado OK' : 'Pendiente'}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (lg:col-span-4): Destination & Dispatch Action */}
        <div className="lg:col-span-4 space-y-3 flex flex-col justify-between">
          {/* STEP 3: DESTINATION ROUTE */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">
              Paso 3: Destino de la Caja
            </span>

            <div className="space-y-1.5">
              {/* Destination 1: Caja / Mostrador */}
              <button
                onClick={() => setDestination('caja')}
                className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                  destination === 'caja'
                    ? 'bg-emerald-950/90 border-emerald-500 text-white shadow-lg ring-1 ring-emerald-500/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
                    <Store className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <span>🟢 Caja (Mostrador)</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">Ruta Verde</span>
                    </div>
                    <div className="text-[10px] text-slate-400">Venta directa a cliente en tienda</div>
                  </div>
                </div>
                <span className="text-emerald-400 font-bold text-xs font-mono">-1</span>
              </button>

              {/* Destination 2: Domicilio */}
              <button
                onClick={() => setDestination('domicilio')}
                className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                  destination === 'domicilio'
                    ? 'bg-orange-950/90 border-orange-500 text-white shadow-lg ring-1 ring-orange-500/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-orange-500/20 border border-orange-500/50 flex items-center justify-center">
                    <Truck className="w-3.5 h-3.5 text-orange-400" />
                  </div>
                  <div>
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <span>🟠 Domicilio (Camión)</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-300 font-mono">Ruta Naranja</span>
                    </div>
                    <div className="text-[10px] text-slate-400">Reparto residencial hasta la casa</div>
                  </div>
                </div>
                <span className="text-orange-400 font-bold text-xs font-mono">-1</span>
              </button>

              {/* Destination 3: Carga / Proveedor */}
              <button
                onClick={() => setDestination('carga')}
                className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                  destination === 'carga'
                    ? 'bg-cyan-950/90 border-cyan-500 text-white shadow-lg ring-1 ring-cyan-500/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <span>🔵 Muelle (Proveedor)</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">Ruta Cian</span>
                    </div>
                    <div className="text-[10px] text-slate-400">Reabastecimiento directo a racks</div>
                  </div>
                </div>
                <span className="text-cyan-400 font-bold text-xs font-mono">+1</span>
              </button>
            </div>
          </div>

          {/* MAIN DISPATCH BUTTON */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Etiqueta 3D:</span>
              <span className="font-mono font-bold text-amber-300">
                [{currentTrackingId} | {destination.toUpperCase()} | {isValidated ? '✓ OK' : 'PEND'}]
              </span>
            </div>

            <button
              onClick={handleLaunchThisBox}
              disabled={activeBoxCount >= maxBoxes}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition active:scale-95 shadow-xl flex items-center justify-center gap-2 ${
                activeBoxCount >= maxBoxes
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {activeBoxCount >= maxBoxes
                  ? 'Diorama al Límite (9 Cajas)'
                  : `Validar y Lanzar ${currentTrackingId} a ${destination.toUpperCase()}`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Live Monitor & Inspector of Active Boxes in Flight */}
      {activeBoxesList.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-amber-400" />
              Cajas Activas en Tránsito con Identificador y Validación ({activeBoxesList.length})
            </span>
            <span className="text-[10px] text-slate-400">
              Haz clic en cualquier caja para enfocar la cámara 3D sobre ella
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {activeBoxesList.map((box) => {
              const pct = Math.min(100, Math.round(box.progress * 100));
              const isStore = box.destination === 'caja';
              const isInbound = box.destination === 'carga';

              return (
                <div
                  key={box.id}
                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/60 transition flex flex-col justify-between text-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                      {box.trackingId}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isStore
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : isInbound
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {isStore ? 'Mostrador' : isInbound ? 'Muelle (+1)' : 'Domicilio (-1)'}
                    </span>
                  </div>

                  <div className="font-bold text-white truncate text-xs">{box.productName}</div>
                  <div className="text-[10px] text-slate-400 truncate mb-2">
                    {box.category || 'Ferretería'} • {box.weightKg}kg • EAN-13 ✓
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mb-2">
                    <div
                      className={`h-full transition-all duration-200 ${
                        isStore ? 'bg-emerald-400' : isInbound ? 'bg-cyan-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <span className="text-[10px] font-mono text-slate-400">Progreso: {pct}%</span>
                    <button
                      onClick={() => onFocusBox(box.id)}
                      className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Enfocar 3D</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
