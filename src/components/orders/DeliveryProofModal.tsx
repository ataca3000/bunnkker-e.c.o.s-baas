"use client";

import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import SignatureCanvas from 'react-signature-canvas';
import { Camera, CheckCircle2, RefreshCw, X, ShieldCheck, PenTool, Image as ImageIcon, Upload, FileText } from 'lucide-react';
import { toast } from '@/lib/toast';
import { saveDigitalTicket } from '@/lib/digitalTicket';

interface DeliveryProofModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: any;
    cajaId?: string;
    cashierName?: string;
    onSuccess: (updatedOrder: any, savedTicket?: any) => void;
}

export default function DeliveryProofModal({
    isOpen,
    onClose,
    order,
    cajaId = 'caja_1',
    cashierName = 'Cajero de Turno',
    onSuccess
}: DeliveryProofModalProps) {
    const [activeTab, setActiveTab] = useState<'photo' | 'signature'>('photo');
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [photoData, setPhotoData] = useState<string | null>(order?.photoData || null);
    const [receiverName, setReceiverName] = useState(order?.customer?.name || order?.customerName || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const webcamRef = useRef<any>(null);
    const sigCanvasRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const capturePhoto = useCallback(() => {
        if (!webcamRef.current) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
            setPhotoData(imageSrc);
            setIsCameraActive(false);
            toast.success('Foto de entrega capturada con éxito.');
        } else {
            toast.error('No se pudo capturar la imagen. Verifica los permisos de cámara.');
        }
    }, [webcamRef]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                setPhotoData(reader.result);
                setIsCameraActive(false);
                toast.success('Evidencia fotográfica cargada correctamente.');
            }
        };
        reader.readAsDataURL(file);
    };

    const handleClearSignature = () => {
        sigCanvasRef.current?.clear();
    };

    const handleSubmitDelivery = async () => {
        if (!order) return;

        // Validar foto
        if (!photoData) {
            toast.warning('Es obligatorio capturar o subir la foto de evidencia de los productos entregados.', 'Foto Requerida');
            setActiveTab('photo');
            return;
        }

        // Validar firma
        if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
            toast.warning('Se requiere la firma de conformidad del cliente para cerrar la entrega.', 'Firma Requerida');
            setActiveTab('signature');
            return;
        }

        const signatureData = sigCanvasRef.current.toDataURL('image/png');

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: order.id,
                    action: 'confirm_pickup_receipt',
                    signatureData,
                    photoData,
                    receiverName: receiverName || order?.customer?.name || 'Cliente'
                })
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'Error al validar la entrega en el servidor.');
            }

            // Resguardar ticket digital en bitácora local
            const savedTicket = saveDigitalTicket(
                cajaId,
                cashierName,
                order.id,
                order.items || [],
                Number(order.total) || 0,
                {
                    paymentMethod: order.paymentMethod || 'EFECTIVO EN CAJA',
                    customerName: receiverName || order.customer?.name || 'Cliente Mostrador',
                    vendedorId: order.vendedorId || 'LOCAL',
                    vendedorName: order.vendedorName || cashierName,
                    evidencePhoto: photoData,
                    signatureData: signatureData,
                    loadedBy: order.loadedBy || 'Almacén'
                }
            );

            // Notificar a otros nodos y sockets
            if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                (window as any).__inventorySocket.emit('sync_db_event', {
                    action: 'ORDER_DELIVERED_POD',
                    id: order.id
                });
            }

            toast.success(`✅ Pedido ${order.id} entregado con éxito. Ticket y auditoría resguardados.`);
            onSuccess(data.data || { ...order, status: 'DELIVERED', photoData, signatureData }, savedTicket);
            onClose();
        } catch (error: any) {
            console.error('[PoD Error]:', error);
            toast.error(error.message || 'Error al procesar la entrega.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !order) return null;

    return (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
            <div className="bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden text-white my-6">
                
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/90">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                            <ShieldCheck size={22} />
                        </div>
                        <div>
                            <h3 className="font-black text-white text-base flex items-center gap-2">
                                Protocolo de Entrega & Firma (PoD)
                            </h3>
                            <p className="text-xs text-zinc-400">
                                Folio: <span className="font-mono text-emerald-400 font-bold">{order.id}</span> • Cliente: {order.customer?.name || order.customerName || 'Cliente Mostrador'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10">
                        <X size={20} />
                    </button>
                </div>

                {/* Sub-banner con resumen del pedido y operadores */}
                <div className="px-5 py-3 bg-zinc-900/50 border-b border-white/5 flex flex-wrap justify-between items-center text-xs text-zinc-300 gap-2">
                    <div className="flex items-center gap-3">
                        <span>📦 Total Artículos: <strong className="text-white">{order.items?.length || 0}</strong></span>
                        <span>•</span>
                        <span>💰 Importe: <strong className="text-emerald-400 font-mono">${Number(order.total || 0).toFixed(2)}</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                        <span>Almacén: <strong className="text-blue-400">{order.loadedBy || 'Surtido Completo'}</strong></span>
                        <span>•</span>
                        <span>Caja: <strong className="text-purple-400">{order.vendedorName || cashierName}</strong></span>
                    </div>
                </div>

                {/* Tabs de Evidencia */}
                <div className="flex border-b border-white/10 bg-zinc-950">
                    <button
                        onClick={() => setActiveTab('photo')}
                        className={`flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                            activeTab === 'photo' 
                                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5' 
                                : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        <Camera size={16} /> 1. Foto de Entrega {photoData && '✓'}
                    </button>
                    <button
                        onClick={() => setActiveTab('signature')}
                        className={`flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                            activeTab === 'signature' 
                                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5' 
                                : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        <PenTool size={16} /> 2. Firma del Cliente
                    </button>
                </div>

                {/* Contenido de Tabs */}
                <div className="p-5 space-y-4">

                    {/* TAB 1: FOTOGRAFÍA DE ENTREGA */}
                    {activeTab === 'photo' && (
                        <div className="space-y-4">
                            <p className="text-xs text-zinc-400">
                                Captura una fotografía nítida del producto o paquete entregado en mostrador o bahía de carga.
                            </p>

                            {photoData ? (
                                <div className="space-y-3">
                                    <div className="relative rounded-xl overflow-hidden border border-emerald-500/40 bg-black max-h-72 flex items-center justify-center shadow-lg">
                                        <img src={photoData} alt="Evidencia de Entrega" className="max-h-72 w-auto object-contain" />
                                        <span className="absolute top-2 right-2 px-2.5 py-1 bg-emerald-600/90 text-white font-bold text-[10px] rounded-full uppercase tracking-wider shadow">
                                            ✓ Foto Capturada
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => { setPhotoData(null); setIsCameraActive(true); }}
                                            className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                                        >
                                            <RefreshCw size={14} /> Tomar Otra Foto
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('signature')}
                                            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                                        >
                                            Continuar a Firma <PenTool size={14} />
                                        </button>
                                    </div>
                                </div>
                            ) : isCameraActive ? (
                                <div className="space-y-3">
                                    <div className="relative rounded-xl overflow-hidden border border-white/20 bg-black aspect-video flex items-center justify-center shadow-inner">
                                        <Webcam
                                            audio={false}
                                            ref={webcamRef}
                                            screenshotFormat="image/jpeg"
                                            videoConstraints={{ facingMode: 'environment' }}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={capturePhoto}
                                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
                                        >
                                            <Camera size={16} /> Capturar Fotografía
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsCameraActive(false)}
                                            className="py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-colors"
                                        >
                                            Cancelar Cámara
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsCameraActive(true)}
                                        className="p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-dashed border-white/20 hover:border-emerald-500/50 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group"
                                    >
                                        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-full group-hover:scale-110 transition-transform">
                                            <Camera size={28} />
                                        </div>
                                        <span className="font-bold text-sm text-white">Activar Cámara</span>
                                        <span className="text-[11px] text-zinc-500 text-center">Tomar foto en vivo con la webcam o celular</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-6 bg-zinc-900 hover:bg-zinc-800 border-2 border-dashed border-white/20 hover:border-blue-500/50 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group"
                                    >
                                        <div className="p-3 bg-blue-500/10 text-blue-400 rounded-full group-hover:scale-110 transition-transform">
                                            <Upload size={28} />
                                        </div>
                                        <span className="font-bold text-sm text-white">Subir Imagen</span>
                                        <span className="text-[11px] text-zinc-500 text-center">Seleccionar archivo desde galería o dispositivo</span>
                                    </button>

                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: FIRMA DIGITAL DEL CLIENTE */}
                    {activeTab === 'signature' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                                    Nombre de Quien Recibe
                                </label>
                                <input
                                    type="text"
                                    value={receiverName}
                                    onChange={(e) => setReceiverName(e.target.value)}
                                    placeholder="Nombre completo del cliente o persona autorizada"
                                    className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-white text-xs font-semibold outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                                        <PenTool size={13} className="text-emerald-400" /> Firma Táctil / Digital del Cliente
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleClearSignature}
                                        className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline"
                                    >
                                        Limpiar Firma
                                    </button>
                                </div>

                                <div className="border-2 border-dashed border-white/20 rounded-2xl overflow-hidden bg-white shadow-inner">
                                    <SignatureCanvas
                                        ref={sigCanvasRef}
                                        penColor="black"
                                        canvasProps={{
                                            className: 'w-full h-44 cursor-crosshair'
                                        }}
                                    />
                                </div>
                                <p className="text-[10px] text-zinc-500 italic mt-1 text-center">
                                    Firme con el dedo, stylus o ratón dentro del recuadro blanco de conformidad.
                                </p>
                            </div>

                            <div className="p-3 bg-zinc-900/70 border border-white/5 rounded-xl text-[11px] text-zinc-400 leading-relaxed">
                                ⚖️ <strong>Validez de Entrega:</strong> Al estampar la firma y foto de evidencia, el cliente y el operador acreditan la entrega física a entera satisfacción, resguardando el comprobante en su historial y en la auditoría inmutable del administrador.
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-white/10 bg-zinc-900 flex justify-between items-center gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs transition-colors"
                    >
                        Cancelar
                    </button>

                    <div className="flex items-center gap-2">
                        {activeTab === 'photo' ? (
                            <button
                                type="button"
                                onClick={() => setActiveTab('signature')}
                                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                            >
                                Siguiente: Firma <PenTool size={14} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setActiveTab('photo')}
                                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                            >
                                <Camera size={14} /> Ver Foto
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleSubmitDelivery}
                            disabled={isSubmitting}
                            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black uppercase tracking-wider rounded-xl text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" /> Procesando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={16} /> Cerrar Entrega & Ticket
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
