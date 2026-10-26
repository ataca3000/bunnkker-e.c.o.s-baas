"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { 
  BookOpen, 
  Download, 
  Search, 
  ShieldCheck, 
  Wifi, 
  WifiOff, 
  ArrowLeft, 
  Boxes, 
  Layers, 
  ArrowRight,
  Radio,
  QrCode,
  Truck,
  Package,
  ShoppingCart,
  Database
} from "lucide-react";

interface Section {
  id: string;
  title: string;
  summary: string;
  role: string;
  badge: string;
  steps: string[];
  note: string;
  flowDiagram?: { from: string; action: string; to: string }[];
}

const sections: Section[] = [
  { 
    id: "portal_cliente", 
    title: "1. Portal Cautivo y Registro Local", 
    summary: "Conexión de clientes a la red Wi-Fi de la sucursal y registro automático.",
    role: "Cliente / Visitante",
    badge: "Wi-Fi LAN",
    steps: [
      "El cliente se conecta a la red Wi-Fi local de la sucursal desde su teléfono móvil.",
      "El router o navegador redirige al portal de bienvenida local en http://<IP_SERVIDOR>:3000/registro.",
      "El cliente introduce su nombre, teléfono o correo y genera su PIN personal de acceso.",
      "Los datos se graban de inmediato en la base de datos local SQLite WAL (0 latencia, sin requerir internet).",
      "El cliente queda autenticado con cookie y token de sesión, listo para comprar en el catálogo o mostrador."
    ],
    note: "El registro no se bloquea aunque la tienda se quede sin internet; queda encolado localmente.",
    flowDiagram: [
      { from: "Celular del Cliente (Wi-Fi)", action: "Abre /registro", to: "Servidor .exe (0.0.0.0:3000)" },
      { from: "Servidor .exe", action: "Guarda cliente", to: "SQLite WAL Local" },
      { from: "SQLite WAL", action: "Encola en SyncQueue", to: "Worker en Segundo Plano" }
    ]
  },
  { 
    id: "caja_cobro", 
    title: "2. Punto de Venta & Caja", 
    summary: "Cobro, emisión de tickets térmicos y bloqueo atómico de inventario.",
    role: "Cajero / Ventas",
    badge: "Caja POS",
    steps: [
      "Abre el módulo de Caja (/dashboard/sales) desde cualquier terminal PWA en la red.",
      "Busca productos por lector de código de barras o buscador predictivo instantáneo.",
      "El sistema reserva el stock flotante en tiempo real para evitar que dos cajas vendan la misma pieza.",
      "Selecciona el método de pago (Efectivo, Tarjeta, Transferencia) y confirma el cobro.",
      "Se imprime el ticket físico (ESC/POS) y se emite la orden sincronizada a todas las pantallas."
    ],
    note: "Cada venta queda firmada con la identidad del cajero y su arqueo de caja se actualiza al instante.",
    flowDiagram: [
      { from: "Terminal Caja (PWA)", action: "Confirma cobro", to: "SQLite WAL (Transacción Atómica)" },
      { from: "Transacción Atómica", action: "sync_db_event (Socket 3001)", to: "Pizarras de Almacén y Patio" }
    ]
  },
  { 
    id: "almacen_picking", 
    title: "3. Almacén & Preparación (Picking)", 
    summary: "Recepción de órdenes cobradas, surtido en estantes y empaque.",
    role: "Bodeguero / Inventario",
    badge: "Almacén",
    steps: [
      "La orden pagada aparece automáticamente en el pizarrón de almacén (/dashboard/inventory).",
      "El almacenista toma la orden y hace clic en 'Iniciar Surtido' para bloquearla a su nombre.",
      "Recorre los pasillos y estantes guiándose por las coordenadas de ubicación (Estante, Fila, Nivel).",
      "Escanea o verifica cada producto surtido con el lector.",
      "Al completar los artículos, presiona 'Listo para Entrega' o 'Listo para Patio'."
    ],
    note: "Si un artículo está dañado o no se encuentra, se registra la merma con motivo sin detener el pedido.",
    flowDiagram: [
      { from: "Pizarrón Almacén", action: "Reclamo de orden", to: "Bloqueo de operario (claim_order)" },
      { from: "Surtido completado", action: "Cambio de estado", to: "Notificación al Patio o Mostrador" }
    ]
  },
  { 
    id: "patio_carga", 
    title: "4. Patio de Carga & Material Pesado", 
    summary: "Carga de camionetas, verificación de bultos y validación de salida.",
    role: "Patio / Montacargas",
    badge: "Patio Carga",
    steps: [
      "La tablet de patio (/dashboard/patio) lista las órdenes de tipo Carga Local o Entrega Pesada.",
      "El operador de patio o montacargas valida el vehículo o cajón asignado al cliente.",
      "Se cargan los materiales pesados y se coteja el folio del ticket.",
      "El operador registra su firma o confirmación de carga en el sistema.",
      "La orden cambia a 'Cargada / Despachada' liberando el cajón de estacionamiento."
    ],
    note: "El radio de voz PTT (Walkie-Talkie integrado) permite comunicarse con caja ante cualquier duda.",
    flowDiagram: [
      { from: "Tablet Patio", action: "Valida carga en vehículo", to: "Marca isLoaded = true" },
      { from: "Despacho", action: "Libera cajón", to: "Actualiza tablero central" }
    ]
  },
  { 
    id: "reparto_delivery", 
    title: "5. Reparto & Entrega a Domicilio", 
    summary: "Ruta de choferes, geolocalización, PoD con firma y foto.",
    role: "Repartidor / Chofer",
    badge: "Reparto",
    steps: [
      "El repartidor abre la app de entregas (/dashboard/delivery) desde su celular.",
      "Revisa la lista de pedidos en ruta con mapa, dirección y teléfono del cliente.",
      "Al llegar a la ubicación, solicita al cliente su PIN de entrega o firma digital en pantalla.",
      "Opcionalmente captura foto de evidencia de entrega (Proof of Delivery).",
      "Presiona 'Finalizar Entrega', actualizando el estado a DELIVERED en tiempo real."
    ],
    note: "Cuenta con botón de pánico en caso de percance en ruta que envía alerta inmediata al administrador.",
    flowDiagram: [
      { from: "Celular Repartidor", action: "Captura firma y PoD", to: "Envío de confirmación" },
      { from: "Confirmación", action: "Marca DELIVERED", to: "Cierre contable en matriz" }
    ]
  },
  { 
    id: "offline_sync", 
    title: "6. Resiliencia Offline & Replicación Cloud", 
    summary: "Operación ininterrumpida sin internet y sincronización en segundo plano con Supabase.",
    role: "Toda la Red",
    badge: "Sync Nube",
    steps: [
      "Si la conexión a internet cae, el sistema continúa funcionando al 100% sobre la red local Wi-Fi.",
      "Todas las ventas, clientes y movimientos se escriben de inmediato en SQLite WAL.",
      "En paralelo, cada registro se deposita en la tabla interna de cola 'SyncQueue'.",
      "El worker de fondo detecta cuando vuelve el internet y envía los lotes pendientes a Supabase / Postgres.",
      "Se actualiza el panel del dueño en la nube con la insignia de sincronización en verde."
    ],
    note: "Cero duplicados: cada transacción lleva su ID y hash único para garantizar idempotencia estricta.",
    flowDiagram: [
      { from: "Operación Offline", action: "Guarda en SQLite", to: "SyncQueue (Pendiente)" },
      { from: "Internet Restaurado", action: "processCloudSyncQueue()", to: "Supabase / Postgres Cloud" },
      { from: "Supabase", action: "Confirma guardado", to: "SyncQueue (SYNCED)" }
    ]
  }
];

