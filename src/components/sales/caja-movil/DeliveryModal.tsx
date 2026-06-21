import React, { useState, useEffect } from 'react';
import { X, MapPin, User, Phone, Navigation } from 'lucide-react';
import dynamic from 'next/dynamic';

const LocationPickerMap = dynamic(() => import('@/components/LocationPickerMap'), { ssr: false });

export interface DeliveryInfo {
  customerName: string;
  phone: string;
  address: string;
  reference?: string;
  lat: number;
  lng: number;
}

interface DeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (info: DeliveryInfo) => void;
}

export function DeliveryModal({ isOpen, onClose, onConfirm }: DeliveryModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [reference, setReference] = useState('');
  const [position, setPosition] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCustomerName('');
      setPhone('');
      setAddress('');
      setReference('');
      setPosition(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isValid = customerName.trim() !== '' && phone.trim() !== '' && address.trim() !== '' && position !== null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !position) return;
    onConfirm({
      customerName,
      phone,
      address,
      reference,
      lat: position.lat,
      lng: position.lng
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <Navigation className="h-5 w-5 text-blue-400" />
            Datos para Repartidor
          </h3>
          <button onClick={onClose} type="button" className="p-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/20">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto hide-scrollbar flex-1">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-zinc-300 flex items-center gap-1.5">
                <User className="w-4 h-4 text-zinc-500" /> Nombre del Cliente *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Juan Pérez"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white rounded-xl focus:bg-black/60 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors placeholder-zinc-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-zinc-300 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-zinc-500" /> Teléfono *
              </label>
              <input
                type="tel"
                required
                placeholder="10 dígitos para contacto"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white rounded-xl focus:bg-black/60 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors placeholder-zinc-600"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-zinc-300 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-zinc-500" /> Dirección Completa *
            </label>
            <textarea
              required
              rows={2}
              placeholder="Calle, Número, Colonia, Código Postal..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white rounded-xl focus:bg-black/60 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors resize-none placeholder-zinc-600"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-zinc-400">
              Referencias de Ubicación (Opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Ej. Casa verde junto a portón blanco..."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white rounded-xl focus:bg-black/60 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors resize-none placeholder-zinc-600"
            />
          </div>

          <div className="space-y-1.5 relative z-0">
            <label className="text-sm font-semibold text-zinc-300 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-zinc-500" /> Pin de Entrega en Mapa *
            </label>
            <div className="h-48 w-full rounded-xl overflow-hidden border border-white/10">
               <LocationPickerMap 
                  onLocationSelect={(lat, lng) => setPosition({lat, lng})} 
               />
            </div>
          </div>

          <div className="pt-4 shrink-0 relative z-10">
            <button
              type="submit"
              disabled={!isValid}
              className={`w-full py-4 rounded-xl flex items-center justify-center text-lg font-bold transition-all ${
                isValid 
                  ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.4)] border border-blue-500/50 transform hover:-translate-y-0.5'
                  : 'bg-white/5 text-zinc-600 border border-white/5 cursor-not-allowed'
              }`}
            >
              Continuar al Cobro
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
