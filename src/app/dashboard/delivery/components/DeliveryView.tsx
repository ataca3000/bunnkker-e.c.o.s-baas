import React, { useRef, useState } from 'react';
import type { DeliveryOrder } from './types';
import { User, MapPin, Navigation, XCircle, CheckCircle, ArrowLeft, Camera, ShieldBan } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import Webcam from 'react-webcam';
import { motion } from 'framer-motion';
import { toast } from '@/lib/toast';
import AdvancedMap from '@/components/AdvancedMap';

// Acoustic feedback
const playBeep = () => {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.1);
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) { }
};

// Función para calcular distancia con fórmula Haversine
function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radio de la tierra en metros
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function DeliveryView({
  order,
  onUpdate,
  onFinish
}: {
  order: DeliveryOrder;
  onUpdate: (updates: Partial<DeliveryOrder>) => void;
  onFinish: () => void;
}) {
  const [mode, setMode] = useState<'info' | 'deliver' | 'reject'>('info');
  const [photoMode, setPhotoMode] = useState(false);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [isVerifyingGPS, setIsVerifyingGPS] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const signatureRef = useRef<SignatureCanvas>(null);

  const openGoogleMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.address)}`;
    window.open(url, '_blank');
  };

  const handleComplete = async () => {
    // 1. Validar OTP si la orden lo requiere
    if (order.deliveryPin && pinInput !== order.deliveryPin) {
        setPinError('El PIN ingresado es incorrecto.');
        return;
    }

    // 2. Validar Geocerca (50 metros) si hay coordenadas de destino
    if (order.lat && order.lng) {
        setIsVerifyingGPS(true);
        try {
            const pos: any = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
            });
            const distance = getDistanceFromLatLonInMeters(pos.coords.latitude, pos.coords.longitude, order.lat, order.lng);
            if (distance > 50) {
                toast.warning(`Estás a ${Math.round(distance)} metros del destino. Acércate a menos de 50 metros para confirmar la entrega.`, '⚠️ GPS');
                setIsVerifyingGPS(false);
                return;
            }
        } catch (err) {
            toast.error('No pudimos obtener tu ubicación actual para verificar la geocerca. Asegúrate de tener el GPS activado.', '❌ Error GPS');
            setIsVerifyingGPS(false);
            return;
        }
        setIsVerifyingGPS(false);
    }

    playBeep();
    
    // Extraer firma si existe
    const sigData = signatureRef.current && !signatureRef.current.isEmpty() 
      ? signatureRef.current.toDataURL('image/png') 
      : null;

    onUpdate({ 
      status: 'completed', 
      signatureData: sigData,
      photoData,
      completedAt: new Date().toISOString() 
    });
    onFinish();
  };

  const handleReject = (reason: 'rejected' | 'no_answer') => {
    onUpdate({
      status: reason,
      completedAt: new Date().toISOString()
    });
    onFinish();
  };

  const capturePhoto = React.useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setPhotoData(imageSrc);
      setPhotoMode(false);
    }
  }, [webcamRef]);

  if (mode === 'reject') {
    return (
      <div className="space-y-6">
        <button onClick={() => setMode('info')} className="flex items-center gap-2 text-slate-300 hover:text-white font-medium transition-colors">
          <ArrowLeft size={20} /> Volver
        </button>
        <h2 className="text-xl font-bold text-white tracking-wide">Reportar Incidencia</h2>
        <div className="space-y-3">
          <button 
            onClick={() => handleReject('no_answer')}
            className="w-full bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-400 p-4 rounded-xl flex items-center justify-between backdrop-blur-md transition-all active:scale-95"
          >
            <span className="font-bold">No Hubo Respuesta</span>
            <ShieldBan size={24} />
          </button>
          <button 
            onClick={() => handleReject('rejected')}
            className="w-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center justify-between backdrop-blur-md transition-all active:scale-95"
          >
            <span className="font-bold">Rechazó el Pedido</span>
            <XCircle size={24} />
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'deliver') {
    return (
      <div className="space-y-6 pb-24">
        <button onClick={() => setMode('info')} className="flex items-center gap-2 text-slate-300 hover:text-white font-medium transition-colors">
          <ArrowLeft size={20} /> Volver a Detalles
        </button>
        <h2 className="text-xl font-bold text-white tracking-wide">Entrega Exitosa</h2>
        
        {/* Photo Evidence */}
        <div className="bg-slate-900/60 backdrop-blur-lg p-4 rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.1)] border border-white/10">
          <h3 className="font-bold text-sm text-sky-400 mb-3 uppercase tracking-wider">Evidencia Fotográfica</h3>
          {photoMode ? (
            <div className="space-y-3">
              <div className="rounded-lg overflow-hidden bg-black aspect-video relative border border-white/10">
                 <Webcam 
                   audio={false} 
                   ref={webcamRef} 
                   screenshotFormat="image/jpeg"
                   videoConstraints={{ facingMode: "environment" }}
                   className="w-full h-full object-cover"
                 />
              </div>
              <button 
                onClick={capturePhoto}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-lg transition-colors border border-sky-400/50"
              >
                Capturar Foto
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {photoData ? (
                 <div className="relative">
                   <img src={photoData} alt="Evidencia" className="rounded-lg border border-white/20 w-full h-auto shadow-[0_0_15px_rgba(0,0,0,0.3)]" />
                   <button onClick={() => setPhotoData(null)} className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors">
                     <XCircle size={16} />
                   </button>
                 </div>
              ) : (
                <button 
                  onClick={() => setPhotoMode(true)}
                  className="w-full border-2 border-dashed border-white/20 hover:border-sky-500 text-slate-300 hover:text-sky-400 focus:outline-none focus:ring-0 bg-white/5 hover:bg-sky-500/10 font-bold py-6 rounded-xl flex flex-col items-center justify-center gap-2 transition-all"
                >
                  <Camera size={24} />
                  Tomar Fotografía (Opcional)
                </button>
              )}
            </div>
          )}
        </div>

        {/* OTP Input */}
        <div className="bg-slate-900/60 backdrop-blur-lg p-4 rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.1)] border border-white/10">
           <div className="mb-3 text-center">
             <h3 className="font-bold text-sm text-sky-400 uppercase tracking-wider mb-1">PIN de Confirmación</h3>
             <p className="text-xs text-slate-400">Pide al cliente su OTP de 4 dígitos</p>
           </div>
           <div className="flex justify-center">
             <input 
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={pinInput}
                onChange={(e) => {
                    setPinInput(e.target.value.replace(/\D/g, ''));
                    setPinError('');
                }}
                className="w-32 text-center text-3xl font-bold bg-white/10 border-2 border-white/20 text-white p-3 rounded-xl focus:border-sky-500 focus:outline-none transition-colors"
                placeholder="0000"
             />
           </div>
           {pinError && <p className="text-red-400 text-xs text-center mt-2 font-bold">{pinError}</p>}
        </div>

        {/* Signature Canvas */}
        <div className="bg-slate-900/60 backdrop-blur-lg p-4 rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.1)] border border-white/10">
           <h3 className="font-bold text-sm text-sky-400 uppercase tracking-wider mb-2">Firma del Cliente</h3>
           <div className="bg-white rounded-xl overflow-hidden border-2 border-white/20 touch-none">
             <SignatureCanvas 
               ref={signatureRef}
               penColor="black"
               canvasProps={{ className: 'w-full h-40 bg-white cursor-crosshair touch-none' }}
               clearOnResize={false}
             />
           </div>
           <button 
             onClick={() => signatureRef.current?.clear()}
             className="text-slate-400 text-xs font-bold uppercase mt-2 w-full text-right hover:text-white transition-colors"
           >
             Borrar Firma
           </button>
        </div>

        <button 
            onClick={handleComplete}
            disabled={isVerifyingGPS || (order.deliveryPin ? pinInput.length !== 4 : false)}
            className="w-full bg-emerald-500 hover:bg-emerald-400 border border-emerald-400/50 text-white font-black p-5 rounded-full flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(16,185,129,0.4)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isVerifyingGPS ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <CheckCircle size={24} />}
            {isVerifyingGPS ? 'Verificando GPS...' : 'CONFIRMAR ENTREGA'}
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col md:flex-row overflow-hidden">
      {/* Map Embed Dashboard - Full Background */}
      <div className="absolute inset-0 z-0 bg-slate-900 pointer-events-auto">
          <AdvancedMap 
            mode="route"
            markers={[{ id: order.id, lat: order.lat || 19.4326, lng: order.lng || -99.1332, title: order.customerName, description: order.address }]}
            routeIndices={[0]}
            warehouseLocation={[order.lat || 19.4326, order.lng || -99.1332]} // Center on order for individual view
            useOfflineTiles={true}
          />
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-slate-950 via-transparent to-slate-900/50 z-10" />
      </div>

      {/* Floating Controls Layer */}
      <div className="relative z-20 flex flex-col justify-between w-full h-full p-4 pointer-events-none">
          
          {/* Top Info Panel */}
          <div className="bg-slate-900/80 backdrop-blur-xl rounded-sm p-4 border border-cyan-500/30 shadow-[0_0_20px_rgba(0,242,255,0.2)] max-w-md w-full pointer-events-auto">
             <div className="flex justify-between items-center mb-2">
                <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span> Destino</span>
                <button onClick={openGoogleMaps} className="bg-sky-600/80 text-white rounded-full p-2 hover:bg-sky-500 transition-colors shadow-lg border border-sky-400/50 active:scale-95">
                   <Navigation size={16} />
                </button>
             </div>
             <h2 className="text-lg font-bold text-white line-clamp-2 drop-shadow-[0_0_2px_rgba(0,0,0,1)]">{order.address}</h2>
             <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/10 text-xs font-medium">
                <div className="text-slate-300">Progreso</div>
                <div className="h-1 flex-1 mx-3 bg-slate-800 rounded-full overflow-hidden relative">
                   <motion.div 
                     className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-cyan-600 to-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                     initial={{ width: "10%" }}
                     animate={{ width: "90%" }}
                     transition={{ duration: 2, ease: "easeOut" }}
                   />
                </div>
             </div>
          </div>

          {/* Bottom Action Panel */}
          <div className="bg-slate-900/80 backdrop-blur-xl rounded-sm p-5 border border-cyan-500/30 shadow-[0_0_20px_rgba(0,242,255,0.2)] max-w-md w-full pointer-events-auto mt-auto self-end md:self-start">
            <div>
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block mb-2 drop-shadow-[0_0_5px_rgba(0,242,255,0.5)]">Recibe</span>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-cyan-300 border border-cyan-500/30 shadow-[0_0_10px_rgba(0,242,255,0.2)]">
                   <User size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg drop-shadow-[0_0_2px_rgba(0,0,0,1)]">{order.customerName}</h3>
                  <p className="text-sm text-cyan-300 font-medium">{order.customerRole || 'Cliente'}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 mt-4 border-t border-cyan-500/20">
               <button 
                 onClick={() => setMode('reject')}
                 className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/40 py-3 rounded-sm font-bold flex flex-col items-center gap-1 transition-colors active:scale-95 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
               >
                 <XCircle size={20} />
                 <span className="text-xs">Incidencia</span>
               </button>
               <button 
                 onClick={() => setMode('deliver')}
                 className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 py-3 rounded-sm font-bold flex flex-col items-center gap-1 transition-colors active:scale-95 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
               >
                 <CheckCircle size={20} />
                 <span className="text-xs">Entregar</span>
               </button>
            </div>
          </div>
      </div>
    </div>
  );
}
