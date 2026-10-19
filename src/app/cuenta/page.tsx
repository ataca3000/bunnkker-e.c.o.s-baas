"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    User, ShoppingBag, LogOut, FileText, Phone, Lock, Save, Loader2, 
    MapPin, ShieldCheck, KeyRound, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, X, FileSpreadsheet
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { saveCustomerSession, clearCustomerSession, getCustomerAuthHeaders, getCustomerProfile } from '@/lib/customerAuth';

export default function UserAccount() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'profile' | 'invoicing' | 'orders'>('profile');
    
    // Auth State
    const [loading, setLoading] = useState(true);
    const [customer, setCustomer] = useState<any>(null);
    const [orders, setOrders] = useState<any[]>([]);

    // Login & Register State
    const [phone, setPhone] = useState('');
    const [pin, setPin] = useState('');
    const [name, setName] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [authError, setAuthError] = useState('');
    const [authSuccess, setAuthSuccess] = useState('');

    // Password / PIN Reset Recovery Modal State
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetPhone, setResetPhone] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetMessage, setResetMessage] = useState('');
    const [resetError, setResetError] = useState('');

    // Profile & CFDI State
    const [profileData, setProfileData] = useState({
        name: '',
        phone: '',
        address: '',
        references: '',
        rfc: '',
        razonSocial: '',
        regimenFiscal: '',
        usoCFDI: '',
        codigoPostal: ''
    });
    const [savingProfile, setSavingProfile] = useState(false);

    const fetchProfile = useCallback(async () => {
        // Pre-hidratar inmediatamente desde almacenamiento local
        const cached = getCustomerProfile();
        if (cached && cached.id) {
            setCustomer(cached);
            setOrders(cached.orders || []);
            setProfileData({
                name: cached.name || '',
                phone: cached.phone || '',
                address: cached.address || '',
                references: cached.references || '',
                rfc: cached.rfc || '',
                razonSocial: cached.razonSocial || '',
                regimenFiscal: cached.regimenFiscal || '',
                usoCFDI: cached.usoCFDI || '',
                codigoPostal: cached.codigoPostal || ''
            });
            setLoading(false);
        }

        try {
            const authHeaders = getCustomerAuthHeaders();
            const res = await fetch('/api/customer/me', {
                credentials: 'include',
                headers: authHeaders
            });
            const data = await res.json();
            if (data.success && data.customer) {
                setCustomer(data.customer);
                setOrders(data.customer.orders || []);
                setProfileData({
                    name: data.customer.name || '',
                    phone: data.customer.phone || '',
                    address: data.customer.address || '',
                    references: data.customer.references || '',
                    rfc: data.customer.rfc || '',
                    razonSocial: data.customer.razonSocial || '',
                    regimenFiscal: data.customer.regimenFiscal || '',
                    usoCFDI: data.customer.usoCFDI || '',
                    codigoPostal: data.customer.codigoPostal || ''
                });
                if (typeof window !== 'undefined') {
                    localStorage.setItem('_bunkker_customer', JSON.stringify(data.customer));
                }
            } else if (!cached) {
                setCustomer(null);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        setAuthSuccess('');
        try {
            const res = await fetch('/api/customer/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ 
                    phone, 
                    pin, 
                    action: isRegistering ? 'register' : 'login',
                    name: isRegistering ? name : undefined 
                })
            });
            const data = await res.json();
            if (data.success) {
                // Guardar sesión y perfil de forma persistente y dual (localStorage + cookies)
                if (data.customer) {
                    saveCustomerSession({
                        uid: data.uid || data.customer.id,
                        role: data.role || 'client',
                        signature: data.signature,
                        token: data.token
                    }, data.customer);
                }

                const searchParams = new URLSearchParams(window.location.search);
                const redirectParam = searchParams.get('redirect');
                if (redirectParam) {
                    window.location.href = redirectParam;
                } else if (data.redirect) {
                    window.location.href = data.redirect;
                } else {
                    fetchProfile();
                }
            } else {
                setAuthError(data.error || 'Error al autenticar');
            }
        } catch (err) {
            setAuthError('Error de conexión con el servidor.');
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetError('');
        setResetMessage('');
        setResetLoading(true);

        try {
            const res = await fetch('/api/customer/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ phone: resetPhone })
            });
            const data = await res.json();
            if (data.success) {
                setResetMessage(data.message);
                setPhone(resetPhone);
                if (data.newPin) setPin(data.newPin);
            } else {
                setResetError(data.error || 'No se pudo restablecer la contraseña.');
            }
        } catch {
            setResetError('Error de conexión al procesar la solicitud.');
        } finally {
            setResetLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/customer/logout', { method: 'POST', credentials: 'include' });
        } catch { }
        clearCustomerSession();
        setCustomer(null);
        setOrders([]);
        window.location.href = '/catalogo';
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);
        try {
            const authHeaders = getCustomerAuthHeaders();
            const res = await fetch('/api/customer/me', {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    ...authHeaders
                },
                credentials: 'include',
                body: JSON.stringify(profileData)
            });
            const data = await res.json();
            if (data.success) {
                toast.success('¡Perfil y datos fiscales guardados con éxito!', '✅ Guardado');
                fetchProfile();
            } else {
                toast.error(data.error || 'Error al guardar la información.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error de red al actualizar perfil.');
        } finally {
            setSavingProfile(false);
        }
    };

    const getOrderProgress = (order: any) => {
        const status = String(order.status || '').toUpperCase();
        const isCancelled = ['CANCELLED', 'REFUNDED'].includes(status);
        const received = ['DELIVERED', 'COMPLETED'].includes(status);
        const paymentConfirmed = Boolean(order.confirmedAt) || ['PAID', 'OUT_FOR_DELIVERY', 'CLAIMED', 'READY_FOR_PICKUP_PAID'].includes(status);
        const readyForPayment = ['READY_TO_SHIP', 'READY_FOR_PICKUP'].includes(status);
        const activeStep = isCancelled ? -1 : received ? 2 : (paymentConfirmed || readyForPayment) ? 1 : 0;
        
        let detail = 'Pedido generado en espera. Pasa a caja en sucursal.';
        if (isCancelled) {
            detail = 'El pedido ha sido cancelado.';
        } else if (received) {
            detail = 'Entregado y completado exitosamente con comprobante.';
        } else if (['OUT_FOR_DELIVERY', 'CLAIMED'].includes(status)) {
            detail = 'Pago confirmado. El repartidor va en camino a tu domicilio.';
        } else if (status === 'READY_FOR_PICKUP_PAID') {
            detail = 'Pago confirmado en Caja. Tu pedido está empacado y listo para entrega física.';
        } else if (status === 'READY_FOR_PICKUP') {
            detail = 'Tus artículos ya fueron recolectados. Pasa a Caja a realizar tu pago y recibir tu ticket.';
        } else if (status === 'PREPARANDO') {
            detail = paymentConfirmed
                ? 'Pago confirmado. Personal de almacén está recolectando tus artículos en anaquel.'
                : 'Personal de almacén está preparando tus productos. Puedes pagar en Caja mientras se empaca.';
        } else if (paymentConfirmed) {
            detail = 'Pago confirmado en Caja. En espera de recolección en anaqueles.';
        }

        return { activeStep, paymentConfirmed, detail, isCancelled };
    };

    const getOrderEventLabel = (eventType: string) => ({
        ORDER_CREATED: 'Pedido generado',
        CASHIER_CLAIMED: 'Pedido tomado por caja',
        PAYMENT_CONFIRMED: 'Pago confirmado en Caja',
        LOADING_CLAIMED: 'Recolección en proceso',
        LOADING_COMPLETED: 'Recolección completada',
        ORDER_CLAIMED: 'Pedido tomado para preparación',
        ORDER_DELEGATED: 'Pedido reasignado de área',
        DRIVER_CLAIMED: 'Asignado a repartidor',
        DELIVERY_RECEIVED: 'Entrega finalizada en domicilio',
        ORDER_DELIVERED_POD: 'Entrega física completada con comprobante',
        PICKUP_RECEIVED: 'Entregado en mostrador/patio',
        ORDER_CANCELLED: 'Pedido cancelado',
        RESTOCK_COMPLETED: 'Artículos devueltos al anaquel'
    } as Record<string, string>)[eventType] || eventType.replaceAll('_', ' ');

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0514] flex flex-col items-center justify-center text-white">
                <Loader2 className="animate-spin text-sky-400 mb-3" size={40}/>
                <p className="text-sm font-semibold text-slate-400">Cargando tu portal de cliente...</p>
            </div>
        );
    }

    // ── PANTALLA DE ACCESO / LOGIN / REGISTRO / RECUPERACIÓN ──
    if (!customer) {
        return (
            <div className="min-h-screen bg-[#0a0514] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
                {/* Visual Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-sky-500/10 blur-[130px] rounded-full pointer-events-none" />

                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-slate-900/80 backdrop-blur-2xl border border-slate-700/60 p-8 rounded-[32px] shadow-2xl w-full max-w-md relative z-10"
                >
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-tr from-sky-500 to-blue-600 rounded-2xl shadow-lg shadow-sky-500/25 flex items-center justify-center mx-auto mb-4">
                            <User size={32} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-extrabold text-white tracking-tight">
                            {isRegistering ? 'Registro de Cliente' : 'Portal de Cliente'}
                        </h1>
                        <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                            {isRegistering 
                                ? 'Crea tu cuenta para guardar tus datos fiscales y rastrear tus compras.'
                                : 'Ingresa con tu teléfono y PIN para consultar tus datos de facturación y pedidos.'}
                        </p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-4">
                        {isRegistering && (
                            <div>
                                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-1.5 ml-1">Nombre Completo *</label>
                                <input 
                                    type="text" 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    required 
                                    className="w-full p-3.5 bg-slate-950/70 border border-slate-700 text-white rounded-xl focus:border-sky-500 outline-none text-sm" 
                                    placeholder="Ej. Juan Pérez" 
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-1.5 ml-1">Teléfono Móvil (10 dígitos) *</label>
                            <div className="relative">
                                <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="tel" 
                                    value={phone} 
                                    onChange={e => setPhone(e.target.value)} 
                                    required 
                                    maxLength={10} 
                                    className="w-full p-3.5 pl-11 bg-slate-950/70 border border-slate-700 text-white rounded-xl focus:border-sky-500 outline-none text-sm font-mono tracking-wider" 
                                    placeholder="5551234567" 
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-1.5 ml-1">PIN de Seguridad (4 dígitos) *</label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="password" 
                                    value={pin} 
                                    onChange={e => setPin(e.target.value)} 
                                    required 
                                    maxLength={4} 
                                    minLength={4} 
                                    className="w-full p-3.5 pl-11 bg-slate-950/70 border border-slate-700 text-white rounded-xl focus:border-sky-500 outline-none font-mono tracking-widest text-lg" 
                                    placeholder="••••" 
                                />
                            </div>
                        </div>

                        {authError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold rounded-xl text-center">
                                {authError}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-sky-500/20 active:scale-[0.98] text-sm uppercase tracking-wider flex items-center justify-center gap-2 mt-2"
                        >
                            <span>{isRegistering ? 'Crear mi Cuenta de Cliente' : 'Entrar a mi Cuenta'}</span>
                            <ArrowRight size={16} />
                        </button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-slate-800 flex flex-col items-center gap-3 text-center">
                        <button 
                            type="button" 
                            onClick={() => {
                                setAuthError('');
                                setIsRegistering(!isRegistering);
                            }} 
                            className="text-xs text-sky-400 hover:text-sky-300 font-semibold transition-colors"
                        >
                            {isRegistering ? '¿Ya tienes cuenta de cliente? Inicia Sesión' : '¿Nuevo en la tienda? Registra tus datos aquí'}
                        </button>

                        {!isRegistering && (
                            <button
                                type="button"
                                onClick={() => {
                                    setResetError('');
                                    setResetMessage('');
                                    setResetPhone(phone);
                                    setShowResetModal(true);
                                }}
                                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5"
                            >
                                <KeyRound size={13} className="text-amber-400" />
                                ¿Olvidaste tu PIN / Contraseña? Recuperar aquí
                            </button>
                        )}
                    </div>
                </motion.div>

                <button 
                    onClick={() => router.push('/catalogo')} 
                    className="mt-6 text-slate-500 text-xs font-bold hover:text-slate-300 transition-colors"
                >
                    ← Volver al Catálogo de Productos
                </button>

                {/* MODAL RECUPERACIÓN DE CONTRASEÑA / PIN */}
                <AnimatePresence>
                    {showResetModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="w-full max-w-sm bg-slate-900 border border-sky-500/40 rounded-3xl p-6 shadow-2xl relative"
                            >
                                <button
                                    onClick={() => setShowResetModal(false)}
                                    className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
                                >
                                    <X size={18} />
                                </button>

                                <div className="text-center mb-5">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-500/30">
                                        <KeyRound size={24} />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">Recuperar mi PIN</h3>
                                    <p className="text-xs text-slate-400 mt-1">Ingresa tu número de teléfono registrado para restablecer tu PIN de acceso.</p>
                                </div>

                                <form onSubmit={handleResetPassword} className="space-y-4">
                                    {resetError && (
                                        <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl text-center font-medium">
                                            {resetError}
                                        </div>
                                    )}

                                    {resetMessage && (
                                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl text-center font-semibold">
                                            {resetMessage}
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-1.5 ml-1">Teléfono Móvil Registrado</label>
                                        <input
                                            type="tel"
                                            required
                                            maxLength={10}
                                            value={resetPhone}
                                            onChange={e => setResetPhone(e.target.value)}
                                            placeholder="5551234567"
                                            className="w-full p-3 bg-slate-950 border border-slate-700 text-white rounded-xl focus:border-amber-400 outline-none text-sm font-mono tracking-wider"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={resetLoading}
                                        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                                    >
                                        {resetLoading ? <Loader2 size={16} className="animate-spin" /> : <span>Generar Nuevo PIN</span>}
                                    </button>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // ── CONSOLA PRINCIPAL DE PERFIL DE CLIENTE AUTENTICADO ──
    return (
        <div className="min-h-screen bg-[#0a0514] text-white py-8 px-4 sm:px-6 relative overflow-hidden font-sans">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[450px] bg-sky-500/10 blur-[140px] rounded-full pointer-events-none" />

            <div className="max-w-6xl mx-auto space-y-6 relative z-10">

                {/* Header Superior del Portal */}
                <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-tr from-sky-500 to-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-sky-500/30 border border-sky-400/30 overflow-hidden">
                            <img src={`https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(customer.name || 'Cliente')}&backgroundColor=b6e3f4`} alt="Avatar de Perfil" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold text-white">{customer.name}</h1>
                                <span className="text-[10px] font-bold uppercase bg-sky-500/20 text-sky-400 border border-sky-500/30 px-2.5 py-0.5 rounded-full">
                                    Cliente Registrado
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">📞 {customer.phone} · {profileData.rfc ? `RFC: ${profileData.rfc}` : 'Sin RFC registrado'}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/catalogo')}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5"
                        >
                            <ShoppingBag size={14} /> Ir al Catálogo
                        </button>
                        <button
                            onClick={handleLogout}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border border-red-500/30 flex items-center gap-1.5"
                        >
                            <LogOut size={14} /> Salir
                        </button>
                    </div>
                </div>

                {/* Grid con Navegación Lateral y Panel Principal */}
                <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">

                    {/* Menú Lateral */}
                    <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-4 shadow-xl self-start space-y-2">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-3 ${
                                activeTab === 'profile'
                                    ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                            }`}
                        >
                            <User size={16} /> Perfil & Entrega
                        </button>

                        <button
                            onClick={() => setActiveTab('invoicing')}
                            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-3 ${
                                activeTab === 'invoicing'
                                    ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                            }`}
                        >
                            <FileText size={16} /> Facturación CFDI 4.0
                        </button>

                        <button
                            onClick={() => setActiveTab('orders')}
                            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between ${
                                activeTab === 'orders'
                                    ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <ShoppingBag size={16} /> Mis Compras
                            </div>
                            <span className="bg-slate-950/60 text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-mono">
                                {orders.length}
                            </span>
                        </button>
                    </div>

                    {/* Contenido Principal por Pestaña */}
                    <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-6 sm:p-8 shadow-xl">
                        <AnimatePresence mode="wait">

                            {/* PESTAÑA 1: PERFIL PERSONAL & DATOS DE ENTREGA */}
                            {activeTab === 'profile' && (
                                <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                            <User className="text-sky-400" size={22} /> Perfil Personal & Dirección de Entrega
                                        </h2>
                                        <p className="text-xs text-slate-400 mt-1">Guarda tu dirección por defecto para agilizar tus compras.</p>
                                    </div>

                                    <form onSubmit={handleSaveProfile} className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-1.5 ml-1">Nombre Completo</label>
                                                <input 
                                                    type="text" 
                                                    value={profileData.name} 
                                                    onChange={e => setProfileData({ ...profileData, name: e.target.value })} 
                                                    className="w-full p-3.5 bg-slate-950/70 border border-slate-700 text-white rounded-xl focus:border-sky-500 outline-none text-sm" 
                                                    placeholder="Tu Nombre" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-1.5 ml-1">Teléfono Móvil (WhatsApp)</label>
                                                <input 
                                                    type="tel" 
                                                    value={profileData.phone} 
                                                    readOnly
                                                    className="w-full p-3.5 bg-slate-950/40 border border-slate-800 text-slate-400 rounded-xl outline-none text-sm font-mono cursor-not-allowed" 
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-1.5 ml-1">Dirección de Entrega por Defecto</label>
                                            <input 
                                                type="text" 
                                                value={profileData.address} 
                                                onChange={e => setProfileData({ ...profileData, address: e.target.value })} 
                                                className="w-full p-3.5 bg-slate-950/70 border border-slate-700 text-white rounded-xl focus:border-sky-500 outline-none text-sm" 
                                                placeholder="Calle, Número exterior/interior, Colonia, Municipio" 
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-1.5 ml-1">Referencias de Entrega (Opcional)</label>
                                            <input 
                                                type="text" 
                                                value={profileData.references} 
                                                onChange={e => setProfileData({ ...profileData, references: e.target.value })} 
                                                className="w-full p-3.5 bg-slate-950/70 border border-slate-700 text-white rounded-xl focus:border-sky-500 outline-none text-sm" 
                                                placeholder="Entre qué calles, color de fachada o portón" 
                                            />
                                        </div>

                                        <div className="pt-4 border-t border-slate-800">
                                            <button 
                                                type="submit" 
                                                disabled={savingProfile} 
                                                className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold px-6 py-3.5 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-sky-500/20 transition-all flex items-center gap-2"
                                            >
                                                {savingProfile ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                                <span>Guardar Datos de Perfil</span>
                                            </button>
                                        </div>
                                    </form>
                                </motion.div>
                            )}

                            {/* PESTAÑA 2: DATOS DE FACTURACIÓN CFDI 4.0 */}
                            {activeTab === 'invoicing' && (
                                <motion.div key="invoicing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                            <FileText className="text-sky-400" size={22} /> Datos de Facturación Fiscal (SAT CFDI 4.0)
                                        </h2>
                                        <p className="text-xs text-slate-400 mt-1">Configura tu RFC y Régimen Fiscal para generar facturas de tus compras con un solo clic.</p>
                                    </div>

                                    <form onSubmit={handleSaveProfile} className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-1.5 ml-1">RFC con Homoclave *</label>
                                                <input 
                                                    type="text" 
                                                    value={profileData.rfc} 
                                                    onChange={e => setProfileData({ ...profileData, rfc: e.target.value.toUpperCase() })} 
                                                    className="w-full p-3.5 bg-slate-950/70 border border-slate-700 text-white rounded-xl focus:border-sky-500 outline-none text-sm font-mono uppercase" 
                                                    placeholder="XAXX010101000" 
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-1.5 ml-1">Razón Social / Nombre Fiscal *</label>
                                                <input 
                                                    type="text" 
                                                    value={profileData.razonSocial} 
                                                    onChange={e => setProfileData({ ...profileData, razonSocial: e.target.value.toUpperCase() })} 
                                                    className="w-full p-3.5 bg-slate-950/70 border border-slate-700 text-white rounded-xl focus:border-sky-500 outline-none text-sm uppercase" 
                                                    placeholder="PÚBLICO EN GENERAL" 
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-1.5 ml-1">Régimen Fiscal *</label>
                                                <select 
                                                    value={profileData.regimenFiscal} 
                                                    onChange={e => setProfileData({ ...profileData, regimenFiscal: e.target.value })} 
                                                    className="w-full p-3.5 bg-slate-950/70 border border-slate-700 text-white rounded-xl focus:border-sky-500 outline-none text-xs"
                                                >
                                                    <option value="" className="bg-slate-900">Selecciona Régimen Fiscal...</option>
                                                    <option value="601" className="bg-slate-900">601 - General de Ley Personas Morales</option>
                                                    <option value="612" className="bg-slate-900">612 - Personas Físicas con Actividades Empresariales</option>
                                                    <option value="626" className="bg-slate-900">626 - Régimen Simplificado de Confianza (RESICO)</option>
                                                    <option value="616" className="bg-slate-900">616 - Sin Obligaciones Fiscales</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-1.5 ml-1">Uso de CFDI *</label>
                                                <select 
                                                    value={profileData.usoCFDI} 
                                                    onChange={e => setProfileData({ ...profileData, usoCFDI: e.target.value })} 
                                                    className="w-full p-3.5 bg-slate-950/70 border border-slate-700 text-white rounded-xl focus:border-sky-500 outline-none text-xs"
                                                >
                                                    <option value="" className="bg-slate-900">Selecciona Uso de CFDI...</option>
                                                    <option value="G01" className="bg-slate-900">G01 - Adquisición de mercancías</option>
                                                    <option value="G03" className="bg-slate-900">G03 - Gastos en general</option>
                                                    <option value="S01" className="bg-slate-900">S01 - Sin efectos fiscales</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-1.5 ml-1">Código Postal (Fiscal SAT)</label>
                                            <input 
                                                type="text" 
                                                maxLength={5}
                                                value={profileData.codigoPostal} 
                                                onChange={e => setProfileData({ ...profileData, codigoPostal: e.target.value })} 
                                                className="w-full p-3.5 bg-slate-950/70 border border-slate-700 text-white rounded-xl focus:border-sky-500 outline-none text-sm font-mono max-w-xs" 
                                                placeholder="12345" 
                                            />
                                        </div>

                                        <div className="pt-4 border-t border-slate-800">
                                            <button 
                                                type="submit" 
                                                disabled={savingProfile} 
                                                className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold px-6 py-3.5 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-sky-500/20 transition-all flex items-center gap-2"
                                            >
                                                {savingProfile ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                                <span>Guardar Perfil Fiscal CFDI</span>
                                            </button>
                                        </div>
                                    </form>
                                </motion.div>
                            )}

                            {/* PESTAÑA 3: HISTORIAL DE COMPRAS & PEDIDOS */}
                            {activeTab === 'orders' && (
                                <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                                <ShoppingBag className="text-sky-400" size={22} /> Historial de Compras & Pedidos
                                            </h2>
                                            <p className="text-xs text-slate-400 mt-1">Consulta el estado en tiempo real de tus pedidos y tickets.</p>
                                        </div>

                                        <button
                                            onClick={fetchProfile}
                                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all text-xs flex items-center gap-1.5"
                                            title="Actualizar lista"
                                        >
                                            <RefreshCw size={14} /> Actualizar
                                        </button>
                                    </div>

                                    {orders.length === 0 ? (
                                        <div className="py-16 text-center bg-slate-950/40 rounded-2xl border border-slate-800">
                                            <ShoppingBag size={48} className="mx-auto text-slate-600 mb-3" />
                                            <p className="text-slate-400 text-sm font-semibold">Aún no tienes pedidos registrados.</p>
                                            <button
                                                onClick={() => router.push('/catalogo')}
                                                className="mt-4 bg-sky-500 hover:bg-sky-400 text-white font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider"
                                            >
                                                Explorar Catálogo
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {orders.map((order: any) => {
                                                const progress = getOrderProgress(order);
                                                const steps = ['Pedido generado', 'Pase a Caja', 'Entregado'];

                                                return (
                                                    <div key={order.id} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition-all">
                                                        <div className="flex flex-wrap justify-between items-start gap-2 border-b border-slate-800 pb-3">
                                                            <div>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Folio</span>
                                                                <p className="text-sm font-mono font-bold text-white">{order.id}</p>
                                                                <p className="text-[11px] text-slate-400 mt-0.5">
                                                                    {new Date(order.date).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                                                                </p>
                                                            </div>

                                                            <div className="text-right">
                                                                <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full border ${
                                                                    progress.isCancelled
                                                                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                                                        : progress.activeStep === 2
                                                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                                            : progress.activeStep === 1
                                                                                ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                                                                                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                                                }`}>
                                                                    {progress.isCancelled ? 'Cancelado' : steps[progress.activeStep]}
                                                                </span>
                                                                <p className="text-lg font-black text-white mt-1">
                                                                    ${Number(order.total || 0).toFixed(2)} MXN
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Timeline de Etapas */}
                                                        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold uppercase tracking-wider">
                                                            {steps.map((step, idx) => (
                                                                <div 
                                                                    key={step} 
                                                                    className={`pb-1.5 border-b-2 ${idx <= progress.activeStep ? 'border-sky-400 text-sky-300' : 'border-slate-800 text-slate-600'}`}
                                                                >
                                                                    {step}
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <p className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                                                            💡 {progress.detail}
                                                        </p>

                                                        {/* Lista de Artículos */}
                                                        {order.items && order.items.length > 0 && (
                                                            <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-800 space-y-1.5 text-xs">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                                                                    Productos ({order.items.length}):
                                                                </span>
                                                                {order.items.map((i: any, idx: number) => (
                                                                    <div key={idx} className="flex justify-between text-slate-300">
                                                                        <span>{i.cantidad || i.quantity}x {i.product?.name || i.name || 'Producto'}</span>
                                                                        <span className="font-mono text-slate-400">${Number((i.precio || i.price || 0) * (i.cantidad || i.quantity || 1)).toFixed(2)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Historial de Eventos del Pedido */}
                                                        {order.events && order.events.length > 0 && (
                                                            <details className="text-xs text-slate-400 pt-2 border-t border-slate-800">
                                                                <summary className="cursor-pointer font-bold text-sky-400 hover:text-sky-300">
                                                                    Ver Historial Completo de Eventos ({order.events.length})
                                                                </summary>
                                                                <ol className="mt-3 space-y-2 border-l border-slate-700 pl-4">
                                                                    {order.events.map((event: any) => (
                                                                        <li key={event.id} className="text-xs text-slate-300">
                                                                            <span className="font-semibold">{getOrderEventLabel(event.eventType)}</span>
                                                                            <span className="text-slate-500"> · {event.actorName} · {new Date(event.createdAt).toLocaleString('es-MX')}</span>
                                                                        </li>
                                                                    ))}
                                                                </ol>
                                                            </details>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </motion.div>
                            )}

                        </AnimatePresence>
                    </div>

                </div>

            </div>
        </div>
    );
}
