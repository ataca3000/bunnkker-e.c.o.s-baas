import { History } from 'lucide-react';

const EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Pedido generado',
  CASHIER_CLAIMED: 'Pedido tomado por caja',
  PAYMENT_CONFIRMED: 'Pago confirmado',
  LOADING_CLAIMED: 'Preparación iniciada',
  LOADING_COMPLETED: 'Pedido preparado',
  DRIVER_CLAIMED: 'Ruta asignada',
  DELIVERY_RECEIVED: 'Entrega validada',
  PICKUP_RECEIVED: 'Pedido recogido',
  ORDER_CANCELLED: 'Pedido cancelado',
  ORDER_EXPIRED: 'Reserva vencida'
};

export default function OrderActivity({ orders = [], actorId }: { orders?: any[]; actorId?: string }) {
  if (!actorId) return null;

  const activity = orders
    .flatMap(order => (order.events || [])
      .filter((event: any) => event.actorId === actorId)
      .map((event: any) => ({ ...event, orderId: order.id, customerName: order.customer?.name || 'Cliente' })))
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 12);

  return (
    <section className="mt-8 border border-slate-700/70 bg-slate-900/70 p-5">
      <div className="mb-4 flex items-center gap-2 border-b border-slate-700/70 pb-3">
        <History size={18} className="text-sky-300" />
        <h3 className="text-sm font-black uppercase tracking-wide text-white">Mi actividad reciente</h3>
      </div>
      {activity.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-500">Tus movimientos de pedidos aparecerán aquí.</p>
      ) : (
        <ol className="space-y-3">
          {activity.map((event: any) => (
            <li key={event.id} className="flex flex-col gap-1 border-l-2 border-sky-500/50 pl-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold text-slate-200">{EVENT_LABELS[event.eventType] || event.eventType.replaceAll('_', ' ')}</p>
                <p className="text-[11px] text-slate-400">{event.orderId} · {event.customerName}</p>
              </div>
              <time className="text-[10px] text-slate-500">{new Date(event.createdAt).toLocaleString('es-MX')}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}