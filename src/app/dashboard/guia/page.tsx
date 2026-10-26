"use client";

import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, Download, Search, ShieldCheck, Wifi, WifiOff } from "lucide-react";

const sections = [
  { id: "inicio", title: "Inicio rápido", summary: "Conoce la operación diaria de BUNKKER E.C.O.S." },
  { id: "pos", title: "Punto de venta", summary: "Agrega productos, cobra y emite tickets." },
  { id: "inventario", title: "Inventario y almacén", summary: "Ubica existencias, entradas, salidas y mermas." },
  { id: "pedidos", title: "Pedidos y entregas", summary: "Recibe pedidos, prepara y confirma entregas." },
  { id: "offline", title: "Modo offline y sincronización", summary: "Opera sin internet y sincroniza al volver la conexión." },
  { id: "seguridad", title: "Seguridad y auditoría", summary: "Protege sesiones, tickets y registros de operación." },
];

const content: Record<string, { steps: string[]; note: string }> = {
  inicio: { steps: ["Revisa el indicador de conexión en la barra superior.", "Selecciona el módulo correspondiente a tu rol.", "Realiza la operación y confirma que aparezca el folio o estado."], note: "La operación local se guarda primero en el equipo para evitar pérdida de información." },
  pos: { steps: ["Abre Punto de Venta y busca por nombre o SKU.", "Agrega artículos al carrito y selecciona el método de pago.", "Confirma la venta para generar el ticket y actualizar existencias."], note: "Verifica el total y el cambio antes de completar una venta." },
  inventario: { steps: ["Busca el producto por SKU, nombre o ubicación.", "Registra entradas, salidas, traspasos o merma con motivo.", "Confirma cantidades y revisa el historial antes de cerrar."], note: "No ajustes inventario sin evidencia o autorización del responsable." },
  pedidos: { steps: ["Abre pedidos pendientes y revisa el método de recepción.", "Prepara los artículos y valida cantidades contra el ticket.", "Marca listo, entrega o recibido según la etapa operativa."], note: "Los pedidos sin conexión quedan en cola y conservan su folio para evitar duplicados." },
  offline: { steps: ["Continúa operando aunque el indicador muestre modo local.", "Confirma que el sistema indique 'Guardado localmente'.", "Al recuperar internet, espera el estado 'Sincronizando' y después 'En línea'."], note: "No borres datos locales ni cierres el equipo mientras una cola esté sincronizando." },
  seguridad: { steps: ["Usa únicamente tu sesión y no compartas PIN o credenciales.", "Consulta Auditoría para revisar quién, cuándo y qué cambió.", "Reporta tickets o movimientos sospechosos al administrador."], note: "Los registros de auditoría toman la identidad de la sesión autenticada." },
};

export default function GuiaPage() {
  const [active, setActive] = useState("inicio");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => sections.filter((item) => `${item.title} ${item.summary}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const current = content[active];

  return (
    <main className="min-h-screen bg-[#071019] px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300"><BookOpen size={14} /> Manual operativo</div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Guía de BUNKKER E.C.O.S.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Consulta los flujos esenciales para caja, almacén, pedidos, sincronización y auditoría desde un solo lugar.</p>
          </div>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10"><Download size={16} /> Imprimir guía</button>
        </header>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4"><Wifi className="mb-3 text-emerald-300" size={20} /><p className="text-sm font-semibold">Operación local-first</p><p className="mt-1 text-xs text-slate-400">La operación continúa sin internet.</p></div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4"><ShieldCheck className="mb-3 text-cyan-300" size={20} /><p className="text-sm font-semibold">Registros protegidos</p><p className="mt-1 text-xs text-slate-400">Tickets y auditoría con identidad de sesión.</p></div>
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4"><WifiOff className="mb-3 text-amber-300" size={20} /><p className="text-sm font-semibold">Cola de sincronización</p><p className="mt-1 text-xs text-slate-400">Los cambios pendientes se reintentan sin duplicar.</p></div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-3 lg:sticky lg:top-6">
            <label className="relative mb-3 block"><Search className="absolute left-3 top-3 text-slate-500" size={16} /><input aria-label="Buscar en la guía" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en la guía" className="w-full rounded-xl border border-white/10 bg-black/20 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/60" /></label>
            <nav aria-label="Secciones del manual" className="space-y-1">{filtered.map((item) => <button key={item.id} type="button" onClick={() => setActive(item.id)} className={`w-full rounded-xl px-3 py-3 text-left transition ${active === item.id ? "bg-cyan-400/15 text-cyan-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><span className="block text-sm font-semibold">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{item.summary}</span></button>)}</nav>
          </aside>

          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Procedimiento</p>
            <h2 className="mt-2 text-2xl font-bold">{sections.find((item) => item.id === active)?.title}</h2>
            <div className="mt-8 space-y-3">{current.steps.map((step, index) => <div key={step} className="flex gap-4 rounded-xl border border-white/10 bg-black/20 p-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-sm font-bold text-cyan-300">{index + 1}</span><p className="pt-1 text-sm leading-6 text-slate-200">{step}</p></div>)}</div>
            <div className="mt-8 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100"><strong>Nota operativa:</strong> {current.note}</div>
          </article>
        </div>
      </div>
    </main>
  );
}
