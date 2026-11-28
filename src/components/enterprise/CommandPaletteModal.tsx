'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CreditCard,
  FileCheck2,
  LayoutDashboard,
  Package,
  Search,
  ShieldCheck,
  ShoppingCart,
  Truck,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { hasCapability, type EnterpriseCapability } from '@/lib/enterpriseRbac';

interface CommandPaletteModalProps {
  open: boolean;
  onClose: () => void;
  onOpenAlerts: () => void;
}

interface PaletteEntry {
  id: string;
  section: 'Módulo' | 'Acción rápida' | 'Catálogo' | 'Pedido';
  title: string;
  subtitle: string;
  keywords: string;
  icon: React.ReactNode;
  run: () => void;
}

interface ModuleSpec {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  keywords: string;
  capability?: EnterpriseCapability;
  icon: React.ReactNode;
}

const DASHBOARD_MODULES: ModuleSpec[] = [
  {
    id: 'mod-home',
    href: '/dashboard',
    title: 'Inicio Operativo',
    subtitle: 'Resumen de rol y accesos principales',
    keywords: 'inicio home dashboard resumen',
    icon: <LayoutDashboard size={15} aria-hidden="true" />,
  },
  {
    id: 'mod-enterprise',
    href: '/dashboard/enterprise',
    title: 'Consola Central Multi-Sucursal',
    subtitle: 'Nodos aislados, sesiones revocables, RBAC y Google Workspace',
    keywords: 'enterprise sucursales nodos cloud m365 sesiones sso rbac auditoria',
    capability: 'branches:admin',
    icon: <Building2 size={15} aria-hidden="true" />,
  },
  {
    id: 'mod-executive',
    href: '/dashboard/executive',
    title: 'Tablero Ejecutivo de Ventas',
    subtitle: 'KPIs, Hoy vs Ayer, rangos de fecha y Google Sheets',
    keywords: 'tablero ejecutivo ventas rendimiento margen sheets',
    capability: 'executive:read',
    icon: <BarChart3 size={15} aria-hidden="true" />,
  },
  {
    id: 'mod-sales',
    href: '/dashboard/sales',
    title: 'Punto de Venta (POS / Caja)',
    subtitle: 'Cobro rápido, tickets y validación de pedidos',
    keywords: 'pos caja ventas cobrar ticket',
    capability: 'orders:write',
    icon: <ShoppingCart size={15} aria-hidden="true" />,
  },
  {
    id: 'mod-inventory',
    href: '/dashboard/inventory',
    title: 'Almacén e Inventario',
    subtitle: 'Catálogo, existencias físicas, costos y ubicaciones',
    keywords: 'inventario almacen stock productos catalogo',
    capability: 'inventory:read',
    icon: <Boxes size={15} aria-hidden="true" />,
  },
  {
    id: 'mod-patio',
    href: '/dashboard/patio',
    title: 'Patio de Carga y Surtido',
    subtitle: 'Preparación de mercancía y evidencia de batea',
    keywords: 'patio carga descarga surtido preparacion',
    capability: 'orders:read',
    icon: <Package size={15} aria-hidden="true" />,
  },
  {
    id: 'mod-delivery',
    href: '/dashboard/delivery',
    title: 'Reparto y Evidencia PoD',
    subtitle: 'Rutas activas, firma y fotografía de entrega',
    keywords: 'reparto entregas chofer gps pod',
    capability: 'orders:read',
    icon: <Truck size={15} aria-hidden="true" />,
  },
  {
    id: 'mod-audit',
    href: '/dashboard/audit',
    title: 'Auditoría y Arqueos',
    subtitle: 'Cortes de caja, discrepancias y facturación',
    keywords: 'auditoria arqueo caja facturas cfdi',
    capability: 'audit:read',
    icon: <FileCheck2 size={15} aria-hidden="true" />,
  },
  {
    id: 'mod-billing',
    href: '/dashboard/suscripcion',
    title: 'Suscripción SaaS y Licencias',
    subtitle: 'Planes comerciales, hardware vinculado y facturación',
    keywords: 'suscripcion plan licencia stripe pago saas',
    capability: 'billing:admin',
    icon: <CreditCard size={15} aria-hidden="true" />,
  },
];

