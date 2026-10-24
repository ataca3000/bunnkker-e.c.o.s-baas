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
  signatureData?: string | null;
  loadedBy?: string | null;
  validationSerial?: string;
  deliveryType?: 'PATIO' | 'CAJA';
  status?: 'COMPLETADO' | 'CANCELADO';
  cancellationReason?: string;
  notes?: string[];
}

const STORAGE_PREFIX = '_bunkker_tickets_';

import { roundMoney, safeAddMoney } from '@/lib/financial';

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
    signatureData?: string | null;
    loadedBy?: string | null;
    validationSerial?: string;
    deliveryType?: 'PATIO' | 'CAJA';
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

  const formattedItems: DigitalTicketItem[] = items.map(i => {
    const unitPrice = roundMoney(Number(i.price) || 0);
    const qty = Number(i.quantity) || 1;
    return {
      id: i.id || '',
      name: i.name || 'Producto',
      quantity: qty,
      unitType: i.unitType || 'PZA',
      price: unitPrice,
      subtotal: roundMoney(unitPrice * qty),
    };
  });

  const finalTotal = roundMoney(Number(total) || 0);
  const received = roundMoney(Number(paymentDetails.amountReceived ?? finalTotal));
  const changeAmt = roundMoney(Number(paymentDetails.change ?? Math.max(0, received - finalTotal)));

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
    total: finalTotal,
    amountReceived: received,
    change: changeAmt,
    paymentMethod: paymentDetails.paymentMethod || 'EFECTIVO EN CAJA',
    consecutiveNumber,
    facturaStatus: 'no_solicitada',
    evidencePhoto: paymentDetails.evidencePhoto || null,
    signatureData: paymentDetails.signatureData || null,
    loadedBy: paymentDetails.loadedBy || null,
    validationSerial: paymentDetails.validationSerial,
    deliveryType: paymentDetails.deliveryType,
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

export function clearDigitalTickets(cajaId = 'caja_1'): boolean {
  const safeCaja = cajaId || 'caja_1';
  const storageKey = `${STORAGE_PREFIX}${safeCaja}`;
  try {
    localStorage.removeItem(storageKey);
    localStorage.removeItem('_bunkker_last_ticket');
    return true;
  } catch (e) {
    console.warn('Error clearing digital tickets:', e);
  }
  return false;
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

export function addNoteToDigitalTicket(cajaId: string, ticketId: string, noteText: string): boolean {
  if (!noteText || !noteText.trim()) return false;
  const safeCaja = cajaId || 'caja_1';
  const storageKey = `${STORAGE_PREFIX}${safeCaja}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false;
    const tickets: DigitalTicket[] = JSON.parse(raw);
    const index = tickets.findIndex(t => t.id === ticketId || t.orderId === ticketId);
    if (index !== -1) {
      const currentNotes = tickets[index].notes || [];
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      tickets[index].notes = [...currentNotes, `[${timestamp}] ${noteText.trim()}`];
      localStorage.setItem(storageKey, JSON.stringify(tickets));
      return true;
    }
  } catch (e) {
    console.error('Error adding note to ticket:', e);
  }
  return false;
}

export function cancelDigitalTicket(cajaId: string, ticketId: string, reason: string): boolean {
  if (!reason || !reason.trim()) return false;
  const safeCaja = cajaId || 'caja_1';
  const storageKey = `${STORAGE_PREFIX}${safeCaja}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false;
    const tickets: DigitalTicket[] = JSON.parse(raw);
    const index = tickets.findIndex(t => t.id === ticketId || t.orderId === ticketId);
    if (index !== -1) {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      tickets[index].status = 'CANCELADO';
      tickets[index].cancellationReason = reason.trim();
      const currentNotes = tickets[index].notes || [];
      tickets[index].notes = [...currentNotes, `[${timestamp} - CANCELACIÓN] Motivo: ${reason.trim()}`];
      localStorage.setItem(storageKey, JSON.stringify(tickets));
      return true;
    }
  } catch (e) {
    console.error('Error cancelling ticket:', e);
  }
  return false;
}
