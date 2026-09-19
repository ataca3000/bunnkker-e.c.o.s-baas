"use client";

import { useState, useEffect, useRef } from 'react';
import { useCart, type Product } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { 
    ScanLine, 
    Search, 
    XCircle, 
    ArrowLeft, 
    Package, 
    Camera, 
    Keyboard,
    ShoppingBag, 
    Clock, 
    CheckCircle2, 
    User, 
    Phone, 
    MapPin, 
    CreditCard,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function PriceScannerPage() {
    const { products, formatCurrency, addToCart } = useCart();
    const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [manualCode, setManualCode] = useState('');
    const [showCamera, setShowCamera] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showToast, setShowToast] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const resetTimer = useRef<NodeJS.Timeout | null>(null);

    const handleAddToCart = () => {
        if (addToCart && scannedProduct) {
            addToCart(scannedProduct);
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2500);
        }
    };

    // Mantener el input oculto enfocado para escáneres láser USB/Bluetooth
    useEffect(() => {
        const focusInput = () => {
            if (!showCamera && inputRef.current) {
                inputRef.current.focus();
            }
        };
        focusInput();
        window.addEventListener('click', focusInput);
        return () => window.removeEventListener('click', focusInput);
    }, [showCamera]);

    // Lógica del escáner de cámara usando html5-qrcode
    useEffect(() => {
        if (!showCamera) return;
        let scanner: any;

        // Importación dinámica para evitar errores de SSR en Next.js
        import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
            scanner = new Html5QrcodeScanner(
                "reader", 
                { fps: 10, qrbox: { width: 250, height: 250 } }, 
                false
            );
            scanner.render((text: string) => {
                handleScan(text);
                scanner.clear();
                setShowCamera(false);
            }, undefined);
        }).catch(err => console.error("Error cargando escáner:", err));

        return () => {
            if (scanner) scanner.clear().catch(console.error);
        };
    }, [showCamera]);

    const handleScan = (code: string) => {
        if (!code.trim()) return;
        
        const query = code.trim().toLowerCase();
        const found = products.find(p => 
            p.id.toLowerCase() === query || 
            (p.barcode && p.barcode.toLowerCase() === query)
        );
        
        if (found) {
            setScannedProduct(found);
            setNotFound(false);
        } else {
            setScannedProduct(null);
            setNotFound(true);
        }
        
        setManualCode('');
        
        if (resetTimer.current) clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => {
            setScannedProduct(null);
            setNotFound(false);
        }, 30000);
    };

    const handleSearch = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const query = searchQuery.trim().toLowerCase();
        if (!query) return;
        
        const found = products.find(p => 
            p.id.toLowerCase() === query || 
            (p.barcode && p.barcode.toLowerCase() === query) ||
            p.name.toLowerCase().includes(query)
        );
        
        if (found) {
            setScannedProduct(found);
            setNotFound(false);
        } else {
            setScannedProduct(null);
            setNotFound(true);
        }
        
        setSearchQuery('');

        if (resetTimer.current) clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => {
            setScannedProduct(null);
            setNotFound(false);
        }, 30000);
    };

    const onSubmitManual = (e: React.FormEvent) => {
        e.preventDefault();
        handleScan(manualCode);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#003875] to-[#005bb5] flex flex-col relative overflow-hidden font-sans">
            {/* Encabezado con fondo transparente blur */}
            <header className="w-full bg-[#003875]/80 backdrop-blur-md border-b border-white/10 text-white px-8 py-5 shadow-md z-20 flex justify-between items-center">
                <Link href="/login" className="flex items-center gap-3 hover:text-blue-200 font-semibold text-sm uppercase tracking-widest transition-colors">
                    <ArrowLeft size={18} /> Salir
                </Link>
                <div className="text-xs text-blue-200 font-medium tracking-widest uppercase hidden md:block">
                    Escáner y Verificador de Precios
                </div>
            </header>

            {/* Formulario oculto para capturar el input del escáner láser */}
            <form onSubmit={onSubmitManual} className="absolute opacity-0 -left-[9999px]">
                <input 
                    ref={inputRef}
                    type="text" 
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    autoFocus
                    onBlur={() => !showCamera && inputRef.current?.focus()}
                    aria-label="Código de barras para escáner"
                    placeholder="Escanee el código"
                />
            </form>

            {/* Contenedor Principal con más espaciado vertical */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 py-16 w-full max-w-2xl mx-auto relative z-10">
                
                {/* BARRA DE BÚSQUEDA UNIFICADA */}
                <form onSubmit={handleSearch} className="w-full mb-10 relative z-20">
                    <div className="relative flex items-center shadow-2xl rounded-2xl overflow-hidden bg-slate-800/80 transition-all focus-within:ring-4 focus-within:ring-white/20">
                        <Search className="absolute left-6 text-[#004A99]" size={24} />
                        <input 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar por nombre, código de barras o ID..."
                            className="w-full pl-16 pr-32 py-6 text-lg font-bold text-gray-800 outline-none placeholder:text-gray-400 placeholder:font-medium"
                            autoFocus
                        />
                        <button type="submit" className="absolute right-4 bg-[#004A99] hover:bg-blue-800 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm shadow-md transition-all active:scale-95 hover:-translate-y-0.5">
                            Buscar
                        </button>
                    </div>
                </form>

                <AnimatePresence mode="wait">
                    {scannedProduct ? (
                        /* VISTA DE PRODUCTO ENCONTRADO */
                        <motion.div 
                            key="found"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 1.1, opacity: 0 }}
                            className="bg-slate-800/80 rounded-[40px] p-12 md:p-16 text-center shadow-2xl border-b-8 border-green-500 w-full"
                        >
                            <div className="bg-green-100 text-green-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <ScanLine size={40} />
                            </div>
                            <h2 className="text-gray-400 font-semibold uppercase tracking-widest text-sm mb-2">
                                {scannedProduct.category}
                            </h2>
                            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800 tracking-tight leading-tight mb-8">
                                {scannedProduct.name}
                            </h1>
                            
                            <div className="bg-gray-50 rounded-[32px] p-8 md:p-10 mb-8 border border-gray-100 shadow-inner">
                                <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-xs mb-3">Precio de Venta</p>
                                <p className="text-6xl md:text-7xl font-extrabold text-[#004A99] tracking-tighter">
                                    {formatCurrency(scannedProduct.price)}
                                </p>
                            </div>

                            <div className="flex justify-center items-center gap-2 text-sm font-semibold text-gray-500 uppercase">
                                <Package size={18} className={scannedProduct.stock > 0 ? "text-green-500" : "text-red-500"} />
                                {scannedProduct.stock > 0 ? `En Existencia (${scannedProduct.stock})` : "Agotado temporalmente"}
                            </div>

                            <button
                                onClick={handleAddToCart}
                                disabled={scannedProduct.stock <= 0 || showToast}
                                className={`mt-10 w-full py-5 text-white font-bold uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl active:scale-[0.98] ${
                                    showToast ? 'bg-green-500 shadow-green-500/40' : 'bg-[#004A99] hover:bg-blue-800 hover:-translate-y-1 shadow-blue-900/40'
                                }`}
                            >
                                {showToast ? (
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                                        <CheckCircle2 size={24} /> ¡Agregado con éxito!
                                    </motion.div>
                                ) : (
                                    <>
                                        <ShoppingBag size={24} /> Agregar al Carrito
                                    </>
                                )}
                            </button>
                        </motion.div>
                    ) : notFound ? (
                        /* VISTA DE ERROR */
                        <motion.div 
                            key="not-found"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            className="bg-slate-800/80 rounded-[40px] p-12 md:p-16 text-center shadow-2xl border-b-8 border-red-500 w-full"
                        >
                            <XCircle size={80} className="text-red-500 mx-auto mb-6" />
                            <h1 className="text-3xl font-extrabold text-gray-800 uppercase tracking-tight">Producto No Encontrado</h1>
                            <p className="text-gray-500 font-medium mt-4">Verifique el código o consulte a un asesor en mostrador.</p>
                            <button onClick={() => setNotFound(false)} className="w-full mt-10 px-8 py-5 bg-[#004A99] hover:bg-blue-800 transition-all hover:-translate-y-1 active:scale-[0.98] shadow-lg shadow-blue-900/20 text-white font-bold rounded-2xl uppercase tracking-widest">ESCANEAR DE NUEVO</button>
                            <button onClick={() => {
                                setNotFound(false);
                                setSearchQuery('');
                            }} className="w-full mt-4 px-8 py-5 bg-slate-800/80 border-2 border-gray-100 hover:bg-gray-50 text-gray-700 transition-all hover:-translate-y-1 active:scale-[0.98] font-bold rounded-2xl uppercase tracking-widest">NUEVA BÚSQUEDA</button>
                        </motion.div>
                    ) : (
                        /* VISTA DE ESPERA */
                        <motion.div 
                            key="idle"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-center w-full"
                        >
                            <ScanLine size={120} className="text-white/20 mx-auto mb-8 animate-pulse" />
                            <Search size={100} className="text-white/20 mx-auto mb-8 animate-pulse" />
                            <h1 className="text-4xl md:text-5xl font-extrabold text-white uppercase tracking-tight mb-4 drop-shadow-lg">
                                VERIFICADOR DE PRECIOS
                                BÚSQUEDA DE PRODUCTOS
                            </h1>
                            <p className="text-blue-200 font-medium uppercase tracking-widest text-sm mb-14">
                                Pase el código de barras por el escáner
                                Ingrese el nombre, código o ID del producto arriba
                            </p>

                            {showCamera ? (
                                <div className="bg-slate-800/80 p-4 rounded-3xl max-w-sm mx-auto shadow-2xl overflow-hidden">
                                    <div id="reader" className="rounded-2xl overflow-hidden w-full"></div>
                                    <button onClick={() => setShowCamera(false)} className="mt-4 w-full bg-red-50 text-red-600 font-bold py-3 rounded-xl uppercase text-xs">Cancelar Cámara</button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setShowCamera(true)}
                                    className="bg-slate-800/80 hover:bg-gray-50 text-[#004A99] py-4 px-8 rounded-2xl font-bold uppercase tracking-widest text-sm transition-all active:scale-[0.98] hover:-translate-y-1 flex items-center gap-3 mx-auto shadow-xl"
                                >
                                    <Camera size={20} /> Usar Cámara del Dispositivo
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
