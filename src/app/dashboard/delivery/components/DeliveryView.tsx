import React, { useRef, useState } from 'react';
import type { DeliveryOrder } from './types';
import { User, MapPin, Navigation, XCircle, CheckCircle, ArrowLeft, Camera, ShieldBan } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import Webcam from 'react-webcam';
import { motion } from 'framer-motion';

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
  const sigCanvas = useRef<any>(null);
  const webcamRef = useRef<Webcam>(null);

  const openGoogleMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.address)}`;
    window.open(url, '_blank');
  };

  const handleComplete = () => {
    const signature = sigCanvas.current?.isEmpty() ? null : sigCanvas.current?.toDataURL();
    onUpdate({ 
      status: 'completed', 
      signatureData: signature,
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

        {/* Signature */}
        <div className="bg-slate-900/60 backdrop-blur-lg p-4 rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.1)] border border-white/10">
           <div className="flex justify-between items-center mb-3">
             <h3 className="font-bold text-sm text-sky-400 uppercase tracking-wider">Firma de Recibido</h3>
             <button onClick={() => sigCanvas.current?.clear()} className="text-xs focus:ring-0 text-slate-400 hover:text-white font-medium transition-colors">Limpiar</button>
           </div>
           <div className="border border-white/20 rounded-xl bg-white overflow-hidden shadow-inner">
              <SignatureCanvas 
                ref={sigCanvas} 
                penColor="black"
                canvasProps={{ className: 'w-full h-40 bg-white' }}
              />
           </div>
        </div>

        <button 
            onClick={handleComplete}
            className="w-full bg-emerald-600/90 hover:bg-emerald-500 border border-emerald-400/50 text-white font-bold p-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 transition-all"
        >
            <CheckCircle size={20} />
            Confirmar y Finalizar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Route Progress Bar */}
      <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] sticky top-0 z-30">
        <div className="flex justify-between text-xs text-slate-400 font-bold mb-2 uppercase tracking-wide">
           <span className="flex items-center gap-1.5"><Navigation size={12} className="text-sky-400 fill-sky-400/20" /> Progreso de entrega</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden relative border border-white/5">
           <motion.div 
             className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-sky-600 to-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
             initial={{ width: "10%" }}
             animate={{ width: "90%" }}
             transition={{ duration: 2, ease: "easeOut" }}
           />
        </div>
        <div className="flex justify-between items-center mt-2 text-xs font-medium">
          <div className="text-slate-300">Origen</div>
          <div className="text-slate-300 flex items-center gap-1">
             <MapPin size={10} className="text-emerald-400" />
             <span className="truncate max-w-[120px]">{order.address.split(',')[0]}</span>
          </div>
        </div>
      </div>

      {/* Map Embed Dashboard */}
      <div className="bg-slate-900/40 backdrop-blur-lg rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.1)] border border-white/10 overflow-hidden relative">
        <div className="h-64 w-full bg-slate-800 relative z-0">
          <iframe 
            width="100%" 
            height="100%" 
            frameBorder="0" 
            scrolling="no" 
            marginHeight={0} 
            marginWidth={0} 
            src={`https://maps.google.com/maps?width=100%25&height=600&hl=en&q=${encodeURIComponent(order.address)}&t=&z=15&ie=UTF8&iwloc=B&output=embed`}
            className="absolute inset-0 z-0 w-full h-full border-0"
            title="Map"
          ></iframe>
           <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10" />
        </div>
        <div className="p-4 relative z-20 -mt-12">
            <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-xl">
               <div className="flex items-center justify-between mb-2">
                  <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Destino</span>
                  <button onClick={openGoogleMaps} className="bg-sky-600/80 text-white rounded-full p-2 hover:bg-sky-500 transition-colors shadow-lg border border-sky-400/50 active:scale-95">
                     <Navigation size={16} />
                  </button>
               </div>
               <h2 className="text-lg font-bold text-white line-clamp-2">{order.address}</h2>
            </div>
        </div>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-lg rounded-2xl p-5 border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)] space-y-4">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Recibe</span>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white border border-white/5 shadow-inner">
               <User size={24} />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">{order.customerName}</h3>
              <p className="text-sm text-sky-300 font-medium">{order.customerRole || 'Cliente'}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
           <button 
             onClick={() => setMode('reject')}
             className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 py-3 rounded-xl font-bold flex flex-col items-center gap-1 transition-colors active:scale-95"
           >
             <XCircle size={20} />
             <span className="text-xs">Incidencia</span>
           </button>
           <button 
             onClick={() => setMode('deliver')}
             className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 py-3 rounded-xl font-bold flex flex-col items-center gap-1 transition-colors active:scale-95"
           >
             <CheckCircle size={20} />
             <span className="text-xs">Entregar</span>
           </button>
        </div>
      </div>
    </div>
  );
}
