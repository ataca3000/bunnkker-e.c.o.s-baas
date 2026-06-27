"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, ShoppingBag, LogOut, FileText, Phone, Lock, Save, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
                fetchProfile();
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
                alert('Perfil actualizado correctamente');
                fetchProfile();
            } else {
                alert('Error al guardar perfil');
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
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <User size={32} className="text-blue-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800">Acceso a Clientes</h1>
                        <p className="text-gray-500 text-sm mt-2">Ingresa tu número para ver tus compras y facturas</p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-4">
                        {isRegistering && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-3 border rounded-xl" placeholder="Juan Pérez" />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono Móvil (10 dígitos)</label>
                            <div className="relative">
                                <Phone size={18} className="absolute left-3 top-3.5 text-gray-400" />
                                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required maxLength={10} className="w-full p-3 pl-10 border rounded-xl" placeholder="5551234567" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">PIN de Seguridad (4 dígitos)</label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-3 top-3.5 text-gray-400" />
                                <input type="password" value={pin} onChange={e => setPin(e.target.value)} required maxLength={4} className="w-full p-3 pl-10 border rounded-xl" placeholder="••••" />
                            </div>
                        </div>

                        {authError && <p className="text-red-500 text-sm font-bold text-center">{authError}</p>}

                        <button type="submit" className="w-full bg-blue-600 text-white font-bold p-3 rounded-xl hover:bg-blue-700 transition">
                            {isRegistering ? 'Crear mi cuenta' : 'Entrar a mi cuenta'}
                        </button>
                    </form>

                    <p className="text-center text-sm text-gray-500 mt-6">
                        {isRegistering ? '¿Ya tienes cuenta?' : '¿Eres nuevo aquí?'}
                        <button onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} className="text-blue-600 font-bold ml-1">
                            {isRegistering ? 'Inicia sesión' : 'Regístrate'}
                        </button>
                    </p>
                </div>
                <button onClick={() => router.push('/catalogo')} className="mt-8 text-gray-500 font-bold hover:text-gray-800">Volver al Catálogo</button>
            </div>
        );
    }

    // PANTALLA DE PERFIL
    return (
        <div className="min-h-screen bg-[#F8F9FA] py-12 px-4">
            <div className="max-w-[1000px] mx-auto grid grid-cols-1 md:grid-cols-[minmax(250px,1fr)_3fr] gap-8">
                
                {/* Sidebar Navigation */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 self-start">
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-[#2563EB] text-white rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold">
                            {customer.name?.charAt(0) || 'C'}
                        </div>
                        <h2 className="text-xl font-bold m-0">{customer.name}</h2>
                        <p className="text-gray-500 text-sm">{customer.phone}</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <button onClick={() => setActiveTab('orders')} className={`px-4 py-2.5 text-left rounded-lg border-none flex items-center gap-3 transition-colors ${activeTab === 'orders' ? 'bg-[#2563EB] text-white font-bold' : 'bg-transparent text-gray-700 cursor-pointer hover:bg-gray-50'}`}>
                            <ShoppingBag size={18} /> Mis Compras
                        </button>
                        <button onClick={() => setActiveTab('profile')} className={`px-4 py-2.5 text-left rounded-lg border-none flex items-center gap-3 transition-colors ${activeTab === 'profile' ? 'bg-[#2563EB] text-white font-bold' : 'bg-transparent text-gray-700 cursor-pointer hover:bg-gray-50'}`}>
                            <FileText size={18} /> Datos de Facturación
                        </button>
                        <hr className="my-4 border-gray-100" />
                        <button onClick={handleLogout} className="px-4 py-2.5 text-left rounded-lg border-none bg-red-50 text-red-600 cursor-pointer flex items-center gap-3 font-bold transition-colors hover:bg-red-100">
                            <LogOut size={18} /> Salir (Ir al Catálogo)
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    <AnimatePresence mode="wait">
                        {activeTab === 'orders' && (
                            <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <h3 className="text-2xl font-bold mb-6 text-[#1a1a1a] flex items-center gap-3">
                                    <ShoppingBag color="#2563EB" /> Mis Compras (Tickets)
                                </h3>
                                {orders.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500">
                                        <p>Aún no tienes compras registradas en mostrador.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {orders.map((order: any) => (
                                            <div key={order.id} className="border border-gray-100 rounded-xl p-5 hover:shadow-md transition">
                                                <div className="flex justify-between items-start mb-3 border-b border-gray-50 pb-3">
                                                    <div>
                                                        <span className="text-xs text-gray-400 font-mono">{order.id}</span>
                                                        <p className="font-bold text-gray-800 mt-1">{new Date(order.date).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">{order.status}</span>
                                                        <p className="font-black text-lg mt-1">${order.total?.toFixed(2)}</p>
                                                    </div>
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    {order.items?.map((i: any) => (
                                                        <div key={i.id} className="flex justify-between mt-1">
                                                            <span>{i.cantidad}x {i.product?.name || 'Producto eliminado'}</span>
                                                            <span>${i.precio?.toFixed(2)}</span>
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
                                <h3 className="text-2xl font-bold mb-6 text-[#1a1a1a] flex items-center gap-3">
                                    <FileText color="#2563EB" /> Datos de Facturación (CFDI)
                                </h3>
                                <p className="text-sm text-gray-500 mb-6">Llena estos datos para que, cuando realices una compra, podamos enviarte tu factura de manera automática.</p>
                                
                                <form onSubmit={handleSaveProfile} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">RFC</label>
                                            <input type="text" value={profileData.rfc} onChange={e => setProfileData({...profileData, rfc: e.target.value})} className="w-full p-3 border rounded-xl uppercase" placeholder="XAXX010101000" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Razón Social</label>
                                            <input type="text" value={profileData.razonSocial} onChange={e => setProfileData({...profileData, razonSocial: e.target.value})} className="w-full p-3 border rounded-xl uppercase" placeholder="PÚBLICO EN GENERAL" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Régimen Fiscal</label>
                                            <select value={profileData.regimenFiscal} onChange={e => setProfileData({...profileData, regimenFiscal: e.target.value})} className="w-full p-3 border rounded-xl">
                                                <option value="">Selecciona...</option>
                                                <option value="601">601 - General de Ley Personas Morales</option>
                                                <option value="612">612 - Personas Físicas con Actividades Empresariales y Profesionales</option>
                                                <option value="626">626 - Régimen Simplificado de Confianza (RESICO)</option>
                                                <option value="616">616 - Sin obligaciones fiscales</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Uso de CFDI</label>
                                            <select value={profileData.usoCFDI} onChange={e => setProfileData({...profileData, usoCFDI: e.target.value})} className="w-full p-3 border rounded-xl">
                                                <option value="">Selecciona...</option>
                                                <option value="G01">G01 - Adquisición de mercancías</option>
                                                <option value="G03">G03 - Gastos en general</option>
                                                <option value="S01">S01 - Sin efectos fiscales</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Código Postal (Fiscal)</label>
                                            <input type="text" value={profileData.codigoPostal} onChange={e => setProfileData({...profileData, codigoPostal: e.target.value})} maxLength={5} className="w-full p-3 border rounded-xl" placeholder="12345" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Dirección de Entrega</label>
                                            <input type="text" value={profileData.address} onChange={e => setProfileData({...profileData, address: e.target.value})} className="w-full p-3 border rounded-xl" placeholder="Calle, Colonia, Ciudad" />
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-gray-100 mt-6">
                                        <button type="submit" disabled={savingProfile} className="flex items-center gap-2 bg-[#2563EB] text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50">
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
