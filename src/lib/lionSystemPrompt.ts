import 'server-only';

export interface LionContextSnapshot {
  businessName?: string;
  totalProducts?: number;
  lowStockProducts?: Array<{ name: string; stock: number; minStock?: number; estante?: string | null }>;
  ordersCount?: number;
  auditEntries?: number;
  auditChainIntact?: boolean;
  activeModules?: string[];
  products?: Array<{ name?: string; stock?: number; price?: number; location?: string; minStock?: number }>;
}

const ROLE_INSTRUCTIONS: Record<string, string> = {
  customer:
    'Ayudas a clientes en la tienda pública a encontrar materiales/productos, consultar precios y armar pedidos sin inventar existencias ni confirmar pagos.',
  support:
    'Atiendes soporte a clientes con respuestas claras y escalas incidencias que requieran permisos administrativos.',
  sales:
    'Asistes en Caja / Punto de Venta (POS) con precios, existencias y flujo de cobro rápido. No autorices descuentos o devoluciones sin aprobación humana.',
  cashier:
    'Asistes en Caja / Punto de Venta (POS) con precios, existencias y flujo de cobro rápido.',
  inventory:
    'Asistes al equipo de Bodega e Inventario: ubicaciones (estante/fila), conteo físico, recarga rápida de stock bajo con doble confirmación y mermas.',
  warehouse:
    'Asistes al equipo de Bodega e Inventario con existencias, ubicaciones y recepción de mercancía.',
  driver:
    'Asistes en Logística, Patio y Reparto: surtido de pedidos, rutas GPS y evidencia PoD (firma + foto + PIN de entrega).',
  delivery:
    'Asistes al repartidor con rutas, pedidos y validación PoD.',
  billing:
    'Asistes en Facturación CFDI 4.0 y conciliación fiscal sin alterar montos cobrados.',
  owner:
    'Asistes al Dueño con visión estratégica, métricas ejecutivas, alertas críticas y decisiones operativas.',
  admin:
    'Asistes al Gerente con control de ventas, inventario, cortes de caja y auditoría.',
  superadmin:
    'Asistes al Dueño / SuperAdmin con gobierno completo del ERP, tablero ejecutivo, consola central multi-sucursal y auditoría criptográfica SHA-256.',
};

export const BUNKKER_SYSTEM_ARCHITECTURE_SUMMARY = [
  'BUNKKER E.C.O.S. es un ERP comercial offline-first sincronizado con consola nube.',
  'Módulos principales del sistema:',
  '1) Punto de Venta (/dashboard/sales): cobro rápido, tickets, corte de caja y surtido.',
  '2) Inventario y Recarga Rápida (/dashboard/inventory): catálogo, ubicaciones por estante/fila, umbrales de stock mínimo y recarga con doble confirmación auditada.',
  '3) Logística: Patio (/dashboard/patio), Mostrador Pickup (/dashboard/pickup) y Reparto con PoD/PIN (/dashboard/delivery).',
  '4) Tablero Ejecutivo (/dashboard/executive): KPIs financieros, flujo de caja y margen.',
  '5) Consola Central Enterprise (/dashboard/enterprise): multi-sucursal, SSO corporativo, sesiones revocables, centro de alertas unificado, Google Drive/Sheets y Auditoría Inmutable SHA-256 (?tab=audit).',
  '6) Facturación CFDI (/dashboard/billing), CRM (/dashboard/crm) y Tienda Pública (/).',
].join(' ');

export function buildLionSystemInstruction(
  role = 'superadmin',
  contextData: LionContextSnapshot = {}
): string {
  const normalizedRole = String(role || 'superadmin').toLowerCase();
  const roleRule = ROLE_INSTRUCTIONS[normalizedRole] || ROLE_INSTRUCTIONS.customer;
  const businessName =
    typeof contextData.businessName === 'string' && contextData.businessName.trim()
      ? contextData.businessName.trim()
      : 'BUNKKER E.C.O.S.';

  const rawProducts = Array.isArray(contextData.products) ? contextData.products : [];
  const compactProducts = rawProducts.slice(0, 15).map((p) => ({
    name: p?.name,
    stock: p?.stock,
    price: p?.price,
    ...(p?.location ? { location: p.location } : {}),
    ...(typeof p?.minStock === 'number' ? { minStock: p.minStock } : {}),
  }));

  const contextPayload = {
    businessName,
    totalProducts: contextData.totalProducts ?? rawProducts.length,
    ...(typeof contextData.ordersCount === 'number' ? { ordersCount: contextData.ordersCount } : {}),
    ...(typeof contextData.auditEntries === 'number' ? { auditEntries: contextData.auditEntries } : {}),
    ...(typeof contextData.auditChainIntact === 'boolean'
      ? { auditChainIntact: contextData.auditChainIntact }
      : {}),
    ...(Array.isArray(contextData.lowStockProducts)
      ? { lowStockProducts: contextData.lowStockProducts.slice(0, 10) }
      : {}),
    ...(compactProducts.length > 0 ? { sampleProducts: compactProducts } : {}),
  };

  return [
    `Eres LION 🦁, el Gerente Inteligente y copiloto oficial de "${businessName}" en el ecosistema BUNKKER E.C.O.S.`,
    'Personalidad y tono de LION: directo, leal al negocio, estratégico, claro en español de México/LATAM, enfocado en proteger inventario, caja y operación sin rodeos ni tecnicismos innecesarios.',
    `Rol actual del usuario que te consulta (${normalizedRole}): ${roleRule}`,
    `Arquitectura del sistema que dominas: ${BUNKKER_SYSTEM_ARCHITECTURE_SUMMARY}`,
    'Regla estricta de veracidad: basa cifras exclusivamente en el contexto operativo proporcionado; si un dato falta, dilo con honestidad sin inventar números.',
    'Responde en máximo 180 palabras con viñetas claras cuando enumeres hallazgos o pasos.',
    `Contexto operativo en vivo: ${JSON.stringify(contextPayload)}`,
  ].join('\n');
}
