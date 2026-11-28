"use client";

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Download, CheckCircle2, Coins, Zap, Search, Loader2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, auth, hasRealCredentials } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { toast } from '@/lib/toast';
import { BILLING_TIMBRE_PACKAGES, TIMBRE_UNIT_PRICE_MXN } from '@/lib/billingPackages';

function FacturacionContent() {
    const { ownerCredits, purchaseCredits, siteConfig, orders } = useCart();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showCreditModal, setShowCreditModal] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [invoiceCount, setInvoiceCount] = useState(0);

    // Form state
    const [orderId, setOrderId] = useState('');
    const [orderFound, setOrderFound] = useState<any>(null);
    const [rfc, setRfc] = useState('');
    const [legalName, setLegalName] = useState('');
    const [zipCode, setZipCode] = useState('');
    const [taxSystem, setTaxSystem] = useState('');
    const [usoCfdi, setUsoCfdi] = useState('G03');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');

    useEffect(() => {
        if (!hasRealCredentials || !auth?.currentUser) return;
        const fetchStats = async () => {
            try {
                const q = query(collection(db, 'audit_logs'), where('type', '==', 'INVOICE_GENERATE'));
                const snap = await getDocs(q);
                setInvoiceCount(snap.size);
            } catch (err) {
                console.warn("Stats fallback (local):", err);
            }
        };
        fetchStats();
    }, []);

    useEffect(() => {
        const sessionId = searchParams.get('session_id');
        const credits = searchParams.get('credits');

        if (sessionId && credits && !verifying) {
            const verifyPayment = async () => {
                setVerifying(true);
                try {
                    const res = await fetch(`/api/verify-payment?session_id=${sessionId}`);
                    const data = await res.json();
                    if (data.status === 'paid') {
                        await purchaseCredits(parseInt(credits), 'invoice');
                        toast.success('Tus créditos han sido abonados correctamente.', '✅ ¡Pago Confirmado!');
                        router.replace('/dashboard/billing');
                    }
                } catch (err) {
                    console.error("Error verificando pago", err);
                } finally {
                    setVerifying(false);
                }
            };
            verifyPayment();
        }
    }, [searchParams]);

    const handleSearchOrder = async () => {
        if (!orderId) return;
        setLoading(true);
        setOrderFound(null);
        try {
            // 1. Buscar primero en las órdenes de memoria local en el CartContext
            const foundInLocal = orders?.find((o: any) => o.id === orderId);
            if (foundInLocal) {
                setOrderFound(foundInLocal);
                if ((foundInLocal.customer as any)?.email) setCustomerEmail((foundInLocal.customer as any).email);
                else if ((foundInLocal as any).customerEmail) setCustomerEmail((foundInLocal as any).customerEmail);
                setLoading(false);
                return;
            }

            // 2. Fallback: Buscar en la API del servidor local
            const res = await fetch('/api/orders');
            const data = await res.json();
            const foundInApi = data.data?.find((o: any) => o.id === orderId);

            if (foundInApi) {
                setOrderFound(foundInApi);
                if ((foundInApi.customer as any)?.email) setCustomerEmail((foundInApi.customer as any).email);
            } else {
                toast.warning('Orden no encontrada en la base de datos.', '❌ No encontrada');
            }
        } catch (err) {
            console.error("Error searching order", err);
            toast.error('Error al buscar la orden.');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orderFound || !orderFound.items || orderFound.items.length === 0) {
            toast.warning('No hay productos válidos para facturar en esta orden.');
            return;
        }

        setLoading(true);
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("No autenticado");
            const idToken = await currentUser.getIdToken();

            const response = await fetch('/api/billing', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    customer: {
                        legal_name: legalName,
                        tax_id: rfc,
                        tax_system: taxSystem,
                        zip: zipCode,
                        email: customerEmail || 'sin_correo@ejemplo.com'
                    },
                    clientItems: orderFound.items.map((item: any) => ({
                        id: item.id,
                        quantity: item.quantity
                    })),
                    payment_form: paymentMethod,
                    use: usoCfdi
                }),
            });

            const data = await response.json();
            if (data.success) {
                setSuccess(true);
                // Refresh count
                setInvoiceCount(prev => prev + 1);
            } else {
                toast.error(data.error, 'Error de Facturación');
            }
        } catch (error) {
            console.error(error);
            toast.error('No se pudo conectar con el servidor de facturación.');
        } finally {
            setLoading(false);
        }
    };

    const handleBuyCredits = (timbres: number, monto: number) => {
        const busName = siteConfig.businessName || 'Sistema ERP';
        const paypalUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=luishalo69@gmail.com&currency_code=MXN&amount=${monto}&item_name=${encodeURIComponent(`Recarga ${timbres} Timbres - ${busName}`)}`;
        window.open(paypalUrl, '_blank');
        toast.info(
            `Realiza el pago de $${monto} MXN por ${timbres} timbres en PayPal y envía el comprobante por WhatsApp. Tus timbres se abonarán en minutos.`,
            '🔔 Instrucciones de Recarga',
            10000
        );
        setTimeout(() => {
            const message = `Hola, acabo de realizar el pago de $${monto} MXN en PayPal para recarga de ${timbres} timbres de facturación (${busName}). Anexo comprobante.`;
            window.open(`https://wa.me/522411354984?text=${encodeURIComponent(message)}`, '_blank');
        }, 3000);
    };

    const handleExportBillingCSV = async () => {
        try {
            const res = await fetch('/api/orders');
            const data = await res.json();
            const allOrders = data.data || [];
            
            const rows = [
                ["Fecha", "ID Pedido", "Cliente", "Total", "Metodo Pago", "Estatus"]
            ];
            
            allOrders.forEach((o: any) => {
                rows.push([
                    new Date(o.date).toLocaleDateString(),
                    o.id,
                    o.customer?.name || 'PUBLICO EN GENERAL',
                    o.total,
                    o.paymentMethod || '01',
                    o.status
                ]);
            });

            const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(",")).join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `Reporte_Facturacion_${new Date().toLocaleDateString().replace(/\//g,'-')}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch(e) {
            toast.error('Error al exportar el reporte de facturación.');
        }
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

    return (
        <div style={{ minHeight: '100vh', padding: '2rem' }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 className="bunkker-heading text-2xl font-black text-white">Facturación y Créditos</h1>
                        <p style={{ color: '#94a3b8' }}>Timbrado de facturas SAT 4.0 y gestión de saldo por paquete.</p>
                        <div className="bg-emerald-950/35 px-4 py-2.5 rounded-lg mt-2.5 border-l-4 border-emerald-500 text-xs sm:text-sm text-emerald-300 tabular-nums">
                            💡 <b>Tarifa de Timbrado API:</b> Paquetes de <b>100 timbres × $300 MXN</b> o <b>200 timbres × $600 MXN</b> ($3.00 MXN por timbre).
                        </div>
                    </div>

                    <div className="bunkker-card bg-slate-800/80 shadow-lg rounded-xl px-5 py-3 border-l-4 border-amber-400 flex items-center gap-4">
                        <div className="bg-amber-500/20 p-2 rounded-full">
                            <Coins color="#Fcd34d" size={24} />
                        </div>
                        <div>
                            <span className="text-[11px] text-slate-400 font-bold block uppercase">SALDO DISPONIBLE</span>
                            <span className="text-lg font-black text-slate-50 tabular-nums">{ownerCredits} Timbres</span>
                        </div>
                        <button
                            onClick={() => setShowCreditModal(true)}
                            className="bunkker-btn min-h-[44px] px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg transition-colors text-xs uppercase cursor-pointer"
                        >
                            RECARGAR
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
                    <div className="bunkker-card bg-slate-800/80 p-[8px] rounded-[5px] shadow-lg border border-slate-700/50">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <FileText color="#0ea5e9" size={20} /> Generador de CFDI
                        </h3>
                        
                        {success ? (
                            <div className="text-center py-10 bg-emerald-50 rounded-xl border border-emerald-100">
                                <CheckCircle2 size={64} className="text-emerald-500 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-emerald-700 mb-2">¡Factura Timbrada con Éxito!</h3>
                                <p className="text-emerald-600/80 mb-6 text-sm">El cliente recibirá un correo con sus archivos PDF y XML.</p>
                                <button onClick={() => { setSuccess(false); setOrderFound(null); setOrderId(''); }} className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors">
                                    Generar Otra Factura
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Búsqueda de Orden */}
                                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">ID del Pedido / Venta</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            placeholder="Ej. ORD-12345" 
                                            value={orderId}
                                            onChange={e => setOrderId(e.target.value.trim())}
                                            className="flex-1 p-3 bg-slate-800/80 text-white border border-slate-600/50 rounded-lg outline-none focus:border-sky-500" 
                                        />
                                        <button 
                                            onClick={handleSearchOrder}
                                            disabled={loading || !orderId}
                                            className="px-6 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {loading ? <Loader2 className="animate-spin" size={18} /> : <><Search size={18} /> Buscar</>}
                                        </button>
                                    </div>
                                </div>

                                {orderFound && (
                                    <motion.form 
                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                        onSubmit={handleGenerate} 
                                        className="space-y-5"
                                    >
                                        <div className="p-4 border border-sky-900/50 bg-sky-950/30 rounded-xl flex justify-between items-center">
                                            <div>
                                                <div className="text-xs font-bold text-sky-400 uppercase">Orden Encontrada</div>
                                                <div className="font-bold text-white">{orderFound.id} ({orderFound.items?.length} items)</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-bold text-sky-400 uppercase">Monto Total</div>
                                                <div className="font-black text-lg text-sky-300">{formatCurrency(orderFound.total)}</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-[8px]">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Razón Social *</label>
                                                <input required type="text" placeholder="Ej. PUBLICO EN GENERAL" value={legalName} onChange={e => setLegalName(e.target.value.toUpperCase())} className="w-full p-3 bg-slate-800/80 text-white border border-slate-600/50 rounded-lg outline-none focus:border-sky-500 uppercase" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">RFC *</label>
                                                <input required type="text" placeholder="Ej. XAXX010101000" value={rfc} onChange={e => setRfc(e.target.value.toUpperCase().replace(/\s/g, ''))} className="w-full p-3 bg-slate-800/80 text-white border border-slate-600/50 rounded-lg outline-none focus:border-sky-500 uppercase" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-[8px]">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">C.P. Fiscal *</label>
                                                <input required type="text" maxLength={5} placeholder="00000" value={zipCode} onChange={e => setZipCode(e.target.value.replace(/\D/g, ''))} className="w-full p-3 bg-slate-800/80 text-white border border-slate-600/50 rounded-lg outline-none focus:border-sky-500" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Régimen Fiscal *</label>
                                                <select required value={taxSystem} onChange={e => setTaxSystem(e.target.value)} className="w-full p-3 border border-slate-600/50 rounded-lg outline-none focus:border-sky-500 bg-slate-800/80">
                                                    <option value="" disabled>Seleccionar...</option>
                                                    <option value="601">601 - General de Ley P. Morales</option>
                                                    <option value="612">612 - Personas Físicas</option>
                                                    <option value="626">626 - RESICO</option>
                                                    <option value="616">616 - Sin obligaciones fiscales</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-[8px]">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Uso de CFDI *</label>
                                                <select required value={usoCfdi} onChange={e => setUsoCfdi(e.target.value)} className="w-full p-3 border border-slate-600/50 rounded-lg outline-none focus:border-sky-500 bg-slate-800/80">
                                                    <option value="G01">G01 - Adquisición de mercancías</option>
                                                    <option value="G03">G03 - Gastos en general</option>
                                                    <option value="S01">S01 - Sin efectos fiscales</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Forma de Pago *</label>
                                                <select required value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full p-3 border border-slate-600/50 rounded-lg outline-none focus:border-sky-500 bg-slate-800/80">
                                                    <option value="" disabled>Seleccionar...</option>
                                                    <option value="01">01 - Efectivo</option>
                                                    <option value="02">02 - Cheque nominativo</option>
                                                    <option value="03">03 - Transferencia electrónica</option>
                                                    <option value="04">04 - Tarjeta de crédito</option>
                                                    <option value="28">28 - Tarjeta de débito</option>
                                                    <option value="99">99 - Por definir</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Correo del Cliente</label>
                                            <input type="email" placeholder="Para enviar la factura..." value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="w-full p-3 bg-slate-800/80 text-white border border-slate-600/50 rounded-lg outline-none focus:border-sky-500" />
                                        </div>

                                        <button 
                                            type="submit"
                                            disabled={loading}
                                            className="w-full mt-4 bg-sky-600 hover:bg-sky-500 text-white p-4 rounded-xl font-black tracking-widest transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                                        >
                                            {loading ? <Loader2 className="animate-spin" size={20} /> : 'TIMBRAR FACTURA AHORA'}
                                        </button>
                                    </motion.form>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-[8px]">
                        <div className="bunkker-card bg-slate-800/80 p-[8px] rounded-[5px] shadow-lg border border-slate-700/50">
                            <h4 className="text-sm font-black text-white uppercase tracking-widest mb-4">Estadísticas</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                                    <span className="text-sm text-slate-400 font-medium">Emitidas (Histórico)</span>
                                    <span className="font-black text-lg text-white">{invoiceCount}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-emerald-900/20 rounded-lg border border-emerald-900/50">
                                    <div>
                                        <span className="text-sm text-emerald-400 font-medium block">Costo por timbre</span>
                                        <span className="text-[11px] text-emerald-300/75">100 timbres × $300 MXN</span>
                                    </div>
                                    <span className="font-black text-lg text-emerald-300 tabular-nums">${TIMBRE_UNIT_PRICE_MXN.toFixed(2)} MXN</span>
                                </div>
                            </div>
                            
                            <div className="mt-6 border-t border-slate-700/50 pt-4">
                                <p className="text-xs text-slate-400 mb-3">Versión 1.5: Descarga el reporte para tu contador si usas facturación externa.</p>
                                <button 
                                    onClick={handleExportBillingCSV}
                                    className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors text-sm"
                                >
                                    <Download size={16} /> Exportar Reporte para Contador (CSV)
                                </button>
                            </div>
                        </div>

                        {success && (
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bunkker-card bg-emerald-50 p-[8px] rounded-[5px] border-2 border-emerald-500 shadow-lg">
                                <div className="flex items-center gap-2 text-emerald-700 mb-4 font-bold">
                                    <CheckCircle2 size={20} /> Factura Lista
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button className="flex items-center justify-center gap-2 bg-slate-800/80 border border-emerald-200 text-emerald-700 p-3 rounded-lg font-bold hover:bg-emerald-100 transition-colors text-sm"><Download size={16} /> Descargar PDF</button>
                                    <button className="flex items-center justify-center gap-2 bg-slate-800/80 border border-emerald-200 text-emerald-700 p-3 rounded-lg font-bold hover:bg-emerald-100 transition-colors text-sm"><Download size={16} /> Descargar XML</button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Compra de Créditos */}
            <AnimatePresence>
                {showCreditModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ background: '#0F172A', border: '1px solid #1E293B', padding: '2.5rem', borderRadius: '20px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                            <div className="text-center mb-6">
                                <div className="bg-amber-500/20 p-3.5 rounded-full inline-block mb-3">
                                    <Zap color="#Fcd34d" size={32} />
                                </div>
                                <h2 className="font-black text-xl text-white">RECARGAR TIMBRES</h2>
                                <p className="text-sm text-slate-400 mt-1">
                                    Elige tu recarga de 100 o 200 timbres fiscales ($3.00 MXN por timbre).
                                </p>
                            </div>

                            <div className="flex flex-col gap-3.5">
                                {BILLING_TIMBRE_PACKAGES.map((pkg) => (
                                    <button
                                        key={pkg.id}
                                        type="button"
                                        onClick={() => handleBuyCredits(pkg.timbres, pkg.priceMxn)}
                                        className={`min-h-[84px] p-5 rounded-xl text-left cursor-pointer transition-all relative overflow-hidden flex justify-between items-center gap-4 ${
                                            pkg.recommended
                                                ? 'border-2 border-sky-500 bg-sky-500/10 hover:bg-sky-500/20'
                                                : 'border-2 border-slate-700 bg-slate-800/60 hover:bg-slate-800'
                                        }`}
                                    >
                                        <div>
                                            <b className="text-base sm:text-lg text-white block">{pkg.name}</b>
                                            <p className="text-xs text-emerald-400 font-bold mt-0.5 tabular-nums">
                                                {pkg.badgeText} · ${pkg.unitPriceMxn.toFixed(2)} c/u
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-black text-xl sm:text-2xl text-sky-400 tabular-nums">
                                                ${pkg.priceMxn} MXN
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                {pkg.recommended ? 'Más popular · PayPal' : 'PayPal / Tarjeta'}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowCreditModal(false)}
                                className="w-full min-h-[44px] mt-6 px-4 py-3 text-slate-400 hover:text-white font-bold cursor-pointer rounded-xl hover:bg-white/5 transition-colors"
                            >
                                Tal vez más tarde
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function FacturacionNode() {
    return (
        <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}><Loader2 className="animate-spin mx-auto text-sky-500" size={32} /></div>}>
            <FacturacionContent />
        </Suspense>
    );
}

