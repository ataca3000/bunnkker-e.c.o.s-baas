"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect } from 'react';
import { ShoppingBag, ArrowRight, ShieldCheck, Lock, Truck, Sparkles, Plus, Minus, Trash2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';

export default function CarritoPage() {
    const { cart, total, openCart, removeFromCart, addToCart, decrementFromCart, products } = useCart() as any;

    const FREE_SHIPPING_THRESHOLD = 999;
    const diff = Math.max(0, FREE_SHIPPING_THRESHOLD - total);
    const progress = Math.min(100, Math.round((total / FREE_SHIPPING_THRESHOLD) * 100));
    const hasFreeShipping = diff <= 0;

    return (
        <div className="min-h-[85vh] bg-slate-50/50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#008060] flex items-center gap-1.5 mb-1">
                            <Sparkles size={14} /> Tu Compra Segura
                        </span>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                            Bolsa de Compras
                        </h1>
                    </div>
                    <Link
                        href="/catalogo"
                        className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#008060] transition-colors"
                    >
                        ← Continuar Comprando
                    </Link>
                </div>

                {/* Barra de Envío Gratis */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 mb-6 shadow-xs">
                    <div className="flex items-center justify-between text-xs sm:text-sm font-semibold mb-2 text-slate-800 dark:text-slate-200">
                        {hasFreeShipping ? (
                            <span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">
                                <Sparkles size={16} /> ¡Felicidades! Tienes <strong>Envío Gratis a Domicilio</strong>
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <Truck size={16} className="text-[#008060]" />
                                Te faltan <strong className="text-[#008060]">${diff.toFixed(2)} MXN</strong> para envío gratis
                            </span>
                        )}
                        <span className="text-xs text-slate-500 font-bold">{progress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-[#008060] rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {cart.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-10 sm:p-14 text-center shadow-xs">
                        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center text-slate-400 mb-5">
                            <ShoppingBag size={38} strokeWidth={1.5} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                            Tu bolsa está vacía
                        </h2>
                        <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
                            No tienes productos en tu carrito en este momento. Explora nuestro catálogo y llévate lo que necesitas.
                        </p>
                        <Link
                            href="/catalogo"
                            className="inline-flex items-center gap-2 bg-[#008060] hover:bg-[#006e52] text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-sm"
                        >
                            Explorar Catálogo <ArrowRight size={16} />
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Lista de Ítems */}
                        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
                            {cart.map((item: any) => {
                                const lineTotal = item.price * item.quantity;
                                return (
                                    <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex gap-4 items-center">
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex-shrink-0">
                                            <Image
                                                src={item.image || '/placeholder-product.png'}
                                                alt={item.name}
                                                width={80}
                                                height={80}
                                                className="w-full h-full object-cover"
                                                unoptimized
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate mb-1">
                                                {item.name}
                                            </h3>
                                            <p className="text-xs text-slate-500 mb-2">
                                                ${item.price.toFixed(2)} MXN c/u
                                            </p>

                                            {/* Stepper */}
                                            <div className="flex items-center gap-3">
                                                <div className="inline-flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                                    <button
                                                        onClick={() => decrementFromCart ? decrementFromCart(item.id) : removeFromCart(item.id)}
                                                        className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                        aria-label="Disminuir cantidad"
                                                    >
                                                        <Minus size={12} />
                                                    </button>
                                                    <span className="w-8 text-center text-xs font-bold text-slate-900 dark:text-white">
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        onClick={() => {
                                                            const prod = products?.find((p: any) => p.id === item.id);
                                                            if (prod) addToCart(prod, 1);
                                                        }}
                                                        className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                        aria-label="Aumentar cantidad"
                                                    >
                                                        <Plus size={12} />
                                                    </button>
                                                </div>

                                                <button
                                                    onClick={() => removeFromCart(item.id)}
                                                    className="text-slate-400 hover:text-red-500 text-xs font-semibold transition-colors flex items-center gap-1"
                                                >
                                                    <Trash2 size={13} /> Eliminar
                                                </button>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="text-base font-extrabold text-slate-900 dark:text-white">
                                                ${lineTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-semibold">MXN</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Resumen de Checkout */}
                        <div className="lg:col-span-1">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs sticky top-24 space-y-4">
                                <h3 className="text-base font-black text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
                                    Resumen del Pedido
                                </h3>

                                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                                    <div className="flex justify-between">
                                        <span>Subtotal ({cart.reduce((s: number, i: any) => s + i.quantity, 0)} productos)</span>
                                        <span className="font-semibold text-slate-900 dark:text-white">
                                            ${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Envío estimado</span>
                                        <span className="font-bold text-[#008060]">
                                            {hasFreeShipping ? 'GRATIS' : 'Calculado en paso final'}
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-baseline">
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">Total a Pagar</span>
                                    <div className="text-right">
                                        <div className="text-2xl font-black text-[#008060]">
                                            ${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        <span className="text-[10px] text-slate-400">Impuestos incluidos</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => openCart()}
                                    className="w-full bg-[#008060] hover:bg-[#006e52] text-white font-extrabold py-3.5 px-5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-[#008060]/20 active:scale-[0.99] cursor-pointer"
                                >
                                    <Lock size={16} /> Proceder al Pago Seguro
                                </button>

                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
                                        <ShieldCheck size={14} className="text-[#008060]" />
                                        <span>Garantía de stock en anaquel en tiempo real</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
                                        <Truck size={14} className="text-[#008060]" />
                                        <span>Despacho directo desde sucursal local</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
