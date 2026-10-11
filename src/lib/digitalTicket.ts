// Módulo de Bitácora y Generador de Ticket Digital Independiente por Caja
// Diseñado para doble comprobante: Copia Cliente (Garantía) y Copia Tienda/Vendedor (Despacho y Corte)

export interface DigitalTicketItem {
  id?: string;
  name: string;
  quantity: number;
  unitType?: string;
  price: number;
  subtotal: number;
}

export interface DigitalTicket {
  id: string; // TCK-CAJA-0001
  orderId: string;
  cajaId: string;
  cajaName?: string;
  cashierName: string;
  vendedorId?: string;
  vendedorName?: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  timestamp: string;
  dateIso: string;
  items: DigitalTicketItem[];
  total: number;
  amountReceived: number;
  change: number;
  paymentMethod: string; // 'EFECTIVO EN CAJA'
  consecutiveNumber: number;
  copyType?: 'CLIENTE' | 'TIENDA';
  facturaStatus?: 'pendiente' | 'facturado' | 'no_solicitada';
  facturaRfc?: string;
  evidencePhoto?: string | null;
}

const STORAGE_PREFIX = '_bunkker_tickets_';

export function saveDigitalTicket(
  cajaId: string,
  cashierName: string,
  orderId: string,
  items: any[],
  total: number,
  paymentDetails: {
    amountReceived?: number;
    change?: number;
    paymentMethod?: string;
    customerName?: string;
    vendedorId?: string;
    vendedorName?: string;
    evidencePhoto?: string | null;
  } = {}
): DigitalTicket {
  const safeCaja = cajaId || 'caja_1';
  const storageKey = `${STORAGE_PREFIX}${safeCaja}`;
  let existing: DigitalTicket[] = [];

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) existing = JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading local tickets:', e);
  }

  const consecutiveNumber = existing.length + 1;
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const formattedItems: DigitalTicketItem[] = items.map(i => ({
    id: i.id || '',
    name: i.name || 'Producto',
    quantity: i.quantity || 1,
    unitType: i.unitType || 'PZA',
    price: Number(i.price) || 0,
    subtotal: Number(( (i.price || 0) * (i.quantity || 1) ).toFixed(2)),
  }));

  const ticket: DigitalTicket = {
    id: `TCK-${safeCaja.toUpperCase()}-${String(consecutiveNumber).padStart(5, '0')}`,
    orderId,
    cajaId: safeCaja,
    cajaName: `Caja ${safeCaja.replace('caja_', '').toUpperCase()}`,
    cashierName: cashierName || 'Cajero de Turno',
    vendedorId: paymentDetails.vendedorId || 'LOCAL',
    vendedorName: paymentDetails.vendedorName || cashierName || 'Vendedor Piso',
    customerName: paymentDetails.customerName || 'Cliente Mostrador',
    timestamp: `${timeStr} - ${dateStr}`,
    dateIso: now.toISOString(),
    items: formattedItems,
    total: Number(total.toFixed(2)),
    amountReceived: Number((paymentDetails.amountReceived || total).toFixed(2)),
    change: Number((paymentDetails.change || 0).toFixed(2)),
    paymentMethod: paymentDetails.paymentMethod || 'EFECTIVO EN CAJA',
    consecutiveNumber,
    facturaStatus: 'no_solicitada',
    evidencePhoto: paymentDetails.evidencePhoto || null,
  };

  existing.unshift(ticket);
  // Mantener los últimos 300 tickets locales por caja
  if (existing.length > 300) {
    existing = existing.slice(0, 300);
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(existing));
    // Guardar también el último ticket global para acceso instantáneo
    localStorage.setItem('_bunkker_last_ticket', JSON.stringify(ticket));
  } catch (e) {
    console.warn('Error saving ticket to localStorage:', e);
  }

  return ticket;
}

export function getDigitalTickets(cajaId = 'caja_1'): DigitalTicket[] {
  const safeCaja = cajaId || 'caja_1';
  const storageKey = `${STORAGE_PREFIX}${safeCaja}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export function getLastDigitalTicket(): DigitalTicket | null {
  try {
    const raw = localStorage.getItem('_bunkker_last_ticket');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

export function updateTicketFacturaStatus(cajaId: string, ticketId: string, rfc: string): boolean {
  const safeCaja = cajaId || 'caja_1';
  const storageKey = `${STORAGE_PREFIX}${safeCaja}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false;
    const tickets: DigitalTicket[] = JSON.parse(raw);
    const index = tickets.findIndex(t => t.id === ticketId || t.orderId === ticketId);
    if (index !== -1) {
      tickets[index].facturaStatus = 'facturado';
      tickets[index].facturaRfc = rfc;
      localStorage.setItem(storageKey, JSON.stringify(tickets));
      return true;
    }
  } catch (e) {}
  return false;
}
