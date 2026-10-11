"use client";

import Link from 'next/link';
import { useEffect } from 'react';
import { ShoppingBag, ArrowRight, ShieldCheck, HardDrive } from 'lucide-react';
import { useCart } from '@/context/CartContext';

export default function CarritoPage() {
    const { cart, total, openCart, formatCurrency } = useCart();

    useEffect(() => {
        openCart();
    }, [openCart]);

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-6">
            <div className="max-w-lg w-full bg-slate-900/90 border border-sky-500/30 rounded-3xl p-8 text-white shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                        <ShoppingBag size={24} />
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                            <HardDrive size={11} /> Persistencia Offline IndexedDB Activa
                        </span>
                        <h1 className="text-2xl font-black">Tu Carrito Protegido</h1>
                    </div>
                </div>

                {cart.length === 0 ? (
                    <div className="text-center py-8 space-y-4">
                        <p className="text-slate-400 text-sm">No tienes productos en tu carrito actualmente.</p>
                        <Link
                            href="/catalogo"
                            className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black px-6 py-3 rounded-xl text-sm transition-all"
                        >
                            Ir al Catálogo <ArrowRight size={16} />
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div className="bg-slate-950/80 border border-white/10 rounded-2xl p-4 space-y-2 max-h-60 overflow-y-auto">
                            {cart.map((item: any) => (
                                <div key={item.id} className="flex justify-between items-center text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                                    <div>
                                        <p className="font-bold text-white">{item.name}</p>
                                        <p className="text-xs text-slate-400">{item.quantity} x {formatCurrency(item.price)}</p>
                                    </div>
                                    <span className="font-mono font-bold text-sky-400">
                                        {formatCurrency(item.price * item.quantity)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between items-center bg-sky-500/10 border border-sky-500/30 rounded-xl p-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-sky-300">Total Resguardado</span>
                            <span className="text-xl font-black text-white">{formatCurrency(total)}</span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <Link
                                href="/carrito/checkout"
                                className="flex-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black py-3.5 px-5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
                            >
                                Finalizar Pedido <ArrowRight size={16} />
                            </Link>
                            <Link
                                href="/catalogo"
                                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3.5 px-5 rounded-xl text-sm flex items-center justify-center transition-all"
                            >
                                Seguir Comprando
                            </Link>
                        </div>

                        <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5 pt-2">
                            <ShieldCheck size={14} className="text-emerald-400" />
                            Tus productos están guardados en IndexedDB contra cierres de navegador.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
