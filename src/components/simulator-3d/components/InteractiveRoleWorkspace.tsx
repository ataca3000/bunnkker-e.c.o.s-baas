import React, { useState } from 'react';
import {
  User,
  HardHat,
  ShoppingBag,
  Layers,
  Truck,
  Store,
  CheckCircle2,
  Scan,
  CreditCard,
  PackageCheck,
  ArrowRight,
  ArrowDownToLine,
  Star,
  FileText,
  DollarSign,
  AlertTriangle,
  Sparkles,
  MapPin,
  PenTool,
} from 'lucide-react';
import {
  UserRole,
  Product,
  DeliveryType,
  BusinessKPIs,
  LogisticsOrder,
  SimulationStep,
  BoxDestination,
  ActiveBoxItem,
  BoxClassificationCategory,
} from '../types/logistics';
import { SimpleBoxLauncherBar } from './SimpleBoxLauncherBar';
import { SequentialBoxClassifier } from './SequentialBoxClassifier';

interface InteractiveRoleWorkspaceProps {
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  products: Product[];
  selectedProduct: Product;
  onSelectProduct: (p: Product) => void;
  deliveryType: DeliveryType;
  onChangeDeliveryType: (type: DeliveryType) => void;
  onRoleAction: (role: UserRole, action: string, productName: string) => void;
  currentStep: SimulationStep;
  progress: number;
  kpis: BusinessKPIs;
  activeBoxCount: number;
  maxBoxes: number;
  activeBoxesList?: ActiveBoxItem[];
  onLaunchBox: (dest: BoxDestination) => void;
  onLaunchSequentialBox?: (
    destination: BoxDestination,
    productName: string,
    trackingId: string,
    category: BoxClassificationCategory,
    isValidated: boolean
  ) => void;
  onFocusBox?: (boxId: string) => void;
  onLaunchTrio: () => void;
  onClearBoxes: () => void;
  onFocusRoleCamera: (role: UserRole) => void;
}