export default function GuiaPage() {
  const [active, setActive] = useState("portal_cliente");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => 
    sections.filter((item) => 
      `${item.title} ${item.summary} ${item.role}`.toLowerCase().includes(query.toLowerCase())
    ), 
    [query]
  );

  const current = sections.find((item) => item.id === active) || sections[0];

  return (
    <main className="min-h-screen bg-[#071019] px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        
        {/* Encabezado y Navegación de Regreso */}
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
              >
                <ArrowLeft size={14} /> Volver al Dashboard
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                <BookOpen size={14} /> Manual del Flujo E.C.O.S.
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl uppercase">
              Guía Operativa & Flujo Sistémico
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Recorrido paso a paso del circuito completo: desde el registro Wi-Fi y cobro en caja hasta el despacho, entrega y sincronización en la nube.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/dashboard/simulator"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/25 transition shadow-lg"
            >
              <Boxes size={16} /> Ver en Gemelo 3D
            </Link>
            <button 
              type="button" 
              onClick={() => window.print()} 
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              <Download size={16} /> Imprimir
            </button>
          </div>
        </header>

        {/* Tarjetas de Arquitectura Rápida */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
            <Wifi className="mb-2 text-emerald-300" size={20} />
            <p className="text-sm font-semibold">100% Operativo Offline</p>
            <p className="mt-1 text-xs text-slate-400">Las terminales siguen cobrando y despachando sin internet sobre SQLite WAL.</p>
          </div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
            <Radio className="mb-2 text-cyan-300" size={20} />
            <p className="text-sm font-semibold">Sincronización LAN P2P</p>
            <p className="mt-1 text-xs text-slate-400">Caja, almacén y patio sincronizados en tiempo real a través del puerto 3001.</p>
          </div>
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
            <Database className="mb-2 text-amber-300" size={20} />
            <p className="text-sm font-semibold">Replicación Cloud Silenciosa</p>
            <p className="mt-1 text-xs text-slate-400">Cola SyncQueue con reintentos automáticos hacia Supabase cuando regresa la nube.</p>
          </div>
        </div>

        {/* Contenido Principal: Menú Lateral + Detalle de Etapa */}
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-3 lg:sticky lg:top-6 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-500" size={16} />
              <input 
                aria-label="Buscar en el flujo" 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
                placeholder="Buscar etapa o rol..." 
                className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/60" 
              />
            </div>

            <nav aria-label="Etapas del circuito operativo" className="space-y-1.5">
              {filtered.map((item) => (
                <button 
                  key={item.id} 
                  type="button" 
                  onClick={() => setActive(item.id)} 
                  className={`w-full rounded-xl p-3 text-left transition border ${
                    active === item.id 
                      ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-200 shadow-md" 
                      : "border-transparent text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="block text-sm font-bold truncate">{item.title}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-slate-300 border border-white/10 shrink-0">
                      {item.badge}
                    </span>
                  </div>
                  <span className="mt-1 block text-xs leading-5 text-slate-400 line-clamp-2">
                    {item.summary}
                  </span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Panel de Detalle del Procedimiento */}
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
                  Rol Responsable: {current.role}
                </span>
                <h2 className="mt-1 text-2xl font-black text-white">{current.title}</h2>
              </div>
              <span className="px-3 py-1 rounded-full bg-cyan-400/15 text-cyan-300 border border-cyan-400/30 text-xs font-mono font-bold">
                {current.badge}
              </span>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              {current.summary}
            </p>

            {/* Diagrama de Flujo Visual */}
            {current.flowDiagram && (
              <div className="rounded-xl border border-cyan-500/20 bg-slate-950/60 p-4 space-y-3">
                <p className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1.5">
                  <Layers size={14} /> Circulación de Datos Entre Actores
                </p>
                <div className="space-y-2">
                  {current.flowDiagram.map((pipe, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-xs font-mono">
                      <span className="font-bold text-slate-200">{pipe.from}</span>
                      <span className="hidden sm:inline text-cyan-400 font-bold">──[ {pipe.action} ]──▶</span>
                      <span className="sm:hidden text-cyan-400 font-bold">↓ {pipe.action}</span>
                      <span className="font-bold text-emerald-400">{pipe.to}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pasos Detallados */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Pasos a Seguir
              </h3>
              <div className="space-y-3">
                {current.steps.map((step, index) => (
                  <div key={index} className="flex gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-sm font-bold text-cyan-300">
                      {index + 1}
                    </span>
                    <p className="pt-0.5 text-sm leading-6 text-slate-200">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Nota Operativa */}
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
              <strong className="text-amber-200">Nota operativa del sistema:</strong> {current.note}
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
