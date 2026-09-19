"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, ShoppingBag, LogOut, FileText, Phone, Lock, Save, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';

export default function UserAccount() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('orders');
    
    // Auth State
    const [loading, setLoading] = useState(true);
    const [customer, setCustomer] = useState<any>(null);
    const [orders, setOrders] = useState<any[]>([]);

    // Login State
    const [phone, setPhone] = useState('');
    const [pin, setPin] = useState('');
    const [name, setName] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [authError, setAuthError] = useState('');

    // Profile State (Facturacion)
    const [profileData, setProfileData] = useState({
        rfc: '',
        razonSocial: '',
        regimenFiscal: '',
        usoCFDI: '',
        codigoPostal: '',
        address: ''
    });
    const [savingProfile, setSavingProfile] = useState(false);

    const fetchProfile = useCallback(async () => {
        try {
            const res = await fetch('/api/customer/me');
            const data = await res.json();
            if (data.success) {
                setCustomer(data.customer);
                setOrders(data.customer.orders || []);
                setProfileData({
                    rfc: data.customer.rfc || '',
                    razonSocial: data.customer.razonSocial || '',
                    regimenFiscal: data.customer.regimenFiscal || '',
                    usoCFDI: data.customer.usoCFDI || '',
                    codigoPostal: data.customer.codigoPostal || '',
                    address: data.customer.address || ''
                });
            } else {
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
        try {
            const res = await fetch('/api/customer/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    phone, 
                    pin, 
                    action: isRegistering ? 'register' : 'login',
                    name: isRegistering ? name : undefined 
                })
            });
            const data = await res.json();
            if (data.success) {
                if (data.redirect) {
                    window.location.href = data.redirect;
                } else {
                    fetchProfile();
                }
            } else {
                setAuthError(data.error);
            }
        } catch (err) {
            setAuthError('Error de conexión');
        }
    };

    const handleLogout = async () => {
        // En un caso real, borraríamos la cookie llamando a una API de logout
        // Por ahora lo mandamos al catálogo o se puede limpiar la cookie
        document.cookie = "admincom_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        window.location.href = '/catalogo';
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);
        try {
            const res = await fetch('/api/customer/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData)
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Perfil actualizado correctamente', '✅ Éxito');
                fetchProfile();
            } else {
                toast.error('Error al guardar el perfil');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSavingProfile(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32}/></div>;
    }

    // PANTALLA DE LOGIN / REGISTRO
    if (!customer) {
        return (
            <div className="min-h-screen bg-[#0a0514] flex flex-col items-center justify-center p-4 relative overflow-hidden">
                {/* Background glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/10 blur-[120px] rounded-full pointer-events-none"></div>

                <div className="bg-slate-900/60 backdrop-blur-2xl border border-slate-700/50 p-8 rounded-[32px] shadow-2xl shadow-black/50 w-full max-w-md relative z-10">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-tr from-sky-500 to-indigo-500 rounded-[20px] shadow-lg shadow-sky-500/20 flex items-center justify-center mx-auto mb-5">
                            <User size={32} className="text-white" />
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight">Acceso a Clientes</h1>
                        <p className="text-slate-400 text-sm mt-2 font-medium">Ingresa tu número para ver tus compras y facturas</p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-4">
                        {isRegistering && (
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest ml-1">Nombre Completo</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-4 bg-slate-800/80 border border-slate-700 text-white rounded-2xl focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all" placeholder="Ej. Juan Pérez" />
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest ml-1">Teléfono Móvil (10 dígitos)</label>
                            <div className="relative">
                                <Phone size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required maxLength={10} className="w-full p-4 pl-12 bg-slate-800/80 border border-slate-700 text-white rounded-2xl focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all font-mono tracking-wider" placeholder="5551234567" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest ml-1">PIN de Seguridad (4 dígitos)</label>
                            <div className="relative">
                                <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="password" value={pin} onChange={e => setPin(e.target.value)} required maxLength={4} minLength={4} className="w-full p-4 pl-12 bg-slate-800/80 border border-slate-700 text-white rounded-2xl focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all font-mono tracking-widest text-lg" placeholder="••••" />
                            </div>
                        </div>
                        
                        {authError && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium rounded-xl text-center">{authError}</div>}
                        
                        <button type="submit" className="w-full bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-sky-500/25 active:scale-[0.98] uppercase tracking-widest text-sm mt-4">
                            {isRegistering ? 'Crear mi cuenta' : 'Entrar a mi cuenta'}
                        </button>
                    </form>

                    <div className="mt-8 text-center border-t border-slate-700/50 pt-6">
                        <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="text-slate-400 hover:text-white text-sm font-medium transition-colors">
                            {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿Eres nuevo aquí? '}
                            {!isRegistering && <span className="text-sky-400 font-bold hover:text-sky-300">Regístrate</span>}
                        </button>
                        
                        <div className="mt-4 pt-4 border-t border-slate-800">
                            {/* Hidden backdoor, no text link */}
                        </div>
                    </div>
                </div>
                <button onClick={() => router.push('/catalogo')} className="mt-8 text-slate-500 font-bold hover:text-slate-300">Volver al Catálogo</button>
            </div>
        );
    }

    // PANTALLA DE PERFIL
    return (
        <div className="min-h-screen bg-[#0a0514] py-12 px-4 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-sky-500/10 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="max-w-[1000px] mx-auto grid grid-cols-1 md:grid-cols-[minmax(250px,1fr)_3fr] gap-8 relative z-10">
                
                {/* Sidebar Navigation */}
                <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-700/50 p-6 self-start">
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-gradient-to-tr from-sky-500 to-indigo-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold shadow-lg shadow-sky-500/20">
                            {customer.name?.charAt(0) || 'C'}
                        </div>
                        <h2 className="text-xl font-bold text-white m-0">{customer.name}</h2>
                        <p className="text-slate-400 text-sm mt-1">{customer.phone}</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <button onClick={() => setActiveTab('orders')} className={`px-4 py-2.5 text-left rounded-lg border-none flex items-center gap-3 transition-colors ${activeTab === 'orders' ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/25' : 'bg-transparent text-slate-300 cursor-pointer hover:bg-slate-800'}`}>
                            <ShoppingBag size={18} /> Mis Compras
                        </button>
                        <button onClick={() => setActiveTab('profile')} className={`px-4 py-2.5 text-left rounded-lg border-none flex items-center gap-3 transition-colors ${activeTab === 'profile' ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/25' : 'bg-transparent text-slate-300 cursor-pointer hover:bg-slate-800'}`}>
                            <FileText size={18} /> Datos de Facturación
                        </button>
                        <hr className="my-4 border-slate-700/50" />
                        <button onClick={handleLogout} className="px-4 py-2.5 text-left rounded-lg border-none bg-red-500/10 text-red-400 cursor-pointer flex items-center gap-3 font-bold transition-colors hover:bg-red-500/20">
                            <LogOut size={18} /> Salir (Ir al Catálogo)
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-700/50 p-8">
                    <AnimatePresence mode="wait">
                        {activeTab === 'orders' && (
                            <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <h3 className="text-2xl font-bold mb-6 text-white flex items-center gap-3">
                                    <ShoppingBag className="text-sky-400" /> Mis Compras (Tickets)
                                </h3>
                                {orders.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500">
                                        <p>Aún no tienes compras registradas en mostrador.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {orders.map((order: any) => (
                                            <div key={order.id} className="border border-slate-700/50 bg-slate-800/40 rounded-xl p-5 hover:bg-slate-800/80 hover:shadow-lg hover:border-slate-600 transition-all">
                                                <div className="flex justify-between items-start mb-3 border-b border-slate-700/50 pb-3">
                                                    <div>
                                                        <span className="text-xs text-slate-500 font-mono">{order.id}</span>
                                                        <p className="font-bold text-slate-200 mt-1">{new Date(order.date).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-xs font-bold border border-emerald-500/20">{order.status}</span>
                                                        <p className="font-black text-lg text-white mt-1">${order.total?.toFixed(2)}</p>
                                                    </div>
                                                </div>
                                                <div className="text-sm text-slate-400">
                                                    {order.items?.map((i: any) => (
                                                        <div key={i.id} className="flex justify-between mt-1">
                                                            <span>{i.cantidad}x {i.product?.name || 'Producto eliminado'}</span>
                                                            <span className="text-slate-300">${i.precio?.toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {activeTab === 'profile' && (
                            <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <h3 className="text-2xl font-bold mb-6 text-white flex items-center gap-3">
                                    <FileText className="text-sky-400" /> Datos de Facturación (CFDI)
                                </h3>
                                <p className="text-sm text-slate-400 mb-6">Llena estos datos para que, cuando realices una compra, podamos enviarte tu factura de manera automática.</p>
                                
                                <form onSubmit={handleSaveProfile} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest ml-1 mb-1.5">RFC</label>
                                            <input type="text" value={profileData.rfc} onChange={e => setProfileData({...profileData, rfc: e.target.value})} className="w-full p-4 bg-slate-800/60 border border-slate-700 text-white rounded-2xl focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all uppercase placeholder-slate-600" placeholder="XAXX010101000" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest ml-1 mb-1.5">Razón Social</label>
                                            <input type="text" value={profileData.razonSocial} onChange={e => setProfileData({...profileData, razonSocial: e.target.value})} className="w-full p-4 bg-slate-800/60 border border-slate-700 text-white rounded-2xl focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all uppercase placeholder-slate-600" placeholder="PÚBLICO EN GENERAL" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest ml-1 mb-1.5">Régimen Fiscal</label>
                                            <select value={profileData.regimenFiscal} onChange={e => setProfileData({...profileData, regimenFiscal: e.target.value})} className="w-full p-4 bg-slate-800/60 border border-slate-700 text-white rounded-2xl focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all appearance-none">
                                                <option value="" className="bg-slate-900">Selecciona...</option>
                                                <option value="601" className="bg-slate-900">601 - General de Ley Personas Morales</option>
                                                <option value="612" className="bg-slate-900">612 - Personas Físicas con Actividades Empresariales y Profesionales</option>
                                                <option value="626" className="bg-slate-900">626 - Régimen Simplificado de Confianza (RESICO)</option>
                                                <option value="616" className="bg-slate-900">616 - Sin obligaciones fiscales</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest ml-1 mb-1.5">Uso de CFDI</label>
                                            <select value={profileData.usoCFDI} onChange={e => setProfileData({...profileData, usoCFDI: e.target.value})} className="w-full p-4 bg-slate-800/60 border border-slate-700 text-white rounded-2xl focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all appearance-none">
                                                <option value="" className="bg-slate-900">Selecciona...</option>
                                                <option value="G01" className="bg-slate-900">G01 - Adquisición de mercancías</option>
                                                <option value="G03" className="bg-slate-900">G03 - Gastos en general</option>
                                                <option value="S01" className="bg-slate-900">S01 - Sin efectos fiscales</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest ml-1 mb-1.5">Código Postal (Fiscal)</label>
                                            <input type="text" value={profileData.codigoPostal} onChange={e => setProfileData({...profileData, codigoPostal: e.target.value})} maxLength={5} className="w-full p-4 bg-slate-800/60 border border-slate-700 text-white rounded-2xl focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all placeholder-slate-600" placeholder="12345" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest ml-1 mb-1.5">Dirección de Entrega</label>
                                            <input type="text" value={profileData.address} onChange={e => setProfileData({...profileData, address: e.target.value})} className="w-full p-4 bg-slate-800/60 border border-slate-700 text-white rounded-2xl focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all placeholder-slate-600" placeholder="Calle, Colonia, Ciudad" />
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-slate-700/50 mt-8">
                                        <button type="submit" disabled={savingProfile} className="flex items-center justify-center gap-2 w-full md:w-auto bg-gradient-to-r from-sky-500 to-indigo-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:from-sky-400 hover:to-indigo-400 transition-all shadow-lg shadow-sky-500/25 active:scale-[0.98] disabled:opacity-50">
                                            {savingProfile ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                            Guardar Perfil
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
