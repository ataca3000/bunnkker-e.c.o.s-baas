// Módulo de Bitácora y Generador de Ticket Digital Independiente por Caja

export interface DigitalTicket {
  id: string;
  orderId: string;
  cajaId: string;
  cashierName: string;
  timestamp: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  paymentMethod: string;
  consecutiveNumber: number;
}

export function saveDigitalTicket(cajaId: string, cashierName: string, orderId: string, items: any[], total: number, paymentMethod = 'EFECTIVO'): DigitalTicket {
  const storageKey = `_bunkker_tickets_${cajaId || 'caja_1'}`;
  let existing: DigitalTicket[] = [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) existing = JSON.parse(raw);
  } catch (e) {}

  const consecutiveNumber = existing.length + 1;
  const ticket: DigitalTicket = {
    id: `TCK-${cajaId}-${String(consecutiveNumber).padStart(4, '0')}`,
    orderId,
    cajaId: cajaId || 'caja_1',
    cashierName: cashierName || 'Cajero',
    timestamp: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + new Date().toLocaleDateString('es-MX'),
    items: items.map(i => ({ name: i.name, quantity: i.quantity || 1, price: i.price })),
    total,
    paymentMethod,
    consecutiveNumber
  };

  existing.unshift(ticket);
  // Mantener los últimos 200 tickets digitales por caja en memoria local
  if (existing.length > 200) existing = existing.slice(0, 200);

  try {
    localStorage.setItem(storageKey, JSON.stringify(existing));
  } catch (e) {}

  return ticket;
}

export function getDigitalTickets(cajaId: string): DigitalTicket[] {
  const storageKey = `_bunkker_tickets_${cajaId || 'caja_1'}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}