export const InteractiveRoleWorkspace: React.FC<InteractiveRoleWorkspaceProps> = ({
  currentRole,
  onSelectRole,
  products,
  selectedProduct,
  onSelectProduct,
  deliveryType,
  onChangeDeliveryType,
  onRoleAction,
  currentStep,
  progress,
  kpis,
  activeBoxCount,
  maxBoxes,
  activeBoxesList = [],
  onLaunchBox,
  onLaunchSequentialBox,
  onFocusBox,
  onLaunchTrio,
  onClearBoxes,
  onFocusRoleCamera,
}) => {
  // Client Role State
  const [clientAddress, setClientAddress] = useState('Av. Los Sauces #420, Residencial Las Rosas');
  const [clientSigned, setClientSigned] = useState(false);
  const [clientRating, setClientRating] = useState(5);

  // Warehouse Role State
  const [activeWarehouseStep, setActiveWarehouseStep] = useState<number>(1);

  // Sales Role State
  const [salesInvoiceNumber, setSalesInvoiceNumber] = useState('FAC-2026-0042');
  const [paymentApproved, setPaymentApproved] = useState(false);

  // Global Tab Submode State (Secuencial 1 a 1 vs Lanzador Rápido)
  const [globalSubmode, setGlobalSubmode] = useState<'secuencia' | 'rapido'>('secuencia');

  // Financial calculations
  const productPrice = selectedProduct.price;
  const shippingFee = deliveryType === 'domicilio' ? selectedProduct.deliveryCost : 0;
  const subtotal = productPrice;
  const tax = subtotal * 0.16;
  const totalClientPay = subtotal + shippingFee + tax;

  return (
    <div className="w-full">
      {/* 1. Primary Interactive Role Selector Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {/* Role 1: Cliente */}
        <button
          onClick={() => {
            onSelectRole('cliente');
            onFocusRoleCamera('cliente');
          }}
          className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition active:scale-95 ${
            currentRole === 'cliente'
              ? 'bg-emerald-950/80 border-emerald-500 text-white shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-500/50'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              currentRole === 'cliente'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            <User className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs truncate">1. Rol: Cliente</div>
            <div className="text-[10px] text-slate-400 truncate">Elige entrega y compra</div>
          </div>
        </button>

        {/* Role 2: Almacén */}
        <button
          onClick={() => {
            onSelectRole('almacenista');
            onFocusRoleCamera('almacenista');
          }}
          className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition active:scale-95 ${
            currentRole === 'almacenista'
              ? 'bg-amber-950/80 border-amber-500 text-white shadow-lg shadow-amber-500/20 ring-1 ring-amber-500/50'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              currentRole === 'almacenista'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            <HardHat className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs truncate">2. Rol: Almacén</div>
            <div className="text-[10px] text-slate-400 truncate">Picking, empaque y stock</div>
          </div>
        </button>

        {/* Role 3: Vendedor */}
        <button
          onClick={() => {
            onSelectRole('vendedor');
            onFocusRoleCamera('vendedor');
          }}
          className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition active:scale-95 ${
            currentRole === 'vendedor'
              ? 'bg-blue-950/80 border-blue-500 text-white shadow-lg shadow-blue-500/20 ring-1 ring-blue-500/50'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              currentRole === 'vendedor'
                ? 'bg-blue-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs truncate">3. Rol: Vendedor</div>
            <div className="text-[10px] text-slate-400 truncate">Cobro POS y entrega</div>
          </div>
        </button>

        {/* Role 4: Secuencia y Clasificador */}
        <button
          onClick={() => {
            onSelectRole('todos');
            onFocusRoleCamera('todos');
          }}
          className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition active:scale-95 ${
            currentRole === 'todos'
              ? 'bg-purple-950/80 border-purple-500 text-white shadow-lg shadow-purple-500/20 ring-1 ring-purple-500/50'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              currentRole === 'todos'
                ? 'bg-purple-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs truncate">4. Secuencia 1 a 1</div>
            <div className="text-[10px] text-slate-400 truncate">Clasificador & Validador 3D</div>
          </div>
        </button>
      </div>

      {/* 2. DYNAMIC CONTENT SPECIFIC TO SELECTED ROLE */}

      {/* ======================================================== */}
      {/* A. ROL: CLIENTE                                         */}
      {/* ======================================================== */}
      {currentRole === 'cliente' && (
        <div className="p-3 sm:p-4 rounded-xl bg-slate-950/70 border border-emerald-500/30">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wider">
                Panel del Cliente: Elección de Producto y Modalidad de Entrega
              </h3>
            </div>
            <button
              onClick={() => onFocusRoleCamera('cliente')}
              className="text-xs px-2.5 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-200 transition"
            >
              🎥 Enfocar Perspectiva Cliente 3D
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Left: Product & Delivery Selection */}
            <div className="lg:col-span-7 space-y-3">
              {/* Product selector dropdown */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">
                  1. Selecciona el Producto que deseas comprar:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {products.slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onSelectProduct(p)}
                      className={`p-2 rounded-xl text-left border transition ${
                        selectedProduct.id === p.id
                          ? 'bg-emerald-950/60 border-emerald-400 text-white shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-bold text-xs truncate">{p.name}</div>
                      <div className="text-[11px] font-mono text-emerald-400 mt-0.5">
                        ${p.price.toFixed(2)} USD
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Stock: {p.stock} uds</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Delivery method: Mostrador vs Domicilio */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">
                  2. ¿Cómo deseas recibir tu compra? (Opciones del Cliente):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => onChangeDeliveryType('mostrador')}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition ${
                      deliveryType === 'mostrador'
                        ? 'bg-emerald-950/70 border-emerald-400 text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0 mt-0.5">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">🏪 Recogida en Mostrador</div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Pasa a la ferretería, pagas en caja y retiras inmediatamente en mostrador.
                      </p>
                      <span className="inline-block mt-1 text-[10px] font-bold text-emerald-400">
                        Envío: GRATIS ($0.00)
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={() => onChangeDeliveryType('domicilio')}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition ${
                      deliveryType === 'domicilio'
                        ? 'bg-emerald-950/70 border-emerald-400 text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 shrink-0 mt-0.5">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">🏡 Entrega a Domicilio Express</div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Camión Ferre-Express directo a tu vivienda con firma de entrega en tablet.
                      </p>
                      <span className="inline-block mt-1 text-[10px] font-bold text-amber-400">
                        Flete logístico: +${selectedProduct.deliveryCost.toFixed(2)} USD
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Delivery Address if Domicilio */}
              {deliveryType === 'domicilio' && (
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-slate-400 block font-semibold">
                      Dirección de Entrega del Cliente:
                    </span>
                    <input
                      type="text"
                      value={clientAddress}
                      onChange={(e) => setClientAddress(e.target.value)}
                      className="w-full bg-transparent text-xs text-white font-medium focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Launch Client Order Button */}
              <button
                onClick={() => {
                  setClientSigned(false);
                  onRoleAction('cliente', deliveryType, selectedProduct.name);
                }}
                disabled={activeBoxCount >= maxBoxes}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition active:scale-95 shadow-xl ${
                  activeBoxCount >= maxBoxes
                    ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  Confirmar y Lanzar Pedido como Cliente ({deliveryType === 'mostrador' ? 'Retiro en Tienda' : 'Envío a Domicilio'})
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Right: Client Order Tracking & Digital Receipt */}
            <div className="lg:col-span-5 space-y-3">
              {/* Order Status Stepper */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs font-bold text-slate-300 block mb-2">
                  📡 Estado del Paquete (Visión del Cliente):
                </span>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>1. Pedido confirmado en sistema</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>2. Bodega preparando caja y etiquetado</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-blue-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      3. {deliveryType === 'mostrador' ? 'Listo en mostrador de caja' : 'Camión en ruta a residencia'}
                    </span>
                  </div>
                </div>

                {/* Digital Reception Signature */}
                <div className="mt-3 pt-2.5 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-300">
                      Firma de Recepción (Puerta / Mostrador):
                    </span>
                    {clientSigned ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        ✓ FIRMADO
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">Pendiente de firma</span>
                    )}
                  </div>

                  {!clientSigned ? (
                    <button
                      onClick={() => setClientSigned(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition active:scale-95"
                    >
                      <PenTool className="w-3.5 h-3.5 text-amber-400" />
                      <span>Firmar Recepción en Tablet Digital</span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/40 border border-emerald-600/40 text-xs">
                      <span className="text-emerald-300 font-medium">¡Producto recibido a satisfacción!</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            onClick={() => setClientRating(s)}
                            className={`w-3.5 h-3.5 cursor-pointer ${
                              s <= clientRating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Digital Client Receipt */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1 mb-1.5">
                  <span className="flex items-center gap-1 text-[11px]">
                    <FileText className="w-3 h-3 text-emerald-400" />
                    TICKET DE COMPRA CLIENTE
                  </span>
                  <span className="text-[10px]">FERRE-TIENDA S.A.</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between text-slate-300">
                    <span className="truncate pr-2">{selectedProduct.name}</span>
                    <span>${productPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Flete Logístico ({deliveryType})</span>
                    <span>${shippingFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>IVA Estimado (16%)</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-white pt-1 border-t border-slate-800 text-xs">
                    <span>Total Pagado por el Cliente</span>
                    <span className="text-emerald-400">${totalClientPay.toFixed(2)} USD</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* B. ROL: EMPLEADO DE ALMACÉN                             */}
      {/* ======================================================== */}
      {currentRole === 'almacenista' && (
        <div className="p-3 sm:p-4 rounded-xl bg-slate-950/70 border border-amber-500/30">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">
                Panel de Almacén: Tareas Operativas de Picking, Embalaje y Stock
              </h3>
            </div>
            <button
              onClick={() => onFocusRoleCamera('almacenista')}
              className="text-xs px-2.5 py-1 rounded-lg bg-amber-950 hover:bg-amber-900 border border-amber-700/60 text-amber-200 transition"
            >
              🎥 Enfocar Bodega & Racks 3D
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Task 1: Picking */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    PASO 1
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Rack 02 / N2</span>
                </div>
                <h4 className="font-bold text-xs text-white">🔍 Iniciar Picking en Racks</h4>
                <p className="text-[10px] text-slate-400 mt-1">
                  El operario camina a la estantería, localiza {selectedProduct.name} y toma la caja.
                </p>
              </div>

              <button
                onClick={() => {
                  setActiveWarehouseStep(1);
                  onRoleAction('almacenista', 'picking', selectedProduct.name);
                }}
                disabled={activeBoxCount >= maxBoxes}
                className="mt-3 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition active:scale-95 shadow"
              >
                Ejecutar Picking
              </button>
            </div>

            {/* Task 2: Packing */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    PASO 2
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Mesa Despacho</span>
                </div>
                <h4 className="font-bold text-xs text-white">⚖️ Embalar y Pesar Caja</h4>
                <p className="text-[10px] text-slate-400 mt-1">
                  Pesa en báscula ({selectedProduct.weightKg} kg), aplica precinto y coloca guía con código de barras.
                </p>
              </div>

              <button
                onClick={() => {
                  setActiveWarehouseStep(2);
                  onRoleAction('almacenista', 'packing', selectedProduct.name);
                }}
                disabled={activeBoxCount >= maxBoxes}
                className="mt-3 w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition active:scale-95 shadow"
              >
                Pesar y Embalar
              </button>
            </div>

            {/* Task 3: Loading to Dock */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    PASO 3
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Portón Muelle</span>
                </div>
                <h4 className="font-bold text-xs text-white">🚚 Cargar a Furgoneta</h4>
                <p className="text-[10px] text-slate-400 mt-1">
                  Abre el portón industrial y monta el paquete en el camión Ferre-Express.
                </p>
              </div>

              <button
                onClick={() => {
                  setActiveWarehouseStep(3);
                  onRoleAction('almacenista', 'loading', selectedProduct.name);
                }}
                className="mt-3 w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition active:scale-95 shadow"
              >
                Cargar en Camión
              </button>
            </div>

            {/* Task 4: Inbound Restock */}
            <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    ENTRADA
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400">+1 STOCK</span>
                </div>
                <h4 className="font-bold text-xs text-white">📥 Recepción Proveedor</h4>
                <p className="text-[10px] text-slate-400 mt-1">
                  Descarga palet con montacargas y acomoda en estantería con etiqueta verde +1.
                </p>
              </div>

              <button
                onClick={() => {
                  setActiveWarehouseStep(4);
                  onRoleAction('almacenista', 'restock', selectedProduct.name);
                }}
                disabled={activeBoxCount >= maxBoxes}
                className="mt-3 w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition active:scale-95 shadow"
              >
                +1 Surtir Mercancía
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* C. ROL: VENDEDOR / CAJERO (PUNTO DE VENTA)              */}
      {/* ======================================================== */}
      {currentRole === 'vendedor' && (
        <div className="p-3 sm:p-4 rounded-xl bg-slate-950/70 border border-blue-500/30">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
              <h3 className="text-sm font-bold text-blue-300 uppercase tracking-wider">
                Panel del Vendedor: Terminal POS, Facturación y Entrega
              </h3>
            </div>
            <button
              onClick={() => onFocusRoleCamera('vendedor')}
              className="text-xs px-2.5 py-1 rounded-lg bg-blue-950 hover:bg-blue-900 border border-blue-700/60 text-blue-200 transition"
            >
              🎥 Enfocar Mostrador POS 3D
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Left: POS Actions */}
            <div className="lg:col-span-8 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 1. Scan Barcode */}
                <button
                  onClick={() => onRoleAction('vendedor', 'scan', selectedProduct.name)}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-400 text-left transition active:scale-95 shadow"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center mb-2">
                    <Scan className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-xs text-white">1. Escanear Código</div>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">Lectura láser de código de barras</p>
                </button>

                {/* 2. Process Payment & Open Drawer */}
                <button
                  onClick={() => {
                    setPaymentApproved(true);
                    onRoleAction('vendedor', 'payment', selectedProduct.name);
                  }}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-400 text-left transition active:scale-95 shadow"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-xs text-white">2. Cobrar & Abrir Cajón</div>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">Suena caja y emite ticket fiscal</p>
                </button>

                {/* 3. Handover Box at Counter */}
                <button
                  onClick={() => onRoleAction('vendedor', 'request_picking', selectedProduct.name)}
                  disabled={activeBoxCount >= maxBoxes}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-400 text-left transition active:scale-95 shadow"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center mb-2">
                    <Store className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-xs text-white">3. Solicitar y Entregar</div>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">Almacén surte a mostrador (-1)</p>
                </button>
              </div>

              {/* POS Status Row */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="font-bold text-white">Terminal POS #01: ACTIVO</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-300 font-mono">Factura: {salesInvoiceNumber}</span>
                </div>
                <div className="text-emerald-400 font-bold font-mono">
                  Total Cobrado: ${selectedProduct.price.toFixed(2)} USD
                </div>
              </div>
            </div>

            {/* Right: Sales KPIs */}
            <div className="lg:col-span-4 p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs">
              <span className="text-slate-400 text-[11px] font-bold block mb-2 border-b border-slate-800 pb-1">
                💼 RENDIMIENTO DEL VENDEDOR
              </span>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Ventas Totales Hoy:</span>
                  <span className="text-white font-bold">${kpis.totalRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Margen Comercial:</span>
                  <span className="text-emerald-400 font-bold">
                    {((kpis.netProfit / kpis.totalRevenue) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Comisión Vendedor (3%):</span>
                  <span className="text-amber-400 font-bold">
                    ${(kpis.totalRevenue * 0.03).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800">
                  <span className="text-slate-400">Clientes Atendidos:</span>
                  <span className="text-cyan-400 font-bold">{kpis.ordersCompleted} órdenes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* D. ROL: SECUENCIA Y CLASIFICADOR 1 A 1 CON VALIDADOR     */}
      {/* ======================================================== */}
      {currentRole === 'todos' && (
        <div className="space-y-2.5">
          {/* Submode Selector Pill Bar */}
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                onClick={() => setGlobalSubmode('secuencia')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  globalSubmode === 'secuencia'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Despacho 1 por 1 & Clasificador</span>
              </button>
              <button
                onClick={() => setGlobalSubmode('rapido')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  globalSubmode === 'rapido'
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Lanzador Rápido de 3 Cajas</span>
              </button>
            </div>

            <span className="hidden sm:inline text-[11px] text-slate-400">
              Visualización representativa a ritmo pausado
            </span>
          </div>

          {globalSubmode === 'secuencia' ? (
            <SequentialBoxClassifier
              products={products}
              selectedProduct={selectedProduct}
              onSelectProduct={onSelectProduct}
              activeBoxCount={activeBoxCount}
              maxBoxes={maxBoxes}
              activeBoxesList={activeBoxesList}
              onLaunchSequentialBox={(dest, prodName, trackingId, cat, isValid) => {
                if (onLaunchSequentialBox) {
                  onLaunchSequentialBox(dest, prodName, trackingId, cat, isValid);
                } else {
                  onLaunchBox(dest);
                }
              }}
              onFocusBox={(boxId) => {
                onFocusBox?.(boxId);
              }}
              onClearBoxes={onClearBoxes}
            />
          ) : (
            <SimpleBoxLauncherBar
              activeBoxCount={activeBoxCount}
              maxBoxes={maxBoxes}
              onLaunchBox={onLaunchBox}
              onLaunchTrio={onLaunchTrio}
              onClearBoxes={onClearBoxes}
            />
          )}
        </div>
      )}
    </div>
  );
};