export default function CommandPaletteModal({
  open,
  onClose,
  onOpenAlerts,
}: CommandPaletteModalProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { products, orders, formatCurrency } = useCart();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [open]);

  const role = profile?.role || '';

  const allEntries = useMemo<PaletteEntry[]>(() => {
    const entries: PaletteEntry[] = [];

    for (const mod of DASHBOARD_MODULES) {
      if (mod.capability && !hasCapability(role, mod.capability)) continue;
      entries.push({
        id: mod.id,
        section: 'Módulo',
        title: mod.title,
        subtitle: mod.subtitle,
        keywords: `${mod.title} ${mod.subtitle} ${mod.keywords}`.toLowerCase(),
        icon: mod.icon,
        run: () => {
          onClose();
          router.push(mod.href);
        },
      });
    }

    entries.push({
      id: 'act-alerts',
      section: 'Acción rápida',
      title: 'Abrir Centro Unificado de Alertas',
      subtitle: 'Revisar stock crítico, colas pendientes y seguridad',
      keywords: 'alertas notificaciones centro critico',
      icon: <Bell size={15} aria-hidden="true" />,
      run: () => {
        onClose();
        onOpenAlerts();
      },
    });

    if (hasCapability(role, 'audit:read')) {
      entries.push({
        id: 'act-immutable-audit',
        section: 'Acción rápida',
        title: 'Auditoría Inmutable SHA-256',
        subtitle: 'Validar cadena criptográfica, sellar checkpoints y prueba forense',
        keywords: 'auditoria inmutable sha256 sha-256 hash cadena integridad forense logs',
        icon: <ShieldCheck size={15} aria-hidden="true" />,
        run: () => {
          onClose();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('bunkker_enterprise_tab', { detail: { tab: 'audit' } })
            );
          }
          router.push('/dashboard/enterprise?tab=audit');
        },
      });
    }

    if (hasCapability(role, 'inventory:read')) {
      for (const product of products.slice(0, 40)) {
        entries.push({
          id: `prod-${product.id}`,
          section: 'Catálogo',
          title: product.name,
          subtitle: `Stock: ${product.stock} pzas · ${formatCurrency(product.price)} · ${product.estante || 'Sin estante'}`,
          keywords: `${product.name} ${product.barcode || ''} ${product.category || ''} producto sku`.toLowerCase(),
          icon: <Package size={15} aria-hidden="true" />,
          run: () => {
            onClose();
            router.push('/dashboard/inventory');
          },
        });
      }
    }

    if (hasCapability(role, 'orders:read')) {
      for (const order of orders.slice(0, 25)) {
        const shortId = order.id.slice(0, 8).toUpperCase();
        entries.push({
          id: `ord-${order.id}`,
          section: 'Pedido',
          title: `Pedido #${shortId}`,
          subtitle: `${order.customerName || 'Cliente mostrador'} · ${formatCurrency(order.total)} · ${order.status}`,
          keywords: `pedido orden ${order.id} ${shortId} ${order.customerName || ''} ${order.status}`.toLowerCase(),
          icon: <ShoppingCart size={15} aria-hidden="true" />,
          run: () => {
            onClose();
            router.push(hasCapability(role, 'orders:write') ? '/dashboard/sales' : '/dashboard/patio');
          },
        });
      }
    }

    return entries;
  }, [role, products, orders, formatCurrency, onClose, onOpenAlerts, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allEntries.slice(0, 12);
    const terms = q.split(/\s+/).filter(Boolean);
    return allEntries
      .filter((entry) => terms.every((t) => entry.keywords.includes(t)))
      .slice(0, 14);
  }, [allEntries, query]);

  const clampedIndex = Math.min(activeIndex, Math.max(0, filtered.length - 1));

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (filtered.length === 0 ? 0 : (prev + 1) % filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        filtered.length === 0 ? 0 : (prev - 1 + filtered.length) % filtered.length
      );
    } else if (e.key === 'Enter' && filtered[clampedIndex]) {
      e.preventDefault();
      filtered[clampedIndex].run();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette Global"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/75 px-4 pt-20 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
          <Search size={16} className="shrink-0 text-sky-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Ir a módulo, buscar SKU, número de pedido o comando..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar Command Palette"
            className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-800/70">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-slate-400">
              No se encontraron módulos, productos o pedidos para &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const selected = idx === clampedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={item.run}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                    selected ? 'bg-sky-500/15 text-slate-50' : 'hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={selected ? 'text-sky-400' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-100">{item.title}</p>
                      <p className="truncate text-[11px] text-slate-400">{item.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-[11px] text-slate-400">
                    <span>{item.section}</span>
                    {selected && <ArrowRight size={13} className="text-sky-400" aria-hidden="true" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/70 px-4 py-2 text-[11px] text-slate-400">
          <span>↑↓ navegar · Enter ejecutar · Esc cerrar</span>
          <span className="font-mono text-slate-500">{filtered.length} resultados</span>
        </div>
      </div>
    </div>
  );
}
