// src/lib/configHelpCatalog.ts

export type HelpRiskLevel = 'bajo' | 'medio' | 'alto';

export interface ConfigHelpEntry {
  key: string;
  title: string;
  whatItDoes: string;
  whoItAffects: string;
  riskLevel: HelpRiskLevel;
  tip: string;
}

export const CONFIG_HELP_CATALOG: Record<string, ConfigHelpEntry> = {
  operationSpace: {
    key: 'operationSpace',
    title: 'Operación Local vs Modo Business',
    whatItDoes:
      'Separa la vista diaria de tienda única (Operación Local: caja POS, almacén, patio y pickup) de las funciones corporativas avanzadas (Modo Business: multi-sucursal, espejo en la nube, SSO y auditoría SHA-256).',
    whoItAffects:
      'A los operadores y administradores dentro del panel. Tus ventas, inventario y tienda pública siguen intactos al cambiar de vista.',
    riskLevel: 'bajo',
    tip: 'Usa Operación Local para trabajar sin distracciones; cambia a Modo Business solo cuando administres sucursales o integraciones en la nube.',
  },
  businessName: {
    key: 'businessName',
    title: 'Nombre Comercial y Eslogan',
    whatItDoes:
      'Define el título visible de tu negocio en tickets impresos, encabezado de la tienda en línea y mensajes del asistente LION.',
    whoItAffects: 'Clientes públicos en catálogo, tickets de venta y personal del panel.',
    riskLevel: 'bajo',
    tip: 'Puedes actualizarlo en cualquier momento sin afectar pedidos ni existencias.',
  },
  facturapi: {
    key: 'facturapi',
    title: 'Facturación SAT (Facturapi 4.0)',
    whatItDoes:
      'Conecta tus llaves de Facturapi para timbrar CFDI 4.0 directamente al cobrar en caja y enviar PDF/XML al cliente.',
    whoItAffects: 'Cajeras, módulo de Facturación CFDI y clientes que soliciten factura.',
    riskLevel: 'medio',
    tip: 'Verifica que la llave corresponda al RFC emisor correcto (pruebas vs producción) antes de emitir facturas reales.',
  },
  bankAccount: {
    key: 'bankAccount',
    title: 'Cuenta Bancaria de Destino (CLABE)',
    whatItDoes:
      'Registra el banco y la CLABE de 18 dígitos donde recibes transferencias SPEI y depósitos vinculados a fichas de pago.',
    whoItAffects: 'Clientes que pagan por transferencia web cuando las fichas web están activas, y cortes de caja.',
    riskLevel: 'medio',
    tip: 'Revisa los 18 dígitos dos veces antes de guardar para evitar transferencias rechazadas.',
  },
  enableWebPayments: {
    key: 'enableWebPayments',
    title: 'Fichas y Pagos Web Públicos',
    whatItDoes:
      'Muestra u oculta las referencias bancarias y opciones de reserva/pago directo en el carrito de la tienda pública.',
    whoItAffects: 'Únicamente a los compradores de la tienda web; las ventas en caja física (POS) siguen operando normal.',
    riskLevel: 'medio',
    tip: 'Desactívalo temporalmente si solo deseas recibir pedidos para pagar físicamente en mostrador.',
  },
  requireCashierInspection: {
    key: 'requireCashierInspection',
    title: 'Inspección Obligatoria en Caja',
    whatItDoes:
      'Exige que una cajera confirme el serial BNK-XXXX y el cobro antes de liberar un pedido hacia Almacén o Patio.',
    whoItAffects: 'Flujo entre caja, mostrador (pickup) y almacén.',
    riskLevel: 'bajo',
    tip: 'Mantén esta opción activa para evitar entregas sin comprobante validado.',
  },
  operationRange: {
    key: 'operationRange',
    title: 'Alcance Operativo y Módulos',
    whatItDoes:
      'Activa o pausa módulos del ecosistema (Ventas, Almacén, Reparto, Facturación, Marketing) y define la cobertura logística.',
    whoItAffects: 'Menús visibles del equipo y rutas de envío disponibles.',
    riskLevel: 'medio',
    tip: 'En Modo Operación Local basta mantener Ventas, Inventario y Pickup activos.',
  },
  cloudBackup: {
    key: 'cloudBackup',
    title: 'Bóveda Local y Respaldos Cloud',
    whatItDoes:
      'Resguarda automáticamente inventario, ventas y configuración en disco local y, si lo deseas, en Google Drive / Firebase.',
    whoItAffects: 'Almacenamiento del servidor y recuperación ante fallos de energía.',
    riskLevel: 'bajo',
    tip: 'El sistema siempre guarda en disco local primero aunque se vaya el internet.',
  },
  hardwarePrinters: {
    key: 'hardwarePrinters',
    title: 'Impresoras Térmicas y Escáneres',
    whatItDoes:
      'Configura el ancho de ticket (58mm / 80mm), apertura automática de cajón de dinero y lectores de código de barras.',
    whoItAffects: 'Terminales de Punto de Venta (POS) y recepción en almacén.',
    riskLevel: 'bajo',
    tip: 'Prueba una impresión de diagnóstico antes de abrir turno.',
  },
  androidPush: {
    key: 'androidPush',
    title: 'Alertas Push en Tiempo Real',
    whatItDoes:
      'Envía avisos inmediatos al teléfono del dueño o encargados cuando un producto baja del mínimo o cambia un precio.',
    whoItAffects: 'Administradores y SuperAdmin suscritos desde su dispositivo.',
    riskLevel: 'bajo',
    tip: 'Requiere permiso de notificaciones del navegador en el teléfono.',
  },
  hidePublicStock: {
    key: 'hidePublicStock',
    title: 'Ocultar piezas al público (solo precio)',
    whatItDoes:
      'Muestra únicamente el precio y la palabra "Disponible" en la tienda pública, ocultando cuántas piezas exactas quedan en bodega.',
    whoItAffects: 'Solo la tienda pública. Almacén y POS siguen viendo y descontando el inventario real.',
    riskLevel: 'bajo',
    tip: 'Útil cuando no quieres que competidores o clientes vean cuántas unidades exactas tienes en existencia.',
  },
  hideFromPublic: {
    key: 'hideFromPublic',
    title: 'Ocultar tarjeta completa al público',
    whatItDoes:
      'Saca por completo este producto de la tienda pública y sus categorías, sin eliminarlo del sistema.',
    whoItAffects: 'La tienda en línea. El producto sigue activo para vender en caja (POS) y controlar stock en Almacén.',
    riskLevel: 'medio',
    tip: 'Ideal para insumos internos, pedidos bajo cotización o artículos en revisión.',
  },
  thresholdConfig: {
    key: 'thresholdConfig',
    title: 'Umbrales de Stock Mínimo',
    whatItDoes:
      'Define a partir de cuántas piezas el sistema enciende alertas de stock bajo por categoría o por producto individual.',
    whoItAffects: 'Alertas en Almacén, tablero del SuperAdmin y reportes de resurtido con LION.',
    riskLevel: 'bajo',
    tip: 'Ajusta umbrales más altos para productos de alta rotación.',
  },
  branchIsolationMode: {
    key: 'branchIsolationMode',
    title: 'Topología de Aislamiento de Sucursal',
    whatItDoes:
      'Elige si la sucursal opera primero de forma autónoma con respaldo local (Local-First) o si sincroniza espejo continuo en la nube (Espejo Cloud).',
    whoItAffects: 'Sucursales registradas en Modo Business y su cola de replicación.',
    riskLevel: 'alto',
    tip: 'Si una sucursal tiene internet inestable, usa siempre "Aislada Local-First".',
  },
  branchTier: {
    key: 'branchTier',
    title: 'Plan SaaS por Sucursal',
    whatItDoes:
      'Asigna el nivel de capacidades habilitadas (TRIAL, STARTER, PRO o ENTERPRISE) para cada nodo de sucursal.',
    whoItAffects: 'Límites de funciones avanzadas disponibles en esa sucursal.',
    riskLevel: 'medio',
    tip: 'Solo modificable en Modo Business por el SuperAdmin.',
  },
  auditChain: {
    key: 'auditChain',
    title: 'Auditoría Inmutable SHA-256',
    whatItDoes:
      'Encadena criptográficamente cada cambio crítico (precios, borrados, configuraciones) con el hash del evento anterior para detectar alteraciones.',
    whoItAffects: 'Historial forense de seguridad y respaldos en Google Drive.',
    riskLevel: 'bajo',
    tip: 'Es de solo lectura: nadie puede borrar bloques anteriores sin invalidar la cadena.',
  },
};

export function getConfigHelpEntry(key: string): ConfigHelpEntry | null {
  return CONFIG_HELP_CATALOG[key] || null;
}
