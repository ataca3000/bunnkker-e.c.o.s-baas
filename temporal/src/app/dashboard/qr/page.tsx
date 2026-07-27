"use client";

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Share2, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/lib/toast';

export default function QRGeneratorPage() {
    const { profile } = useAuth();
    const [storeUrl, setStoreUrl] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const currentHost = window.location.hostname;
            if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
                fetch('/api/network/ip')
                    .then(res => res.json())
                    .then(data => {
                        const port = window.location.port ? `:${window.location.port}` : '';
                        setStoreUrl(`http://${data.ip}${port}/dashboard/link`);
                    })
                    .catch(() => setStoreUrl(`${window.location.origin}/dashboard/link`));
            } else {
                setStoreUrl(`${window.location.origin}/dashboard/link`);
            }
        }
    }, []);

    const handlePrint = () => {
        window.print();
    };

    if (!profile || profile.role !== 'superadmin') {
        return <div className="p-8 text-white">No tienes permisos para ver esta página.</div>;
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            <header className="mb-8">
                <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                    <Share2 className="text-purple-400" size={32} />
                    Vincular Dispositivos (Código QR)
                </h1>
                <p className="text-slate-400 mt-2">
                    Imprime este código QR y colócalo en el mostrador o lugares estratégicos. Los clientes y trabajadores podrán escanearlo para acceder rápidamente al sistema.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-800/50 backdrop-blur-md rounded-3xl p-8 border border-slate-700/50 flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
                    
                    <div className="bg-white p-6 rounded-2xl shadow-xl mt-4 mb-8 print:shadow-none print:p-0">
                        {storeUrl ? (
                            <QRCodeSVG 
                                value={storeUrl} 
                                size={256} 
                                level="H"
                                includeMargin={true}
                                imageSettings={{
                                    src: "/logo.png", // Asume que hay un logo en public/logo.png, si no, se ignora elegantemente
                                    x: undefined,
                                    y: undefined,
                                    height: 48,
                                    width: 48,
                                    excavate: true,
                                }}
                            />
                        ) : (
                            <div className="w-64 h-64 bg-slate-200 animate-pulse rounded-xl"></div>
                        )}
                    </div>
                    
                    <h2 className="text-2xl font-black text-white mb-2 text-center">Escanea para Acceder</h2>
                    <p className="text-slate-400 text-center mb-6 max-w-sm">
                        Apunta la cámara de tu celular hacia este código para abrir la tienda inmediatamente.
                    </p>

                    <button 
                        onClick={handlePrint}
                        className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 print:hidden"
                    >
                        <Printer size={20} />
                        Imprimir Código QR
                    </button>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-md rounded-3xl p-8 border border-slate-700/50 flex flex-col justify-center">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <LinkIcon className="text-sky-400" />
                        Enlace Directo
                    </h3>
                    <p className="text-slate-400 mb-4">
                        También puedes compartir este enlace directo por WhatsApp o redes sociales.
                    </p>
                    
                    <div className="flex items-center gap-2 bg-slate-900 p-4 rounded-xl border border-slate-700">
                        <input 
                            type="text" 
                            readOnly 
                            value={storeUrl}
                            className="bg-transparent border-none text-white w-full outline-none font-mono text-sm"
                        />
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(storeUrl);
                                toast.success('Enlace copiado al portapapeles.', '✅ Copiado');
                            }}
                            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap"
                        >
                            Copiar
                        </button>
                    </div>

                    <div className="mt-8 p-4 bg-sky-900/20 border border-sky-500/30 rounded-xl">
                        <h4 className="text-sky-400 font-bold mb-2 text-sm uppercase tracking-wider">Tip de Uso</h4>
                        <ul className="text-slate-300 text-sm list-disc pl-5 space-y-2">
                            <li><strong>Para Clientes en fila:</strong> Escanean el QR, ven el catálogo y arman su pedido mientras esperan. Agiliza muchísimo las ventas.</li>
                            <li><strong>Para Trabajadores:</strong> Si un empleado llega nuevo, solo escanea el QR, entra con sus credenciales y ya está operando su dispositivo personal.</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Estilos para impresión */}
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    .print\\:shadow-none {
                        box-shadow: none !important;
                    }
                    .print\\:p-0 {
                        padding: 0 !important;
                    }
                    .bg-white.p-6.rounded-2xl {
                        visibility: visible;
                        position: absolute;
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%);
                        width: 100vw;
                        height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .bg-white.p-6.rounded-2xl * {
                        visibility: visible;
                    }
                    h2.text-2xl.font-black {
                        visibility: visible;
                        position: absolute;
                        top: 15%;
                        left: 50%;
                        transform: translateX(-50%);
                        color: black !important;
                        font-size: 3rem;
                    }
                }
            `}} />
        </div>
    );
}
