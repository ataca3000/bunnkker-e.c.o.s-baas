import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, DollarSign } from 'lucide-react';
import type { OrderType } from './Cart';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  orderType: OrderType;
  onConfirm: (amountReceived: number, change: number) => void;
  isProcessing: boolean;
}

export function PaymentModal({ isOpen, onClose, total, orderType, onConfirm, isProcessing }: PaymentModalProps) {
  const [received, setReceived] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setReceived('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const receivedAmount = parseFloat(received) || 0;
  const change = Math.max(0, receivedAmount - total);
  const isValid = receivedAmount >= total;

  const quickAmounts = [
    total,
    Math.ceil(total / 50) * 50,
    Math.ceil(total / 100) * 100,
    Math.ceil(total / 500) * 500,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= total);

  const handleConfirm = () => {
    if (!isValid || isProcessing) return;
    onConfirm(receivedAmount, change);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-400" />
            Cerrar Venta y Cobro
          </h3>
          <button onClick={onClose} disabled={isProcessing} className="p-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/20">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary */}
          <div className="text-center space-y-1">
            <p className="text-sm text-zinc-400 font-medium uppercase tracking-wider">
              {orderType === 'local' ? 'Entrega en Piso' : 'Envío a Domicilio'}
            </p>
            <div className="text-4xl font-display font-bold text-white">
              ${total.toFixed(2)}
            </div>
            <p className="text-sm text-zinc-500">Total a cobrar</p>
          </div>

          {/* Input Area */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-300">Monto Recibido Efectivo</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-zinc-500 font-bold text-lg">$</span>
              </div>
              <input
                type="number"
                autoFocus
                className="block w-full pl-8 pr-4 py-4 text-2xl font-bold border-2 border-white/10 rounded-xl bg-black/40 text-white focus:bg-black/60 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/20 transition-all hide-arrows"
                placeholder="0.00"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                disabled={isProcessing}
              />
            </div>

            {/* Quick amount chips */}
            <div className="flex gap-2 shrink-0">
               {quickAmounts.map(amt => (
                 <button
                   key={amt}
                   onClick={() => setReceived(amt.toString())}
                   disabled={isProcessing}
                   className="flex-1 py-2 px-1 text-sm font-medium border border-white/10 bg-white/5 rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                 >
                   ${amt}
                 </button>
               ))}
            </div>
          </div>

          {/* Change Display */}
          <div className={`p-4 rounded-xl border flex justify-between items-center transition-colors ${
            receivedAmount > 0 && isValid ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/10 text-zinc-500'
          }`}>
             <span className="font-medium text-sm text-zinc-300">Cambio a entregar:</span>
             <span className={`text-xl font-bold ${isValid ? 'text-green-400' : 'text-zinc-500'}`}>
               ${receivedAmount >= total ? change.toFixed(2) : '---'}
             </span>
          </div>

          <button
            onClick={handleConfirm}
            disabled={!isValid || isProcessing}
            className={`w-full py-4 rounded-xl flex items-center justify-center text-lg font-bold transition-all relative overflow-hidden ${
              !isValid 
                ? 'bg-white/5 text-zinc-600 border border-white/5 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)] border border-green-500/50'
            }`}
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                Procesando e imprimiendo...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Registrar e Imprimir Ticket
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
